import os, json, time
os.chdir(os.path.expanduser('~/Drosophila_brain_model'))
import numpy as np, pandas as pd
from brian2 import ms
from flybrain_step import FlyBrain
from flydrone import Quad, Autopilot, Retina, Bridge, ZERO_SP, G, d2r
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt

L = json.load(open('celltype_ids_783.json'))
inputs = {k: L[k] for k in ['LPLC2_left','LPLC2_right','LC4_left','LC4_right'] + [f'T{t}{s}_{side}' for t in (4,5) for s in 'ab' for side in ('left','right')]}
readout = {k: L[k] for k in Bridge.GROUPS}
DT = 0.02; SUB = 20
t0 = time.time(); fb = FlyBrain('./Completeness_783.csv', './Connectivity_783.parquet', inputs, readout, dt_ctrl=DT*1000*ms)
fb.step(); fb.reset(); print(f'brain ready in {time.time()-t0:.0f}s', flush=True)
os.makedirs('results/phase3', exist_ok=True)

def run_looming(az_deg, brain, T=3.5, v_obs=2.0, R_obs=0.3, d0=6.0):
    q = Quad(); ap = Autopilot(q); ret = Retina(); br = Bridge(fb, q.m); fb.reset()
    start = q.p.copy(); az = d2r(az_deg)
    obs_p = start + d0*np.array([np.cos(az), np.sin(az), 0.0]); obs_v = (start - obs_p)/d0*v_obs
    rows = []; mind = 1e9; sp = dict(ZERO_SP); t_wall = time.time()
    for k in range(int(T/DT)):
        rates, geo = ret.looming(q, obs_p, R_obs)
        if brain:
            fb.set_rates(rates); out = fb.step(); sp = br.update(out)
        for _ in range(SUB):
            thrust, tau = ap(sp); q.step(thrust, tau); obs_p = obs_p + obs_v*q.dt
            mind = min(mind, np.linalg.norm(obs_p - q.p))
        roll, pitch, yaw = q.euler()
        rows.append(dict(t=q.t, x=q.p[0], y=q.p[1], z=q.p[2], roll=np.rad2deg(roll), yaw=np.rad2deg(yaw), dist=geo['d'], drive=geo['drive'],
                         turn=sp['turn'], gf=sp['gf'], **({g: br.ema[g] for g in Bridge.GROUPS} if brain else {}), nact=(out['_n_active'] if brain else 0)))
    df = pd.DataFrame(rows); tag = f"loom_az{az_deg:+d}_{'brain' if brain else 'nobrain'}"; df.to_csv(f'results/phase3/{tag}.csv', index=False)
    print(f'{tag:24s} min dist {mind:5.2f} m  final y {df.y.iloc[-1]:+6.2f} m  z {df.z.iloc[-1]:5.2f}  yaw {df.yaw.iloc[-1]:+6.1f} deg  peak|turn| {df.turn.abs().max():.2f}  peak gf {df.gf.max():.2f}  ({time.time()-t_wall:.0f}s wall)', flush=True)
    return df, mind

def run_optomotor(brain, T=3.0, t_on=0.5, t_off=1.5, omega_target=d2r(90)):
    q = Quad(); ap = Autopilot(q); ret = Retina(); br = Bridge(fb, q.m); fb.reset()
    tau_dist = np.array([0, 0, q.I[2]*ap.kd_yaw*omega_target])   # would spin the drone at ~90 deg/s left with no brain
    rows = []; sp = dict(ZERO_SP); t_wall = time.time()
    for k in range(int(T/DT)):
        if brain:
            fb.set_rates(ret.rotation(q)); out = fb.step(); sp = br.update(out)
        for _ in range(SUB):
            thrust, tau = ap(sp); q.step(thrust, tau, tau_dist if t_on <= q.t < t_off else None)
        roll, pitch, yaw = q.euler()
        rows.append(dict(t=q.t, yaw=np.rad2deg(yaw), wz=np.rad2deg(q.w[2]), turn=sp['turn'], yawrate_sp=np.rad2deg(sp['yawrate_sp']),
                         **({g: br.ema[g] for g in Bridge.GROUPS} if brain else {}), nact=(out['_n_active'] if brain else 0)))
    df = pd.DataFrame(rows); tag = f"opto_{'brain' if brain else 'nobrain'}"; df.to_csv(f'results/phase3/{tag}.csv', index=False)
    print(f'{tag:24s} total yaw {df.yaw.iloc[-1]:+7.1f} deg  peak yaw rate {df.wz.max():+6.1f} deg/s  mean turn during disturbance {df[(df.t>t_on)&(df.t<t_off)].turn.mean():+.3f}  max active {df.nact.max()}  ({time.time()-t_wall:.0f}s wall)', flush=True)
    return df

