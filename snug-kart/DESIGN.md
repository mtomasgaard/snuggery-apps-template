# Snug Kart — design

The design Snug Kart was built from. It was written before the code; wherever building and testing
the game changed a number, the number here is now the one the code uses, and `NOTES.md` — under
Decisions — says what it was and why. `NOTES.md` also covers running the game, the tests, and
editing the tracks and racers.

---

## 1. Concept

Snug Kart is an original arcade kart racer for a phone held upright. Eight small karts, driven by
eight people from an imaginary seaside-and-mountain town, race three laps of one of three tracks —
a flat harbour loop, a mountain pass that climbs to a pair of banked hairpins, and a fast night
circuit that crosses over its own start straight on a bridge. Throttle is automatic: one thumb
steers, the other drifts and uses items picked up from floating parcels. Everything — karts,
tracks, trees, houses, lanterns, the faces of the drivers, every sound — is generated in code at
start-up, so the whole game is one small ZIP that runs offline inside Snuggery. The tone is cosy
rather than aggressive: the items are household things (a kettle, a quilt, a ball of yarn, a paper
plane, a pot of honey), nobody is hurt, and a spin-out is a comic wobble, not a crash.

---

## 2. Ground rules

- **Original everything.** No name, character, track, item, sound, logo or colour scheme from any
  existing kart game appears in code, comments, text, file names or assets. `tools/check.mjs`
  enforces a banned-word list (§17.1). The word "kart" for the vehicle is fine.
- **No assets.** Every model is three.js geometry, every texture a `<canvas>` painted at start-up,
  every sound Web Audio synthesis. The only third-party code is three.js r186 (MIT), vendored.
- **Snuggery's runtime** (the rules Snuggery's Create tab gives an AI for a mini-app): one ZIP with `index.html` at the top; relative paths only, no `..`, no symlinks; ≤ 10,000 files,
  ≤ 512 MB total, ≤ 128 MB per file, ≤ 16 folder levels, no encryption; **no network of any kind**
  (content rule list, CSP and navigation policy all block it); no JavaScript-to-native bridge; ES
  modules and `fetch()` of the app's own files work; `localStorage` persists, `sessionStorage` is
  emptied on every launch; `alert/confirm/prompt` show as native dialogs (not used here). Must
  work on a phone, in light and dark mode (the menus follow `prefers-color-scheme`; the 3D scene is
  the scene).
- **Targets:** 390 × 844 CSS px portrait, DPR 2–3, 60 fps on an iPhone 16-class phone in
  WKWebView. ZIP **under 3 MB** (it is about 0.53 MB: three.js deflates to about 420 KB).

---

## 3. Racers

Eight racers. In v1 **all karts share one physics model** — the choice is cosmetic plus the AI
personality the other seven drive with. (Per-racer weight and speed classes are cut: §19.)

| id | Name | Body colour | Trim | Personality (one line, shown on the title screen) |
| --- | --- | --- | --- | --- |
| `pip` | Pip Marlow | tangerine `#F28C28` | cream `#FFF1D6` | A bike courier who has never once touched the brakes. |
| `juno` | Juno Vale | teal `#17A3A0` | mist `#E8F6F5` | A lighthouse keeper: patient, precise, always on the clean line. |
| `otto` | Otto Brisk | plum `#7D3C98` | lilac `#F0D9F7` | A retired bus driver, unhurried and impossible to shove. |
| `wren` | Wren Tully | mustard `#D9A21B` | umber `#3B2F1E` | A teenage inventor who drifts every bend, needed or not. |
| `soren` | Soren Hale | slate `#4A6FA5` | frost `#DDE6F3` | A ferry pilot who takes the wide line and waves as you pass. |
| `mabel` | Mabel Quist | rose `#E0607E` | blush `#FFE3EA` | A knitting champion who drops yarn with real glee. |
| `tuck` | Tuck Rowan | moss `#5B8C3A` | sprout `#EAF2DF` | A gardener who takes every patch of grass personally. |
| `ines` | Ines Carvo | charcoal `#3A3F47` | ivory `#F2EBDD` | A night-shift nurse: calm, exact, fastest on the final lap. |

Faces (painted into the atlas, §6.2) — skin, hair colour, hair style, expression:

| id | Skin | Hair | Style | Expression |
| --- | --- | --- | --- | --- |
| pip | `#E9B48A` | `#2B1B12` | short fringe | wide grin |
| juno | `#8D5A3B` | `#1A1A1A` | high bun | calm smile |
| otto | `#F1C8A8` | `#D8D8D8` | bald crown, side tufts, moustache | flat, content |
| wren | `#F3D0B0` | `#C8552B` | goggles on the forehead, messy top | open-mouth "whee" |
| soren | `#C68A62` | `#3A2A1E` | knitted cap in trim colour | friendly smile |
| mabel | `#F6D5C0` | `#9A9AA5` | curls | mischievous smirk |
| tuck | `#B77B55` | `#5A3A1C` | wide-brim sun hat in trim colour | big smile |
| ines | `#6E452C` | `#111111` | short crop, visor in `#FFB000` | small focused smile |

AI personality parameters, in `data/racers.json` (a person can edit it in Snuggery):

| id | `lane` (fraction of usable half-width, + = right) | `skill` (pace multiplier) | `drift` (chance to drift a qualifying bend) | `aggression` (item eagerness 0–1) | `awareness` (chance to dodge a hazard) |
| --- | --- | --- | --- | --- | --- |
| pip | −0.15 | 1.00 | 0.70 | 0.60 | 0.70 |
| juno | 0.00 | 1.02 | 0.50 | 0.30 | 0.90 |
| otto | +0.25 | 0.97 | 0.30 | 0.40 | 0.80 |
| wren | −0.30 | 0.99 | 0.90 | 0.50 | 0.60 |
| soren | +0.30 | 0.98 | 0.40 | 0.30 | 0.80 |
| mabel | −0.05 | 1.00 | 0.60 | 0.90 | 0.70 |
| tuck | +0.12 | 0.99 | 0.50 | 0.50 | 0.75 |
| ines | −0.22 | 1.01 (+0.01 on the final lap) | 0.60 | 0.45 | 0.85 |

The player picks one racer; the other seven are AI. The player's own row is ignored for AI.

---

## 4. Items

