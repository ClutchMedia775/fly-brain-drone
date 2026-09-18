"""phase56_summary.py -- aggregate phase 5/6 results into tables + JSON for the site."""
import os, json, glob, numpy as np, pandas as pd
os.chdir(os.path.expanduser('~/Drosophila_brain_model'))
OUT = '/mnt/c/Users/killm/OneDrive/Documents/Claude Code/fly-brain-drone'
rng = np.random.default_rng(0)
def ci(x, n=2000):
    x = np.asarray(x, float); 
    if len(x) < 2: return [float(x.mean()), float(x.mean())]
    b = [rng.choice(x, len(x)).mean() for _ in range(n)]; return [float(np.percentile(b, 2.5)), float(np.percentile(b, 97.5))]
def js(name, obj):
    with open(f'{OUT}/site/data/{name}.js', 'w') as f: f.write(f'window.FB=window.FB||{{}};window.FB.{name}=' + json.dumps(obj, separators=(',', ':')) + ';')
R = {}
# ---- main comparison (FlyWire)
parts = [pd.read_csv(f) for f in ['results/phase5/main.csv'] + glob.glob('results/phase5/main_shuffle*.csv') + glob.glob('results/phase5/main_rand*.csv') if os.path.exists(f)]
m = pd.concat(parts, ignore_index=True)
m['evaded'] = m.min_dist > 0.3; m['correct_side'] = np.sign(m.final_y) == -np.sign(m.az)
rows = []
for cond, g in m.groupby('cond', sort=False):
    rows.append(dict(cond=cond, n=int(len(g)), mean_min_dist=round(float(g.min_dist.mean()), 2), ci=[round(v, 2) for v in ci(g.min_dist)],
                     evade_rate=round(float(g.evaded.mean()), 2), correct_side_rate=round(float(g[g.evaded].correct_side.mean()) if g.evaded.any() else 0.0, 2),
                     mean_peak_turn=round(float(g.peak_turn.mean()), 2)))
R['main'] = rows; print(pd.DataFrame(rows).to_string())
# ---- ablations
a = pd.read_csv('results/phase5/ablate.csv')
R['ablate'] = [dict(variant=v, n=int(len(g)), mean_min_dist=round(float(g.min_dist.mean()), 2), ci=[round(x, 2) for x in ci(g.min_dist)], mean_peak_turn=round(float(g.peak_turn.mean()), 2), mean_peak_gf=round(float(g.peak_gf.mean()), 2)) for v, g in a.groupby('variant', sort=False)]
print(pd.DataFrame(R['ablate']).to_string())
# ---- T4/T5-driven looming (FlyWire)
t = pd.read_csv('results/phase5/t4t5.csv'); t = t[t.rate == 100.0]
cols = ['LPLC2_left', 'LPLC2_right', 'LC4_left', 'LC4_right', 'DNp01_left', 'DNp01_right', 'DNa02_left', 'DNa02_right', 'DNb01_left', 'DNb01_right', 'DNp11_left', 'DNp11_right']
R['t4t5'] = {s: {c: round(float(g[c].mean()), 1) for c in cols} for s, g in t.groupby('stim')}
# ---- forward flight
if os.path.exists('results/phase5/forward.csv'):
    f = pd.read_csv('results/phase5/forward.csv')
    R['forward'] = [dict(course=c, cond=k, n=int(len(g)), mean_min_dist=round(float(np.minimum(g.min_dist, 99).mean()), 2), mean_abs_turn=round(float(g.mean_abs_turn.mean()), 3), final_y=round(float(g.final_y.mean()), 2), final_yaw=round(float(g.final_yaw.mean()), 0)) for (c, k), g in f.groupby(['course', 'cond'], sort=False)]
    print(pd.DataFrame(R['forward']).to_string())
    # trajectories for the site (first brain trial per course)
    traj = {}
    for c in ['headon_static', 'gauntlet_offset']:
        p = f'results/phase5/forward_{c}_t0.csv'
        if os.path.exists(p):
            d = pd.read_csv(p); traj[c] = dict(t=[round(v, 2) for v in d.t], x=[round(v, 2) for v in d.x], y=[round(v, 2) for v in d.y], yaw=[round(v, 1) for v in d.yaw], turn=[round(v, 2) for v in d.turn])
    R['forward_traj'] = traj
