# Fly Brain Drone

The complete wiring diagram of a fruit fly brain (FlyWire v783, 138,639 neurons, 54 million synapses), run as a spiking
leaky integrate-and-fire network with the Shiu et al. (2024) model, wired to a simulated quadcopter. No parameters are
trained. Fed a looming object through its own looming-detector neurons, the connectome steers the drone away from the
threat; fed rotational optic flow, it damps a yaw disturbance. Shuffling the synaptic targets destroys both behaviours.

**Live write-up:** see the URL in the latest commit message or `site/` deployed on Vercel.

## Layout

```
site/        static write-up (index.html, styles.css, app.js, data/*.js, img/*)   -> deployed to Vercel
sim/         simulation code (runs inside the philshiu/Drosophila_brain_model repo, see below)
results/     flight logs (CSV), descending-neuron rate tables, summary JSON, figure
serve.js     local preview:  node serve.js  ->  http://localhost:8787
```

## Reproducing the simulations

The simulation depends on two external repositories that are **not** vendored here (about 100 MB of data):

1. `git clone https://github.com/philshiu/Drosophila_brain_model` — the model and the v783 connectivity files.
2. `git clone https://github.com/flyconnectome/flywire_annotations` — cell-type labels for every v783 neuron.

Environment (Linux or WSL2; the repo's `environment.yml` creates a conda env named `brian2`):

```bash
conda env create -f environment.yml && conda activate brian2
pip install "setuptools<80" "cython<3" matplotlib scipy   # brian2 2.5.1 needs both pins
```

Copy everything from `sim/` into the `Drosophila_brain_model` checkout, then:

| Script | What it does |
|---|---|
| `mklookup.py` | builds `celltype_ids_783.json` (cell type + side -> FlyWire root IDs) from the annotations |
| `phase0.py` | reproduces the paper's sugar-neuron -> MN9 example and times it |
| `phase1.py`, `phase1b.py` | open-loop looming experiments, descending-neuron rate tables |
| `flybrain_step.py` | `FlyBrain`: build once, step in 20 ms ticks, settable Poisson rates, DN spike counts, optional synapse shuffle |
| `flydrone.py` | 6-DOF quadcopter, attitude autopilot, analytic retina, DN -> setpoint bridge |
| `flyexp.py` | the looming and optomotor closed-loop experiments |
| `phase3_run.py` | real-brain flights (all bearings, brain on/off) + figure |
| `phase4_control.py real 0` / `shuffle 1` / `shuffle 2` | real vs shuffled-wiring control runs with per-tick activity logs |
| `export_site.py` | exports everything the web page needs into `site/data` and `site/img` |
| `phase5.py main real` / `main shuffle <s>` / `main rand <s>` | n=10 comparison: real wiring, shuffled wiring, random read-out control |
| `phase5.py ablate` / `t4t5` / `forward` / `robust` | read-out ablations, T4/T5-driven looming, forward cruise past obstacles, bearing × speed × size sweep |
| `malecns_prep.py` | converts MaleCNS v1.0 flat files (public, ~1.1 GB, `~/malecns`) into the same model format |
| `phase6_mcns.py openloop` / `fly` / `shuffle` | MaleCNS replication, flights with descending-neuron and wing-motor-neuron read-outs, shuffle control |
| `phase56_summary.py`, `export3d.py` | aggregate round-two results (bootstrap CIs) and export 3D neuron positions for the site |

MaleCNS flat files come from `https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/`
(body annotations, body neurotransmitters, connectome weights); no account or token is required.

A full-brain 3.5 s flight takes about 20 s of wall time on an i7-12700F (Brian2 with Cython). Memory: give WSL2 at least
16 GB for a single network; parallel batch runs need ~9 GB per worker.

## Credits

FlyWire connectome: Dorkenwald et al., Nature 2024 (CC-BY 4.0). Annotations: Schlegel et al., Nature 2024. Model:
Shiu et al., Nature 2024, code at philshiu/Drosophila_brain_model. Full source list with links is on the page.
Built with Claude Code, September 2026.
