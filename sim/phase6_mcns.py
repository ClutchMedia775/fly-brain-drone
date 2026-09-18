"""phase6_mcns.py -- replicate on MaleCNS v1.0 (brain + nerve cord). usage: python phase6_mcns.py openloop | fly | shuffle"""
import os, sys, json, time
os.chdir(os.path.expanduser('~/Drosophila_brain_model'))
import numpy as np, pandas as pd
from brian2 import ms, seed as b2seed
from flybrain_step import FlyBrain
from flydrone import Quad, Autopilot, Retina, Bridge, ZERO_SP, d2r, G
D = os.path.expanduser('~/malecns'); OUT = 'results/phase6'; os.makedirs(OUT, exist_ok=True)
M = json.load(open(f'{D}/celltype_ids_mcns.json')); DT, SUB = 0.02, 20
VIS = ['LPLC2_left','LPLC2_right','LC4_left','LC4_right'] + [f'T{t}{s}_{side}' for t in (4,5) for s in 'abcd' for side in ('left','right')]
STEER = ['b1','b2','b3','i1','i2','iii1','iii3','hg1','hg2','hg3','hg4','tp1','tp2','tpn','ps1','ps2']
READ = list(Bridge.GROUPS) + ['LPLC2_left','LPLC2_right','LC4_left','LC4_right','MN_all_left','MN_all_right','MNsteer_left','MNsteer_right','MNpower_left','MNpower_right','TTMn_left','TTMn_right','DNp06_left','DNp06_right','DNp09_left','DNp09_right'] + [f'{m}_{s}' for m in STEER for s in ('left','right')]

def build(shuffle=None):
    t0 = time.time(); fb = FlyBrain(f'{D}/Completeness_mcns.csv', f'{D}/Connectivity_mcns.parquet', {k: M[k] for k in VIS}, {k: M[k] for k in READ}, dt_ctrl=DT*1000*ms, shuffle_seed=shuffle)
    fb.step(); fb.reset(); print(f'MaleCNS brain ready ({len(fb.neu)} neurons, {len(fb.syn)} synapses, shuffle={shuffle}) in {time.time()-t0:.0f}s', flush=True); return fb

class MNBridge(Bridge):
    """Read-out from wing motor neurons instead of descending neurons. Ipsilateral steering-muscle drive raises that wing's
    stroke amplitude and turns the fly the other way (Lindsay 2017, Melis 2024), so turn_right = (left - right)."""
    def __init__(self, fb, m, norm=15.0, **kw): super().__init__(fb, m, norm=norm, **kw); self.ema.update({g: 0.0 for g in ['MNsteer_left','MNsteer_right','TTMn_left','TTMn_right']})
    def update(self, out):
        e = self.ema
        for g in ['MNsteer_left','MNsteer_right','TTMn_left','TTMn_right'] + list(self.GROUPS): e[g] += self.a*(self.fb.rate_hz(out, g) - e[g])
        turn = float(np.clip((e['MNsteer_left'] - e['MNsteer_right'])/self.norm, -1, 1))
        gf = float(np.clip(0.5*(e['TTMn_left'] + e['TTMn_right'])/100.0, 0, 1))
        return dict(roll_sp=self.roll_max*turn, pitch_sp=0.0, yawrate_sp=-self.yawrate_max*turn, thrust_extra=self.climb*self.m*G*gf, turn=turn, gf=gf)

