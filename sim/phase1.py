import os, json, copy, time
os.chdir(os.path.expanduser('~/Drosophila_brain_model'))
import pandas as pd, numpy as np
from brian2 import Hz
from model import run_exp, default_params
import utils as utl

ANN = os.path.expanduser('~/flywire_annotations/supplemental_files/Supplemental_file1_neuron_annotations.tsv')
COMP, CON = './Completeness_783.csv', './Connectivity_783.parquet'
ann = pd.read_csv(ANN, sep='\t', low_memory=False)
comp = pd.read_csv(COMP, index_col=0)
ann = ann[ann.root_id.isin(set(comp.index))]
ann['cell_type'] = ann.cell_type.fillna('')

def ids(ct_regex, side=None):
    m = ann.cell_type.str.match(ct_regex)
    if side: m &= (ann.side == side)
    return [int(x) for x in ann.loc[m, 'root_id']]

# save lookup for later phases
lookup = {f'{ct}_{s}': ids(f'^{ct}$', s) for ct in ['LPLC2','LC4','LC6','LPLC1','DNp01','DNp03','DNa02','DNp09','DNp06','DNp11','DNb01','HSN','HSE','HSS'] for s in ['left','right']}
lookup.update({f'DNg02_{s}': ids(r'^DNg02_', s) for s in ['left','right']})
for k in ['T4a','T4b','T4c','T4d','T5a','T5b','T5c','T5d']:
    for s in ['left','right']: lookup[f'{k}_{s}'] = ids(f'^{k}$', s)
json.dump(lookup, open('celltype_ids_783.json','w'))
print('saved celltype_ids_783.json with', len(lookup), 'groups', flush=True)

params = copy.deepcopy(default_params); params['n_run'] = 4
os.makedirs('results/phase1', exist_ok=True)
exps = {
  'baseline'   : [],
  'LPLC2_L'    : lookup['LPLC2_left'],
  'LPLC2_R'    : lookup['LPLC2_right'],
  'LPLC2_both' : lookup['LPLC2_left'] + lookup['LPLC2_right'],
  'LC4_L'      : lookup['LC4_left'],
  'LC4_R'      : lookup['LC4_right'],
  'LC4_LPLC2_L': lookup['LC4_left'] + lookup['LPLC2_left'],
}
t0 = time.time()
for name, exc in exps.items():
    run_exp(name, exc, './results/phase1', COMP, CON, params=params, n_proc=4, force_overwrite=True)
print(f'all experiments done in {time.time()-t0:.0f}s', flush=True)

# ---- readout: descending neurons
df = utl.load_exps([f'./results/phase1/{n}.parquet' for n in exps])
rate, std = utl.get_rate(df, t_run=1.0, n_run=4)
dn = ann[ann.super_class=='descending'].set_index('root_id')
r = rate.reindex(dn.index).fillna(0.0)
r['cell_type'] = dn.cell_type.replace('', 'unnamed'); r['side'] = dn.side
cols = list(exps)
print('\n=== DN summary: number of descending neurons firing >5 Hz per experiment ===')
print((r[cols] > 5).sum().to_string())
print('\n=== Key DNs (Hz, mean of 4 trials) ===')
key = r[r.cell_type.str.match(r'^(DNp01|DNp03|DNp06|DNp09|DNp11|DNa02|DNa01|DNb01|DNg02_[a-h])$')].sort_values(['cell_type','side'])
print(key.groupby(['cell_type','side'])[cols].mean().round(1).to_string())
print('\n=== Top 20 DNs by rate under LPLC2_L ===')
print(r.sort_values('LPLC2_L', ascending=False).head(20)[['cell_type','side']+cols].round(1).to_string())
print('\n=== Top 20 DNs by rate under LC4_L ===')
print(r.sort_values('LC4_L', ascending=False).head(20)[['cell_type','side']+cols].round(1).to_string())
# lateralization index per DN cell type under left-only stim: (L-R)/(L+R)
def lat(col):
    g = r.groupby(['cell_type','side'])[col].mean().unstack(fill_value=0)
    g = g[(g.sum(axis=1) > 5)]
    g['LI'] = (g['left']-g['right'])/(g['left']+g['right'])
    return g.round(2)
print('\n=== Lateralization under LPLC2_L (LI=+1 left-only, -1 right-only) ===')
print(lat('LPLC2_L').sort_values('LI').to_string())
print('\n=== Lateralization under LC4_L ===')
print(lat('LC4_L').sort_values('LI').to_string())
r.to_csv('results/phase1/dn_rates.csv')
print('\nPHASE1 DONE', flush=True)
