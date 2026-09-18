import os, json, numpy as np, pandas as pd
os.chdir(os.path.expanduser('~/Drosophila_brain_model'))
OUT = '/mnt/c/Users/killm/OneDrive/Documents/Claude Code/fly-brain-drone/site/data'
def js(name, obj):
    with open(f'{OUT}/{name}.js', 'w') as f: f.write(f'window.FB=window.FB||{{}};window.FB.{name}=' + json.dumps(obj, separators=(',', ':')) + ';')
rng = np.random.default_rng(1)
cid = {'optic': 0, 'visual_projection': 1, 'central': 2, 'descending': 3, 'ol_intrinsic': 0, 'cb_intrinsic': 2, 'descending_neuron': 3, 'vnc_intrinsic': 5, 'vnc_motor': 6, 'ascending': 4, 'ascending_neuron': 4}
# FlyWire
comp = pd.read_csv('Completeness_783.csv', index_col=0)
ann = pd.read_csv(os.path.expanduser('~/flywire_annotations/supplemental_files/Supplemental_file1_neuron_annotations.tsv'), sep='\t', low_memory=False).drop_duplicates('root_id').set_index('root_id').reindex(comp.index)
P = np.c_[ann.pos_x.values*4, ann.pos_y.values*4, ann.pos_z.values*40]/1000.0; ok = np.isfinite(P).all(1)
c = np.array([cid.get(s, 4) for s in ann.super_class.fillna('')])
ctr = np.nanmean(P[ok], 0); Q = (P - ctr)
sel = rng.choice(np.nonzero(ok)[0], 30000, replace=False)
L = json.load(open('celltype_ids_783.json')); i_of = {f: i for i, f in enumerate(comp.index)}
hi = {}
for g in ['LPLC2_left', 'LPLC2_right', 'LC4_left', 'LC4_right', 'DNp01_left', 'DNp01_right', 'DNa02_left', 'DNa02_right', 'DNp11_left', 'DNp11_right', 'DN_all_left', 'DN_all_right']:
    idx = np.array([i_of[f] for f in L[g]]); idx = idx[ok[idx]]; hi[g] = np.round(Q[idx], 1).tolist()
js('brain3d_fw', dict(pts=np.round(Q[sel], 1).tolist(), cls=c[sel].tolist(), hi=hi, extent=float(np.nanmax(np.abs(Q[ok]))), n=int(ok.sum())))
# MaleCNS (soma positions, 8 nm voxels -> microns)
m = pd.read_parquet(os.path.expanduser('~/malecns/neurons_mcns.parquet'))
P2 = m[['x', 'y', 'z']].values*8/1000.0; ok2 = np.isfinite(P2).all(1); c2 = np.array([cid.get(s, 4) for s in m.superclass.fillna('')])
ctr2 = np.nanmean(P2[ok2], 0); Q2 = P2 - ctr2
sel2 = rng.choice(np.nonzero(ok2)[0], 30000, replace=False)
M = json.load(open(os.path.expanduser('~/malecns/celltype_ids_mcns.json'))); j_of = {b: i for i, b in enumerate(m.bodyId.values)}
hi2 = {}
for g in ['LPLC2_left', 'LPLC2_right', 'LC4_left', 'LC4_right', 'DNp01_left', 'DNp01_right', 'DNa02_left', 'DNa02_right', 'DNp11_left', 'DNp11_right', 'MNsteer_left', 'MNsteer_right', 'MNpower_left', 'MNpower_right', 'DN_all_left', 'DN_all_right']:
    idx = np.array([j_of[b] for b in M[g] if b in j_of]); idx = idx[ok2[idx]] if len(idx) else idx; hi2[g] = np.round(Q2[idx], 1).tolist()
js('brain3d_mc', dict(pts=np.round(Q2[sel2], 1).tolist(), cls=c2[sel2].tolist(), hi=hi2, extent=float(np.nanmax(np.abs(Q2[ok2]))), n=int(ok2.sum())))
print('fw extent', np.nanmax(np.abs(Q[ok])), 'mc extent', np.nanmax(np.abs(Q2[ok2])), '| sizes KB:', {f: round(os.path.getsize(f'{OUT}/{f}')/1024) for f in ['brain3d_fw.js', 'brain3d_mc.js']})
print('mc axis ranges', np.nanmin(Q2[ok2], 0).round(), np.nanmax(Q2[ok2], 0).round())
