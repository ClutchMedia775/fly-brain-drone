"""flyexp.py -- the two closed-loop experiments, reusable across brain conditions."""
import time, json
import numpy as np, pandas as pd
from flydrone import Quad, Autopilot, Retina, Bridge, ZERO_SP, d2r
DT = 0.02; SUB = 20

def run_looming(fb, az_deg, brain=True, T=3.5, v_obs=2.0, R_obs=0.3, d0=6.0, log_active=False, runaway=30000):
    q = Quad(); ap = Autopilot(q); ret = Retina(); br = Bridge(fb, q.m); fb.reset()
    start = q.p.copy(); az = d2r(az_deg)
    obs_p = start + d0*np.array([np.cos(az), np.sin(az), 0.0]); obs_v = (start - obs_p)/d0*v_obs
    rows, active, mind, sp, hot = [], [], 1e9, dict(ZERO_SP), 0
    t_wall = time.time()
    for k in range(int(T/DT)):
        rates, geo = ret.looming(q, obs_p, R_obs)
        out = None
        if brain:
            fb.set_rates(rates); out = fb.step(active_idx=log_active); sp = br.update(out)
            if log_active: active.append(out['_active_idx'].tolist())
            hot = hot + 1 if out['_n_active'] > runaway else 0
        for _ in range(SUB):
            thrust, tau = ap(sp); q.step(thrust, tau); obs_p = obs_p + obs_v*q.dt
            mind = min(mind, np.linalg.norm(obs_p - q.p))
        roll, pitch, yaw = q.euler()
        rows.append(dict(t=q.t, x=q.p[0], y=q.p[1], z=q.p[2], roll=np.rad2deg(roll), yaw=np.rad2deg(yaw), ox=obs_p[0], oy=obs_p[1],
                         dist=geo['d'], drive=geo['drive'], turn=sp['turn'], gf=sp['gf'],
                         **({g: br.ema[g] for g in Bridge.GROUPS} if brain else {}), nact=(out['_n_active'] if brain else 0)))
        if hot >= 10: print('   runaway activity, stopping early at t=%.2f' % q.t, flush=True); break
    df = pd.DataFrame(rows)
    summ = dict(min_dist=float(mind), final_y=float(df.y.iloc[-1]), final_yaw=float(df.yaw.iloc[-1]), peak_turn=float(df.turn.abs().max()),
                peak_gf=float(df.gf.max()), max_active=int(df.nact.max()), wall=time.time()-t_wall, ticks=len(df))
    return df, summ, active

def run_optomotor(fb, brain=True, T=3.0, t_on=0.5, t_off=1.5, omega_target=d2r(90), log_active=False, runaway=30000):
    q = Quad(); ap = Autopilot(q); ret = Retina(); br = Bridge(fb, q.m); fb.reset()
    tau_dist = np.array([0, 0, q.I[2]*ap.kd_yaw*omega_target])
    rows, active, sp, hot = [], [], dict(ZERO_SP), 0; t_wall = time.time()
    for k in range(int(T/DT)):
        out = None
        if brain:
            fb.set_rates(ret.rotation(q)); out = fb.step(active_idx=log_active); sp = br.update(out)
            if log_active: active.append(out['_active_idx'].tolist())
            hot = hot + 1 if out['_n_active'] > runaway else 0
        for _ in range(SUB):
            thrust, tau = ap(sp); q.step(thrust, tau, tau_dist if t_on <= q.t < t_off else None)
        roll, pitch, yaw = q.euler()
        rows.append(dict(t=q.t, yaw=np.rad2deg(yaw), wz=np.rad2deg(q.w[2]), turn=sp['turn'], yawrate_sp=np.rad2deg(sp['yawrate_sp']),
                         **({g: br.ema[g] for g in Bridge.GROUPS} if brain else {}), nact=(out['_n_active'] if brain else 0)))
        if hot >= 10: print('   runaway activity, stopping early at t=%.2f' % q.t, flush=True); break
    df = pd.DataFrame(rows)
    summ = dict(total_yaw=float(df.yaw.iloc[-1]), peak_wz=float(df.wz.max()), mean_turn=float(df[(df.t>t_on)&(df.t<t_off)].turn.mean()),
                max_active=int(df.nact.max()), wall=time.time()-t_wall, ticks=len(df))
    return df, summ, active
