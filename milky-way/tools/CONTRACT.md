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
  same fragments.
- Every step ships a **`verify_<step>.py`** that asserts the properties the app relies on, run by
  `verify_data.py`. Print measured numbers, not just "ok".

Environment for every step: `tools/venv/bin/python`, working directory `tools/`. Downloads are cached
in `tools/.cache/` (gitignored). Set `MILKYWAY_SEED` to a folder of earlier downloads to reuse them.

Budget (unpacked, hard caps): ephemeris ≤ 1.5 MB, moons ≤ 0.6 MB, physical ≤ 60 KB, small bodies
≤ 0.7 MB, planet textures ≤ 2.3 MB, sky ≤ 0.25 MB, deep stars ≤ 1.9 MB, named stars + constellations
+ exoplanets ≤ 0.9 MB, galaxy ≤ 0.6 MB.

---

## 1. Planets, Moon, Pluto — `ephem.json` + `ephem.bin`   (step `10_ephemeris.py`)

Source: JPL DE430. Range: **JD 2415020.5 – 2488069.5 TDB (1900-01-01 – 2100-01-01)**.

`ephem.bin`: for each body, `intervals × 3 × (degree+1)` float32 Chebyshev coefficients, laid out
`[interval][x,y,z][coefficient]`, bodies concatenated in the order of `ephem.json.bodies`.

`ephem.json`:
```
{ "source": "de430.bsp", "jd_start": 2415020.5, "jd_end": 2488069.5,
  "frame": "ICRF", "units": "km",
  "emrat": <Earth/Moon mass ratio, derived from the SPK's own Earth and Moon segments>,
  "bodies": [ { "name": "mercury", "center": "sun", "offset": <byte offset>,
                "intervals": n, "interval_days": L, "degree": d }, ... ],
  "max_error_km": { "<name>": <measured max vs DE430 over >= 20000 random epochs> } }
```
Bodies: `mercury, venus, emb, mars, jupiter, saturn, uranus, neptune, pluto` are **heliocentric**
(target − Sun). For Jupiter…Pluto they are the **system barycentres** (DE has no planet centres;
the offset is < 400 km except Pluto, whose centre is ~2,135 km from its barycentre). `moon` is
**geocentric** (Moon − Earth). Earth = EMB − moon / (1 + emrat).

Evaluate at `jd` (TDB): `i = clamp(floor((jd − jd_start)/L), 0, n−1)`,
`x = 2·(jd − (jd_start + i·L))/L − 1`, Clenshaw sum per axis.

## 2. Major moons — `moons.json` + `moons.bin`   (step `11_moons.py`)

Source: JPL satellite SPKs mar097, jup310, sat425, ura111, nep081. Range:
**JD 2433282.5 – 2469807.5 TDB (1950-01-01 – 2050-01-01)**, the span every file covers.

