# Data contract — what `tools/` writes into `data/`, and what the app reads

This file is the agreement between the pipeline steps and the app. Every shipped file is described
here: its layout, units, frame and the order in which to decode it. If a step changes a format, it
changes this file in the same commit.

## Ground rules

- **Only real data.** Every number comes from a pinned source file downloaded by the pipeline and
  traced to a catalogue, a paper or an agency product. Nothing from memory, no invented structure.
  A fitted model published in a paper (an ephemeris, a spiral-arm fit, a bar model) is allowed and
  is always labelled as a fit or model. When something cannot be shown with real data, it is left
  out and the About text says so.
- **Pinned and reproducible.** Every download goes through `common.fetch()` (or `git_file()`) with
  a sha256. Outputs go through `common.write_json()` / `common.write_bin()`. No `today()`, no random
  numbers without a fixed seed, every list sorted by something stable. Two builds from the same
  cache give byte-identical files.
- **No URL in the app's own code.** `index.html`, `styles.css`, `app.js` and `js/*.js` must not
  contain `http://` or `https://`, not even in a comment — the packager refuses them, because the
  app runs in Snuggery's offline web view. URLs live in `CREDITS.txt`, `NOTES.md`,
  `data/about.json` and the `tools/` scripts.
- **Little-endian everywhere.** Binary files have no header; the matching `.json` says where
  everything is.
- **Time** in files is TDB, as **days from J2000.0** (JD 2451545.0 TDB) unless a field says JD.
- **Frames.** The whole solar system and every star use **ICRF / ICRS equatorial** axes
  (x → RA 0, Dec 0; z → north celestial pole). The galaxy layer is in **astropy's Galactocentric
  frame, v4.0 parameters**, in kpc, and ships the 4×4 matrix that takes it to ICRS heliocentric.
- Every step writes a **credits fragment** to `tools/credits/<step>.json` (not shipped): a list of
  `{id, title, owner, source, url, licence, licence_quote, retrieved, adaptations, accuracy}`
  blocks. `90_about.py` assembles them into `data/about.json`; `CREDITS.txt` is written from the
  same fragments, and ends with the full texts of the galstreams, SpiralMap and Agama licences,
  read from their pinned files.
- Every step ships a **`verify_<step>.py`** that asserts the properties the app relies on, run by
  `verify_data.py`. Print measured numbers, not just "ok".
- **`data/` holds only claimed files**: the fixed names in the sections below, plus the files the
  metadata points at (`tex/textures.json` bodies, `sky/sky.json` file, `galaxy/galaxy.json` model
  and young files). `verify_data.py` fails on anything else, and on a claimed file that is missing.

Environment for every step: `tools/venv/bin/python`, working directory `tools/`. Downloads are cached
in `tools/.cache/` (gitignored). Set `MILKYWAY_SEED` to a folder of earlier downloads to reuse them.

Budget (unpacked, hard caps): ephemeris ≤ 1.5 MB, moons ≤ 0.6 MB, physical ≤ 60 KB, small bodies
≤ 0.7 MB, planet textures ≤ 2.3 MB, sky ≤ 0.25 MB, deep stars ≤ 1.9 MB, named stars + constellations
+ exoplanets ≤ 0.9 MB, galaxy ≤ 0.6 MB.

---

## 1. Planets, Moon, Pluto — `ephem.json` + `ephem.bin`   (step `10_ephemeris.py`)

Source: JPL DE430 (full `de430.bsp`, sha256-pinned). Range: **JD 2415020.5 – 2488069.5 TDB
(1900-01-01 – 2100-01-01)**.

`ephem.bin`: for each body, `intervals × 3 × (degree+1)` float32 Chebyshev coefficients (km),
laid out `[interval][x,y,z][coefficient]`, bodies concatenated in the order of `ephem.json.bodies`.
Built by interpolating DE430 at the degree+1 Chebyshev nodes of each interval (float64), then
stored as float32.

`ephem.json` (floats written unrounded):
```
{ "source": "de430.bsp", "jd_start": 2415020.5, "jd_end": 2488069.5,
  "frame": "ICRF", "units": "km", "time_scale": "TDB",
  "emrat": <Earth/Moon mass ratio, measured from the SPK's own 3->301 and 3->399 segments>,
  "bodies": [ { "name": "mercury", "center": "sun", "offset": <byte offset>,
                "intervals": n, "interval_days": L, "degree": d }, ... ],
  "max_error_km": { "<name>": <measured max vs DE430 over 20,000 random epochs>, ...,
                    "earth": <the same for EMB − moon/(1+emrat)> },
  "error_epochs": 20000, "note": "..." }
```
Bodies and settings (interval days / degree): `mercury` 32/13, `venus` 128/11, `emb` 128/9,
`mars` 256/11, `jupiter`, `saturn`, `uranus`, `neptune`, `pluto` 512/9 — all **heliocentric**
(target − Sun); `moon` 16/11 is **geocentric** (Moon − Earth). For Jupiter…Pluto the target is the
**system barycentre** (DE has no planet centres; the offset is < 400 km except Pluto, whose centre
is ~2,135 km from the Pluto–Charon barycentre — the app draws Pluto at the barycentre and says so;
**Charon is not included**: no long-term Pluto-satellite ephemeris is reachable).
Earth = EMB − moon / (1 + emrat). Measured errors: Mercury 20 km, Venus 8.5, EMB/Earth 11,
Mars 26, Jupiter 67, Saturn 101, Uranus 169, Neptune 285, Pluto 291 (the float32 floor), Moon 2.6.
1,318,776 bytes.

Evaluate at `jd` (TDB): `i = clamp(floor((jd − jd_start)/L), 0, n−1)`,
`x = 2·(jd − (jd_start + i·L))/L − 1`, Clenshaw sum per axis. (`js/ephem.js` clamps `jd` into the
range first, so positions freeze at the ends instead of extrapolating.)

## 2. Major moons — `moons.json` + `moons.bin`   (step `11_moons.py`)

Source: JPL satellite SPKs mar097, jup310, sat425, ura111, nep081 (whole files, sha256-pinned).
Range: **JD 2433282.5 – 2469807.5 TDB (1950-01-01 – 2050-01-01)**, the span every file covers.

Moons (21, NAIF order): Phobos, Deimos; Io, Europa, Ganymede, Callisto; Mimas, Enceladus, Tethys,
Dione, Rhea, Titan, Hyperion, Iapetus; Ariel, Umbriel, Titania, Oberon, Miranda; Triton, Nereid.
None had to be dropped. The Moon is in section 1.

Each moon's orbit is stored as a sequence of contiguous windows of `W = window_days` days
(`W = 36525 / windows`, a terminating decimal, so Python and JS compute the same `tc`); in each
window a **precessing Keplerian ellipse** is least-squares fitted to the SPK positions **relative
to the planet's centre** (699 etc., not the system barycentre — that orbit is the one close to an
ellipse), in a fixed frame per planet. Nine float32 per window:
`a (km), e, varpi0 (rad), dvarpi (rad/day), inc (rad), Omega0 (rad), dOmega (rad/day),
lambda0 (rad), n (rad/day)`; angles stored reduced to [0, 2π).

