import os, sys, json, time
os.chdir(os.path.expanduser('~/Drosophila_brain_model'))
import numpy as np
from brian2 import ms
from flybrain_step import FlyBrain
from flydrone import Bridge
from flyexp import run_looming, run_optomotor, DT
cond = sys.argv[1]; seed = None if cond == 'real' else int(sys.argv[2])
tag = 'real' if seed is None else f'shuffle{seed}'
L = json.load(open('celltype_ids_783.json'))
inputs = {k: L[k] for k in ['LPLC2_left','LPLC2_right','LC4_left','LC4_right'] + [f'T{t}{s}_{side}' for t in (4,5) for s in 'ab' for side in ('left','right')]}
readout = {k: L[k] for k in Bridge.GROUPS}
t0 = time.time(); fb = FlyBrain('./Completeness_783.csv', './Connectivity_783.parquet', inputs, readout, dt_ctrl=DT*1000*ms, shuffle_seed=seed)
fb.step(); fb.reset(); print(f'[{tag}] brain ready in {time.time()-t0:.0f}s', flush=True)
os.makedirs('results/phase4', exist_ok=True)
res = {}
for az in (+30, -30):
    df, s, act = run_looming(fb, az, True, log_active=(az == 30))
    df.to_csv(f'results/phase4/loom_az{az:+d}_{tag}.csv', index=False); res[f'loom_az{az:+d}'] = s
    if act: json.dump(act, open(f'results/phase4/active_loom_az{az:+d}_{tag}.json', 'w'))
    print(f'[{tag}] loom az{az:+d}: ' + ' '.join(f'{k}={v:.2f}' if isinstance(v, float) else f'{k}={v}' for k, v in s.items()), flush=True)
df, s, act = run_optomotor(fb, True, log_active=True)
df.to_csv(f'results/phase4/opto_{tag}.csv', index=False); res['opto'] = s
json.dump(act, open(f'results/phase4/active_opto_{tag}.json', 'w'))
print(f'[{tag}] opto: ' + ' '.join(f'{k}={v:.2f}' if isinstance(v, float) else f'{k}={v}' for k, v in s.items()), flush=True)
json.dump(res, open(f'results/phase4/summary_{tag}.json', 'w'), indent=1)
print(f'[{tag}] DONE', flush=True)
