"""phase5.py -- statistics, controls, ablations, T4/T5-driven looming, forward flight.
usage: python phase5.py main real | main shuffle <seed> | robust | ablate | t4t5 | forward
"""
import os, sys, json, time, itertools
os.chdir(os.path.expanduser('~/Drosophila_brain_model'))
import numpy as np, pandas as pd
from brian2 import ms, seed as b2seed
from flybrain_step import FlyBrain
from flydrone import Quad, Autopilot, Retina, Bridge, ZERO_SP, d2r, G
DT, SUB = 0.02, 20
OUT = 'results/phase5'; os.makedirs(OUT, exist_ok=True)
L = json.load(open('celltype_ids_783.json'))
VIS = ['LPLC2_left','LPLC2_right','LC4_left','LC4_right'] + [f'T{t}{s}_{side}' for t in (4,5) for s in 'abcd' for side in ('left','right')]
READ = list(Bridge.GROUPS) + ['LPLC2_left','LPLC2_right','LC4_left','LC4_right','LC6_left','LC6_right','LPLC1_left','LPLC1_right']
SIZES = {g: len(L[g]) for g in Bridge.GROUPS if not g.startswith('DN_all')}

def random_readout_groups(seed):
    """Random DN neurons of the same side and count as each real read-out group (random read-out control)."""
    rng = np.random.default_rng(seed); out = {}
    for g, n in SIZES.items():
        side = 'left' if g.endswith('left') else 'right'
        out[f'rand{seed}_{g}'] = [int(x) for x in rng.choice(L[f'DN_all_{side}'], n, replace=False)]
    return out

class Bridge2(Bridge):
    def __init__(self, fb, m, keymap=None, drop=(), **kw):
        super().__init__(fb, m, **kw); self.keymap = keymap or {}; self.drop = tuple(drop)
    def update(self, out):
        e = self.ema
        for g in self.GROUPS:
            k = self.keymap.get(g, g); r = self.fb.rate_hz(out, k) if k in self.fb.readout_groups else 0.0
            e[g] += self.a*(r - e[g])
        z = lambda g: 0.0 if any(g.startswith(d) for d in self.drop) else e[g]
        turn = ((z('DNa02_right')-z('DNa02_left')) + (z('DNa01_right')-z('DNa01_left')) + (z('DNb01_right')-z('DNb01_left'))
                + 0.5*(z('DNp03_left')+z('DNp11_left')-z('DNp03_right')-z('DNp11_right')) + (z('DNg02_left')-z('DNg02_right')))/self.norm
        turn = float(np.clip(turn, -1, 1))
        gf = 0.0 if 'DNp01' in self.drop else float(np.clip(0.5*(e['DNp01_left']+e['DNp01_right'])/100.0, 0, 1))
        return dict(roll_sp=self.roll_max*turn, pitch_sp=0.0, yawrate_sp=-self.yawrate_max*turn, thrust_extra=self.climb*self.m*G*gf, turn=turn, gf=gf)

