"""Precessing-ellipse window fits for planetary satellites (used by 11_moons.py and verify_solar.py).

A window of W days is described by nine numbers (CONTRACT.md section 2):

    a, e, varpi0, dvarpi, inc, Omega0, dOmega, lambda0, n

and positions at t = jd - tc (tc = the window's centre) are

    Omega = Omega0 + dOmega t,  varpi = varpi0 + dvarpi t,  M = lambda0 + n t - varpi,
    E - e sin E = M,  xp = a (cos E - e),  yp = a sqrt(1 - e^2) sin E,  w = varpi - Omega,
    r_fit = Rz(Omega) Rx(inc) Rz(w) (xp, yp, 0)          (active rotations)

The least-squares problem is solved in non-singular variables — (k, h) = e (cos, sin) varpi0 and
(q, p) = tan(inc/2) (cos, sin) Omega0 — because most of these moons have e and inc close to zero,
where varpi0 and Omega0 are undefined and a fit in the classical variables stalls. The two
precession rates are held towards zero by one weak regularisation row each, so that a rate the
data cannot see (the pericentre of a near-circular orbit) stays finite instead of wandering;
the weight is chosen so that it moves a well-determined rate by far less than the float32 step.

Initial guesses are built from the data, never assumed: the mean orbit plane from an SVD of the
window's positions, the mean longitude and mean motion from a straight-line fit to the unwrapped
in-plane longitude, e and varpi from the equation of centre left in that fit, and a from the
mean radius. Two further starts come from the osculating elements at the window centre and from
the previous window's solution carried forward; when the best of those still misses the error
goal, a ring of eight pericentre longitudes is tried. The lowest-cost solution wins. Everything
is deterministic: fixed sample grids, no random restarts.
"""
import math

import numpy as np
from scipy.optimize import least_squares

TWO_PI = 2 * math.pi


def kepler(M, e):
    """Solve E - e sin E = M (vectorised); Danby's starter, then Newton to machine precision."""
    M = np.asarray(M, dtype=np.float64)
    Mr = np.remainder(M + math.pi, TWO_PI) - math.pi
    E = Mr + 0.85 * e * np.sign(np.sin(Mr)) if e > 0.3 else Mr + e * np.sin(Mr)
    for _ in range(30):
        f = E - e * np.sin(E) - Mr
        d = f / (1 - e * np.cos(E))
        E = E - d
        if np.max(np.abs(d)) < 1e-15:
            break
    return E + (M - Mr)


def classical(p):
    """Internal (non-singular) parameters -> the nine stored values."""
    a, k, h, dv, q, pp, dO, l0, n = p
    e = math.hypot(k, h)
    varpi0 = math.atan2(h, k)
    inc = 2 * math.atan(math.hypot(q, pp))
    O0 = math.atan2(pp, q)
    return np.array([a, e, varpi0, dv, inc, O0, dO, l0, n])


def internal(c):
    a, e, varpi0, dv, inc, O0, dO, l0, n = c
    s = math.tan(inc / 2)
    return np.array([a, e * math.cos(varpi0), e * math.sin(varpi0), dv, s * math.cos(O0),
                     s * math.sin(O0), dO, l0, n])


