import time, sys, os
os.chdir(os.path.expanduser('~/Drosophila_brain_model'))
import brian2
from brian2 import prefs, Hz, ms
print('codegen target:', prefs.codegen.target, flush=True)
try:
    import Cython; print('cython', Cython.__version__)
except Exception as e:
    print('no cython:', e)

from model import run_exp, run_trial, create_model, default_params
import utils as utl
import pandas as pd
import copy

comp = './2023_03_23_completeness_630_final.csv'
con  = './2023_03_23_connectivity_630_final.parquet'

neu_sugar = [720575940624963786,720575940630233916,720575940637568838,720575940638202345,
 720575940617000768,720575940630797113,720575940632889389,720575940621754367,720575940621502051,
 720575940640649691,720575940639332736,720575940616885538,720575940639198653,720575940620900446,
 720575940617937543,720575940632425919,720575940633143833,720575940612670570,720575940628853239,
 720575940629176663,720575940611875570]
id_mn9 = 720575940660219265

# --- timing: build network alone
t0=time.time()
neu, syn, mon = create_model(comp, con, default_params)
print(f'network: {len(neu)} neurons, {len(syn)} synapses, build {time.time()-t0:.1f}s', flush=True)

# --- one serial trial, timed
df_comp = pd.read_csv(comp, index_col=0)
flyid2i = {j:i for i,j in enumerate(df_comp.index)}
exc = [flyid2i[n] for n in neu_sugar]
t0=time.time()
spk = run_trial(exc, [], [], comp, con, default_params)
dt = time.time()-t0
print(f'single 1 s trial: {dt:.1f}s wall  ({dt:.1f}x slower than real time)', flush=True)
print(f'  neurons that spiked: {len(spk)}; MN9 spikes: {len(spk.get(flyid2i[id_mn9], []))}', flush=True)

# --- parallel run, 8 trials
params = copy.deepcopy(default_params); params['n_run'] = 6
os.makedirs('results/phase0', exist_ok=True)
t0=time.time()
run_exp('sugarR', neu_sugar, './results/phase0', comp, con, params=params, n_proc=3, force_overwrite=True)
print(f'6 trials on 3 procs: {time.time()-t0:.1f}s', flush=True)

df = utl.load_exps(['./results/phase0/sugarR.parquet'])
flyid2name = {f: f'sugar_{i+1}' for i,f in enumerate(neu_sugar)}
rate, std = utl.get_rate(df, t_run=1.0, n_run=6, flyid2name=flyid2name)
print('\nMN9 rate (Hz):', rate.loc[id_mn9,'sugarR'], '+/-', std.loc[id_mn9,'sugarR'])
print('\nTop 15 neurons by rate:')
print(rate.sort_values('sugarR', ascending=False).head(15).to_string())
print('\nTotal neurons active:', len(rate))