def fly(fb, objects, T=3.5, brain=True, seed=0, keymap=None, drop=(), inputs_only=None, cruise_pitch=0.0, log=False):
    """objects: list of dict(p=[x,y,z], v=[vx,vy,vz], r=radius). Retina drive = sum over objects."""
    q = Quad(); ap = Autopilot(q); br = Bridge2(fb, q.m, keymap=keymap, drop=drop) if brain else None
    rets = [Retina() for _ in objects]; ps = [np.array(o['p'], float) for o in objects]; vs = [np.array(o['v'], float) for o in objects]
    if brain: fb.reset(); b2seed(seed)
    rows, mind, sp = [], 1e9, dict(ZERO_SP)
    for k in range(int(T/DT)):
        rates = {g: 0.0 for g in ['LPLC2_left','LPLC2_right','LC4_left','LC4_right']}; geo = []
        for ret, p, o in zip(rets, ps, objects):
            r, g = ret.looming(q, p, o['r']); geo.append(g)
            for kk in rates: rates[kk] += r[kk]
        rates = {kk: min(150.0, v) for kk, v in rates.items()}
        if inputs_only: rates = {kk: (v if kk.split('_')[0] in inputs_only else 0.0) for kk, v in rates.items()}
        out = None
        if brain:
            fb.set_rates(rates); out = fb.step(); sp = br.update(out)
        sp['pitch_sp'] = cruise_pitch
        for _ in range(SUB):
            thrust, tau = ap(sp); q.step(thrust, tau)
            for i in range(len(ps)):
                ps[i] = ps[i] + vs[i]*q.dt; mind = min(mind, np.linalg.norm(ps[i] - q.p) - 0.0)
        roll, pitch, yaw = q.euler()
        rows.append(dict(t=q.t, x=q.p[0], y=q.p[1], z=q.p[2], yaw=np.rad2deg(yaw), roll=np.rad2deg(roll), turn=sp['turn'], gf=sp['gf'],
                         drive=max(g['drive'] for g in geo) if geo else 0.0, nact=(out['_n_active'] if out else 0),
                         **({g: br.ema[g] for g in Bridge.GROUPS} if brain else {})))
    df = pd.DataFrame(rows)
    s = dict(min_dist=float(mind), final_y=float(df.y.iloc[-1]), final_x=float(df.x.iloc[-1]), final_yaw=float(df.yaw.iloc[-1]),
             peak_turn=float(df.turn.abs().max()), mean_abs_turn=float(df.turn.abs().mean()), peak_gf=float(df.gf.max()), max_active=int(df.nact.max()))
    return (df if log else None), s

def loom_obj(az_deg, v=2.0, r=0.3, d0=6.0):
    a = d2r(az_deg); p = np.array([d0*np.cos(a), d0*np.sin(a), 2.0]); return dict(p=p, v=(np.array([0, 0, 2.0]) - p)/d0*v, r=r)

def build(shuffle=None, extra_readout=None):
    readout = {k: L[k] for k in READ}; readout.update(extra_readout or {})
    t0 = time.time(); fb = FlyBrain('./Completeness_783.csv', './Connectivity_783.parquet', {k: L[k] for k in VIS}, readout, dt_ctrl=DT*1000*ms, shuffle_seed=shuffle)
    fb.step(); fb.reset(); print(f'brain ready ({"shuffle %d" % shuffle if shuffle is not None else "real"}) in {time.time()-t0:.0f}s', flush=True); return fb

def save(name, recs): pd.DataFrame(recs).to_csv(f'{OUT}/{name}.csv', index=False); print(f'saved {OUT}/{name}.csv ({len(recs)} rows)', flush=True)

# ---------------------------------------------------------------- main comparison (n=10, bearings +-30)
def main_real():
    extra = {}; [extra.update(random_readout_groups(s)) for s in (1, 2, 3)]
    fb = build(extra_readout=extra); recs = []
    for az in (30, -30):
        _, s = fly(fb, [loom_obj(az)], brain=False); recs.append(dict(cond='nobrain', az=az, trial=0, **s))
    for cond in ['real', 'rand1', 'rand2', 'rand3']:
        keymap = None if cond == 'real' else {g: f'{cond}_{g}' for g in SIZES}
        for az in (30, -30):
            for trial in range(10):
                t0 = time.time(); _, s = fly(fb, [loom_obj(az)], seed=100*trial+(az+90)+7, keymap=keymap)
                recs.append(dict(cond=cond, az=az, trial=trial, **s)); print(f'[main] {cond} az{az:+d} t{trial} min={s["min_dist"]:.2f} turn={s["peak_turn"]:.2f} ({time.time()-t0:.0f}s)', flush=True)
        save('main', recs)