def fly(fb, objects, bridge='dn', T=3.5, brain=True, seed=0, disturb=None):
    q = Quad(); ap = Autopilot(q); br = (MNBridge(fb, q.m) if bridge == 'mn' else Bridge(fb, q.m)) if brain else None
    rets = [Retina() for _ in objects]; ps = [np.array(o['p'], float) for o in objects]; vs = [np.array(o['v'], float) for o in objects]
    if brain: fb.reset(); b2seed(seed)
    rows, mind, sp = [], 1e9, dict(ZERO_SP)
    tau_dist = np.array([0, 0, q.I[2]*ap.kd_yaw*d2r(90)]) if disturb else None
    for k in range(int(T/DT)):
        rates = {g: 0.0 for g in VIS}
        for ret, p, o in zip(rets, ps, objects):
            r, g = ret.looming(q, p, o['r'])
            for kk in r: rates[kk] += r[kk]
        if disturb: rates.update(Retina().rotation(q))
        out = None
        if brain: fb.set_rates(rates); out = fb.step(); sp = br.update(out)
        for _ in range(SUB):
            thrust, tau = ap(sp); q.step(thrust, tau, tau_dist if (disturb and 0.5 <= q.t < 1.5) else None)
            for i in range(len(ps)): ps[i] = ps[i] + vs[i]*q.dt; mind = min(mind, np.linalg.norm(ps[i] - q.p))
        roll, pitch, yaw = q.euler()
        rows.append(dict(t=q.t, x=q.p[0], y=q.p[1], z=q.p[2], yaw=np.rad2deg(yaw), wz=np.rad2deg(q.w[2]), turn=sp['turn'], gf=sp['gf'], nact=(out['_n_active'] if out else 0),
                         **({g: br.ema[g] for g in br.ema} if brain else {})))
    df = pd.DataFrame(rows)
    s = dict(min_dist=float(mind), final_y=float(df.y.iloc[-1]), final_yaw=float(df.yaw.iloc[-1]), peak_turn=float(df.turn.abs().max()), peak_gf=float(df.gf.max()), max_active=int(df.nact.max()))
    return df, s

def loom_obj(az_deg, v=2.0, r=0.3, d0=6.0):
    a = d2r(az_deg); p = np.array([d0*np.cos(a), d0*np.sin(a), 2.0]); return dict(p=p, v=(np.array([0, 0, 2.0]) - p)/d0*v, r=r)

def openloop():
    fb = build(); recs = []; per = []
    def grp(subs, side='left'): return [f'T{t}{s}_{side}' for t in (4, 5) for s in subs]
    stimuli = {'LPLC2_L': ['LPLC2_left'], 'LC4_L': ['LC4_left'], 'LPLC2_R': ['LPLC2_right'], 'T4T5_abcd_L': grp('abcd'), 'T4T5_a_L': grp('a'), 'baseline': []}
    for name, groups in stimuli.items():
        for trial in range(4):
            fb.reset(); b2seed(300+trial); fb.set_rates({g: 0.0 for g in VIS}); fb.set_rates({g: 100.0 for g in groups})
            tot = {g: 0 for g in READ}; pn = {g: 0 for g in ['DN_all_left','DN_all_right','MN_all_left','MN_all_right']}; nact = 0; t0 = time.time()
            for k in range(50):
                out = fb.step(); nact = max(nact, out['_n_active'])
                for g in READ: tot[g] += out[g]
                for g in pn: pn[g] = pn[g] + out['_per_neuron'][g]
            rec = dict(stim=name, trial=trial, max_active=nact, **{g: tot[g]/len(fb.readout_groups[g]) for g in READ}); recs.append(rec)
            for g in pn:
                for i, c in zip(fb.readout_groups[g], pn[g]):
                    if c: per.append(dict(stim=name, trial=trial, group=g, neuron=int(i), rate=float(c)))
            print(f'[mcns] {name} t{trial}: LPLC2 {rec["LPLC2_left"]:.0f}/{rec["LPLC2_right"]:.0f} GF {rec["DNp01_left"]:.0f}/{rec["DNp01_right"]:.0f} DNa02 {rec["DNa02_left"]:.0f}/{rec["DNa02_right"]:.0f} DNp11 {rec["DNp11_left"]:.0f}/{rec["DNp11_right"]:.0f} DNg02 {rec["DNg02_left"]:.0f}/{rec["DNg02_right"]:.0f} | MNsteer {rec["MNsteer_left"]:.1f}/{rec["MNsteer_right"]:.1f} MNpower {rec["MNpower_left"]:.1f}/{rec["MNpower_right"]:.1f} TTMn {rec["TTMn_left"]:.0f}/{rec["TTMn_right"]:.0f} b1 {rec["b1_left"]:.0f}/{rec["b1_right"]:.0f} i1 {rec["i1_left"]:.0f}/{rec["i1_right"]:.0f} active={nact} ({time.time()-t0:.0f}s)', flush=True)
        pd.DataFrame(recs).to_csv(f'{OUT}/openloop.csv', index=False); pd.DataFrame(per).to_csv(f'{OUT}/openloop_perneuron.csv', index=False)
    print('saved openloop', flush=True)