Evaluate at `jd`: `k = clamp(floor((jd − jd_start)/W), 0, nwin−1)`,
`tc = jd_start + (k + 0.5)·W` (float64), `t = jd − tc`,
`Omega = Omega0 + dOmega·t`, `varpi = varpi0 + dvarpi·t`, `M = lambda0 + n·t − varpi`,
solve `E − e·sin E = M`, `xp = a(cos E − e)`, `yp = a·sqrt(1−e²)·sin E`, `w = varpi − Omega`,
rotate `(xp, yp, 0)` by `Rz(Omega)·Rx(inc)·Rz(w)` — **active** (vector) rotations, i.e.
```
X = (cΩ cw − sΩ sw ci) xp + (−cΩ sw − sΩ cw ci) yp
Y = (sΩ cw + cΩ sw ci) xp + (−sΩ sw + cΩ cw ci) yp
Z = (sw si) xp + (cw si) yp
```
— into the fit frame, then `r_c = Fᵀ · r_fit` (ICRF, relative to the planet's centre) where `F`
(rows) is the planet's `frame` matrix (ICRF → fit frame): `z` = the planet's spin axis at J2000
(pck00011 IAU pole, full series, **reversed when the prime meridian runs backwards** — Uranus — so
regular moons sit near inc 0, not 180°, where the node is undefined), `x` = the ascending node of
that equator on the ICRF equator, `y = z × x`; written rounded to 12 decimals and used as written.

**Relative to the system barycentre** (what `moon()` returns, and what adds to the planet's
heliocentric position from section 1): `centre = −Σ_j mass_ratio_j · r_c,j` over the planet's moons
in the file (`mass_ratio = GM_moon / GM_system` from gm_de440; 0 for Nereid, which has no GM),
then `r_bary = r_c + centre`. This rebuilds JPL's own planet-centre segment to ≤ 0.23 km (Saturn;
the centre moves up to 312 km about the barycentre).

`moons.json` (floats unrounded except the error figures and `a_km`, which is rounded to 0.1 km):
```
{ "source": [...5 SPKs], "jd_start": ..., "jd_end": ..., "time_scale": "TDB", "units": "km, rad, rad/day",
  "frames": { "mars": [[...],[...],[...]], "jupiter": ..., "saturn": ..., "uranus": ..., "neptune": ... },
  "record": ["a","e","varpi0","dvarpi","inc","Omega0","dOmega","lambda0","n"], "fit_center": "planet",
  "moons": [ { "name": "Io", "naif": 501, "parent": "jupiter", "window_days": W,
               "windows": nwin, "offset": <byte offset>, "a_km": <mean of the windows' a>,
               "mass_ratio": <GM_moon/GM_system>, "max_error_km": <measured>,
               "max_error_frac": <max error / a>, "p99_error_km": ... }, ... ],
  "centre_error_km": { "<planet>": <rebuilt centre vs JPL's planet segment> },
  "error_epochs": 20000, "note": "..." }
```
Target: max error ≤ 0.5 % of the orbit radius for every moon, measured (barycentric, as the app
evaluates it) at 20,000 random epochs per moon against the SPK. Measured worst: Titania 0.20 %,
Oberon 0.16 %, Umbriel 0.14 %, Hyperion 0.09 % (12.175-day windows), Ganymede 0.08 %; the rest
≤ 0.06 % (Triton 3 km). 448,200 + ~6,000 bytes.

`js/ephem.js` (written by this step, ES module, no dependencies) exports:
```
export async function loadEphemeris(base = 'data/', physical = null)
        // fetches ephem.json, ephem.bin, moons.json, moons.bin and, unless given, physical.json
        // (for the leap seconds); returns an Ephemeris
export function buildEphemeris(ephemJson, ephemBuf, moonsJson, moonsBuf, physicalJson)
        // the same from already-loaded files (Node tests); ArrayBuffer or typed array/Buffer
class Ephemeris {
  range  -> { jdStart, jdEnd }                    // planets
  moonRange -> { jdStart, jdEnd }
  maxErrorKm                                      // ephem.json max_error_km
  helio(name, jd, out) -> out  // km, ICRF, heliocentric: 'sun' (zero), 'mercury','venus','earth',
                               // 'moon','emb','mars','jupiter','saturn','uranus','neptune','pluto';
                               // out = Float64Array(3) or []
  geoMoon(jd, out) -> out
  inRange(jd) -> bool          // planets' range
  moons(parent) -> [{ name, naif, parent, aKm }]
  moon(name, jd, out) -> bool  // km, ICRF, relative to the parent's barycentre; fills out (clamped
                               // to the range) and returns false outside 1950–2050
  moonFromCentre(name, jd, out) -> bool   // relative to the planet's centre (the fitted ellipse)
  planetCentre(parent, jd, out) -> out    // planet centre relative to its barycentre (km)
  moonOrbit(name, jd, segments = 128) -> Float64Array(3·(segments+1))
                               // the ellipse of the window containing jd, frozen at jd, relative
                               // to the planet's centre (km, ICRF), first point = last
}
export function jdFromDate(date)      // UTC Date -> JD TDB (TT = UTC + (TAI−UTC) + 32.184 s)
export function dateFromJd(jd)        // inverse, for display
export function setTimeConstants(physical.constants)   // done by load/buildEphemeris
export function kepler(M, e)
```
Leap seconds come from ERFA's table (in `physical.json.constants.leap_seconds`), TT − TAI from
`constants.tt_minus_tai_s`. Before 1972 the app uses TAI − UTC = 10 s
(`constants.tai_minus_utc_before_1972_s`; documented approximation, < 1 minute of error). TT is used
as TDB (they differ by < 2 ms).
A node test (`tools/test_ephem.mjs`) evaluates the JS module against positions exported by
Python from the SPKs and prints the worst error per body.

## 3. Physical and rotational constants — `physical.json`   (step `12_physical.py`)

Sources: NAIF `pck00011.tpc` (IAU WGCCRE 2015), `gm_de440.tpc` (both read through CSPICE's kernel
pool), ring radii from the `sat425` header (Saturn C/B/A) and the PDS Ring-Moon Systems Node
constants (Uranus, French et al. 1991; labelled), ERFA from the pyerfa 2.0.1.5 sdist (leap seconds
`dat.c`, J2000 obliquity `obl06.c`, TT − TAI `erfam.h`), astropy 7.1.0's IAU 2012 AU. Kernel values
are copied exactly (floats written unrounded).

