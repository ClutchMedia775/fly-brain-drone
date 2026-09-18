"""flybrain_step.py -- closed-loop stepping wrapper around the Shiu et al. LIF model.

Build the FlyWire network once, then advance it in control ticks while changing
Poisson input rates and reading descending-neuron spike counts between ticks.
shuffle_seed: if set, every synapse keeps its presynaptic neuron, sign and strength
but is re-targeted to a random postsynaptic neuron (wiring-specificity control).
"""
import numpy as np
import pandas as pd
from brian2 import NeuronGroup, Synapses, PoissonGroup, Network, mV, ms, Hz
from model import default_params

class FlyBrain:
    def __init__(self, path_comp, path_con, input_groups, readout_groups,
                 dt_ctrl=20*ms, params=None, shuffle_seed=None):
        self.p = dict(params or default_params)
        self.dt_ctrl = dt_ctrl
        df_comp = pd.read_csv(path_comp, index_col=0)
        df_con = pd.read_parquet(path_con)
        self.flyid2i = {f: i for i, f in enumerate(df_comp.index)}
        N = len(df_comp)
        pre = df_con['Presynaptic_Index'].values
        post = df_con['Postsynaptic_Index'].values
        if shuffle_seed is not None:
            post = np.random.default_rng(shuffle_seed).permutation(post)
        self.shuffled = shuffle_seed is not None

        eqs = self.p['eqs'] + '\n nspk : integer\n'
        self.neu = NeuronGroup(N, model=eqs, method='linear', threshold=self.p['eq_th'],
                               reset=self.p['eq_rst'] + '; nspk += 1', refractory='rfc',
                               name='neurons', namespace=self.p)
        self.neu.v = self.p['v_0']; self.neu.g = 0*mV; self.neu.rfc = self.p['t_rfc']; self.neu.nspk = 0

        self.syn = Synapses(self.neu, self.neu, 'w : volt', on_pre='g += w', delay=self.p['t_dly'], name='synapses')
        self.syn.connect(i=pre, j=post)
        self.syn.w = df_con['Excitatory x Connectivity'].values * self.p['w_syn']

        self.input_groups = {k: np.array([self.flyid2i[f] for f in v], dtype=int) for k, v in input_groups.items()}
        self.in_idx = np.unique(np.concatenate(list(self.input_groups.values())))
        self.pos = {i: k for k, i in enumerate(self.in_idx)}
        self.pg = PoissonGroup(len(self.in_idx), rates=0*Hz, name='drive')
        self.syn_in = Synapses(self.pg, self.neu, on_pre='v += w_in', name='drive_syn',
                               namespace={'w_in': self.p['w_syn'] * self.p['f_poi']})
        self.syn_in.connect(i=np.arange(len(self.in_idx)), j=self.in_idx)
        self.neu.rfc[self.in_idx] = 0*ms

        self.readout_groups = {k: np.array([self.flyid2i[f] for f in v], dtype=int) for k, v in readout_groups.items()}
        self._last = np.zeros(N, dtype=int)
        self.net = Network(self.neu, self.syn, self.pg, self.syn_in)
        self.net.store('init')
        self.t = 0.0
        self.rates = np.zeros(len(self.in_idx))

    def set_rates(self, group_rates):
        for k, hz in group_rates.items():
            self.rates[[self.pos[i] for i in self.input_groups[k]]] = hz
        self.pg.rates = self.rates * Hz

    def step(self, n_ticks=1, active_idx=False):
        self.net.run(n_ticks * self.dt_ctrl)
        self.t += float(n_ticks * self.dt_ctrl / ms)
        cnt = np.array(self.neu.nspk[:])
        d = cnt - self._last
        self._last = cnt
        out = {k: int(d[idx].sum()) for k, idx in self.readout_groups.items()}
        out['_per_neuron'] = {k: d[idx] for k, idx in self.readout_groups.items()}
        out['_n_active'] = int((d > 0).sum())
        if active_idx:
            out['_active_idx'] = np.nonzero(d)[0]
        return out

    def rate_hz(self, out, group):
        n = len(self.readout_groups[group])
        return out[group] / n / float(self.dt_ctrl / ms) * 1000.0

    def reset(self):
        self.net.restore('init')
        self._last[:] = 0; self.t = 0.0
        self.rates[:] = 0; self.pg.rates = 0*Hz