Items come from **parcels**: small wrapped boxes (a 0.9 m cube in a warm cream `#F7E7C6` with a
ribbon cross in the track's accent colour and a bow on top), floating 1.0 m above the road, slowly
turning (1.2 rad/s) and bobbing (±0.12 m, 1.6 s period). Parcels stand in **rows of four** across
the road at lateral positions −0.6, −0.2, +0.2, +0.6 × half-width, at three places per lap (§5);
the first place is a **double row** (two rows 10 m apart), so the whole grid can collect one on the
opening straight. A kart within 1.8 m (plan distance) of a parcel collects it; the parcel shrinks
away in 0.15 s and **respawns 1.5 s later** (grows back in 0.3 s). A racer holds **one** item; a
racer already holding one drives through a parcel without breaking it. On pickup the item button
shuffles icons for 0.8 s (four changes, a tick each), then settles; the item can be used only once
it has settled.

Five items — a boost, a shield, one dropped behind, one fired ahead, and a cheap fifth that reuses
the drop code:

| Item | What it does | Numbers |
| --- | --- | --- |
| **Kettle** (boost) | A jet of steam from the back: a burst of speed. | Boost 1.4 s: top speed +8 m/s, extra acceleration 30 m/s², off-track slowdown mostly ignored (§8). |
| **Quilt** (shield) | A quilted, translucent bubble wraps the kart. Blocks the next spin-out or tumble, then pops. While up, Honey has no effect and bumps push others 3× harder. | Lasts 10 s or one hit. |
| **Yarn Snare** (dropped behind) | A ball of yarn left on the road 2.5 m behind the kart. The next kart to touch it spins out. | Arms after 0.35 s. Catches a kart within 0.9 m plus 0.7 m of the kart's radius. Spin-out: 1.0 s, control lost, speed shed at 40 m/s² down to 8 m/s. Lasts until touched or 40 s. At most 10 on the track (oldest unravels first). |
| **Paper Plane** (fired ahead) | A folded paper plane that flies forward along the track and homes on **the racer one place ahead at launch**. | Speed 45 m/s along the centreline at the shooter's lateral offset; once within 25 m of its target it closes laterally at 8 m/s and vertically to kart height. Hit radius 1.2 m: tumble 1.3 s, speed × 0.2. Expires after 7 s. Fired by the leader, it flies ahead and fades out after 2 s. |
| **Honey Puddle** (dropped behind, the cheap fifth) | A golden puddle spreads behind the kart. Anyone driving through it is slowed while inside. | Centred 4 m behind, it spreads 0 → 3.2 m radius in 0.4 s. Inside: top speed × 0.5, plus 0.3 s after leaving; the kart that dropped it is spared for 1.5 s. Lasts 14 s. At most 4 on the track. |

**Recovery:** after a spin-out or tumble a kart is immune to further spin-outs and tumbles for
1.0 s (a gentle blink), so a pile-up does not chain; a blinking kart drives through a Snare without
setting it off. Hazards and planes touch only karts at their own height, so Lantern Night's bridge
and underpass never interact.

**Distribution** — weights by the collector's race position at pickup:

| Position | Kettle | Quilt | Yarn Snare | Paper Plane | Honey |
| --- | --- | --- | --- | --- | --- |
| 1st | 5 | 25 | 40 | 0 | 30 |
| 2nd–3rd | 15 | 20 | 25 | 20 | 20 |
| 4th–6th | 25 | 15 | 15 | 30 | 15 |
| 7th–8th | 40 | 15 | 5 | 35 | 5 |

**How the AI uses them** (each AI rolls a hold time of 1.5–6.0 s × (1.3 − `aggression`) on
pickup and will not use the item before it, except the Quilt defence):

- **Kettle** — used when the next 60 m of track is nearly straight (|κ| < 1/120 m⁻¹ throughout), or
  after 15 s held.
- **Quilt** — held as a defence: raised the moment a Paper Plane targets this kart (with
  probability `awareness`), or when a Snare or Honey lies on its line within 15 m and it has decided
  not to dodge. Raised anyway after 12 s held.
- **Yarn Snare** — dropped when another kart is 3–15 m behind on roughly the same line
  (|Δlateral| < 2 m); after 8 s held, at a corner entry (|κ| > 1/60); after 12 s, anywhere.
- **Paper Plane** — fired when the racer one place ahead is within 90 m, or after 8 s held.
- **Honey** — dropped at a corner apex (|κ| > 1/45) with a kart within 30 m behind, or after 8 s.

**Dodging:** when a Snare or Honey lies within 25 m ahead and within 2 m (plus the puddle's radius)
of the AI's line, it rolls `awareness` once for that hazard; on success it shifts its line to clear
the hazard by 0.5 m (at most 3.5 m, never into the verge) until past it.

**Seeking:** with empty hands and nothing to dodge, an AI steers for the nearest live parcel 10–45 m
ahead, leaving one that a kart nearer to it has already claimed.

Icons: five small original SVG symbols (a kettle, a quilted square, a ball of yarn, a paper plane,
a honey drip) defined once as `<symbol>` elements in `index.html` and used by the item button and
the results screen.

---

## 5. Tracks

### 5.1 How a track is defined and generated

Each track is a closed loop of control points, in `data/tracks.json`. A point is
`[x, z, y, width, bank]` in metres and degrees:

- `x`, `z` — the plane. three.js convention: **+x is east (screen right on the mini-map), +z is
  south (screen down)**, y is up. The order of points is the direction of travel. Point 0 is on the
  start/finish line.
- `y` — road height at that point.
- `width` — road width (tarmac only). Each side then has a **verge** (default 4 m of grass, sand
  or needles — drivable, slow) and then a **wall** (a 0.6 m-thick, 1.1 m-tall barrier; on the bridge
  a railing). Section overrides can set the verge to 0 (walls at the road edge).
- `bank` — the **magnitude** of the road's bank in degrees. The sign is computed, not stored: the
  road always tilts **down toward the inside of the bend**, so a number cannot be written with the
  wrong sign.

Generation (in `js/track.js`, which imports only `three.core.js` and has no DOM, so Node can run
it):

1. `new CatmullRomCurve3(points.map(([x, z, y]) => new Vector3(x, y, z)), true, 'centripetal')`,
   with `curve.arcLengthDivisions = 8000`. `L = curve.getLength()`.
2. **Samples every 1.0 m** of arc length (`N = floor(L)`): for sample *i*, `t = curve.getUtoTmapping(i / N)`,
   position `P = curve.getPoint(t)`; segment `seg = floor(t·n)`, local `f = t·n − seg`,
   `sm = f²(3 − 2f)`; width and bank magnitude are `lerp(point[seg], point[seg+1], sm)`.
3. **Plan heading** `θᵢ = atan2(zᵢ₊₁ − zᵢ₋₁, xᵢ₊₁ − xᵢ₋₁)`. **Signed curvature**
   `κᵢ = wrap(θᵢ₊₁₂ − θᵢ₋₁₂) / 24` (radians per metre; **positive = turning right**, because with
   +z south the right-hand vector of a forward tangent `(tx, tz)` is `R = (−tz, 0, tx)` and
   `dθ/ds > 0` rotates the tangent toward it).
4. **Signed bank** `bᵢ = bankMagᵢ · clamp(κᵢ · 150, −1, 1)` (full bank at radius ≤ 150 m, fading to
   0 on straights). A point at lateral offset `l` (+ = right) is
   `P + R·l·cos b − Up·l·sin b`, so a right-hand bend (b > 0) has its right (inside) edge lower.
5. Per sample store: `P`, forward `T` (3D, normalised), plan right `R`, surface normal, `w/2`,
   `verge`, `b`, `κ`, cumulative distance `s = i`, section flags (bridge, tunnel-cut, etc.).
6. **Road mesh** from every 2nd sample (2 m): a strip with 2 vertices across (the edges); UV `u`
   across 0–1, `v = s / 8` (the asphalt texture repeats every 8 m). **Verge** strips outside each
   edge, continuing the banked plane. **Walls** from every 4th sample. A **start line** quad
   (checker texture 64 × 16 canvas) at s = 0, and **kerb** strips (alternating trim/white every 2 m,
   0.5 m wide) on the inside edge wherever |κ| > 1/60.
7. **Under the road:** where `y > 1.5` on a flat-ground track, a skirt (vertical faces from the
   road edge to the ground) in the track's stone colour — or, on Lantern Night, **viaduct columns**
   every 14 m at both edges. Pinewood Pass instead gets a heightfield (§5.5).

Karts never raycast. Each kart keeps its **nearest sample index**, searched locally within ±30
samples of the previous one (so the crossover on Lantern Night resolves by continuity, never by
"which road is nearer"). From it: `s`, lateral `l = dot(p − P, R)`, surface height and normal, the
verge and wall limits.

**Race distance** = `lap · L + s`. A lap counts when `s` wraps from `> L − 40` to `< 40` **and**
the kart passed checkpoints at 25 %, 50 % and 75 % of `L` in order during that lap (stops a kart
reversing across the line from scoring).

### 5.2 Validation (already run once, re-run by `tools/check.mjs`)

The numbers below were checked with a prototype of the validator in this design session (three.js
r186's own `CatmullRomCurve3`, the same code path as the game):

| Track | Length | Height range | Width | Min plan radius | Max grade | Corridors |
| --- | --- | --- | --- | --- | --- | --- |
| Harbour Loop | 1,028 m | 0 … 4.1 m | 13 … 18 m | 26.3 m (gate chicane) | 6.2 % | no overlap |
| Pinewood Pass | 1,268 m | 0 … 26.3 m | 11 … 22 m | 20.5 m (summit hairpin) | 8.9 % | no overlap |
| Lantern Night | 1,315 m | 0 … 9.0 m | 14 … 18 m | 61.3 m | 2.8 % | one crossover, 9.0 m clearance |

The grid check (below) was also run: the 40 m before the line has |κ| ≤ 0.0068 on every track
(limit 0.0125).

The checks, which `tools/check.mjs` must repeat on every run (they catch an edited
`data/tracks.json` that folds or overlaps):

- **Radius:** at every sample, `1/|κ| ≥ w/2 + verge + wall + 2` (else the inside edge folds).
- **Corridors:** for every pair of samples more than 60 m apart along the loop, the plan distance
  ≥ `w₁/2 + w₂/2 + 2·(verge + wall) + 4`, unless the heights differ by ≥ 7 m (a bridge).
- **Grade:** `|Δy| per metre ≤ 0.12`.
- **Grid:** the 40 m before point 0 has `|κ| < 1/80` (the starting grid sits there).

### 5.3 Harbour Loop — "flat and friendly, with one tight gate"

A seaside town on a clear morning. Wide, almost flat, easy to learn; the only tricks are a hump
bridge over the canal and the narrow old-town gate chicane.

```json
{ "id": "harbour", "name": "Harbour Loop", "verge": 4,
  "points": [
    [0,0,0,18,0], [120,0,0,18,0], [185,-20,0,18,5], [205,-80,0,17,6], [180,-140,1,16,4],
    [120,-160,3,15,0], [60,-160,4,15,0], [0,-160,1,15,0], [-50,-190,0,13,0], [-100,-170,0,13,0],
    [-150,-190,0,16,3], [-200,-150,0,18,8], [-190,-90,0,18,8], [-140,-70,0,17,2], [-110,-30,0,18,0],
    [-70,0,0,18,0] ],
  "parcels": [70, 80, 450, 800] }
```

Sections by distance along the lap (≈, metres): **0–121** harbour-front straight (start); **121–385**
the east sweep past the crane yard, banked 4–6°; **385–505** the hump bridge over the canal (up to
4 m; skirt of harbour stone, left open over the canal, which reads as a deck on two stone piers at x = 45 and x = 75); **505–674** the old-town gate chicane, 13 m wide,
with a stone archway spanning the road at s ≈ 590; **674–857** the west hairpin, banked 8°;
**857–1028** back along the quay.

- **Palette:** sky zenith `#6FB3E0` → horizon `#E9F2F5` (fog = horizon, near 60 m, far 260 m);
  sea `#2E6F95`; asphalt `#5A5E66`; verge sand `#E3D3A6`; harbour stone `#B8B2A7`; house walls
  apricot `#F2C6A0`, mint `#A8D5BA`, butter `#F6E3A1`, powder `#C9D7F2`, rose `#E7B7C8`; roofs
  terracotta `#B5543C`; accent (parcel ribbons, kerbs) `#2E6F95`.
- **Ground:** a flat plane at y = −0.05 in sand; a sea plane at y = −1.2 south of z = +20 (the
  quay edge is 6 m beyond the start straight's wall); and a **canal**, a 30 m-wide water strip at
  x ∈ [45, 75], z ∈ [−320, −135], which passes under the hump bridge (road height ≈ 4 m there) and
  ends in a basin inside the loop — it must not reach the flat start straight at z = 0. Build the
  ground as rectangles around the canal, with stone canal walls from −1.2 to 0.
- **Props** (all instanced, positions from a seeded RNG so every race looks the same):
  - **Houses:** 60 boxes, 6–10 m wide, 7–9 m deep, 6–14 m tall, pitched roof prism on top, placed
    along the inside of the loop and north of the gate, ≥ 6 m outside the wall; instance colours
    from the five wall colours. Window grid via a shared 128 × 128 canvas texture (dark panes on
    white; the wall colour comes from the instance colour).
  - **Archway** at the gate: two 4 × 4 × 10 m towers and a 3 m-deep beam across the road at 8.5 m.
  - **Lamp posts** every 24 m on the outer edge of the harbour-front and quay straights (a 5 m
    cylinder and a small box head).
  - **Bollards** every 6 m along the sea side of the quay (0.3 × 0.8 m cylinders) — the main close
    cue for speed.
  - **Crane** in the crane yard (x ≈ 250, z ≈ −60): lattice of boxes, 30 m tall, boom over the water.
  - **Boats:** 8 hulls (a stretched, squashed box with a tapered prism bow) with masts, moored along
    the quay, bobbing ±0.15 m.
  - **Crates** in stacks of 2–4 near the crane.

### 5.4 Pinewood Pass — "climb to the summit hairpins, then a long fast descent"

A mountain road through pines late in the afternoon. The track climbs 26 m through banked
sweepers, squeezes through a rock cut, turns back on itself at the summit, and runs a wide
downhill straight back to the lodge.

```json
{ "id": "pinewood", "name": "Pinewood Pass", "verge": 4,
  "points": [
    [0,0,0,18,0], [110,0,0,18,0], [180,-30,3,17,6], [210,-100,8,16,8], [190,-170,13,15,10],
    [130,-200,17,14,4], [60,-190,20,12,0], [0,-210,22,11,0], [-50,-250,24,12,6], [-40,-310,26,14,14],
    [-100,-330,26,15,14], [-140,-290,24,16,8], [-150,-220,19,20,4], [-160,-140,12,22,4],
    [-200,-80,7,20,8], [-170,-20,3,18,6], [-100,10,0,18,0] ],
  "parcels": [60, 70, 440, 900],
  "sections": [ { "from": 480, "to": 609, "kind": "rockcut", "verge": 1.5 } ] }
```

Sections: **0–111** lodge straight (start); **111–408** the climb, left-hand sweepers banked
6–10°, up to 17 m; **408–609** the ridge and the **rock cut** (11–12 m wide, verge only 1.5 m, 8 m
cliff faces for walls); **609–866** the summit hairpins, banked 14°, the tightest radius (≈ 20 m)
on any track; **866–1089** the long descent, 20–22 m wide, grades up to 9 %; **1089–1268** valley
bends back to the lodge.

- **Palette:** sky zenith `#5B7FA8` → horizon `#F4B97A` (fog = `#E8B98E`, near 50 m, far 240 m);
  asphalt `#54565C`; verge pine needles `#6B5A3C`; pine greens `#2F5D3A`, `#3F7A4A`; granite
  `#8A8D91`; terrain grass `#6E8F4E` → rock `#8A8D91` above 45 m → snow `#F2F4F5` above 75 m;
  accent `#C8552B`.
- **Ground (heightfield):** a grid of 160 × 160 vertices over the track's bounding box plus 180 m on
  each side. For each vertex, find the nearest centreline sample (a 20 m spatial hash of the samples
  keeps this under ~100 ms); with `d` = plan distance and `edge = w/2 + verge + wall`:
  - `d ≤ edge + 2` → height = road height at that sample − 0.6 (always under the road).
  - otherwise → road height − 0.6 + `(d − edge − 2) · 0.35 · (0.6 + 0.8·n(x, z))`, where `n` is a
    seeded 2D value noise (3 octaves, base period 120 m), giving slopes that rise away from the road
    into ridges 60–100 m high at the far edges. Vertex colours by height as above.
  - In the rock cut, the walls are replaced by **cliff faces**: a strip from the wall line up to
    road height + 8 m, jagged by ±0.8 m of noise, granite.
- **Props:**
  - **Pines:** 700 on High, 380 on Low. Each is a trunk cylinder plus three stacked cones (one merged
    geometry with vertex colours, ≈ 40 triangles), scale 0.8–1.6, placed by jittered grid (12 m cells,
    one candidate per cell, rejected within `edge + 3` of the road or on terrain steeper than 0.8).
  - **Rocks:** 120 icosahedrons (detail 0, vertices jittered ±25 %), 0.6–3 m.
  - **Log lodge** at the start: two cabins (boxes, prism roofs) and a timber arch over the line.
  - **Chevron boards** on the outer wall of both summit hairpins and the first sweeper: 1.2 × 0.8 m
    boards, accent colour with white chevrons (canvas 64 × 32), every 8 m through the bend — the key
    readability cue for "turn now".
  - **Marker posts** every 10 m on both edges of the climb and descent (0.15 × 1.0 m, white with a
    reflector) — the close speed cue.

### 5.5 Lantern Night — "fast banked sweepers, and a bridge over your own start"

A lakeside park and quay at night, lit by paper lanterns. A figure of eight: the start straight runs
under a bridge, the east loop climbs on an embankment, the road crosses back over the start
straight on the bridge, and the west loop descends to the lake. The fastest, most flowing track.

```json
{ "id": "lantern", "name": "Lantern Night", "verge": 4,
  "points": [
    [-60,60,0,15,0], [0,0,0,15,0], [60,-60,0,15,0], [130,-100,1,16,8], [200,-80,2,17,10],
    [230,-10,3,16,10], [200,60,5,16,8], [130,90,7,15,4], [60,60,8.5,14,0], [0,0,9,14,0],
    [-60,-60,8.5,14,0], [-130,-100,7,16,6], [-210,-90,5,18,10], [-250,-20,3,18,12],
    [-220,60,1.5,17,8], [-150,90,0.5,16,4] ],
  "parcels": [60, 70, 520, 1000],
  "sections": [ { "from": 640, "to": 810, "kind": "bridge", "verge": 0 } ] }
```

Sections: **0–171** the underpass straight (start; passes under the bridge at s ≈ 86); **171–560**
the east sweepers, banked 8–10°, climbing onto the embankment; **560–889** the high road and the
**bridge** (14 m wide, railings at the road edge, crossing the start straight at s ≈ 723 with 9 m
of height between the two road surfaces); **889–1142** the west sweepers, banked 6–12°, descending;
**1142–1315** the lakeside run back to the line.

- **Palette:** sky zenith `#0E1433` → horizon `#26305E` (fog `#1B2248`, near 40 m, far 220 m);
  asphalt `#3A3D4A`; verge lawn `#2C4A3E`; stone `#5A5E73`; lanterns warm `#FFB347`, coral
  `#FF7A59`, pale gold `#FFD27A`; building windows `#FFD9A0`; accent `#FF7A59`. Lighting: a cool
  hemisphere light (`#6A7BB8` / `#141A33`, intensity 1.7 in r186's physical units) and a moon
  directional light at 0.7; the lanterns are **emissive, not lights** (§15).
- **Ground:** flat plane at −0.05 (lawn); a lake plane at −0.6 south of z = +110.
- **Props:**
  - **Lanterns:** on 3 m poles every 18 m on both edges (≈ 150), a sphere (8 × 6 segments) in one of
    the three lantern colours, `MeshBasicMaterial`. Under each, a **light pool**: an additive,
    transparent radial-gradient quad (canvas 64 × 64) lying on the road/verge, 6 m across,
    instanced. This is what makes the road readable at night.
  - **String lights** across the road at 6 places (a sagging curve of 24 small quads per string).
  - **Buildings** around the outside of both loops: 70 tall boxes (12–40 m) with a lit-window
    texture (256 × 256 canvas, a random 35 % of windows lit in `#FFD9A0`) as `emissiveMap`.
  - **Viaduct columns** under the high road (every 14 m at both edges where y > 2), and **railings**
    on the bridge (posts every 2 m and a top rail).
  - **Park trees** with round crowns (icosahedron detail 1) in dark teal `#1F4E4A`, 160 on High, 90
    on Low.
  - **Moon:** a pale disc sprite low in the east, fog off.

---

## 6. The kart model

### 6.1 Geometry

One kart is **one mesh**: boxes and cylinders merged (`BufferGeometryUtils` is not vendored —
merge by hand: concatenate position/normal/uv/color arrays and offset the indices; ≈ 40 lines in
`js/kart.js`). Dimensions in metres, origin at ground level under the kart's centre, +z forward in
the kart's local frame (rotate the group so it faces along its heading):

| Part | Shape | Size | Position (x, y, z) | Colour |
| --- | --- | --- | --- | --- |
| Floor pan | box | 1.40 × 0.12 × 2.10 | (0, 0.28, 0) | charcoal `#2B2D33` |
| Body tub | box | 1.30 × 0.32 × 1.50 | (0, 0.50, −0.10) | body colour |
| Nose | box, top edge bevelled by a second thin box | 1.00 × 0.24 × 0.60 | (0, 0.44, 0.95) | body colour |
| Front bumper | cylinder along x, r 0.09 | length 1.36 | (0, 0.30, 1.22) | trim |
| Seat back | box | 0.80 × 0.55 × 0.12 | (0, 0.85, −0.55) | trim |
| Engine | box | 0.80 × 0.40 × 0.45 | (0, 0.55, −1.05) | `#5C6068` |
| Exhausts | 2 cylinders along z, r 0.07, length 0.35 | | (±0.25, 0.62, −1.35) | `#9EA3AB` |
| Steering column + wheel | thin cylinder + a torus-like 12-sided flat cylinder r 0.18 | | (0, 0.85, 0.30), tilted 30° | `#1E1F24` |
| Driver torso | cylinder r 0.30 top, 0.34 bottom, h 0.55 | | (0, 0.95, −0.25) | body colour |
| Driver head | sphere r 0.30, 16 × 12 | | (0, 1.45, −0.20) | textured (atlas) |
| Hair / hat | per style: hemisphere cap, bun sphere, brim cylinder, goggles band | | on the head | hair / trim |

**Wheels** are separate: all 32 wheels of all 8 karts are **one `InstancedMesh`** (a 14-sided
cylinder, dark rubber `#1C1C1E` with a hub disc in `#C9CCD1` via vertex colours). Front r 0.30,
width 0.28, at (±0.72, 0.30, 0.78); rear r 0.36, width 0.40, at (±0.74, 0.36, −0.78). Each frame
their matrices are set from the kart transform, the wheel spin (`angle += v·dt / r`) and, for the
front pair, the steer angle (± 0.45 rad at full lock).

≈ 420 triangles per kart body + 32 × 56 for the wheels ≈ 5,200 triangles for the field.

Visual-only motion on the kart group (never fed back into physics): pitch and roll from the road
normal; body **lean** into turns of `−0.10 · steer · min(1, v/20)` rad about the forward axis;
**drift slip** yaw offset of `dir · (0.32 + 0.14 · steer·dir)` rad toward the inside; a squash on
landing a bump (scale y 0.92 for 0.1 s).

### 6.2 The face atlas — the one per-racer texture

A single canvas **512 × 256** (8 tiles of 128 × 128, `pip` … `ines` left-to-right, top row then
bottom row) is the `map` of the kart material
(`MeshLambertMaterial({ map: atlas, vertexColors: true, alphaHash: true })`). The top-left
**8 × 8 pixels of tile 0 are left pure white** — every non-face vertex of every kart gets UVs
pointing at that white patch, so its colour comes from the vertex colour alone. That makes each
kart **one draw call**. Each kart has its own copy of the material (all eight identical, so one
shader program) only so that a rival can fade on its own (§10); `alphaHash` dithers the fade, so
nothing needs sorting, and at full opacity discards nothing.

Painting a tile (the same function paints the 72 px faces on the title screen and the 30 px ones on
the results):
fill the skin colour; two white ellipses (22 × 26 px) at 40 % and 60 % across, 45 % down, with
dark pupils looking slightly forward; brows angled per expression; mouth per expression (arc,
grin with teeth, flat line, "o"); cheek blush circles at 15 % alpha; hair fringe across the top
third in the hair colour. The head sphere's UVs are remapped at build time so the face occupies
the middle half of the sphere's wrap and is centred on the kart's forward direction — verify with
the `face` test scene (§17.3), which puts the camera in front of each kart.

---

## 7. Units and the simulation step

Metres, seconds, radians. **Fixed simulation step 1/120 s**; each animation frame runs
`floor(accumulator / step)` steps, at most 8. The frame delta from `requestAnimationFrame` is
**clamped to 1/15 s**, so a stall or a return from background never teleports a kart; the race
clock is the sum of simulated steps, never wall time.

---

## 8. Physics (every kart, player and AI alike)

State per kart: plan position, height (from the track), heading `ψ`, forward speed `v` (along the
heading), lateral speed `u` (sideways slide), steer `σ ∈ [−1, 1]`, drift state, boost timer,
stun state, the nearest sample index.

| Quantity | Value |
| --- | --- |
| Top speed `vTop` | **30 m/s** (player). AI: §9. |
| Acceleration | `a = 22 · (1 − v / vTop)` m/s² (0 → 27 m/s in ≈ 3.1 s). Throttle is always on. |
| Above `vTop` (after a boost, entering the verge) | decelerate at **12 m/s²** toward `vTop` (16 m/s² on the verge). |
| Brake / reverse | **26 m/s²**; reverse builds at 40 % of that, to **−7 m/s**. (Touch: drag the pad down; keys: ↓ / S.) |
| Slope | `a −= 9.8 · sin(pitch) · 0.5` (uphill slows, downhill helps, halved for fun). |
| Steer input smoothing | `σ` moves toward the input at **6 /s** (digital inputs ramp; the pad and tilt are analog but still rate-limited). |
| Yaw rate | `ω = σ · 2.3 · g(v)`, `g(v) = min(1, |v|/7) · (1 − 0.4 · clamp((v − 7)/23, 0, 1))`; sign flips in reverse. At 30 m/s: 1.38 rad/s → a 21.7 m turning radius. |
| Grip | lateral speed decays `u ← u · e^(−9·dt)` (normal), `e^(−2.5·dt)` (drifting). Velocity in the plane = `v·forward + u·right`. |
| Verge (off-track) | when `|l| > w/2 + 0.3`: `vTop × 0.55` (× 0.9 while boosting). |
| Honey | `vTop × 0.5` while inside + 0.3 s. |
| Boost (Kettle 1.4 s; mini-boosts §8.1) | `vTop + 8` (38 m/s), extra acceleration **30 m/s²** until at it. Timers do not add: the longer one wins. |

### 8.1 Drift and mini-boost

- **Entry:** drift button pressed while `|σ| ≥ 0.25` and `v ≥ 12` → drift direction `dir = sign(σ)`.
  If pressed with the wheel near centre, the drift **arms** and begins as soon as `|σ|` passes 0.25
  within 0.4 s.
- **While drifting:** `ω = dir · 2.3 · g(v) · (0.80 + 0.60 · σ·dir)` (steering *into* the drift
  tightens it to 1.40×, steering out widens it to 0.20×, it never flips); grip `e^(−2.5·dt)`; top
  speed × 0.97.
- **Charge** accumulates 1 s per second while `σ·dir ≥ −0.2`, and at half that rate while steered
  further out. **Tier 1 at 0.8 s** (sparks gold
  `#FFC857`), **tier 2 at 1.7 s** (sparks mint `#6EF0C2`).
- **Exit:** releasing the button ends the drift; tier 1 → **0.55 s** boost, tier 2 → **1.0 s**.
- **Cancel (no boost):** a wall impact with normal speed > 6 m/s, a spin-out or tumble, or `v < 8`.

### 8.2 Walls

The wall line is at `|l| = w/2 + verge − 0.75` (0.75 = the kart's half-width plus a margin). On
contact: clamp `l` back to the line; the velocity component along the track-plane normal (toward
the wall) `vn` becomes `−0.3 · vn`; the along-wall speed is multiplied by `1 − 0.5 · |sin φ|`
(φ = angle between travel and wall), so a scrape costs little and a square hit costs half; if
φ > 50°, speed × 0.35 and the heading turns 50 % of the way toward the wall's tangent. Impacts
with `|vn| > 3` make sparks and a thump. A wall-scraping kart gets its steer input damped to 50 %
for 0.15 s so it does not stick.

### 8.3 Kart-to-kart bumps

Each kart is a circle of **radius 1.0 m** in plan. For every pair (28 pairs, all checked every step)
closer than 2.0 m with height difference < 1.5 m (the bridge again): push each out by half the
overlap along the line of centres; exchange the relative normal velocity with **restitution 0.4**
(equal masses; a Quilt-shielded kart counts as 3× mass). Forward speed is not allowed to drop below
85 % of its pre-bump value from a bump alone — bumps shove sideways, they do not stop you.

### 8.4 Spin-out, tumble, stuck, wrong way

- **Spin-out** (Yarn Snare): 1.0 s, no steering, speed shed at 40 m/s² down to 8 m/s, visual yaw 2
  full turns.
- **Tumble** (Paper Plane): 1.3 s, speed × 0.2 at once, visual roll 360° about the forward axis and
  a 1 m hop.
- **Recovery immunity** 1.0 s (§4).
- **Stuck:** `|v| < 2` for 2.5 s outside the countdown (e.g. nosed into a wall at an angle), or
  wrong way for 4 s → a 0.3 s fade, the kart is placed on the centreline 10 m back at its current
  `s`, facing along the track, at 10 m/s. No character appears; it is just a fade.
- **Wrong way:** heading · track forward < −0.3 for 1.5 s at > 3 m/s → "Wrong way" banner (player).

### 8.5 Starting grid

Two columns at lateral ±3.0 m, four rows 5 m apart, the front row 8 m behind the line — all on the
straight before point 0. **The player starts 5th** (third row, left). AI order is shuffled per race.
Before "Go" no kart moves; AI react after 0.05–0.30 s (random per kart).

---

## 9. The AI

Implemented in `js/ai.js`, pure (no three, no DOM), called once per simulation step per AI kart.
It produces the same inputs a human does — steer, drift button, brake, use item — and goes through
the same physics.

- **Target point:** the centreline sample at `s + La`, `La = 6 + 0.55·v` m (≈ 22 m at full speed).
  **Target lateral** `= lane · (w/2 − 2)` (personality) `+ clamp(κ̄ · 25, −0.55, 0.55) · (w/2 − 2)`,
  where `κ̄` is the mean curvature over `[s + 10, s + 40]` — a pull toward the inside of the coming
  bend. Plus temporary shifts: hazard dodging and parcel seeking (§4), passing (another kart 0–6 m
  ahead within 1.5 m laterally → shift 1.6 m to the side with more room), easing apart from a kart
  side by side (within 3 m along and 2.4 m across), and mistakes (below).
- **Steering:** `α` = angle from the kart's heading to the target point; steer input
  `= clamp(2.4 · α, −1, 1)`, smoothed like a human's. While drifting it aims by pure pursuit and turns
  the needed yaw rate back into a steer through the drift formula of §8.1.
- **Speed:** precompute per sample `vLim(κ)` = the largest `v` for which
  `0.9 · 2.3 · g(v) ≥ v · |κ|` (a lookup table over `v` in 0.5 m/s steps). The AI's target speed is
  the minimum over the next 60 m of `sqrt(vLimⱼ² + 2 · 18 · dⱼ)` (braking distance at 18 m/s²),
  capped by its own `vTop`. Above target → brake at 18 m/s²; otherwise throttle.
- **Drifting:** at the entry of a bend whose `|κ| > 1/90` for ≥ 25 m, with `v > 16`, drift with
  probability `drift`; release when `|κ| < 1/130`, when it runs more than 4 m inside its line, or once
  a tier is banked with the wheel hard over — it gets whichever tier its duration earned.
- **Pace and rubber-banding:** `vTop_ai = 30 · pace · skill · band`, where `pace` is the title
  screen's setting — **Relaxed 0.90, Standard 0.95, Fierce 0.99** — and
  `band = 1 + clamp(−gap/150, −1, 1) · (gap < 0 ? 0.08 : 0.06)` with
  `gap = raceDistance_ai − raceDistance_player` in metres: an AI 150 m or more behind the player
  runs up to 8 % faster, one 150 m or more ahead up to 6 % slower. Hard cap 31.5 m/s without boost.
  After the player finishes, `band = 1`.
- **Mistakes:** every 20–40 s (random), with probability `0.25 · (1.03 − skill) / 0.06`, the AI moves
  0.4 of its usable half-width toward the outside of the coming bend for 0.6 s (runs wide).
- **Items:** §4.

---

## 10. Camera

A chase camera, in `js/camera.js`:

- **Rig target:** a point 4.8 m behind and 2.7 m above the kart along its *velocity* direction
  (blended with its heading: 70 % velocity while drifting, 30 % otherwise, so a drift shows the
  kart's slide); look-at point 6 m ahead of the kart and 1.0 m up.
- **Smoothing:** position `p ← p + (target − p)·(1 − e^(−8·dt))`; yaw toward the target yaw with
  `1 − e^(−5·dt)`; never below the road surface + 1.2 m.
- **Field of view** (vertical, because the screen is portrait): **80° at rest → 90° at top speed →
  96° boosting**, eased with `1 − e^(−3·dt)`. In landscape (aspect > 1): 58° → 66° → 70°. Tune
  within ±4° by screenshot; keep the kart's rear wheels at about 72 % of the screen height.
- **Speed cues:** the FOV kick; **speed lines** (High only) while boosting — up to 18 thin white
  streaks on a transparent 2D canvas above the WebGL canvas, each living 0.2–0.35 s while it slides
  outward, kept to the left and right of a portrait screen, at most 25 % opaque and easing in and
  out with the boost; a 0.03 m camera shake while boosting; and the close props (bollards, marker
  posts, lanterns) that pass at the road edge.
- **Rivals at the camera:** a rival between the camera and the player fades by its depth in front
  of the camera — solid beyond 4 m, gone at 1.5 m (the player is about 5 m in front) — its Quilt
  bubble first, its wheels and shadow at half-way.
- **Countdown:** the camera starts 12 m behind and 7 m up and eases into the rig position over the
  3 s countdown. Every rival behind the player on the grid is hidden until Go, so the swoop frames
  the player's kart; at Go the kart behind is under the camera and comes back already faded.
- **Title backdrop:** the same camera glides along the selected track's centreline at 8 m/s, 6 m up,
  looking ahead — so the title screen is a slow tour of the track (§12).
- **Finish:** after the line the player's kart switches to autopilot (the AI driver) and the camera
  swings to a side-on view for the 2 s banner.

---

## 11. HUD and mini-map

DOM elements over the canvas (`js/hud.js`), updated at most 30 times a second except the
countdown. All inside safe margins: `max(env(safe-area-inset-*), 12px)` on every side, plus 8 px at
the top (Snuggery's full screen may leave the status bar visible). Font: `ui-rounded, system-ui,
-apple-system, sans-serif` (no bundled font), numbers `font-variant-numeric: tabular-nums`, white
with a 2 px dark text-shadow outline so they read over sky or road.

Portrait layout at 390 × 844:

| Element | Where | Size |
| --- | --- | --- |
| Position ("3" + "rd" + " / 8") | top-left | 48 px numeral, 20 px suffix, 16 px total |
| Lap ("Lap 2/3") and race time; last lap below after lap 1 | top-left, under the position | 18 / 16 / 13 px |
| Pause button | top-centre | 40 × 40 px |
| Mini-map | right edge, 56 px below the top margin | 104 × 104 px canvas |
| Item button (shows the held item / the shuffle) | bottom-right, above the drift button | 76 px circle |
| Drift button | bottom-right | 88 px circle |
| Drift hint (the first two races, during the countdown) | centre, below the mini-map | 15 px |
| Steering pad (appears where the thumb lands) | lower-left | 112 px ring, 44 px knob |
| Countdown numerals / "Go" | centre | 120 px |
| Banners ("Lap 2", "Final lap", "Wrong way", "Finished 3rd") | centre, upper third | 32 px, 1.2 s |
| Paper Plane lock-on reticle on the target | over the target kart (projected) | 40 px |

**The top-right corner stays clear.** In Snuggery's full screen on iOS 18, Snuggery's own 44 pt
exit button sits 16 pt inside the safe area's top-right corner; nothing of the HUD goes there.

**Mini-map** (`<canvas>`, drawn at device pixel ratio): north-up, the track fitted into the square
with 8 px padding. The road outline is drawn once into an offscreen canvas — 5 px white at 85 %
opacity over a 2 px dark outline; on Lantern Night the samples are drawn in order of height so the
bridge passes visibly over the underpass. Each frame (30 Hz) the offscreen image is copied and eight
dots drawn: 7 px in each racer's body colour, the player 10 px with a 2 px white ring, drawn last.

A hidden diagnostics line — **tap the race time five times** — shows fps, JS ms per frame, draw
calls, triangles and pixel ratio. It is what a device test reads (§16).

---

## 12. Screens and flow

```
loading ─► title ─► (building track…) ─► countdown ─► race ─► finish banner ─► results
             ▲                                          │                        │
             │                                          └── pause ─► resume / restart / quit
             └──────────────────── "Change track or racer" ◄────────── "Race again" ─► countdown
```

- **Loading:** a plain panel while modules, `data/tracks.json` and `data/racers.json` load. If
  either file is missing or malformed, or a track fails the §5.2 checks, the panel says so in a
  sentence naming the file and the problem — it never shows an empty race.
- **Title** (fits 390 × 844 without scrolling; scrolls inside the panel on shorter screens): the
  wordmark "Snug Kart" at the top; a **track card** (name, one line, length, best lap and best race
  time or "No best yet") with ‹ › buttons and swipe; a **racer grid** of 4 × 2 face tiles (72 px,
  name under each, a ring on the selected one, the personality line of the selected racer below);
  a row of **setting chips** (44 px tall) — Sound (off by default), Tilt (off), Quality (High / Low),
  Controls (Pad / Sides), Pace (Relaxed / Standard / Fierce); and a large **Race** button. Behind it,
  the selected track renders at the selected quality, at pixel ratio 1.25, with the gliding camera
  (§10), so tapping Race never rebuilds the track. Panels follow
  `prefers-color-scheme` (light: cream `#FFF8EC` panels, ink `#2A2622`; dark: `#1D1B22` panels,
  ink `#F2EDE4`), translucent over the scene.
- **Building track:** a short overlay while geometry is generated (target < 1.5 s on a phone). The
  same track is reused, not rebuilt, for "Race again".
- **Countdown:** 3 – 2 – 1 – Go, one per second, with beeps (§14). Inputs are live (the player can
  pre-steer); nothing moves until Go.
- **Race:** as §8–§11. "Final lap" banner on lap 3.
- **Pause** (button, Escape / P, or the page becoming hidden): the simulation stops, audio is
  suspended, a panel offers Resume, Restart, Quit to title. Returning to the page leaves it paused
  until Resume is tapped.
- **Finish:** "Finished 3rd" for 2 s while the player's kart drives on autopilot. AI still racing
  keep racing for up to 8 s more (a tap anywhere after the banner ends the wait at once); any not
  finished by then get a **projected** time
  `t + remainingDistance / max(averageSpeedOverLast10s, 10)`, marked "est." in the results.
- **Results:** eight rows — place, face, name, total time (m:ss.mmm) or "est.", best lap; the
  player's row highlighted; a "New best lap" and/or "New best race" badge when a record fell. Buttons:
  **Race again** and **Change track or racer**.

**Persistence** (`localStorage`, every access in `try/catch`, the game works without it):
`snugkart:v1:settings` → `{ sound, tilt, quality, controls, pace, track, racer }`;
`snugkart:v1:best:<trackId>` → `{ lap, race, racer, at }` (milliseconds, ISO date). Nothing in
`sessionStorage`.

---

## 13. Controls

All pointer input uses Pointer Events with per-`pointerId` tracking (true multi-touch: steer and
drift at the same time), `setPointerCapture`, and `touch-action: none` on the game layer. The page
blocks text selection, the long-press callout and double-tap zoom
(`user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;`, viewport
`user-scalable=no, viewport-fit=cover`), and the body is `position: fixed; overflow: hidden` so the
web view never scrolls or bounces.

- **Pad** (default): a touch anywhere in the lower-left region (left 60 % of the width, below 40 % of
  the height) sets the pad's centre where it lands (and past the ring the ring follows the thumb, so
  steering back never needs a long drag); horizontal drag `dx` gives
  `steer = clamp(dx / 64 px, −1, 1)` with a 6 px dead zone; dragging **down more than 56 px** brakes,
  then reverses once stopped. The ring and knob draw at the touch point; a ghost ring labelled
  "Steer" shows at 30 % opacity until the first race's first touch.
- **Sides:** the lower 42 % of the screen is split into a left zone (steer left, full lock) and a
  right zone (steer right); holding both brakes. **Drift in Sides mode:** tap-and-hold — release and
  press the same side again within 250 ms and keep holding: that starts a drift in that direction.
  Sides mode has no drift button (in the corner it would swallow the right thumb's steering); the
  Controls chip and the first races' hint explain the gesture. The item button sits above the right
  zone.
- **Drift button:** press and hold to drift (§8.1); release to fire the mini-boost. In Pad mode a
  thumb anywhere in the lower right below the item button drifts too.
- **Item button:** tap to use the held item. Both buttons take touches 14 px beyond their ring.
- **Tilt** (off by default): turning it on from the title chip is a tap, so it can call
  `DeviceOrientationEvent.requestPermission()` when that function exists (iOS); on `"granted"` the
  chip turns on, otherwise it stays off with the line "Tilt isn't available here". Steering then
  comes from `gamma` in portrait (`beta` in landscape, sign by `screen.orientation.angle`):
  `steer = clamp((angle − neutral) / 22°, −1, 1)` with a 3° dead zone, where `neutral` is the average
  reading during the countdown. The pad is then ignored; drift and item buttons stay. **Untested in
  Snuggery** — see §16's device list: Snuggery's `WKUIDelegate` does not implement the
  orientation-permission callback, and whether WebKit then prompts or refuses has to be seen on a
  phone. If it refuses, the chip explains it and the game is unaffected.
- **Keyboard** (desktop testing): ← → / A D steer; Space or Shift drift; X, E or Enter item; ↓ / S
  brake and reverse; Escape or P pause. While racing these keys call `preventDefault`; on the menus
  they do not, so Space and Enter still press a focused button.

---

## 14. Sound (Web Audio only)

`js/audio.js`. **Off by default.** The `AudioContext` is created on the first tap that turns sound
on, or on the Race tap if sound is already on from a previous visit (iOS allows audio only from a
gesture), and `resume()`d on every later tap while suspended. It is suspended when paused or hidden.
A master gain of 0.7 through a `DynamicsCompressorNode`.

| Sound | Synthesis |
| --- | --- |
| Engine (player only) | a sawtooth and a square one octave down, through a low-pass filter; `f = 55 + 170 · (v / 30)` Hz, cutoff `400 + 1800 · (v / 30)` Hz, gain 0.08; +6 % pitch and a 7 Hz wobble while drifting; +15 % pitch while boosting. Its parameters are set 20 times a second and glide on 40–80 ms time constants. |
| Drift screech | white noise (a 1 s looping buffer) through a band-pass at 2.2 kHz (Q 6), gain `0.06 · min(1, v/20)` while drifting. |
| Mini-boost | sine sweep 400 → 900 Hz in 0.2 s (tier 2: to 1200 Hz). |
| Countdown | sine 660 Hz, 0.12 s, for 3, 2, 1; 1320 Hz, 0.4 s, for Go. |
| Parcel pickup | triangle notes 880, 1320, 1760 Hz, 50 ms each; the shuffle ticks are 30 ms 2 kHz clicks. |
| Kettle | noise through a band-pass sweeping 800 → 3000 Hz over 0.6 s (a hiss). |
| Quilt | a soft sine chord (523, 659, 784 Hz), 0.5 s, slow attack; a pop (noise 40 ms) when it breaks. |
| Yarn Snare / Honey drop | a 140 Hz sine thump, 0.1 s / a low 90 Hz blip with a slow release. |
| Paper Plane launch | noise through a high-pass sweeping 500 → 4000 Hz in 0.3 s. |
| Spin-out / tumble | sawtooth sweeping 600 → 120 Hz over 0.5 s. |
| Wall thump | noise through a 300 Hz low-pass, 80 ms, gain by impact speed. |
| Lap / final lap | two notes (784, 1047 Hz) / three notes (784, 988, 1175 Hz), 0.12 s each. |
| Finish | an arpeggio 523 → 659 → 784 → 1047 Hz, 0.15 s each, the last held 0.6 s. |

No music in v1 (§19). The in-app line under the Sound chip: "Uses your phone's volume. If you hear
nothing, check the silent switch." (Web Audio in a web view on iOS usually follows the ring/silent
switch; whether it does inside Snuggery is a device check.)

---

## 15. Rendering and performance

### 15.1 Setup

`WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })`, created once and reused
across races; `outputColorSpace` sRGB; no tone mapping. Materials are `MeshLambertMaterial`
throughout (plus `MeshBasicMaterial` for sky, lanterns, light pools, particles) — no
`MeshStandardMaterial`, no environment maps, no post-processing. The sky is a sphere of radius
0.92 × the camera's far plane that follows the camera, vertex-coloured zenith → horizon, `fog: false`, `depthWrite: false`.
Linear fog in the horizon colour. Camera `near 0.3`, `far = fogFar + 10`.

### 15.2 Budgets (measured with `renderer.info` after a frame, reported by `__sk.stats()`)

| | High | Low |
| --- | --- | --- |
| Pixel ratio | `min(devicePixelRatio, 2)` | 1.25 |
| Shadows | one 1024² directional shadow map following the player (70 × 70 m ortho frustum); karts cast, road/verge/terrain receive | none; a blob shadow quad under each kart (instanced, one call) |
| Props | 100 % of the counts in §5 | 55 % |
| Speed lines, spark particles | on (particles ≤ 400) | speed lines off, particles ≤ 150 |
| Fog far / camera far | 260 / 270 m (Pinewood 240) | 180 / 190 m |
| Triangles drawn per frame | ≤ 150,000 | ≤ 90,000 |
| Draw calls per frame | ≤ 50 | ≤ 35 |

Where the draw calls go (expected ≈ 35–45 on High): sky 1; road, verge, walls, kerbs, start line ≈
6; terrain or ground/water 1–4; each prop type one `InstancedMesh` (≈ 6–10); karts 8 (one mesh
each); wheels 1; parcels 1 (instanced); items on track ≈ 4 (one instanced mesh per type); particles
1; Quilt bubbles ≤ 8 (only while up); shadow pass extra ≈ 10.

**Textures** (all canvases, all generated at start): asphalt 256², verge 128², face atlas 512 × 256,
house windows 128², lit windows 256², chevron 64 × 32, checker 64 × 16, light pool 64², quilt 128².
Total under 1.5 MB of GPU memory. `anisotropy` 4 on the road only.

**Geometry is disposed** — every geometry, material and texture of a track — when the player
switches to a different track, so twenty races in a row do not grow memory. Karts and shared
materials are built once.

**Adaptive resolution:** if the 90th-percentile frame interval over the last 2 s exceeds 19 ms,
step the pixel ratio down one notch (High: 2.0 → 1.7 → 1.4; Low: 1.25 → 1.0) and wait 3 s before
judging again. It never steps up during a race and never changes the Quality setting itself.

### 15.3 What to measure

- In the headless run (§17.3): `__sk.stats()` — draw calls, triangles, geometries, textures — on
  every track at both qualities, printed and checked against the table. **Frame times from headless
  Chromium with SwiftShader are not evidence of phone performance** and are printed for trend only.
- On a phone (§16): fps and JS ms from the diagnostics line, over a full race of Pinewood Pass on
  High (the heaviest), and of Lantern Night on High (the most overdraw from light pools).
- Time to build each track (logged to the diagnostics line), target < 1.5 s on a phone.

---

## 16. Robustness, and the device checks this design cannot do

- **Loop:** one `requestAnimationFrame` loop; clamped delta and fixed step (§7). Stops entirely
  (no rAF scheduled) while paused and while hidden.
- **Hidden page:** `visibilitychange` → hidden pauses the race, suspends audio; visible leaves it
  paused behind the pause panel. `pagehide` does the same.
- **Resize / rotation:** `resize` and `orientationchange` → `renderer.setSize`, camera aspect, FOV
  mode (§10), mini-map canvas re-created at the new device pixel ratio, pad region recomputed. The
  HUD is CSS and needs nothing. Portrait is the design; landscape must work, not shine.
- **WebGL context loss:** listen for `webglcontextlost` (prevent default, pause, suspend the sound,
  show "Graphics were reset — tap to continue" above every other screen) and
  `webglcontextrestored` (nothing is rebuilt: three.js re-uploads every geometry and texture on
  the next render; the stale dispose listeners it keeps are cleared at the loss).
- **No console errors, no failed requests, no request outside the app.** The only fetches are
  `./data/tracks.json` and `./data/racers.json`; the only imports are relative.

Device checks (listed in `NOTES.md`; the simulator and headless Chromium are not evidence for any
of these): 60 fps on High through a full Pinewood Pass
race on an iPhone 16-class phone, and what the adaptive resolution settles on; the same on Low on
the oldest phone available; audio starts on the first tap and follows the silent switch; the Tilt
permission prompt inside Snuggery (appears / refused); steering and drifting with two thumbs at
once; no text selection, callout, zoom or bounce on long presses and fast double taps; safe areas
in Snuggery's full screen with the status bar showing; leaving the app mid-race pauses it; bests
survive closing and reopening the app.

---

## 17. Files, testing and the debug hook

### 17.1 Layout

```
snug-kart/
  index.html          the page: canvas, HUD and menu markup, the item <symbol>s, one module script
  style.css           menus, HUD, buttons; light and dark tokens
  miniapp.json        {"schemaVersion":1,"name":"Snug Kart","entryPoint":"index.html",
                       "description":"An original kart racer for your phone: eight racers, three
                       tracks, drifting and household items, all offline.","version":"1.0"}
  NOTES.md            what it is, the folder, run it locally, how it was built, code map, licences
  DESIGN.md           this file
  data/
    tracks.json       the three tracks of §5 (control points, sections, parcels, palette, prop counts)
    racers.json       the eight racers of §3 (names, colours, faces, AI personality)
  js/
    main.js           boot, screens, the loop, speed lines, the __sk hook
    track.js          spline, samples, surface queries, validation (three.core only, no DOM)
    physics.js        kart dynamics, walls, bumps (pure)
    ai.js             the AI driver (pure)
    items.js          parcels, items, hits, the AI's item use (pure logic)
    items-view.js     item meshes and Quilt bubbles (instanced), the item button, reticle, warning
    race.js           grid, laps, checkpoints, positions, finish, projected times (pure)
    scenery.js        road, verge, walls, terrain, props, sky (three)
    kart.js           kart mesh, wheels, face atlas painter (three + canvas)
    fx.js             drift sparks, boost puffs, Kettle steam, Quilt pops, wall sparks (three)
    camera.js         chase, countdown, title glide, finish views
    hud.js            HUD and mini-map (DOM + canvas)
    input.js          pad, sides, drift and item buttons, keyboard
    tilt.js           orientation permission, readings, calibration
    audio.js          Web Audio synthesis
    store.js          localStorage wrapper, every call in try/catch
    rng.js            seeded PRNG (mulberry32) and value noise
    geo.js            geometry merging, canvas textures
  vendor/
    three.module.js   three.js r186, copied from ../anatomy/vendor/ unchanged
    three.core.js
    three-LICENSE.txt
  screenshots/app.png (left out of the ZIP)
  tools/              (left out of the ZIP)
    check.mjs         static checks + track validation + ZIP build and size
    sim.mjs           headless races in Node (no browser)
    items.mjs         each item's rule, set up deterministically on the race code
    shoot.mjs         headless Chromium screenshots and runtime checks
```

`OrbitControls.js` is **not** copied (not needed). No `PROMPT.md` (the app needs no setup).
Modules under `js/` import three as `'../vendor/three.module.js'`; the pure modules import only
`'../vendor/three.core.js'` or nothing, so Node can load them.

**Data is data.** The tracks and racers live in JSON so a person can change them in Snuggery; the
code re-validates on every load and fails loudly with the reason. Prop counts, palettes and parcel
positions are per-track fields in `tracks.json`, next to the points.

### 17.2 `tools/check.mjs` (Node, no dependencies)

1. **Files:** walk the folder with the ZIP's exclusions (`.*`, `screenshots/`, `tools/`,
   `pipeline/`, `scripts/`, `dist/`, `raw/`); assert ≤ 10,000 files, depth ≤ 16, no symlinks, each
   file ≤ 128 MB.
2. **No external URLs:** no `http://`, `https://` or protocol-relative `//host` in any shipped file
   **outside `vendor/`**; the vendored files must be byte-identical (SHA-256) to
   `../anatomy/vendor/three.module.js`, `three.core.js` and `three-LICENSE.txt` (three's source has
   URLs in comments; identity with the reviewed copy is the check).
3. **Relative paths:** every `import … from`, `import(…)`, `src=`, `href=` and `fetch(` target in
   shipped HTML/JS/CSS starts with `./`, `../` (resolving inside the folder) or a bare file name —
   never `/`, never a scheme.
4. **Names:** a whole-word, case-insensitive scan of every file in the folder except `vendor/` for
   the banned list. It is stored **ROT13-encoded** in `check.mjs` so the names never appear in plain
   text anywhere in the folder (decode at run time):
   `znevb yhvtv avagraqb lbfuv xbbcn objfre crnpu gbnq jnevb jnyhvtv qnvfl ebfnyvan "qbaxrl xbat"
   ynxvgh furyy onanan fgne zhfuebbz "envaobj ebnq" "ohyyrg ovyy" oybbcre fcval gujbzc obb
   zvav-gheob "tenaq cevk" 50pp 100pp 150pp 200pp "fhcre ubea" cvenaun "obbzrenat sybjre"
   "sver sybjre" "tbyqra zhfuebbz" "vgrz obk"` (quoted entries are phrases).
5. **Tracks:** load `data/tracks.json` through `js/track.js` and run the §5.2 checks; print the
   §5.2 table.
6. **ZIP:** build it exactly as the template's `.github/workflows/build-zips.yml` does
   (`zip -q -r -X <out> . -x '.*' '*/.*' 'screenshots/*' 'tools/*' 'pipeline/*' 'scripts/*' 'dist/*' 'raw/*'`)
   into `tools/.work/snug-kart.zip`; assert `index.html` is at its top and the size is
   **< 3 MB** (print it; expected ≈ 0.55 MB).

### 17.3 `tools/sim.mjs` (Node) and `tools/shoot.mjs` (headless Chromium)

**`sim.mjs`** imports `track.js`, `physics.js`, `ai.js`, `items.js` and `race.js` directly and runs
a full three-lap race on each track with **eight AI drivers** (the player slot on autopilot), seeds
1–5, at the fixed step, as fast as Node goes. It asserts: every kart finishes within 4 simulated
minutes; no NaN anywhere; no kart triggers the stuck-respawn more than twice in a race; lap times
between 95 % of a lap at the AI's 31.5 m/s cap and 75 s; and the finishing spread between 1st and 8th is under 25 s at Standard pace
(the rubber band works without making it a procession). It prints per-track lap-time ranges —
these are the numbers to tune §8–§9 against.

**`shoot.mjs`**, copied in shape from `../milky-way/tools/shoot.mjs`: serves the folder on a
local port, launches Chromium with SwiftShader at **390 × 844, DPR 2, `isMobile`, `hasTouch`**, and
**fails on any console error or warning, page error, failed request, HTTP ≥ 400, or any request
that is not to the local server, `data:` or `blob:`**. It needs Playwright (how to install it is in
`NOTES.md`). The first scenes, driven through `window.__sk` (`NOTES.md` lists the full set):

| Scene | What it does | Checks |
| --- | --- | --- |
| `title` | loads; waits for the title | the track card and racer grid are visible |
| `countdown` | `__sk.startRace({ track: 'harbour', racer: 'pip', seed: 1 })`, freezes at "2" | numeral shown |
| `race-harbour`, `race-pinewood`, `race-lantern` | start with the player on autopilot, `__sk.advance(20)` (simulate 20 s, then render one frame); give the player a Paper Plane and a tier-2 drift for the Pinewood shot | position, lap, mini-map, item shown; `__sk.stats()` within budget for High and Low |
| `touch` | synthetic pointer events: pad drag right, drift hold, item tap | steer > 0.5, drift begins, item used; no errors |
| `resize` | viewport 844 × 390, one frame, back to 390 × 844 | canvas size follows |
| `hidden` | fake `visibilitychange` to hidden | race paused, no frames scheduled |
| `results` | `__sk.advance(400)` to the finish, 8 s on | eight rows; a best lap written to `localStorage` |
| `face` | camera in front of each kart in turn | faces face forward (look at the image) |

`screenshots/app.png` is a Pinewood Pass shot like `race-pinewood`, written by `SAVE=1`.

**The hook:** `window.__sk = { startRace, advance(seconds), setAutopilot, giveItem, stats, state,
pause, resume, … }` — present in the shipped build (it is inert unless called) so the tests exercise
exactly what ships; `NOTES.md` lists the helpers added for the tests.

---

## 18. Licences

- **three.js** r186 — MIT, © 2010–2026 three.js authors; `vendor/three-LICENSE.txt`, unchanged.
- **Everything else** — the code, the tracks, the racers, the items, every texture and sound
  generated by that code — is original to this app and released under the **MIT** licence in the
  repository's root `LICENSE`. No font, image, model, sound or data file from anywhere else is
  included. NOTES.md repeats this in its licence section.

---

## 19. Cut from v1, and why

| Cut | Why |
| --- | --- |
| Per-racer stats (weight, speed, handling) | Balancing eight stat lines is weeks of tuning; one shared physics model keeps the race fair and the AI tuning tractable. |
| Speed classes and cups / championships | Pace (Relaxed / Standard / Fierce) covers difficulty with one multiplier; a series of races adds screens and state for little. |
| Multiplayer of any kind | No network by design; split-screen does not fit a phone. |
| Time-trial ghosts | Needs input recording and a replay path; a strong v1.1 candidate (best laps already persist). |
| Music | Composing an original loop well takes longer than the whole sound set; silence is the default anyway. |
| Jumps, air time, underwater or gliding sections | A second physics mode (airborne) and a raycast ground; the track model here keeps every kart on its ribbon. |
| A start-line boost trick, a rear-view camera, replays, battle mode | Scope; none are needed for a complete race. |
| Engine sounds for the AI | Eight oscillator pairs cost more than they add on a phone speaker. |
| Shadows from props | Only karts cast (High); props would multiply the shadow pass. |
| An in-app track editor | `data/tracks.json` is editable in Snuggery and validated on load — the editor is the JSON. |
| Haptics | iOS web views expose no vibration API. |
| A designed landscape HUD | Landscape works; portrait is the design target. |
