"""flydrone.py -- quadcopter body, analytic retina and DN->setpoint bridge for the fly-brain controller.

Frames: body x forward, y LEFT, z up (right-handed). Positive roll (about +x) tilts thrust to the RIGHT.
Positive yaw rate (about +z) turns LEFT. Azimuth positive = object on the LEFT.
"""
import numpy as np
G = 9.81
d2r = np.deg2rad

def expm_so3(th):
    a = np.linalg.norm(th)
    if a < 1e-12: return np.eye(3)
    k = th / a; K = np.array([[0,-k[2],k[1]],[k[2],0,-k[0]],[-k[1],k[0],0]])
    return np.eye(3) + np.sin(a)*K + (1-np.cos(a))*K@K

class Quad:
    def __init__(self, m=0.5, I=(2.5e-3, 2.5e-3, 4.5e-3), dt=1e-3, drag=0.25):
        self.m, self.I, self.dt, self.drag = m, np.array(I), dt, drag
        self.reset()
    def reset(self, p=(0.0, 0.0, 2.0)):
        self.p = np.array(p, float); self.v = np.zeros(3); self.R = np.eye(3); self.w = np.zeros(3); self.t = 0.0
    def euler(self):
        R = self.R
        return (np.arctan2(R[2,1], R[2,2]), -np.arcsin(np.clip(R[2,0], -1, 1)), np.arctan2(R[1,0], R[0,0]))
    def step(self, thrust, torque, ext_torque=None):
        thrust = float(np.clip(thrust, 0.0, 2.5*self.m*G))
        f = self.R @ np.array([0, 0, thrust]) + np.array([0, 0, -self.m*G]) - self.drag*self.v
        self.v += f/self.m*self.dt; self.p += self.v*self.dt
        tau = torque + (ext_torque if ext_torque is not None else 0)
        self.w += (tau - np.cross(self.w, self.I*self.w))/self.I*self.dt
        self.R = self.R @ expm_so3(self.w*self.dt); self.t += self.dt

class Autopilot:
    """Inner loop standing in for the fly's ventral nerve cord: tracks roll/pitch/yaw-rate setpoints and holds altitude."""
    def __init__(self, quad, z_sp=2.0, kp=40., kd=8., kd_yaw=6., kp_z=4., kd_z=3.):
        self.q, self.z_sp, self.kp, self.kd, self.kd_yaw, self.kp_z, self.kd_z = quad, z_sp, kp, kd, kd_yaw, kp_z, kd_z
    def __call__(self, sp):
        q = self.q; roll, pitch, yaw = q.euler()
        tau = q.I * np.array([self.kp*(sp['roll_sp']-roll) - self.kd*q.w[0],
                              self.kp*(sp['pitch_sp']-pitch) - self.kd*q.w[1],
                              self.kd_yaw*(sp['yawrate_sp']-q.w[2])])
        thrust = q.m*(G + self.kp_z*(self.z_sp-q.p[2]) - self.kd_z*q.v[2]) + sp['thrust_extra']
        return thrust, tau

ZERO_SP = dict(roll_sp=0.0, pitch_sp=0.0, yawrate_sp=0.0, thrust_extra=0.0, turn=0.0, gf=0.0)

class Retina:
    """Analytic stand-in for the optic lobe. ENGINEERED: converts geometry into Poisson rates for named cell-type groups."""
    def __init__(self, dt_tick=0.02, r_max=150., thetadot_ref=d2r(15), thetadot_min=d2r(2), fov_half=d2r(100), blend=d2r(30), omega_ref=d2r(90)):
        self.dt, self.r_max, self.ref, self.min, self.fov, self.blend, self.omega_ref = dt_tick, r_max, thetadot_ref, thetadot_min, fov_half, blend, omega_ref
        self.prev_theta = None
    def looming(self, quad, obs_p, obs_r):
        rel = quad.R.T @ (obs_p - quad.p); d = np.linalg.norm(rel)
        az = np.arctan2(rel[1], rel[0])
        theta = 2*np.arcsin(min(1.0, obs_r/max(d, 1e-6)))
        thetadot = 0.0 if self.prev_theta is None else (theta - self.prev_theta)/self.dt
        self.prev_theta = theta
        drive = 0.0
        if abs(az) < self.fov and thetadot > self.min and d > obs_r:
            drive = self.r_max*min(1.0, thetadot/self.ref)
        wl = float(np.clip(0.5 + az/(2*self.blend), 0, 1)); wr = float(np.clip(0.5 - az/(2*self.blend), 0, 1))
        return {'LPLC2_left': drive*wl, 'LPLC2_right': drive*wr, 'LC4_left': drive*wl, 'LC4_right': drive*wr}, dict(d=d, az=az, theta=theta, thetadot=thetadot, drive=drive)
    def rotation(self, quad):
        """Yaw self-rotation -> horizontal-motion T4/T5 subtypes. Left yaw: back-to-front (b) on left eye, front-to-back (a) on right eye."""
        wz = quad.w[2]; r = self.r_max*min(1.0, abs(wz)/self.omega_ref)
        L_b = R_a = r if wz > 0 else 0.0
        L_a = R_b = r if wz < 0 else 0.0
        return {'T4a_left': L_a, 'T5a_left': L_a, 'T4b_left': L_b, 'T5b_left': L_b,
                'T4a_right': R_a, 'T5a_right': R_a, 'T4b_right': R_b, 'T5b_right': R_b}

class Bridge:
    """DN firing rates -> autopilot setpoints. ENGINEERED linear read-out; signs follow fly physiology:
    ipsilateral DNa02/DNa01/DNb01 -> ipsiversive turn; ipsilateral DNg02 (wing amplitude) and DNp03/DNp11 (saccade) -> contraversive turn;
    giant fiber DNp01 -> escape climb."""
    GROUPS = ['DNp01_left','DNp01_right','DNa02_left','DNa02_right','DNa01_left','DNa01_right','DNb01_left','DNb01_right',
              'DNp03_left','DNp03_right','DNp11_left','DNp11_right','DNg02_left','DNg02_right','DN_all_left','DN_all_right']
    def __init__(self, fb, m, dt=0.02, tau=0.06, roll_max=d2r(20), yawrate_max=d2r(120), climb_frac=0.35, norm=60.0):
        self.fb, self.m, self.a, self.roll_max, self.yawrate_max, self.climb, self.norm = fb, m, dt/tau, roll_max, yawrate_max, climb_frac, norm
        self.ema = {g: 0.0 for g in self.GROUPS}
    def update(self, out):
        e = self.ema
        for g in self.GROUPS: e[g] += self.a*(self.fb.rate_hz(out, g) - e[g])
        turn = ((e['DNa02_right']-e['DNa02_left']) + (e['DNa01_right']-e['DNa01_left']) + (e['DNb01_right']-e['DNb01_left'])
                + 0.5*(e['DNp03_left']+e['DNp11_left']-e['DNp03_right']-e['DNp11_right'])
                + (e['DNg02_left']-e['DNg02_right']))/self.norm
        turn = float(np.clip(turn, -1, 1))
        gf = float(np.clip(0.5*(e['DNp01_left']+e['DNp01_right'])/100.0, 0, 1))
        return dict(roll_sp=self.roll_max*turn, pitch_sp=0.0, yawrate_sp=-self.yawrate_max*turn,
                    thrust_extra=self.climb*self.m*G*gf, turn=turn, gf=gf)