print('\n=== Experiment B: looming obstacle (0.3 m sphere, 2 m/s, aimed at the drone) ===')
loom = {}
for az in (+30, -30, 0):
    for brain in (False, True):
        loom[(az, brain)] = run_looming(az, brain)
print('\n=== Experiment A: optomotor (1 s yaw disturbance torque, leftward) ===')
opto = {b: run_optomotor(b) for b in (False, True)}

# ---- figure
fig, ax = plt.subplots(2, 3, figsize=(16, 9))
a = ax[0,0]
for (az, brain), (df, mind) in loom.items():
    a.plot(df.x, df.y, ('-' if brain else ':'), color={30:'tab:blue', -30:'tab:red', 0:'tab:green'}[az], label=f'az {az:+d} {"brain" if brain else "no brain"} (min {mind:.2f} m)')
for az in (30,-30,0):
    r = d2r(az); a.plot([6*np.cos(r), 0], [6*np.sin(r), 0], color='gray', lw=0.5, alpha=0.5)
a.set_xlabel('x forward (m)'); a.set_ylabel('y left (m)'); a.set_title('Top-down: drone path vs obstacle bearing'); a.legend(fontsize=7); a.axis('equal'); a.grid(alpha=.3)
for i, az in enumerate((30, -30)):
    df, _ = loom[(az, True)]; a = ax[0, 1+i]
    a.plot(df.t, df.turn, 'k', label='turn cmd (+right)'); a.plot(df.t, df.gf, 'm', label='giant fiber (escape)')
    a.plot(df.t, df.drive/150, 'c--', label='retina drive /150'); a.plot(df.t, df.dist/6, 'g:', label='distance /6 m')
    a.set_title(f'Looming from az {az:+d} deg (brain on)'); a.set_xlabel('t (s)'); a.legend(fontsize=7); a.grid(alpha=.3)
a = ax[1,0]
for az in (30, -30, 0):
    df, _ = loom[(az, True)]
    a.plot(df.t, df.DNa02_right - df.DNa02_left, label=f'DNa02 R-L, az {az:+d}')
    a.plot(df.t, df.DNp11_left - df.DNp11_right, '--', label=f'DNp11 L-R, az {az:+d}')
a.set_title('Steering DN asymmetry (Hz, smoothed)'); a.set_xlabel('t (s)'); a.legend(fontsize=7); a.grid(alpha=.3)
a = ax[1,1]
for b, df in opto.items(): a.plot(df.t, df.yaw, label=f'yaw {"brain" if b else "no brain"}')
a.axvspan(0.5, 1.5, color='y', alpha=.2, label='disturbance'); a.set_title('Optomotor: heading under yaw disturbance'); a.set_xlabel('t (s)'); a.set_ylabel('yaw (deg, +left)'); a.legend(fontsize=7); a.grid(alpha=.3)
a = ax[1,2]; df = opto[True]
a.plot(df.t, df.turn, 'k', label='turn cmd (+right)'); a.plot(df.t, df.wz/90, 'b--', label='yaw rate /90 deg/s')
a.plot(df.t, (df.DN_all_left - df.DN_all_right), 'r:', label='all DN L-R (Hz)')
a.set_title('Optomotor: brain output'); a.set_xlabel('t (s)'); a.legend(fontsize=7); a.grid(alpha=.3)
fig.tight_layout(); fig.savefig('results/phase3/phase3.png', dpi=110)
import shutil; shutil.copy('results/phase3/phase3.png', '/mnt/c/Users/killm/AppData/Local/Temp/phase3.png')
print('\nPHASE3 DONE')
