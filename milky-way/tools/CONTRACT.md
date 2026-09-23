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

`moons.json` (floats unrounded except the error figures):
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
       "obliquity_deg": <derived> | null, "obliquity_ref": "<which orbit/plane it is measured to>",
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
    direction, not a position.**
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
    never joins the primary's row), else by position (≤ 30″, distance within 5 %, same component
    letter), else become their own row from OEC's RA, Dec and distance (`dist_src` 5) — unless
    OEC's quoted distance error makes parallax/error ≤ 5, in which case they are left out.
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
named.json 11,048 rows, 770,787 B: 76 unplaced (flag 4), 176 with parallax/error 5–10, 942 with no
applicable error, 98 white dwarfs, 210 companions, 525 IAU names, 889 hosts; within 20 pc 1,830
placed rows (Gaia DR3 1,503, Hipparcos 2007 145, Gliese 1991 152, Gaia DR2 12, OEC 18). 31 placed
rows (mostly hosts found only in OEC) have no V, so `vmag` and `absmag` are `null` — draw them
as markers, not as stars of magnitude 0. constellations.json 722 + 30 segments, 12,340 B;
exoplanets.json 1,255 planets on 889 rows, 68,766 B; named + constellations + exoplanets
851,893 B of the 900,000 B budget.

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