def main_shuffle(seed):
    fb = build(shuffle=seed); recs = []
    for az in (30, -30):
        for trial in range(10):
            t0 = time.time(); _, s = fly(fb, [loom_obj(az)], seed=100*trial+(az+90)+7)
            recs.append(dict(cond=f'shuffle{seed}', az=az, trial=trial, **s)); print(f'[main] shuffle{seed} az{az:+d} t{trial} min={s["min_dist"]:.2f} turn={s["peak_turn"]:.2f} ({time.time()-t0:.0f}s)', flush=True)
    save(f'main_shuffle{seed}', recs)

# ---------------------------------------------------------------- robustness sweep (real brain, n=3)
def robust():
    fb = build(); recs = []
    for az, v, r in itertools.product([-45, -30, -15, 15, 30, 45], [1.0, 2.0, 3.0], [0.2, 0.3, 0.45]):
        T = 6.0/v + 1.0
        _, s0 = fly(fb, [loom_obj(az, v, r)], T=T, brain=False); recs.append(dict(cond='nobrain', az=az, v=v, r=r, trial=0, **s0))
        for trial in range(3):
            t0 = time.time(); _, s = fly(fb, [loom_obj(az, v, r)], T=T, seed=1000+trial*37+(az+90)+int(v*10)+int(r*100))
            recs.append(dict(cond='real', az=az, v=v, r=r, trial=trial, **s)); print(f'[robust] az{az:+d} v{v} r{r} t{trial} min={s["min_dist"]:.2f} ({time.time()-t0:.0f}s)', flush=True)
        save('robust', recs)

# ---------------------------------------------------------------- ablations (az +30, n=5)
def ablate():
    fb = build(); recs = []
    variants = {'full': {}, 'drop_DNp01': dict(drop=('DNp01',)), 'drop_DNa02': dict(drop=('DNa02',)), 'drop_DNa01_DNb01': dict(drop=('DNa01', 'DNb01')),
                'drop_DNp03_DNp11': dict(drop=('DNp03', 'DNp11')), 'drop_DNg02': dict(drop=('DNg02',)), 'drop_all_steering': dict(drop=('DNa02', 'DNa01', 'DNb01', 'DNp03', 'DNp11', 'DNg02')),
                'input_LC4_only': dict(inputs_only=('LC4',)), 'input_LPLC2_only': dict(inputs_only=('LPLC2',))}
    for name, kw in variants.items():
        for trial in range(5):
            t0 = time.time(); _, s = fly(fb, [loom_obj(30)], seed=500+trial, **kw)
            recs.append(dict(variant=name, trial=trial, **s)); print(f'[ablate] {name} t{trial} min={s["min_dist"]:.2f} turn={s["peak_turn"]:.2f} gf={s["peak_gf"]:.2f} ({time.time()-t0:.0f}s)', flush=True)
        save('ablate', recs)

# ---------------------------------------------------------------- T4/T5-driven looming (open loop, 1 s, n=4)
def t4t5():
    fb = build(); recs = []
    def grp(subs, side='left'): return [f'T{t}{s}_{side}' for t in (4, 5) for s in subs]
    stimuli = {'T4T5_abcd_L': grp('abcd'), 'T4T5_a_L': grp('a'), 'T4T5_b_L': grp('b'), 'T4T5_ab_L': grp('ab'), 'T4T5_cd_L': grp('cd'),
               'T4T5_abcd_R': grp('abcd', 'right'), 'LPLC2_L': ['LPLC2_left'], 'LC4_L': ['LC4_left']}
    for name, groups in stimuli.items():
        for rate in (50.0, 100.0):
            for trial in range(4):
                fb.reset(); b2seed(900+trial); fb.set_rates({g: 0.0 for g in VIS}); fb.set_rates({g: rate for g in groups})
                tot = {g: 0 for g in READ}; nact = 0; t0 = time.time()
                for k in range(50):
                    out = fb.step(); nact = max(nact, out['_n_active'])
                    for g in READ: tot[g] += out[g]
                rec = dict(stim=name, rate=rate, trial=trial, max_active=nact, **{g: tot[g]/len(fb.readout_groups[g]) for g in READ})
                rec['dn_active'] = int(sum(1 for gg in ('DN_all_left', 'DN_all_right') for c in out['_per_neuron'][gg] if c > 0))
                recs.append(rec); print(f'[t4t5] {name} {rate:.0f}Hz t{trial}: LPLC2 L/R {rec["LPLC2_left"]:.1f}/{rec["LPLC2_right"]:.1f}  LC4 L/R {rec["LC4_left"]:.1f}/{rec["LC4_right"]:.1f}  GF {rec["DNp01_left"]:.0f}/{rec["DNp01_right"]:.0f}  DNa02 {rec["DNa02_left"]:.0f}/{rec["DNa02_right"]:.0f}  DNp11 {rec["DNp11_left"]:.0f}/{rec["DNp11_right"]:.0f} active={nact} ({time.time()-t0:.0f}s)', flush=True)
            save('t4t5', recs)