```
{ "constants": { "au_km": 149597870.7, "gm_sun_km3_s2": ..., "k_gauss_au15_day": <derived>,
                 "obliquity_j2000_arcsec": 84381.406, "tt_minus_tai_s": 32.184,
                 "leap_seconds": [[jd_utc, tai_minus_utc], ...],   // from 1972-01-01; jd_utc = 0h
                 "tai_minus_utc_before_1972_s": 10, "notes": { ... } },
  "nut_prec_angles": { "3": [[theta0_deg, theta1_deg_per_century(, theta2)], ...], "4": ..., ... },
  "bodies": { "<key>": {
       "name": "Mars", "naif": 499, "parent": null (sun) | "sun" | "earth" (moon) | "<planet key>",
       "radii_km": [a, b, c], "gm_km3_s2": ... | null (Nereid),
       "gm_system_km3_s2": ... (planets and Pluto: the system's GM, for barycentric orbits),
       "pole": { "ra": [a0, a1, a2], "dec": [d0, d1, d2], "pm": [W0, W1, W2],
                 "nut_ra": [...], "nut_dec": [...], "nut_pm": [...], "system": "4" | null }
               | null (Hyperion, Nereid: no model in pck00011),
       "obliquity_deg": <derived> | null, "obliquity_ref": "<which orbit/plane it is measured to>"
                        (key absent when obliquity_deg is null),
       "sidereal_rotation_h": <derived from W1, negative = retrograde> | null } },
  "rings": { "saturn": [ { "name": "C", "inner_km": ..., "outer_km": ..., "source": "..." }, ... ],
             "uranus": [ { "name": "epsilon", "a_km": ..., "e": ..., "width_km": ...,
                           "inner_km": a − width/2, "outer_km": a + width/2, "source": "..." }, ... ] },
  "rings_note": "...", "rotation_note": "...", "sources": [...] }
```
Keys: `sun, mercury, venus, earth, moon, mars, jupiter, saturn, uranus, neptune, pluto` and every
moon in `moons.json` (lower-case English name). `obliquity_deg` is the angle between the spin axis
(IAU pole, reversed when W1 < 0) and the normal of the osculating orbit at J2000 (DE430 for the
planets — EMB for Earth, system barycentres from Jupiter out — and the Moon; the satellite SPK,
planetocentric, for moons); for the Sun, the J2000 ecliptic. Saturn's D/F rings are left out
(uncited in rms-oops); Uranian ring pericentres and nodes are not shipped (they need rms-oops'
1977 / B1950 ring frame).

Rotation (IAU convention): `T` = Julian centuries TDB since J2000, `d` = days;
`alpha = a0 + a1·T + a2·T² + Σ nut_ra[k]·sin θk`,
`delta = d0 + d1·T + d2·T² + Σ nut_dec[k]·cos θk`, `W = W0 + W1·d + W2·d² + Σ nut_pm[k]·sin θk`,
`θk = Σ_j theta_j·T^j` from `nut_prec_angles[system][k]` (system = NAIF id / 100: Moon "3",
Phobos/Deimos/Mars "4", ...). Body-fixed frame = `Rz(W)·Rx(90° − delta)·Rz(90° + alpha)` applied to
ICRF vectors, where these are **frame** rotations (SPICE convention):
`Rz(θ) = [[c, s, 0], [−s, c, 0], [0, 0, 1]]`, `Rx(θ) = [[1, 0, 0], [0, c, s], [0, −s, c]]`.

`js/rotation.js` (this step) exports `bodyFrame(body, jd, angles?, out?) -> 3×3 row-major
Float64Array` (ICRF → body-fixed; `body` = a `physical.json` body object; `angles` =
`nut_prec_angles[system]`, or call `linkRotation(physical)` once), `poleAngles`, `spinAxis`, and
`loadRotation(base, physical?)` / `buildRotation(physical)` returning
`{ bodyFrame(key, jd, out?), poleAngles(key, jd), spinAxis(key, jd), has(key) }` keyed by body name;
null for bodies without a model. Node test (`tools/test_rotation.mjs`) against CSPICE
(`spiceypy.pxform('J2000', 'IAU_MARS', et)` etc., 30 bodies × 7 epochs 1950–2100): worst 1.7e-5″.

## 4. Small bodies — `smallbodies.json` + `smallbodies.bin`   (step `20_smallbodies.py`)

Sources (all pinned in `tools/smallbodies_sources.py`; JPL, the MPC and ESA are not reachable from
the build machine, so each is a verbatim copy of their output in a public repository):
JPL SBDB Query API response for every asteroid/TNO with **H < 12** (KStars `asteroids.dat`,
2026-04-04; 9,032 rows), the MPC's CometEls (KStars `cometels.json.gz`, epoch 2026-04-03; 947
rows), JPL SBDB comet export (KStars `comets.dat`, 2021) for six famous comets the MPC list lacks
(109P, 55P, C/1996 B2 Hyakutake, C/2020 F3 NEOWISE, C/2006 P1 McNaught, C/1965 S1-A Ikeya-Seki;
an editorial pick, not Shoemaker-Levy 9, whose fragments orbited Jupiter), JPL SBDB lookup-API
responses in adam_core for named NEOs (Apophis, 2024 YR4, 2022 AP7, Itokawa, YORP) and for cited
sizes, a recorded JPL Horizons response in adam_core for Bennu (osculating at 2024-01-01; the SBDB
fixture is a 2011 epoch), ESA NEOCC orbit files in adam_core for Ryugu and Didymos (names from
Stellarium's `ssystem_minor.ini` and Celestia's `asteroids.ssc`). Drift checks (not shipped):
Stellarium's JPL Horizons yearly elements of Ceres, Pallas, Juno, Vesta; DE430.

Dropped (listed in `json.dropped`): 134340 Pluto (drawn from DE430), (2002 PD153) (`e = 0`, no mean
anomaly), and the SBDB rows of A/2024 U2 and A/2018 W3, which the MPC comet list carries at a newer
epoch (kept from there; A/2024 U2 is hyperbolic, e = 1.00326). Nothing else. **Weak orbits are
kept and flagged** (flag bit 0: `e < 0.001` or SBDB orbit solution `JPL 1`/`JPL 2` — a proxy, the
snapshot has no arc length or condition code; 2,351 rows, all TNOs and centaurs).

**Frame and constants.** ICRF heliocentric. The sources' J2000-ecliptic elements are rotated with
the IAU 1976/1980 J2000 obliquity **84381.448″** (ERFA `obl80.c` in the pinned pyerfa sdist) — the
value JPL's output states for its ecliptic frame ("IAU76 obliquity of 84381.448 arcseconds wrt ICRF
X-Y plane", pinned Horizons response), identical to CSPICE's ECLIPJ2000 (verify checks it). This is
deliberately **not** `physical.json`'s `obliquity_j2000_arcsec` (IAU 2006, 84381.406″), which would
tilt every orbit by 0.042″ against the frame its elements were computed in. `k_gauss_au15_day` =
√GM☉ (gm_de440) · 86400 / au^1.5 (IAU 2012 au) — the same number as `physical.json`'s.

`smallbodies.bin` (459,494 B): column arrays, each contiguous, at `json.columns[].offset` (bytes;
every column aligned to its type), `length` = number of values (count × `per_row`):
`q` (au, f32), `e` (f32), `tp` (time of perihelion, days from J2000.0 TDB, **f64**), `P` (3×f32,
unit vector to perihelion, ICRF, `[row][x,y,z]`), `Q` (3×f32, unit vector 90° ahead in the orbital
plane), `H` (f32; comets: the total-magnitude parameter, not comparable; NaN if unknown), `kind`
(u8, index into `kinds`), `flags` (u8: bit 0 weak orbit, bit 1 no epoch given).

