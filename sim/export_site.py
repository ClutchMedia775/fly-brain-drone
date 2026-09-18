import os, json, numpy as np, pandas as pd
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
os.chdir(os.path.expanduser('~/Drosophila_brain_model'))
OUT = '/mnt/c/Users/killm/OneDrive/Documents/Claude Code/fly-brain-drone/site'
os.makedirs(OUT+'/data', exist_ok=True); os.makedirs(OUT+'/img', exist_ok=True)
def js(name, obj): 
    with open(f'{OUT}/data/{name}.js', 'w') as f: f.write(f'window.FB=window.FB||{{}};window.FB.{name}=' + json.dumps(obj, separators=(',',':')) + ';')

comp = pd.read_csv('Completeness_783.csv', index_col=0)
ann = pd.read_csv(os.path.expanduser('~/flywire_annotations/supplemental_files/Supplemental_file1_neuron_annotations.tsv'), sep='\t', low_memory=False)
ann = ann.drop_duplicates('root_id').set_index('root_id').reindex(comp.index)
ann['cell_type'] = ann.cell_type.fillna(''); ann['super_class'] = ann.super_class.fillna('unknown'); ann['side'] = ann.side.fillna('na')
con = pd.read_parquet('Connectivity_783.parquet')
print('neurons', len(comp), 'edges', len(con), 'synapses', int(con.Connectivity.sum()))

# positions (FlyWire voxel coords 4x4x40 nm -> microns); frontal view x horizontal, y vertical
x = ann.pos_x.values*4/1000.0; y = ann.pos_y.values*4/1000.0; z = ann.pos_z.values*40/1000.0
ok = np.isfinite(x) & np.isfinite(y)
print('positions available:', ok.sum(), 'left mean x', np.nanmean(x[(ann.side=="left").values]), 'right mean x', np.nanmean(x[(ann.side=="right").values]))
pad = 0.03
x0, x1 = np.nanpercentile(x, 0.1), np.nanpercentile(x, 99.9); y0, y1 = np.nanpercentile(y, 0.1), np.nanpercentile(y, 99.9)
dx, dy = x1-x0, y1-y0; x0 -= pad*dx; x1 += pad*dx; y0 -= pad*dy; y1 += pad*dy
W = 1600; s = W/(x1-x0); H = int(round((y1-y0)*s))
px = np.round((x-x0)*s).astype(float); py = np.round((y-y0)*s).astype(float)
meta = dict(W=W, H=H, x0=float(x0), y0=float(y0), s=float(s), n_neurons=int(len(comp)), n_edges=int(len(con)), n_synapses=int(con.Connectivity.sum()),
            left_is_image_left=bool(np.nanmean(x[(ann.side=="left").values]) < np.nanmean(x[(ann.side=="right").values])),
            super_class_counts={k: int(v) for k, v in ann.super_class.value_counts().items()})
js('brain_meta', meta)

# background point cloud (all neurons) -- dark style
dpi = 100; fig = plt.figure(figsize=(W/dpi, H/dpi), dpi=dpi); ax = fig.add_axes([0,0,1,1]); ax.set_facecolor('#0b0b0b'); fig.patch.set_facecolor('#0b0b0b')
cls = ann.super_class.values
col = np.where(np.isin(cls, ['optic']), '#2a2a2a', np.where(np.isin(cls, ['descending','ascending','motor','sensory_ascending']), '#4a4a4a', '#383838'))
ax.scatter(px[ok], py[ok], s=0.35, c=col[ok], linewidths=0, alpha=0.9)
ax.set_xlim(0, W); ax.set_ylim(H, 0); ax.axis('off')
fig.savefig(f'{OUT}/img/brain_frontal.png', dpi=dpi, facecolor='#0b0b0b'); plt.close(fig)

# highlighted groups
L = json.load(open('celltype_ids_783.json'))
i_of = {f: i for i, f in enumerate(comp.index)}
def pts(ids, cap=None, seed=0):
    idx = np.array([i_of[f] for f in ids]); idx = idx[ok[idx]]
    if cap and len(idx) > cap: idx = np.random.default_rng(seed).choice(idx, cap, replace=False)
    return [[int(px[i]), int(py[i])] for i in idx]
groups = {}
for g in ['LPLC2_left','LPLC2_right','LC4_left','LC4_right','DNp01_left','DNp01_right','DNa02_left','DNa02_right','DNa01_left','DNa01_right',
          'DNb01_left','DNb01_right','DNp03_left','DNp03_right','DNp11_left','DNp11_right','DNg02_left','DNg02_right','DN_all_left','DN_all_right']:
    groups[g] = pts(L[g])
for side in ['left','right']:
    groups[f'T4T5_{side}'] = pts(sum([L[f'T{t}{s}_{side}'] for t in (4,5) for s in 'abcd'], []), cap=600)
    groups[f'HSVS_{side}'] = pts(L[f'HSN_{side}']+L[f'HSE_{side}']+L[f'HSS_{side}']+L[f'VS_{side}'])
js('groups', groups)
print('group sizes:', {k: len(v) for k, v in groups.items()})

