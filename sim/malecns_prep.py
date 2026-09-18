"""malecns_prep.py -- convert MaleCNS v1.0 flat files into the Shiu-model format used by FlyBrain."""
import os, json, time, numpy as np, pandas as pd, pyarrow.feather as pf
D = os.path.expanduser('~/malecns'); t0 = time.time()
a = pd.read_feather(f'{D}/body-annotations-male-cns-v1.0-minconf-0.5.feather')
a = a[a.status == 'Traced'].copy(); a['type'] = a['type'].fillna(''); a['somaSide'] = a.somaSide.fillna('U'); a['superclass'] = a.superclass.fillna('unknown')
ids = a.bodyId.values.astype(np.int64); idx = pd.Series(np.arange(len(ids)), index=ids)
print('traced neurons', len(ids), flush=True)
nt = pd.read_feather(f'{D}/body-neurotransmitters-male-cns-v1.0.feather').set_index('body')
sign = pd.Series(1, index=ids); c = nt.consensus_nt.reindex(ids).fillna('unknown').str.lower().values
sign[np.isin(c, ['gaba', 'glutamate', 'histamine'])] = -1
print('sign counts', pd.Series(sign).value_counts().to_dict(), '| nt:', pd.Series(c).value_counts().head(8).to_dict(), flush=True)

sch = pf.read_table(f'{D}/connectome-weights-male-cns-v1.0-minconf-0.5.feather', columns=None).schema
print('weights columns:', sch.names, flush=True)
w = pd.read_feather(f'{D}/connectome-weights-male-cns-v1.0-minconf-0.5.feather')
pre_c = [c for c in w.columns if 'pre' in c.lower()][0]; post_c = [c for c in w.columns if 'post' in c.lower()][0]; wt_c = [c for c in w.columns if c not in (pre_c, post_c)][0]
print('using', pre_c, post_c, wt_c, '| edges total', len(w), flush=True)
w = w[w[pre_c].isin(idx.index) & w[post_c].isin(idx.index)]
print('edges between traced neurons', len(w), '| by min weight:', {k: int((w[wt_c] >= k).sum()) for k in (1, 2, 3, 5)}, flush=True)
thr = next(k for k in (1, 2, 3, 5, 10) if (w[wt_c] >= k).sum() <= 25_000_000)
w = w[w[wt_c] >= thr]; print(f'threshold >= {thr}: {len(w)} edges, {int(w[wt_c].sum())} synapses', flush=True)
con = pd.DataFrame({'Presynaptic_ID': w[pre_c].values.astype(np.int64), 'Postsynaptic_ID': w[post_c].values.astype(np.int64)})
con['Presynaptic_Index'] = idx.loc[con.Presynaptic_ID].values; con['Postsynaptic_Index'] = idx.loc[con.Postsynaptic_ID].values
con['Connectivity'] = w[wt_c].values.astype(np.int32); con['Excitatory'] = sign.loc[con.Presynaptic_ID].values.astype(np.int8)
con['Excitatory x Connectivity'] = con.Connectivity * con.Excitatory
con.to_parquet(f'{D}/Connectivity_mcns.parquet', index=False)
pd.DataFrame({'Completed': True}, index=pd.Index(ids, name='')).to_csv(f'{D}/Completeness_mcns.csv')

# cell-type lookup
def grp(mask, side=None):
    m = mask & ((a.somaSide == side) if side else True); return [int(x) for x in a.loc[m, 'bodyId']]
G = {}
for t in ['LPLC2', 'LC4', 'LC6', 'LPLC1', 'DNp01', 'DNa02', 'DNa01', 'DNb01', 'DNp03', 'DNp11', 'DNp06', 'DNp09', 'DNp02', 'DNp04', 'DNp05'] + [f'T{x}{s}' for x in (4, 5) for s in 'abcd']:
    for S, s in (('L', 'left'), ('R', 'right')): G[f'{t}_{s}'] = grp(a['type'] == t, S)
for S, s in (('L', 'left'), ('R', 'right')):
    G[f'DNg02_{s}'] = grp(a['type'].str.startswith('DNg02'), S)
    G[f'DN_all_{s}'] = grp(a.superclass == 'descending_neuron', S)
    G[f'MN_all_{s}'] = grp(a.superclass == 'vnc_motor', S)
    steer = ['b1 MN', 'b2 MN', 'b3 MN', 'i1 MN', 'i2 MN', 'iii1 MN', 'iii3 MN', 'hg1 MN', 'hg2 MN', 'hg3 MN', 'hg4 MN', 'tp1 MN', 'tp2 MN', 'tpn MN', 'ps1 MN', 'ps2 MN']
    G[f'MNsteer_{s}'] = grp(a['type'].isin(steer), S)
    G[f'MNpower_{s}'] = grp(a['type'].str.startswith(('DLMn', 'DVMn')), S)
    G[f'TTMn_{s}'] = grp(a['type'] == 'TTMn', S)
    for t in steer: G[f'{t.replace(" MN", "")}_{s}'] = grp(a['type'] == t, S)
json.dump(G, open(f'{D}/celltype_ids_mcns.json', 'w'))
print('groups:', {k: len(v) for k, v in G.items() if not k[0] in 'T' or k.startswith('TTMn')}, flush=True)
# positions + classes for the site (soma location, 8 nm voxels)
pos = np.array([p if isinstance(p, np.ndarray) and len(p) == 3 else [np.nan]*3 for p in a.somaLocation.values], float)
meta = pd.DataFrame({'bodyId': ids, 'type': a['type'].values, 'side': a.somaSide.values, 'superclass': a.superclass.values, 'x': pos[:, 0], 'y': pos[:, 1], 'z': pos[:, 2]})
meta.to_parquet(f'{D}/neurons_mcns.parquet', index=False); print('soma positions available:', int(np.isfinite(pos[:, 0]).sum()), flush=True)
print(f'MALECNS PREP DONE in {time.time()-t0:.0f}s')