def flights():
    fb = build(); recs = []
    for az in (30, -30):
        _, s = fly(fb, [loom_obj(az)], brain=False); recs.append(dict(cond='nobrain', bridge='-', az=az, trial=0, **s))
    for bridge in ('dn', 'mn'):
        for az in (30, -30):
            for trial in range(5):
                t0 = time.time(); df, s = fly(fb, [loom_obj(az)], bridge=bridge, seed=40+trial); recs.append(dict(cond='real', bridge=bridge, az=az, trial=trial, **s))
                if trial == 0: df.to_csv(f'{OUT}/loom_az{az:+d}_{bridge}.csv', index=False)
                print(f'[mcns fly] {bridge} az{az:+d} t{trial}: min={s["min_dist"]:.2f} y={s["final_y"]:+.2f} turn={s["peak_turn"]:.2f} gf={s["peak_gf"]:.2f} ({time.time()-t0:.0f}s)', flush=True)
            pd.DataFrame(recs).to_csv(f'{OUT}/flights.csv', index=False)
        for trial in range(3):
            t0 = time.time(); df, s = fly(fb, [], bridge=bridge, T=3.0, seed=60+trial, disturb=True); s['total_yaw'] = s['final_yaw']; recs.append(dict(cond='real', bridge=bridge, az='opto', trial=trial, **s))
            if trial == 0: df.to_csv(f'{OUT}/opto_{bridge}.csv', index=False)
            print(f'[mcns opto] {bridge} t{trial}: yaw={s["final_yaw"]:+.1f} turn={s["peak_turn"]:.2f} ({time.time()-t0:.0f}s)', flush=True)
        pd.DataFrame(recs).to_csv(f'{OUT}/flights.csv', index=False)
    _, s = fly(fb, [], brain=False, T=3.0, disturb=True); recs.append(dict(cond='nobrain', bridge='-', az='opto', trial=0, **s)); pd.DataFrame(recs).to_csv(f'{OUT}/flights.csv', index=False)
    print('saved flights', flush=True)

def shuffle():
    fb = build(shuffle=1); recs = []
    for az in (30, -30):
        for trial in range(5):
            t0 = time.time(); _, s = fly(fb, [loom_obj(az)], seed=40+trial); recs.append(dict(cond='shuffle1', bridge='dn', az=az, trial=trial, **s))
            print(f'[mcns shuffle] az{az:+d} t{trial}: min={s["min_dist"]:.2f} turn={s["peak_turn"]:.2f} ({time.time()-t0:.0f}s)', flush=True)
    for trial in range(3):
        _, s = fly(fb, [], T=3.0, seed=60+trial, disturb=True); recs.append(dict(cond='shuffle1', bridge='dn', az='opto', trial=trial, **s)); print(f'[mcns shuffle opto] t{trial}: yaw={s["final_yaw"]:+.1f}', flush=True)
    pd.DataFrame(recs).to_csv(f'{OUT}/flights_shuffle.csv', index=False); print('saved shuffle', flush=True)

if __name__ == '__main__':
    {'openloop': openloop, 'fly': flights, 'shuffle': shuffle}[sys.argv[1]](); print(f'PHASE6 {sys.argv[1]} DONE', flush=True)