# per-tick activity -> [px,py,class]
cid = {'optic':0, 'visual_projection':1, 'central':2, 'descending':3}
cls_id = np.array([cid.get(c, 4) for c in cls])
def activity(path, cap=None, seed=0):
    A = json.load(open(path)); rng = np.random.default_rng(seed); frames = []
    for tick in A:
        idx = np.array(tick, dtype=int); idx = idx[ok[idx]] if len(idx) else idx
        if cap and len(idx) > cap: idx = rng.choice(idx, cap, replace=False)
        frames.append([[int(px[i]), int(py[i]), int(cls_id[i])] for i in idx])
    return frames
js('act_loom_real', activity('results/phase4/active_loom_az+30_real.json'))
js('act_loom_shuffle', activity('results/phase4/active_loom_az+30_shuffle1.json'))
js('act_opto_real', activity('results/phase4/active_opto_real.json', cap=500))

# flight logs
def loom_run(path, az):
    d = pd.read_csv(path); r = lambda c, n=2: [round(float(v), n) for v in d[c]] if c in d else None
    a = np.deg2rad(az); ox = 6*np.cos(a) - 2*d.t.values*np.cos(a); oy = 6*np.sin(a) - 2*d.t.values*np.sin(a)
    mind = float(np.min(np.hypot(ox - d.x.values, oy - d.y.values)))
    out = dict(az=az, t=r('t',3), x=r('x'), y=r('y'), z=r('z'), yaw=r('yaw',1), roll=r('roll',1), turn=r('turn'), gf=r('gf'), drive=r('drive',1), dist=r('dist'),
               min_dist=round(mind, 2), final_y=round(float(d.y.iloc[-1]), 2), final_yaw=round(float(d.yaw.iloc[-1]), 1), nact=[int(v) for v in d.nact])
    for g in ['DNa02_left','DNa02_right','DNa01_left','DNa01_right','DNb01_left','DNb01_right','DNp01_left','DNp01_right','DNp03_left','DNp11_left','DNp11_right','DNg02_left','DNg02_right']:
        if g in d: out[g] = r(g, 1)
    return out
loom = {}
for az in (30, -30, 0):
    loom[f'nobrain_{az}'] = loom_run(f'results/phase3/loom_az{az:+d}_nobrain.csv', az)
    loom[f'real_{az}'] = loom_run(f'results/phase3/loom_az{az:+d}_brain.csv', az)
for az in (30, -30):
    for sd in (1, 2): loom[f'shuffle{sd}_{az}'] = loom_run(f'results/phase4/loom_az{az:+d}_shuffle{sd}.csv', az)
js('loom', loom)
def opto_run(path):
    d = pd.read_csv(path); r = lambda c, n=2: [round(float(v), n) for v in d[c]] if c in d else None
    return dict(t=r('t',3), yaw=r('yaw',1), wz=r('wz',1), turn=r('turn'), DN_L=r('DN_all_left',2), DN_R=r('DN_all_right',2), nact=[int(v) for v in d.nact],
                total_yaw=round(float(d.yaw.iloc[-1]),1), peak_wz=round(float(d.wz.max()),1))
js('opto', {'nobrain': opto_run('results/phase3/opto_nobrain.csv'), 'real': opto_run('results/phase3/opto_brain.csv'),
            'shuffle1': opto_run('results/phase4/opto_shuffle1.csv'), 'shuffle2': opto_run('results/phase4/opto_shuffle2.csv')})

# phase 1 lateralization
r1 = pd.read_csv('results/phase1/dn_rates.csv', index_col=0); r1['cell_type'] = r1.cell_type.fillna('')
r1['fam'] = r1.cell_type.str.replace(r'^DNg02_.*', 'DNg02', regex=True)
types = ['DNp01','DNp03','DNp11','DNa02','DNa01','DNb01','DNg02','DNp06','DNp09','DNp04','DNp02','DNp05']
lat = {}
for exp in ['LPLC2_L','LPLC2_R','LC4_L','LC4_R','LPLC2_both']:
    g = r1[r1.fam.isin(types)].groupby(['fam','side'])[exp].mean().unstack(fill_value=0)
    lat[exp] = {t: [round(float(g.loc[t,'left']),1) if t in g.index else 0, round(float(g.loc[t,'right']),1) if t in g.index else 0] for t in types}
dn_active = {exp: int((r1[exp] > 5).sum()) for exp in ['baseline','LPLC2_L','LPLC2_R','LPLC2_both','LC4_L','LC4_R','LC4_LPLC2_L']}
js('phase1', dict(types=types, lat=lat, dn_active=dn_active, n_dn=int(len(r1))))

summ = {k: json.load(open(f'results/phase4/summary_{k}.json')) for k in ['real','shuffle1','shuffle2']}
js('summary', summ)
sizes = {f: os.path.getsize(f'{OUT}/data/{f}') for f in os.listdir(f'{OUT}/data')}
print('data sizes (KB):', {k: round(v/1024) for k, v in sizes.items()}, 'png KB', round(os.path.getsize(f'{OUT}/img/brain_frontal.png')/1024))
print('EXPORT DONE')