def position(c, t):
    """Positions (3, N) in the fit frame from the nine stored values c at times t (days from tc)."""
    a, e, varpi0, dv, inc, O0, dO, l0, n = [float(x) for x in c]
    t = np.asarray(t, dtype=np.float64)
    O = O0 + dO * t
    varpi = varpi0 + dv * t
    M = l0 + n * t - varpi
    E = kepler(M, e)
    xp = a * (np.cos(E) - e)
    yp = a * math.sqrt(max(0.0, 1 - e * e)) * np.sin(E)
    w = varpi - O
    cO, sO, ci, si, cw, sw = np.cos(O), np.sin(O), math.cos(inc), math.sin(inc), np.cos(w), np.sin(w)
    X = (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp
    Y = (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp
    Z = (sw * si) * xp + (cw * si) * yp
    return np.array([X, Y, Z])


def f32(c):
    """Round the nine values the way they are stored: angles reduced to [0, 2pi), then float32."""
    c = np.array(c, dtype=np.float64)
    for i in (2, 5, 7):
        c[i] = np.remainder(c[i], TWO_PI)
    return c.astype(np.float32).astype(np.float64)


def guess_from_data(t, y):
    """Initial elements from positions y (3, N) at times t (days from the window centre)."""
    # Mean orbit plane: the right-singular vector with the smallest singular value.
    _, _, vt = np.linalg.svd(y.T, full_matrices=False)
    h = vt[2]
    L = np.cross(y[:, :-1].T, y[:, 1:].T).sum(axis=0)
    if h @ L < 0:
        h = -h
    inc = math.acos(max(-1.0, min(1.0, h[2])))
    O = math.atan2(h[0], -h[1]) if math.hypot(h[0], h[1]) > 1e-12 else 0.0
    u = np.array([math.cos(O), math.sin(O), 0.0])
    v = np.cross(h, u)
    theta = np.unwrap(np.arctan2(v @ y, u @ y)) + O          # true longitude (dogleg)
    r = np.linalg.norm(y, axis=0)
    A = np.vstack([np.ones_like(t), t]).T
    c0, c1 = np.linalg.lstsq(A, theta, rcond=None)[0]
    lam = c0 + c1 * t
    B = np.vstack([np.ones_like(t), t, np.sin(lam), np.cos(lam)]).T
    c0, c1, s1, s2 = np.linalg.lstsq(B, theta, rcond=None)[0]
    # theta - lambda ~ 2e sin(lambda - varpi) = 2e (sin lam cos varpi - cos lam sin varpi)
    e = min(0.9, 0.5 * math.hypot(s1, s2))
    varpi = math.atan2(-s2, s1)
    a = float(r.mean()) / (1 + 0.5 * e * e)
    return np.array([a, max(e, 1e-6), varpi, 0.0, inc, O, 0.0, c0, c1])


def guess_osculating(r, v, mu):
    """Osculating elements (stored-value order) from a state r (km), v (km/day), mu (km^3/day^2)."""
    h = np.cross(r, v)
    hn = np.linalg.norm(h)
    inc = math.acos(max(-1.0, min(1.0, h[2] / hn)))
    O = math.atan2(h[0], -h[1]) if math.hypot(h[0], h[1]) > 1e-12 * hn else 0.0
    rn = np.linalg.norm(r)
    ev = np.cross(v, h) / mu - r / rn
    e = float(np.linalg.norm(ev))
    a = 1 / (2 / rn - v @ v / mu)
    n = math.sqrt(mu / abs(a) ** 3)
    u = np.array([math.cos(O), math.sin(O), 0.0])
    w_hat = np.cross(h / hn, u)
    arglat = math.atan2(r @ w_hat, r @ u)
    if e > 1e-8:
        argp = math.atan2(ev @ w_hat, ev @ u)
        f = arglat - argp
        E = 2 * math.atan2(math.sqrt(1 - e) * math.sin(f / 2), math.sqrt(1 + e) * math.cos(f / 2))
        M = E - e * math.sin(E)
    else:
        argp, M = 0.0, arglat
    varpi = O + argp
    return np.array([abs(a), max(e, 1e-6), varpi, 0.0, inc, O, 0.0, varpi + M, n])


class WindowFit:
    """Fit one window: `t` days from the window centre, `y` (3, N) positions in the fit frame."""

    def __init__(self, t, y, W, reg=1e-4):
        self.t, self.y, self.W = t, y, W
        self.scale = float(np.linalg.norm(y, axis=0).mean())
        self.wreg = reg * self.scale * W / 2

    def resid(self, p):
        c = classical(p)
        d = (position(c, self.t) - self.y).ravel()
        return np.concatenate([d, [self.wreg * p[3], self.wreg * p[6]]])

    def solve(self, c0, max_nfev=200):
        try:
            res = least_squares(self.resid, internal(c0), method='trf', x_scale='jac',
                                max_nfev=max_nfev, xtol=1e-14, ftol=1e-14, gtol=1e-14)
        except (ValueError, FloatingPointError):
            return None
        if not np.all(np.isfinite(res.x)):
            return None
        return res

    def fit(self, starts, goal_km):
        """Try the given starting points (stored-value order), then a ring of pericentre
        longitudes if the best still misses `goal_km`. Returns (classical params, max error)."""
        best = None
        tried = 0
        for c0 in starts:
            if c0 is None:
                continue
            r = self.solve(c0)
            tried += 1
            if r is not None and (best is None or r.cost < best.cost):
                best = r
        err = self.max_err(classical(best.x)) if best is not None else float('inf')
        if err > goal_km:
            base = classical(best.x) if best is not None else starts[0]
            for j in range(8):
                for e0 in (max(base[1], 1e-3), 0.02):
                    c0 = base.copy()
                    c0[1] = e0
                    c0[2] = base[2] + j * TWO_PI / 8
                    r = self.solve(c0)
                    tried += 1
                    if r is not None and r.cost < best.cost:
                        best = r
            err = self.max_err(classical(best.x))
        return classical(best.x), err, tried

    def max_err(self, c):
        return float(np.linalg.norm(position(c, self.t) - self.y, axis=0).max())


def position_many(C, t):
    """Positions (3, N) for N epochs, each with its own nine stored values: C (N, 9), t (N,) days
    from that epoch's window centre. The same arithmetic as js/ephem.js."""
    C = np.asarray(C, dtype=np.float64)
    a, e, varpi0, dv, inc, O0, dO, l0, n = C.T
    O = O0 + dO * t
    varpi = varpi0 + dv * t
    M = l0 + n * t - varpi
    Mr = np.remainder(M + math.pi, TWO_PI) - math.pi
    E = Mr + 0.85 * e * np.sign(np.sin(Mr))
    for _ in range(30):
        d = (E - e * np.sin(E) - Mr) / (1 - e * np.cos(E))
        E = E - d
        if np.max(np.abs(d)) < 1e-15:
            break
    xp = a * (np.cos(E) - e)
    yp = a * np.sqrt(1 - e * e) * np.sin(E)
    w = varpi - O
    cO, sO, ci, si, cw, sw = np.cos(O), np.sin(O), np.cos(inc), np.sin(inc), np.cos(w), np.sin(w)
    X = (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp
    Y = (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp
    Z = (sw * si) * xp + (cw * si) * yp
    return np.array([X, Y, Z])