# ---------------------------------------------------------------- forward flight (cruise, static obstacles)
def forward():
    fb = build(); recs = []
    courses = {'empty': [], 'headon_static': [dict(p=[8, 0, 2.0], v=[0, 0, 0], r=0.3)],
               'gauntlet_offset': [dict(p=[4, 1.2, 2.0], v=[0, 0, 0], r=0.3), dict(p=[7, -1.2, 2.0], v=[0, 0, 0], r=0.3), dict(p=[10, 1.2, 2.0], v=[0, 0, 0], r=0.3)]}
    for name, objs in courses.items():
        _, s0 = fly(fb, [dict(o) for o in objs], T=9.0, brain=False, cruise_pitch=d2r(3)); recs.append(dict(course=name, cond='nobrain', trial=0, **s0))
        print(f'[forward] {name} nobrain: min={s0["min_dist"]:.2f} x={s0["final_x"]:.1f} y={s0["final_y"]:+.2f}', flush=True)
        for trial in range(3):
            t0 = time.time(); df, s = fly(fb, [dict(o) for o in objs], T=9.0, seed=700+trial, cruise_pitch=d2r(3), log=True)
            recs.append(dict(course=name, cond='real', trial=trial, **s)); df.to_csv(f'{OUT}/forward_{name}_t{trial}.csv', index=False)
            print(f'[forward] {name} real t{trial}: min={s["min_dist"]:.2f} x={s["final_x"]:.1f} y={s["final_y"]:+.2f} yaw={s["final_yaw"]:+.0f} mean|turn|={s["mean_abs_turn"]:.2f} ({time.time()-t0:.0f}s)', flush=True)
        save('forward', recs)

def main_rand(seed):
    fb = build(extra_readout=random_readout_groups(seed)); recs = []; keymap = {g: f'rand{seed}_{g}' for g in SIZES}
    for az in (30, -30):
        for trial in range(10):
            t0 = time.time(); _, s = fly(fb, [loom_obj(az)], seed=100*trial+(az+90)+7, keymap=keymap)
            recs.append(dict(cond=f'rand{seed}', az=az, trial=trial, **s)); print(f'[main] rand{seed} az{az:+d} t{trial} min={s["min_dist"]:.2f} turn={s["peak_turn"]:.2f} ({time.time()-t0:.0f}s)', flush=True)
    save(f'main_rand{seed}', recs)

if __name__ == '__main__':
    cmd = sys.argv[1]
    {'main': lambda: main_real() if sys.argv[2] == 'real' else (main_rand(int(sys.argv[3])) if sys.argv[2] == 'rand' else main_shuffle(int(sys.argv[3]))), 'robust': robust, 'ablate': ablate, 't4t5': t4t5, 'forward': forward}[cmd]()
    print(f'PHASE5 {" ".join(sys.argv[1:])} DONE', flush=True)


