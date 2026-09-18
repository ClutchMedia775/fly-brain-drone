import os, json, time
os.chdir(os.path.expanduser('~/Drosophila_brain_model'))
import numpy as np
from brian2 import ms, prefs
from flybrain_step import FlyBrain

L = json.load(open('celltype_ids_783.json'))
inputs = {k: L[k] for k in ['LPLC2_left','LPLC2_right','LC4_left','LC4_right']}
readout = {k: L[k] for k in ['DNp01_left','DNp01_right','DNa02_left','DNa02_right','DNa01_left','DNa01_right',
                             'DNb01_left','DNb01_right','DNp03_left','DNp03_right','DNp11_left','DNp11_right',
                             'DNg02_left','DNg02_right','DNp06_left','DNp06_right']}
t0 = time.time()
fb = FlyBrain('./Completeness_783.csv', './Connectivity_783.parquet', inputs, readout, dt_ctrl=20*ms)
print(f'build + store: {time.time()-t0:.1f}s', flush=True)

# first tick includes Cython compile
t0 = time.time(); out = fb.step(); print(f'first tick (compile): {time.time()-t0:.1f}s  active={out["_n_active"]}', flush=True)

# --- protocol: 0-200 ms silent, 200-600 ms left LPLC2 at 150 Hz, 600-1000 ms silent
cols = ['DNp01_left','DNp01_right','DNa02_left','DNa02_right','DNb01_left','DNb01_right','DNg02_left','DNg02_right','DNp03_left','DNp06_right']
print('\n tick   t_ms  stim  wall_s  active | ' + ' '.join(f'{c:>11s}' for c in cols), flush=True)
walls = []
for k in range(1, 50):
    stim = 150.0 if 10 <= k < 30 else 0.0
    fb.set_rates({'LPLC2_left': stim})
    t0 = time.time(); out = fb.step(); w = time.time()-t0; walls.append(w)
    print(f'{k:5d} {fb.t:6.0f} {stim:5.0f} {w:7.3f} {out["_n_active"]:7d} | ' + ' '.join(f'{out[c]:11d}' for c in cols), flush=True)

print(f'\nmean wall per 20 ms tick: {np.mean(walls):.3f}s  (min {np.min(walls):.3f}, max {np.max(walls):.3f})  -> {np.mean(walls)/0.02:.0f}x slower than real time')

# --- second protocol on same object after reset: right LC4, check DNp03_right lights up and reset worked
fb.reset()
fb.set_rates({'LC4_right': 150.0})
tot = {c: 0 for c in ['DNp03_left','DNp03_right','DNp11_left','DNp11_right','DNp01_left','DNp01_right']}
t0 = time.time()
for k in range(15):
    out = fb.step()
    for c in tot: tot[c] += out[c]
print(f'\nafter reset, right LC4 for 300 ms ({time.time()-t0:.1f}s wall): spikes', tot)
print('PHASE2 DONE')
