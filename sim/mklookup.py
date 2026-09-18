import os, json, pandas as pd
os.chdir(os.path.expanduser('~/Drosophila_brain_model'))
ann = pd.read_csv(os.path.expanduser('~/flywire_annotations/supplemental_files/Supplemental_file1_neuron_annotations.tsv'), sep='\t', low_memory=False)
comp = pd.read_csv('./Completeness_783.csv', index_col=0)
ann = ann[ann.root_id.isin(set(comp.index))]; ann['cell_type'] = ann.cell_type.fillna('')
def ids(rx, side): 
    m = ann.cell_type.str.match(rx) & (ann.side == side)
    return [int(x) for x in ann.loc[m, 'root_id']]
types = ['LPLC2','LC4','LC6','LPLC1','LC16','DNp01','DNp02','DNp03','DNp04','DNp05','DNp06','DNp09','DNp10','DNp11','DNp103',
         'DNa01','DNa02','DNa04','DNb01','DNb09','HSN','HSE','HSS','H2'] + [f'T{t}{s}' for t in (4,5) for s in 'abcd']
L = {f'{ct}_{s}': ids(f'^{ct}$', s) for ct in types for s in ['left','right']}
L.update({f'DNg02_{s}': ids(r'^DNg02_', s) for s in ['left','right']})
L.update({f'VS_{s}': ids(r'^VS\d+$', s) for s in ['left','right']})
L.update({f'DN_all_{s}': [int(x) for x in ann.loc[(ann.super_class=='descending') & (ann.side==s), 'root_id']] for s in ['left','right']})
json.dump(L, open('celltype_ids_783.json','w'))
print('lookup groups:', len(L), '| empty:', [k for k,v in L.items() if not v])
