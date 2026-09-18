import os, json
os.chdir(os.path.expanduser('~/Drosophila_brain_model'))
import pandas as pd, numpy as np
import utils as utl
ANN = os.path.expanduser('~/flywire_annotations/supplemental_files/Supplemental_file1_neuron_annotations.tsv')
ann = pd.read_csv(ANN, sep='\t', low_memory=False); ann['cell_type']=ann.cell_type.fillna('')
exps = ['baseline','LPLC2_L','LPLC2_R','LPLC2_both','LC4_L','LC4_R','LC4_LPLC2_L']
df = utl.load_exps([f'./results/phase1/{n}.parquet' for n in exps])
print('spikes per experiment:'); print(df.groupby('exp_name').size().reindex(exps).fillna(0).astype(int).to_string())
rate, std = utl.get_rate(df, t_run=1.0, n_run=4)
for c in exps:
    if c not in rate: rate[c] = 0.0
dn = ann[ann.super_class=='descending'].set_index('root_id')
r = rate.reindex(dn.index).fillna(0.0)[exps]
r['cell_type'] = dn.cell_type.replace('', 'unnamed'); r['side'] = dn.side
print('\n=== descending neurons firing >5 Hz per experiment (of 1299) ===')
print((r[exps] > 5).sum().to_string())
print('\n=== total neurons active anywhere in brain per experiment ===')
print((rate.reindex(columns=exps).fillna(0) > 5).sum().to_string())
print('\n=== Key flight/escape DNs (Hz, mean of 4 trials) ===')
key = r[r.cell_type.str.match(r'^(DNp01|DNp03|DNp06|DNp09|DNp11|DNa02|DNa01|DNb01|DNg02_[a-h])$')]
print(key.groupby(['cell_type','side'])[exps].mean().round(1).to_string())
for col in ['LPLC2_L','LC4_L','LPLC2_both']:
    print(f'\n=== Top 15 DNs under {col} ===')
    print(r.sort_values(col, ascending=False).head(15)[['cell_type','side']+exps].round(1).to_string())
def lat(col):
    g = r.groupby(['cell_type','side'])[col].mean().unstack(fill_value=0)
    for s in ['left','right']:
        if s not in g: g[s]=0.0
    g = g[(g[['left','right']].sum(axis=1) > 5)]
    g['LI'] = ((g['left']-g['right'])/(g['left']+g['right'])).round(2)
    return g[['left','right','LI']].round(1)
for col in ['LPLC2_L','LC4_L','LC4_LPLC2_L']:
    print(f'\n=== Lateralization of DN types under {col} (LI +1 = left only, -1 = right only) ===')
    print(lat(col).sort_values('LI').to_string())
r.to_csv('results/phase1/dn_rates.csv'); print('\nsaved results/phase1/dn_rates.csv')