Position at `jd` (TDB): `dt = jd − J2000 − tp`; elliptic (`e < 1`): `a = q/(1−e)`,
`M = k/a^1.5 · dt` reduced to [−π, π] as `M − 2π·round(M/2π)`, `E − e sin E = M`,
`x = q − 2a sin²(E/2)` (= a(cos E − e)), `y = √(a q (1+e)) sin E` (= a√(1−e²) sin E); hyperbolic
(`e > 1`): `a = q/(e−1)`, `e sinh F − F = M`, `x = q − 2a sinh²(F/2)`, `y = √(a q (1+e)) sinh F`;
parabolic (`e == 1`): `w = 1.5 k √(1/(2q³)) |dt|`, `Y = ∛(w + √(w²+1))`, `s = ±(Y − 1/Y)`,
`x = q(1 − s²)`, `y = 2qs`. `r = x·P + y·Q` (au). The equations are solved in the cancellation-free
form `(1−e)E + e(E − sin E) − M` (series for E − sin E below 0.5), which keeps nearly parabolic
comets exact.

`smallbodies.json` (233,745 B; floats written unrounded except the measured `accuracy` figures, 9 decimals):
```
{ format, count: 9989, asteroid_count: 9028 (the H < 12 rows),
  columns: [{name, type, offset, length, per_row, bytes}],
  kinds: {"0": "dwarf", ...}, kind_labels: {"dwarf": "Dwarf planet", ...},
  names: [...],                  // every row; named numbered asteroids without their provisional
                                 // designation ("1 Ceres"), unnamed ones with it ("(2014 UU277)")
  sources: [{id, label, credit, first, count, epoch_jd}],   // rows are grouped by source, in order
  epochs: {"<JD TDB>": [rows]},  // rows whose epoch differs from their source's epoch_jd
  labelled: [rows],              // 52: dwarf planets, big asteroids, mission targets, famous comets, 1I-3I
  info: {"<row>": {class, orbit_id, desig, diameter_km, albedo, rot_per_h, extent_km,
                   phys_ref, phys_from, orbit_ref}},        // labelled rows only; keys as available
  diameter_km: {"<row>": D},     // every other row with a diameter: SBDB asteroids, and comets
                                 // joined by designation to JPL's 2021 comet export (2,899 rows)
  flag_bits, units, frame, k_gauss_au15_day, gm_sun_km3_s2, au_km, obliquity_arcsec,
  h_note, epoch_note, dwarf_note, names_note, selection, dropped,
  accuracy: { horizons_big4: {<name>: {bins: {"0-1 yr": {max_au, max_deg, n}, ...},
                                       nearest_epoch_err_au, nearest_epoch_dt_days, epochs}},
              pluto_vs_de430: {bins, ...}, halley: {...} } }
```
Kinds: `dwarf` (the eight bodies Celestia's `dwarfplanets.ssc` groups as dwarf planets: Ceres,
Orcus, Haumea, Quaoar, Makemake, Gonggong, Eris, Sedna — Celestia's grouping, stated in
`dwarf_note`; Stellarium types only Eris, Haumea and Makemake so), `mba` (SBDB MBA, IMB, OMB),
`trojan` (TJN), `centaur` (CEN), `tno` (TNO), `neo` (AMO/APO/ATE), `marscrosser` (MCA), `comet`,
`interstellar` (1I, 2I, 3I), `other` (the MPC's A/ objects, SBDB AST). There is **no `hungaria` or
`hilda`**: SBDB's orbit classes have no such group and no pinned source defines one, so the
contract's earlier placeholder kinds are not used. Counts: dwarf 8, mba 2,317, trojan 528,
centaur 276, tno 5,890, neo 10, marscrosser 6, comet 938, interstellar 3, other 13; 117 open orbits.

Accuracy (measured by the step, written into `accuracy`/`epoch_note` and the credits): every orbit is
two-body, so positions drift from the epoch. Ceres, Pallas, Juno, Vesta against JPL Horizons' own
osculating elements: 8.2e-6 au 49 days from the epoch; worst of the four ≤ 0.017 au within 5 years,
0.054 au at 5–10, 0.12 au at 10–25, 0.29 au at 25–50, 0.32 au at 50–75, 0.54 au at 75–125 years.
Pluto's SBDB elements against DE430: 0.037 au at 5–10 years, 0.45 au at 75–125. Halley's 2026 MPC
elements put its 1986 perihelion 13 days late. Float32 storage adds at most 1.3e-4 of the distance
(1900–2100), and the JS agrees with an independent universal-variable propagation to 5e-13.

`js/smallbodies.js` (this step) exports `loadSmallBodies(base = 'data/')`,
`buildSmallBodies(json, buffer)` (node tests), `keplerElliptic(M, e)`, `keplerHyperbolic(M, e)` and
the class they return:
```
SmallBodies {
  count, labelled: [rows], meta (the json), k
  kind(i) -> 'dwarf' | 'mba' | ...     kindCode(i)     kindLabel(i) -> 'Dwarf planet'
  name(i)   H(i)   flags(i)   weakOrbit(i) -> bool   source(i) -> sources[] entry
  epoch(i) -> JD TDB | null
  elements(i) -> { q, e, a, tp (JD), epoch, P: [3], Q: [3], period (days, elliptic) | null }
  info(i) -> json.info[i] merged with { H, diameter_km, kind, kindLabel, epoch,
                                         source: 'text for the card', note: 'accuracy caveats' }
  position(i, jd, out = Float64Array(3)) -> out           // au, ICRF, heliocentric, float64
  positionsAt(jd, out = Float32Array(3·count)) -> out     // every row; ~2 ms for 9,989 in node
  orbitPath(i, jdCentre, segments = 256) -> Float32Array(3·(segments+1))
      // ellipse: closed, first = last = the body at jdCentre, even steps in E;
      // open orbit: from max(10 yr, |jdCentre − tp| + 1 yr) before perihelion to as long after
}
```
Node test `tools/test_smallbodies.mjs` (run after `verify_smallbodies.py`, which exports the
references into `tools/.cache/smallbodies/`): every row at eight epochs 1900–2100 against the
universal-variable propagation, synthetic orbits for every branch (e == 1 exactly included),
orbit paths, and the drift table against Horizons.

## 5. Planet imagery and colours — `tex/*.jpg` + `tex/textures.json`   (step `30_textures.py`)

Equirectangular JPEGs (quality 85), **east-positive longitude increasing to the right**, row 0 =
+90° latitude. Column `x` covers longitudes `lon_left_deg + 360·x/width … + 360·(x+1)/width`; row
`y` covers latitudes `90 − 180·y/height … 90 − 180·(y+1)/height`. So the texture coordinate of a
body-fixed direction is `u = fract((lon − lon_left_deg)/360)`, `v = 0.5 + lat/180` (v = 1 at the top
row, three.js `flipY`). Grayscale maps are single-channel JPEGs (sample `.r`).

| key | file | size | lon_left_deg | kind | source |
|---|---|---|---|---|---|
| `sun` | sun.jpg | 1024×512 RGB | −180 | visible | SDO HMI (Stellarium map), tinted with the TSIS-1 colour |
| `mercury` | mercury.jpg | 1024×512 gray | −180 | visible | MESSENGER MDIS 750 nm mosaic, May 2013 (USGS) |
| `venus` | venus.jpg | 1024×512 gray | −180 | **radar** | Magellan C3-MIDR (USGS); 7 % swath gaps filled flat |
| `earth` | earth.jpg | 2048×1024 RGB | −180 | visible | Blue Marble NG May 2004, byte for byte |
| `earth_night` | earth_night.jpg | 2048×1024 RGB | −180 | visible | DMSP city lights over a dark base (KDE Marble) |
| `moon` | moon.jpg | 2048×1024 RGB | −180 | albedo | LROC WAC Hapke-normalised albedo (Stellarium map) |
| `mars` | mars.jpg | 2048×1024 RGB | −180 | albedo | Viking colour mosaic 925 m (USGS) |
| `jupiter` | jupiter.jpg | 2048×1024 RGB | −180 (= 180 W) | visible | Cassini PIA07782, Dec 2000 (not flipped); 4.3 % (south of 82.3 S) flat in the source |
| `pluto` | pluto.jpg | 1024×512 gray | **0** | visible | New Horizons 2017 (label: centre 180 E); 32 % not imaged |
| `io` | io.jpg | 512×256 gray | −180 | visible | Galileo + Voyager 1 km (label PositiveWest) |
| `ganymede` | ganymede.jpg | 512×256 gray | **0** | visible | Voyager + Galileo 1 km (label PositiveWest, centre 180) |
| `triton` | triton.jpg | 512×256 gray | −180 | visible | Voyager 2, orange filter only; 38 % (the north) not imaged |

Europa (FGDC access constraint "None"), Callisto (no FGDC record) and Titan (access constraint
"None") are left out: only moon maps whose USGS FGDC record says "public domain" ship. Charon's
New Horizons map is not shipped: Charon has no body in the app (no ephemeris, section 1).

`textures.json`:
```
{ "convention": "...", "resampling": "...", "total_bytes": <sum of the JPEGs>,
  "bodies": { "<key>": { "file", "width", "height", "lon_left_deg", "grayscale": bool,
               "kind": "visible" | "radar" | "albedo", "source_id" (= a credits block id),
               "note" (one line for the UI), "lon_evidence" (which metadata fixed the longitudes),
               "lat_type", "nodata_fraction" (0–1), "nodata_fill" (text),
               "fill_value" (DN, or [R,G,B]; only when nodata_fraction > 0) } },
  "colours": { "jupiter" | "saturn" | "uranus" | "neptune" | "titan": {
                 "srgb": [R,G,B] 0–255, "linear": [r,g,b] 0–1, "albedo_Y", "xy": [x,y],
                 "srgb_illuminant_E" (cross-check), "out_of_gamut": bool, "spectrum", "source", "note" },
               "sun": { "srgb", "linear" (largest channel 1), "xy", "cct_k_mccamy", "out_of_gamut",
                        "spectrum", "source", "note" } },
  "colour_method": "..." }
```
Where a map had no data the pixels hold one flat value (`fill_value`, the mean of the imaged
pixels; for Jupiter the source map's own flat south-polar fill, detected and recorded) — "not imaged",
never invented terrain. Longitude conventions are read from each product's
metadata (ISIS label and GeoTIFF CRS; WebWorldWind's `Sector.FULL_SPHERE`; the axis labels of the
annotated Jupiter original — west longitude decreasing to the right, so no flip; its web copy's world
file says the left edge is 0 instead, 180° away, and is not followed) and proved in
`verify_textures_sky.py` (PROJ check against the source GeoTIFFs, and features against their mirror
images: Olympus Mons, Syrtis Major, Hellas, Tycho, Mare Humorum, Maxwell Montes, Beta Regio,
Sputnik Planitia, Loki Patera, Galileo Regio, Greenwich/Africa, city lights, the Great Red Spot).

Colours (disk-averaged, measured): Karkoschka's 1995 ESO full-disk albedo spectra (PDS 1995LOW.TAB)
× the TSIS-1 solar spectrum, CIE 1931 2° on 1 nm steps 360–830 nm, Y = 1 for a white reflector,
Bradford from the Sun's white to D65, IEC 61966-2-1 sRGB: Jupiter (193,193,178), Saturn
(197,185,156), Uranus (157,195,202), Neptune (137,183,202), Titan (145,126,95). Sun (TSIS-1, no
adaptation, largest channel 255): (255,244,241), xy (0.3216, 0.3321). No painted or artist
textures, ever. 1,678,374 bytes of JPEG + ~12.3 KB JSON.

## 6. Sky backdrop — `sky/gaia-dr3-counts.jpg` + `sky/sky.json`   (step `31_sky.py`)

Gaia DR3 source counts (MAST HATS point map, NSIDE 256, NESTED; the two partitions with triplicated
rows, Norder=4/Npix=115 and Norder=3/Npix=29, recounted from distinct `source_id`: 257 pixels,
1,811,709,793 sources), as sources per square degree interpolated bilinearly onto **2048 × 1024
equirectangular in ICRS**: column `x` ↔ RA = 360·(x + 0.5)/2048 deg, row `y` ↔ Dec =
90 − 180·(y + 0.5)/1024 deg (RA increases to the right; u = RA/360, v = 0.5 + Dec/180). Grayscale
JPEG quality 85, 106,041 bytes. Stretch, recorded in `sky.json.stretch`:
`v = asinh(max(D − black, 0)/soft) / asinh((white − black)/soft)`, clipped to [0, 1], pixel =
round(255 v); black 2,500, soft 20,000, white 1,200,000 sources/deg²; inverse
`D = black + soft·sinh(v·asinh((white − black)/soft))`.
`sky.json`: `{ file, width, height, grayscale, jpeg_quality, frame: "ICRS", projection,
pixel_to_sky, quantity, stretch: { type, black_per_deg2, soft_per_deg2, white_per_deg2, formula,
inverse, black_per_pixel, white_per_pixel }, resampling, source: {...}, dedup: { partitions: [...],
total_after_fix }, stats_per_deg2, caption, credit: "ESA/Gaia/DPAC", licence: "CC BY-NC 3.0 IGO" }`.
It is star counts, not brightness (caption it "density of stars measured by Gaia"), and it is the
sky seen from the Sun. Licence: CC BY-NC 3.0 IGO, ESA/Gaia/DPAC.

## 7. Stars — `stars/…`   (step `40_stars.py`)

Sources: AT-HYG v3.2 (subset `athyg_32_reduced_m10` for the stars, `athyg_32_hyg_ids` for joins
only), HYG v4.1, Stellarium v26.2 `hip_gaia3` catalogues 0–3 (build-time parallax errors only —
**no Stellarium value is shipped**), Stellarium v26.2 `modern_iau` sky culture, Open Exoplanet
Catalogue at commit 77ab8690, Mamajek's dwarf table v2022.04.16, Ballesteros (2012), CIE 1931 2°.
All positions are ICRS heliocentric in parsecs (x → RA 0 Dec 0, z → north celestial pole),
equinox and (almost always) epoch J2000.0. Absolute magnitudes are `V + 5 − 5 log10(d/pc)` with
**no extinction correction**. V is AT-HYG's V, or `V = VT − 0.090 (BT − VT)` for Tycho-2 rows
(the formula in AT-HYG's build notes; VT is kept when BT − VT is missing).

**Which distances count as good.** The shipped distance is always AT-HYG's (Gaia DR3, Gaia DR2,
Hipparcos 2007 or Gliese 1991, recorded per star), HYG's for rows AT-HYG lacks, or OEC's for hosts
found nowhere else. A per-star parallax error from Stellarium applies to it only when it belongs
to the same measurement: the star joined Stellarium by its Gaia DR3 id and AT-HYG's distance is
Gaia DR3, or Stellarium's parallax agrees with 1000/d within 3σ (σ = its error ⊕ 0.01 mas, half
its storage step). Otherwise the error is *unknown*. There is no RUWE cut.

- **`stars/deep.bin` + `stars/deep.json`** — AT-HYG m10 stars with d ≤ 500 pc and an applicable
  parallax/error > 10, **minus every star in `named.json`** (~209k). Little-endian, no header,
  8 bytes per star: `int16 x, y, z` (pc × 64; `deep.json.units_per_pc` = 64,
  `quantisation_pc` = 1/64), `uint8 absmag_code` (M_V = code/10 − 8), `uint8 colour_code`
  (index into `colour.json`; 255 = no colour measurement). Sorted by `absmag_code` ascending
  (intrinsically brightest first), then distance, then AT-HYG id, so `deep.json.mv_prefix["k"]`
  (k = −8…17) is the number of leading records with code/10 − 8 ≤ k: every prefix is a complete
  absolute-magnitude-limited subset. `deep.json` also carries `count`, `record_bytes`, `fields`
  (name/type/offset), `selection`, `dist_src_counts` and `colour_src_counts`.
- **`stars/colour.json`** — `teff_k[256]` (entries 0–254 log-spaced 500–50 000 K, entry 255 =
  `null` = no colour measurement), `srgb[256][3]` (sRGB-encoded, 0–1), `linear[256][3]`
  (linear-light sRGB — what a three.js vertex-colour attribute wants), `unknown_index` (255),
  `index_from_teff`, `method`, `xyz_to_linear_srgb`, `teff_note`. Entry 255 is neutral white.
  Temperature per star, first that applies: OEC's catalogue Teff (hosts placed from OEC only) →
  B−V (HIP, Gliese, HYG) through **Ballesteros 2012, a blackbody model** → BT−VT (Tycho-2) through
  Mamajek's Bt−Vt column → spectral type through Mamajek's SpT column (a class letter alone takes
  the class median) → BT−VT outside the table (−0.274 … 1.623) clamped to its nearest end →
  none (255). Bp−Rp is not used: no star here has a Gaia colour in these sources. Teff → colour:
  Planck spectrum × CIE 1931 2° CMFs, 360–830 nm at 1 nm → XYZ → IEC 61966-2-1 matrix → negatives
  set to 0 → divided by the largest channel (chromaticity only; brightness comes from the
  magnitude) → sRGB transfer curve for `srgb`. Observed colours: reddening is not removed.
- **`stars/named.json`** — the stars you can tap. Rows: every star with V < 6.5; everything within
  20 pc (AT-HYG; plus the HYG v4.1 rows AT-HYG lacks — Gliese companions at their primary's
  AT-HYG distance along their own direction, Gliese-only stars at their Gliese 1991 distance);
  every exoplanet host within 100 pc; every star with an IAU-CSN name; every constellation-figure
  star. Sorted by V (nulls last), then `id`. Columns, arrays of length `count`:
  - `id`: "HIP n", else the Gliese designation ("Gl 244B", "GJ 1061"), else "Gaia DR3 n", "HD n",
    "TYC a-b-c", "HR n"; for hosts found only in OEC, the catalogue's first name ("TRAPPIST-1").
  - `name`: the IAU-CSN name (flag 5); else HYG's proper name unless the IAU list gives that name
    to another row; else, for OEC-only hosts, a "… Star" name OEC gives ("Teegarden's Star"); or "".
  - `desig`: Bayer letter in Greek with superscript index ("α¹ Cen"), else Flamsteed ("61 Cyg"),
    each followed by the constellation; or "". `con`: IAU abbreviation from AT-HYG/HYG, or "".
  - `x, y, z`: pc, four significant digits of the distance. **For flag-4 rows they are the unit
    direction, not a position** (5 decimals). The rounding moves a placed star's direction by up
    to 149″ (median 26″) from AT-HYG's RA/Dec — invisible at phone scale, but companions and close
    pairs can coincide.
  - `vmag` (2 decimals) and `absmag` (1 decimal); `null` when unknown; `absmag` is `null` for
    flag-4 rows.
  - `colour`: index into `colour.json`. `spect`: spectral type as catalogued, or "".
  - `dist_src`: integer index into `dist_src_labels` = ["none", "Gaia DR3", "Gaia DR2",
    "Hipparcos 2007", "Gliese 1991", "Open Exoplanet Catalogue"]; a companion shows its primary's.
  - `flags`: bit 0 exoplanet host (planets in `exoplanets.json`); 1 white dwarf (spectral type
    `^D[ABCOQZX]`); 2 companion placed at its primary's distance; 3 parallax/error in (5, 10];
    4 no usable parallax (no distance, or parallax/error ≤ 5) — not placed in 3D; 5 name from the
    IAU Catalog of Star Names; 6 no per-star parallax error applies to the shipped distance
    (Gliese 1991 distances, Hipparcos distances that disagree with Gaia by > 3σ, Gaia stars fainter
    than Stellarium's V ≈ 10.5 limit, OEC distances quoted without an error). `flag_bits` says
    the same in the file.
  - OEC hosts join AT-HYG/HYG by Gaia DR3, HIP, TYC, HD or Gliese id (a B/C suffix on HIP or HD
    never joins the primary's row; an id whose row is > 1° from OEC's coordinates **and** > 50 %
    off OEC's distance is an OEC slip and the next id is tried — 3 hosts: 'HIP 904' for HD 11964 A,
    'HIP 1291 A' for Gliese 3021 A, 'HIP 7642' for TOI-1411), else by position (≤ 30″, distance
    within 5 %, same component letter), else become their own row from OEC's RA, Dec and distance
    (`dist_src` 5) — unless OEC's quoted distance error makes parallax/error ≤ 5, in which case
    they are left out.
    HIP 55203 (xi UMa, deleted from HYG) is HYG's xi UMa A row.
- **`stars/constellations.json`** — `{ "<abbr>": { name, lines: [[i, j], ...], lines_sky_only:
  [[i, j], ...] } }` for the 88 IAU / Sky & Telescope figures, `i, j` row indices into
  `named.json`, segments that the polylines retrace removed. `lines` join placed stars only;
  `lines_sky_only` (30) touch a flag-4 star: leave them out in 3D, draw them on the sky from the
  Sun using the unit directions.
- **`stars/exoplanets.json`** — `{ fields: ["name", "period_d", "a_au", "mass_mj", "radius_rj",
  "year", "method", "circumbinary"], methods: ["RV", "astrometry", …], hosts: { "<named row>":
  [[…one array per planet, in `fields` order…], …] }, units, source, note }`. Confirmed planets
  only (OEC list "Confirmed planets"), sorted by name within a host; `null` where OEC gives no
  value; four significant digits; `method` indexes `methods`; `circumbinary` is 1 for a planet
  orbiting a binary (attached to the component that joined). `mass_mj` is as catalogued (for
  radial-velocity planets usually the minimum mass).

Measured on the current build (`verify_stars.py` prints these): deep.bin 209,156 stars,
1,673,248 B (Gaia DR3 208,759, Hipparcos 2007 388, Gaia DR2 9; 0.43 % without colour).
named.json 11,049 rows, 770,854 B: 76 unplaced (flag 4), 176 with parallax/error 5–10, 942 with no
applicable error, 98 white dwarfs, 210 companions, 525 IAU names, 892 hosts; within 20 pc 1,830
placed rows (Gaia DR3 1,503, Hipparcos 2007 145, Gliese 1991 152, Gaia DR2 12, OEC 18). 31 placed
rows (mostly hosts found only in OEC) have no V, so `vmag` and `absmag` are `null` — draw them
as markers, not as stars of magnitude 0. constellations.json 722 + 30 segments, 12,340 B;
exoplanets.json 1,259 planets on 892 rows, 68,987 B; named + constellations + exoplanets
852,181 B of the 900,000 B budget.

## 8. Galaxy — `galaxy/…`   (step `50_galaxy.py`)

Sources (pinned in `tools/galaxy_sources.py`): astropy 7.1.0's Galactocentric frame (module file
hashed), LVDB v1.1.1 (CC0; tag commit 72dabf78), galstreams 1.2.1 (BSD-3, PyPI sdist), SpiralMap 0.27
(MIT wheel: Reid+2019 Table 2, Drimmel+2024 Cepheid fits, Poggio+2021 and Gaia DR3 overdensity grids
— Gaia-derived, **non-commercial**), Agama @f302756b (`data/McMillan17.ini`,
`py/example_mw_bar_potential.py`). Build-time checks only, nothing shipped: galkin's Reid+2014
masers, galpy 1.12.0 `named_objects.json`, UCC clusters (GPL-3), Skowron+2019 Cepheids. **Not
shipped:** Skowron Cepheids (no licence), UCC (GPL-3), masers (no licence).

**Frame.** Everything is in kpc in astropy's Galactocentric frame, parameter set "v4.0" (R0 8.122 kpc,
z_sun 20.8 pc, Galactic-centre direction `galcen_coord` at ICRS 266.4051, −28.936175 — Galactic
l = b = 0, not the radio source Sgr A* — roll 0): +x from the Sun towards the Galactic
centre, +y towards l = 90° (the Sun's direction of motion), +z to the North Galactic Pole; the disc
turns clockwise seen from +z. The Sun is at `sun_kpc` = (−8.121973366122, 0, 0.0208).
`to_icrs` (nested rows, 4×4, column vectors) maps `[x, y, z, 1]` to ICRS kpc centred on the Sun;
its 3×3 part is a rotation, so the inverse is `Rᵀ (q − t)`. It is computed by transforming the origin
and three points 1000 kpc along the axes with astropy; it reproduces astropy to 1e-12 kpc out to
300 kpc (verify). Published fits keep their own Galactocentric radii: Reid+2019 used R0 = 8.15 kpc,
Drimmel+2024 appears to use ≈ 8.28 kpc.

`galaxy/galaxy.json` (floats rounded: positions of clusters/satellites 0.1 pc, streams and arms 1 pc):
```
{ "format", "units",
  "frame": { name, r0_kpc: 8.122, z_sun_kpc: 0.0208, roll_deg, galcen_icrs_deg: [ra, dec],
             sun_kpc: [x, y, z], to_icrs: [[4], [4], [4], [0, 0, 0, 1]], to_icrs_note, axes,
             refs: ["R0 = 8.122 kpc: 2018A&A...615L..15G", ...], checks },
  "arms_reid2019": [ { name ("Local arm"), key (SpiralMap: "3-kpc", "Norma", "Sct-Cen", "Sgr-Car",
                       "Local", "Perseus", "Outer"), ref, width_kpc, beta_range_deg, beta_kink_deg,
                       r_kink_kpc, pitch_deg: [below, above kink], r0_fit_kpc: 8.15,
                       points: [[x, y, 0], ...], note } ],               // 7 arms, 525 points
  "arms_drimmel2024": [ { name, key ("Scutum", "Sag-Car", "Orion", "Perseus"), ref, pitch_deg,
                       ln_r0, r_at_phi0_kpc, phi_range_deg: [-90, 0], points, note, r0_fit_note } ],
  "arms_note", "drimmel_variants": { "<0..8>": { phi_range_deg, n_cepheids, arms_fitted } },
  "globulars":  [ { name, key (LVDB), table ("gc_harris" | "gc_mw_new"), host ("mw" |
                    "sagittarius_1"), xyz, dist_kpc, dist_err_kpc: [minus, plus] | null, rhalf_pc,
                    mv, ref: "Baumgardt 2021 (2021MNRAS.505.5957B)" } ],   // 194, sorted by key
  "satellites": [ { ...the same, table "dwarf_mw", host ("mw" | "lmc"), ellipticity, pa_deg,
                    galaxy_confirmed: bool } ],                              // 65, sorted by key
  "lvdb_selection": { globulars, satellites, left_out: { gc_mw_new_candidates: [...],
                      gc_ambiguous: [...], dwarf_mw_unconfirmed: [...] }, fields: {...} },
  "streams": [ { name, track (galstreams TrackName), ref ("Ibata et al. 2021, ApJ 914, 123"),
                 quality: "track" | "constant-distance" | "approximate-distance",
                 great_circle: bool, approximate: bool, info_flags ("1111"), dist_range_kpc,
                 n_source_points, points: [[x, y, z], ...] (<= 120), note } ],   // 100, by name
  "streams_note", "streams_dropped": [41 track names],
  "young": { files: { "<key>": {...} }, extent_kpc, what, orientation, plane, orientation_source,
             licence_note, refs },
  "model": { file, width, height, bytes, extent_kpc: [-20, 20, -20, 20], z_kpc: 0, what, quantity,
             orientation, stretch: {...}, scale_heights_kpc: { thin: 0.3, thick: 0.9, bar_x_shaped,
             long_bar_1, long_bar_2 }, vertical_profiles, components: [...], bar_angle_deg: -25,
             not_included, refs } }
```
- `mv` absolute V; `rhalf_pc` LVDB `rhalf_physical` (major-axis half-light radius); `pa_deg` on the
  sky, east of north; `dist_err_kpc` from the catalogued distance-modulus errors (LVDB leaves the
  Harris clusters' kpc errors at 0). `null` where LVDB has no value (e.g. the SMC's ellipticity).
  Left out: gc_ambiguous (22), unconfirmed cluster candidates (19) and dwarfs (3).
- Streams: galstreams default tracks minus the 41 Ibata+2024 tracks whose distance is 1.000 kpc
  everywhere (a placeholder). `quality` "track" = the distance varies and InfoFlags bit 1 = 1 (52);
  "constant-distance" = one published value along the whole track (39); "approximate-distance" =
  it varies but galstreams has no observed distance track (bit 1 = 0: end-point interpolation, a
  mean Galactocentric distance, M5's orbit prediction; bit 1 = 2: M68's reciprocal parallaxes "with
  caution") (9). `great_circle` = InfoFlags bit 0 = 0, a sky path constructed between published
  end points (23). **Draw `approximate` streams (quality ≠ track or great_circle; 48) fainter or
  dashed and show `note`**, which says what is approximate (from galstreams' own track docs).
- Arms are **fits**, only over the azimuths fitted: Reid β = atan2(y, −x) in [β_min, β_max], sampled
  every 1° plus the kink, R = R_kink·exp(−(β − β_kink)·tan ψ), x = −R cos β, y = +R sin β (the sign is
  proved on the Reid+2014 masers: median offset 0.20–0.32 kpc, mirrored 0.79–1.23). `width_kpc` is
  Table 2's arm width as SpiralMap transcribes it; SpiralMap draws the band edges at
  (R_kink ± width/2)·exp(−(β − β_kink)·tan ψ), i.e. a full width of `width_kpc`·R/R_kink. Drimmel:
  variant '1' (φ −90…0°, 1,331 Cepheids; what SpiralMap draws and labels its "best phi range"),
  pitch and ln R0 the mean of the 'strength' and 'prom' estimates, ln R = ln R0 − tan(pitch)·φ,
  x = −R cos φ, y = R sin φ, every 1°. At the Sun's azimuth Drimmel's Orion arm is at R = 9.46 kpc,
  Reid's Local arm at 8.53 kpc (0.93 kpc apart): two models, label both.

**Textures** — all face-on from the North Galactic Pole. Column c (0 = left), row r (0 = top) of a
W × H image with `extent_kpc` = [x0, x1, y0, y1] covers x = x0 + (c + 0.5)(x1 − x0)/W,
y = y1 − (r + 0.5)(y1 − y0)/H (+x right, +y up). In three.js a `PlaneGeometry(x1 − x0, y1 − y0)`
centred on the extent in the x-y plane, default UVs, `texture.flipY = true` (the default), at
z = `z_kpc`, is the right way round.
- `galaxy/young-gaiadr3-ob.png` (8,780 B; Gaia DR3 OB stars, Gaia Collaboration, Drimmel+2023) and
  `galaxy/young-poggio2021-ums.png` (7,369 B; Gaia EDR3 upper main sequence, Poggio+2021): 121 × 121
  RGBA, one pixel per published grid node (0.1 kpc, heliocentric −6…6 kpc), extent
  [−14.171973, −2.071973, −6.05, 6.05], z_kpc 0.0208 (the maps are projections onto b = 0 through
  the Sun). R = G = B = code, overdensity = lo + code/255·(hi − lo) with lo = −1, hi = 1.5 (step
  0.0098); A = 0 where the published grid is exactly 0.0 (no data: 8,130 and 7,981 of 14,641
  cells; coverage 100 % within 3 kpc, about half at 4–5 kpc), else 255. Keys `gaiadr3_ob`,
  `poggio2021_ums`; each `files` entry has file, width, height, bytes, title, ref, tracer,
  extent_kpc, z_kpc, cell_kpc, encoding, value_range, cells_with_data, coverage_by_distance_from_sun,
  cells_at_max (the Gaia DR3 grid is clipped at 1.30 by its producers). Orientation (grid[ix, iy],
  x towards the centre, y towards l = 90°, from SpiralMap's plotting code) is proved on the shipped
  PNGs: 1,930 UCC open clusters younger than 50 Myr sit on mean overdensity 0.243 / 0.146 as
  shipped against at most 0.123 / 0.062 for the other 7 flips and transposes. **Licence: Gaia-derived,
  non-commercial (CC BY-NC 3.0 IGO taken to apply).**
- `galaxy/model.png` (16,990 B): a **model**, 512 × 512 gray over ±20 kpc: McMillan (2017) thin +
  thick stellar discs, Σ = Σ0·exp(−R/Rd), plus the Portail+2017 bar (Sormani+2022 analytic fit,
  Agama `makeBarDensity()`, 33 parameters) integrated over z, rotated to −25° (major axis −25°/155°,
  near end at l > 0: a point 3 kpc out lies at l = +13.2°). McMillan's bulge and gas discs, the
  Sormani disc and all haloes are not included. Stretch: code = round(255·clip((log10 Σ − log10
  black)/(log10 white − log10 black), 0, 1)), inverse Σ = black·(white/black)^(code/255) Msun/kpc²,
  black 5.5e5 (the discs at R = 20 kpc, so the model fades out inside the square), white 5.8e9
  (the maximum); decodes to an independent integration within half a code step (1.83 %). Thickness:
  `scale_heights_kpc` (thin 0.3, thick 0.9, exponential in |z|; bar z0 0.229, long bars sech² with
  0.61 and 0.25).

Budget ≤ 600,000 B: galaxy.json 401,548 + PNGs 33,139 = 434,687 B.

`js/galaxydata.js` (this step; ES module, no dependencies) decodes these files:
```
export async function loadGalaxyData(base = 'data/')   // fetches galaxy/galaxy.json
export function buildGalaxyData(json)                   // the same from parsed JSON (node tests)
class GalaxyData {
  meta (the json), toIcrsMatrix (Float64Array(16), row-major), sun (Float64Array(3)), r0,
  globulars, satellites, streams, armsReid, armsDrimmel, young (json.young.files), model
  toIcrs(p, out?) -> ICRS kpc from the Sun       fromIcrs(q, out?) -> Galactocentric kpc
  raDecDist(p) -> { ra, dec (deg, ICRS), dist (kpc) }
  image(key) -> { file, width, height, extent, z, meta }     // key 'model' | 'gaiadr3_ob' | 'poggio2021_ums'
  pixelCentre(key, col, row, out?) -> [x, y]     pixelAt(key, x, y) -> { col, row } | null
  uv(key, x, y, out?) -> [u, v]                  // three.js, flipY: v = 1 at row 0
  youngValue(key, code, alpha = 255) -> overdensity | null (alpha 0)
  modelSigma(code) -> Msun/kpc^2 (0 for code 0)
  streamApproximate(i) -> bool
}
```
`tools/verify_galaxy.py` checks the above (and writes `tools/.cache/work/galaxy_fixture.json`);
`tools/test_galaxy.mjs` runs the module against it: toIcrs/fromIcrs vs astropy 5.7e-13 kpc, all 259
clusters and satellites back to their LVDB RA/Dec within the 0.1-pc rounding (max 4.4″), every
young-map pixel within half a step of the published grid, the no-data mask exact, model pixels
within 1.83 %.