Each moon's orbit is stored as a sequence of contiguous windows of `W` days; in each window a
**precessing Keplerian ellipse** is least-squares fitted to the SPK positions (relative to the
planet's system barycentre), in a fixed frame per planet. Nine float32 per window:
`a (km), e, varpi0 (rad), dvarpi (rad/day), inc (rad), Omega0 (rad), dOmega (rad/day),
lambda0 (rad), n (rad/day)`.

Evaluate at `jd`: `k = clamp(floor((jd − jd_start)/W), 0, nwin−1)`,
`tc = jd_start + (k + 0.5)·W` (float64), `t = jd − tc`,
`Omega = Omega0 + dOmega·t`, `varpi = varpi0 + dvarpi·t`, `M = lambda0 + n·t − varpi`,
solve `E − e·sin E = M`, `xp = a(cos E − e)`, `yp = a·sqrt(1−e²)·sin E`, `w = varpi − Omega`,
rotate `(xp, yp, 0)` by `Rz(Omega)·Rx(inc)·Rz(w)` into the fit frame, then
`r_ICRF = Fᵀ · r_fit` where `F` (rows) is the planet's `frame` matrix (ICRF → fit frame).

`moons.json`:
```
{ "jd_start": ..., "jd_end": ..., "frames": { "jupiter": [[...],[...],[...]], ... },
  "moons": [ { "name": "Io", "naif": 501, "parent": "jupiter", "window_days": W,
               "windows": nwin, "offset": <byte offset>, "a_km": <mean>,
               "max_error_km": <measured>, "max_error_frac": <max error / a> }, ... ] }
```
Target: max error ≤ 0.5 % of the orbit radius for every moon, measured at ≥ 5,000 random epochs
against the SPK. Moons that cannot meet it are left out and listed in the step's report.

`js/ephem.js` (written by this step, ES module, no dependencies) exports:
```
export async function loadEphemeris(base)   // fetches the four files above; returns an Ephemeris
class Ephemeris {
  range  -> { jdStart, jdEnd }                    // planets
  moonRange -> { jdStart, jdEnd }
  helio(name, jd, out)  // km, ICRF, heliocentric: 'mercury','venus','earth','moon','mars',
                        // 'jupiter','saturn','uranus','neptune','pluto'; out = Float64Array(3) or []
  geoMoon(jd, out)
  moons(parent) -> [{ name, naif, parent, aKm }]
  moon(name, jd, out)   // km, ICRF, relative to the parent's barycentre; returns false outside range
}
export function jdFromDate(date)      // UTC Date -> JD TDB (TT = UTC + (TAI−UTC) + 32.184 s)
export function dateFromJd(jd)        // inverse, for display
```
Leap seconds come from ERFA's table (in `physical.json.constants.leap_seconds`). Before 1972 the
app uses TAI − UTC = 10 s (documented approximation, < 1 minute of error).
A node test (`tools/test_ephem.mjs`) evaluates the JS module against positions exported by
Python from the SPKs and prints the worst error per body.

## 3. Physical and rotational constants — `physical.json`   (step `12_physical.py`)

Sources: NAIF `pck00011.tpc` (IAU WGCCRE 2015), `gm_de440.tpc`, ring radii from the `sat425`
header (Saturn C/B/A) and the PDS Ring-Moon Systems Node constants (Uranus; label them), ERFA
(leap seconds, J2000 obliquity), astropy's IAU 2012 AU.

```
{ "constants": { "au_km": 149597870.7, "gm_sun_km3_s2": ..., "k_gauss_au15_day": ...,
                 "obliquity_j2000_arcsec": ..., "leap_seconds": [[jd_utc, tai_minus_utc], ...] },
  "nut_prec_angles": { "3": [[theta0_deg, theta1_deg_per_century(, theta2)], ...], "4": ..., ... },
  "bodies": { "<key>": {
       "name": "Mars", "naif": 499, "parent": "sun" | "<planet key>",
       "radii_km": [a, b, c], "gm_km3_s2": ...,
       "pole": { "ra": [a0, a1, a2], "dec": [d0, d1, d2], "pm": [W0, W1, W2],
                 "nut_ra": [...], "nut_dec": [...], "nut_pm": [...], "system": "4" },
       "obliquity_deg": <derived>, "sidereal_rotation_h": <derived, negative = retrograde> } },
  "rings": { "saturn": [ { "name": "C", "inner_km": ..., "outer_km": ..., "source": "..." }, ... ],
             "uranus": [ ... ] } }
```
Keys: `sun, mercury, venus, earth, moon, mars, jupiter, saturn, uranus, neptune, pluto` and every
moon in `moons.json` (lower-case English name). Rotation (IAU convention): `T` = Julian centuries
TDB since J2000, `d` = days; `alpha = a0 + a1·T + a2·T² + Σ nut_ra[k]·sin θk`,
`delta = d0 + d1·T + d2·T² + Σ nut_dec[k]·cos θk`, `W = W0 + W1·d + W2·d² + Σ nut_pm[k]·sin θk`,
`θk = Σ_j theta_j·T^j` from `nut_prec_angles[system][k]`. Body-fixed frame =
`Rz(W)·Rx(90° − delta)·Rz(90° + alpha)` applied to ICRF vectors.

`js/rotation.js` (this step) exports `bodyFrame(body, jd) -> 3×3 row-major Float64Array` (ICRF →
body-fixed), with a node test against CSPICE (`spiceypy.pxform('J2000', 'IAU_MARS', et)` etc.).

## 4. Small bodies — `smallbodies.json` + `smallbodies.bin`   (step `20_smallbodies.py`)

Sources: JPL SBDB (all asteroids/TNOs with H < 12, the KStars snapshot), MPC CometEls (KStars
snapshot), JPL SBDB comet export (KStars, for famous historic comets), JPL SBDB lookup fixtures in
adam_core (named NEOs). Pluto is **not** here (it comes from DE430).

`smallbodies.bin`: column arrays, each contiguous, in the order and with the types given by
`smallbodies.json.columns`: `q` (AU, f32), `e` (f32), `tp` (days from J2000 TDB, **f64**),
`P` (3×f32, unit vector to perihelion, ICRF), `Q` (3×f32, unit vector 90° ahead in the orbital
plane, ICRF), `H` (f32, NaN if unknown), `kind` (u8).

Position at `jd`: `a = q/(1−e)`, `n = k_gauss / |a|^1.5`, `M = n·(jd − J2000 − tp)`;
elliptic: `E − e sin E = M`, `x = a(cos E − e)`, `y = a·sqrt(1−e²)·sin E`; hyperbolic
(`e > 1`): `e sinh F − F = M`, `x = |a|(e − cosh F)`, `y = |a|·sqrt(e²−1)·sinh F`; parabolic
(`e == 1`): Barker's equation. `r = x·P + y·Q` (AU, ICRF, heliocentric).

`smallbodies.json`: `{ count, columns: [{name, type, offset, length}], kinds: {code: label},
names: [...], sources: [...] per row index as a code, labelled: [indices shown with a label by
default], info: { "<index>": { diameter_km, albedo, rot_per_h, class, orbit_id, epoch, ref } },
epoch_note }`. Kinds at least: `dwarf, mba, hungaria, hilda, trojan, centaur, tno, neo, comet,
interstellar, other`. Rows with unusable orbits (e.g. `e = 0` placeholders with null M, hyperbolic
asteroid rows mis-typed) are dropped and counted in the report.

`js/smallbodies.js` (this step) exports `loadSmallBodies(base)` returning an object with
`count`, `kind(i)`, `name(i)`, `positionsAt(jd, outFloat32 /*3×count, AU*/)`,
`orbitPath(i, jdCentre, segments) -> Float32Array` (one closed ellipse or a ±N-year arc for open
orbits), and a node test against an independent Python propagation.

## 5. Planet imagery and colours — `tex/*.jpg` + `tex/textures.json`   (step `30_textures.py`)

Equirectangular maps, **east-positive longitude increasing to the right**, row 0 = +90° latitude.
`textures.json` per body: `{ file, width, height, lon_left_deg, grayscale, kind: "visible" |
"radar" | "albedo", nodata_fill: "...", source_id, note }`. Bodies: sun, mercury, venus (Magellan
radar, labelled), earth (Blue Marble NG), earth_night (city lights), moon, mars, jupiter, pluto
(0..360 domain!), charon. And `colours`: measured disk colours in sRGB (0–255) with their source
for jupiter, saturn, uranus, neptune (Karkoschka 1998 spectra) and the sun (TSIS-1), plus how
they were computed. No painted or artist textures, ever.

## 6. Sky backdrop — `sky/gaia-dr3-counts.jpg` + `sky/sky.json`   (step `31_sky.py`)

Gaia DR3 source counts (MAST HATS point map, NSIDE 256, duplicated partitions corrected),
resampled to **2048 × 1024 equirectangular in ICRS**: column `x` ↔ RA = 360·(x + 0.5)/2048 deg,
row `y` ↔ Dec = 90 − 180·(y + 0.5)/1024 deg. Grayscale JPEG, asinh stretch recorded in `sky.json`
with the counts at black and white points. Licence: CC BY-NC 3.0 IGO, ESA/Gaia/DPAC.

## 7. Stars — `stars/…`   (step `40_stars.py`)

- `stars/deep.bin` + `stars/deep.json`: AT-HYG v3.2 stars within 500 pc with parallax/error > 10
  (per-star errors from Stellarium's hip_gaia3 catalogues, used at build time only), **excluding**
  every star that is in `named.json`. 8 bytes per star: `int16 x, y, z` (ICRS heliocentric,
  pc × 64), `uint8 absmag_code` (M_V = code/10 − 8), `uint8 colour_code` (index into
  `stars/colour.json`). Sorted deterministically.
- `stars/colour.json`: 256 sRGB entries (0–1) for effective temperatures, log-spaced, with the
  temperature of each entry; Teff from B−V (Ballesteros 2012 — a model, say so) or from the
  Mamajek table (Bp−Rp, spectral type) when B−V is missing; Teff → sRGB by integrating a Planck
  spectrum against the CIE 1931 2° observer.
- `stars/named.json`: every star with V < 6.5, every object within 20 pc (AT-HYG + HYG companions
  and white dwarfs placed at their primary's distance, flagged), and exoplanet hosts within 100 pc.
  Columns (arrays of equal length): `id` (e.g. "HIP 32349", "Gaia DR3 …", "Gl 244B"), `name`
  (IAU name, or common name for nearby stars, or ""), `desig` (Bayer/Flamsteed, Greek letters,
  e.g. "α CMa"), `con`, `x, y, z` (pc, ICRS), `vmag`, `absmag`, `colour`, `spect`, `dist_src`
  ("Gaia DR3", "Hipparcos 2007", "Gliese 1991", …), `flags` (bit 0 exoplanet host, 1 white dwarf,
  2 companion at primary's distance, 3 parallax/error 5–10, 4 no usable parallax — not placed in
  3D, 5 IAU name).
- `stars/constellations.json`: `{ "<abbr>": { name, lines: [[i, j], ...] } }` with `i, j` row
  indices into `named.json`; segments touching a flag-4 star are dropped and counted.
- `stars/exoplanets.json`: `{ hosts: { "<named row>": [ { name, period_d, a_au, mass_mj,
  radius_rj, year, method } ] } }`, confirmed planets only (Open Exoplanet Catalogue).

## 8. Galaxy — `galaxy/…`   (step `50_galaxy.py`)

`galaxy/galaxy.json`:
```
{ "frame": { "name": "astropy Galactocentric v4.0", "r0_kpc": 8.122, "z_sun_kpc": 0.0208,
             "sun_kpc": [x, y, z], "to_icrs": 4x4 row-major (galactocentric kpc -> ICRS
             heliocentric kpc), "refs": [...] },
  "arms_reid2019":   [ { name, width_kpc, points: [[x,y,z], ...], note } ],
  "arms_drimmel2024":[ { name, points: [...], note } ],
  "globulars":  [ { name, key, xyz: [..], dist_kpc, rhalf_pc, mv, ref } ],
  "satellites": [ { name, key, xyz, dist_kpc, rhalf_pc, ellipticity, pa_deg, mv, ref, host } ],
  "streams":    [ { name, ref, quality: "track" | "constant-distance", points: [...] } ],
  "young":  { "files": {...}, "extent_kpc": ..., "orientation": "...", "refs": [...] },
  "model":  { "file": "galaxy/model.png", "extent_kpc": ..., "scale_heights_kpc": {...},
              "components": [...], "refs": [...] } }
```
Textures: `galaxy/young-*.png` (Gaia young-star overdensity, masked beyond coverage, alpha 0
outside), `galaxy/model.png` (face-on surface density of the McMillan 2017 disc + Portail/Sormani
bar, labelled a model). Every coordinate in galactocentric kpc; the file says how image rows and
columns map to x and y.