# ---- robustness sweep
if os.path.exists('results/phase5/robust.csv'):
    r = pd.read_csv('results/phase5/robust.csv'); rb = r[r.cond == 'real']
    R['robust'] = [dict(az=int(k[0]), v=float(k[1]), r=float(k[2]), n=int(len(g)), mean_min_dist=round(float(g.min_dist.mean()), 2), evade_rate=round(float((g.min_dist > k[2]).mean()), 2),
                        nobrain_min=round(float(r[(r.cond == 'nobrain') & (r.az == k[0]) & (r.v == k[1]) & (r.r == k[2])].min_dist.mean()), 2)) for k, g in rb.groupby(['az', 'v', 'r'])]
    print('robust configs:', len(R['robust']), '| overall evade rate', round(float((rb.min_dist > rb.r).mean()), 2))
# ---- MaleCNS
o = pd.read_csv('results/phase6/openloop.csv')
mc = ['LPLC2_left', 'LPLC2_right', 'DNp01_left', 'DNp01_right', 'DNa02_left', 'DNa02_right', 'DNp11_left', 'DNp11_right', 'MNsteer_left', 'MNsteer_right', 'MNpower_left', 'MNpower_right', 'TTMn_left', 'TTMn_right', 'max_active']
R['mcns_openloop'] = {s: {c: round(float(g[c].mean()), 1) for c in mc} for s, g in o.groupby('stim')}
print(pd.DataFrame(R['mcns_openloop']).T.to_string())
fl = pd.read_csv('results/phase6/flights.csv')
if os.path.exists('results/phase6/flights_shuffle.csv'): fl = pd.concat([fl, pd.read_csv('results/phase6/flights_shuffle.csv')], ignore_index=True)
fl['az'] = fl.az.astype(str); rows = []
for (cond, bridge, az), g in fl.groupby(['cond', 'bridge', 'az'], sort=False):
    if az == 'opto': rows.append(dict(cond=cond, bridge=bridge, az=az, n=int(len(g)), total_yaw=round(float(g.final_yaw.mean()), 1)))
    else: rows.append(dict(cond=cond, bridge=bridge, az=int(az), n=int(len(g)), mean_min_dist=round(float(g.min_dist.mean()), 2), ci=[round(x, 2) for x in ci(g.min_dist)], final_y=round(float(g.final_y.mean()), 2), correct_side=round(float((np.sign(g.final_y) == -np.sign(int(az))).mean()), 2)))
R['mcns_flights'] = rows; print(pd.DataFrame(rows).to_string())
traj = {}
for k in ['loom_az+30_dn', 'loom_az-30_dn', 'loom_az+30_mn', 'loom_az-30_mn', 'opto_dn', 'opto_mn']:
    p = f'results/phase6/{k}.csv'
    if os.path.exists(p):
        d = pd.read_csv(p); traj[k] = {c: [round(float(v), 2) for v in d[c]] for c in ['t', 'x', 'y', 'yaw', 'turn', 'gf'] if c in d}
        for c in ['MNsteer_left', 'MNsteer_right', 'DNa02_left', 'DNa02_right', 'DNp01_left', 'DNp01_right']:
            if c in d: traj[k][c] = [round(float(v), 1) for v in d[c]]
R['mcns_traj'] = traj
json.dump(R, open(f'{OUT}/results/phase56_summary.json', 'w'), indent=1)
js('phase56', {k: v for k, v in R.items() if k not in ('mcns_traj', 'forward_traj')}); js('traj56', dict(mcns=R['mcns_traj'], forward=R.get('forward_traj', {})))
print('SUMMARY DONE')
