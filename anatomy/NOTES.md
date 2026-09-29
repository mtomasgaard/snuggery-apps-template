# Anatomy

Two 3D human bodies, male and female, that you can peel layer by layer, explode, search and inspect. It runs as a Snuggery miniapp: fully offline, no build step, plain HTML, CSS and ES modules.

- **Male** (`data/`): 1,548 structures in nine layers: skin and hair, muscles and tendons, organs, arteries, veins, brain, cartilage, bone and teeth. Skin, muscles, organs, brain, cartilage and skeleton come from BodyParts3D 3.0; the 670 arteries and veins from BodyParts3D 4.0, which reaches the fingers, toes and the arteries of the brain. About 3.3 million triangles, 31 MB of geometry.
- **Female** (`data/female/`): 1,135 structures in the same nine layers, from the HuBMAP Human Reference Atlas: skin, the organs of the chest, abdomen and pelvis with the uterus, ovaries and breasts, the brain in 283 regions, the spinal cord, the eyes, and the spine, pelvis and knees. The hip and leg muscles are a second woman's (the Visible Human Female, Andreassen et al. 2023) and the skull, ribs, shoulders, arms and feet are the male model's bones fitted to this body; both are labelled as such in the app and drawn in their own tint. About 1.4 million triangles, 13 MB.

The Male / Female switch in the top bar loads one body at a time.

## Run it

```sh
python3 -m http.server 8000     # from this folder
```

Open http://localhost:8000. Opening `index.html` directly from disk does not work: browsers block `fetch()` of the data files on `file://`, and the app shows a message saying so.

To import into Snuggery, zip this folder or run `python3 tools/package_snuggery.py`, which writes `dist/anatomy.zip` without the tools and docs.

## Folder map

```
index.html          App shell: top bar, camera buttons, selection card, dock, layer panel, sheets
app.js              All app logic (ES module, no dependencies beyond vendor/)
styles.css          Light and dark theme tokens, mobile-first layout (390 px), wide layout at 720 px+
miniapp.json        Snuggery display name, entry point and version
CREDITS.txt         Attribution and licences (required by the geometry licence)
data/               The male body
  anatomy.json      Editable: layers, regions, groups, types, About text, and every part's name and text
  geometry.json     Manifest: which binary file holds each part, offsets, counts, bounds
  geometry.bin      Skeleton geometry (bone, cartilage, teeth), 11.1 MB
  geometry-*.bin    Soft tissue, one file per layer (skin, muscle, organ, artery, vein, nerve, cartilage)
  female/           The female body: the same three kinds of file, one .bin per layer
vendor/             three.js r186 (three.module.js, three.core.js), OrbitControls, RoomEnvironment, MIT licence
fonts/              Atkinson Hyperlegible 400/700 and Newsreader 400 italic/500, SIL OFL
tools/              Rebuild pipeline for data/, vendor/ and fonts/. Not needed to run the app.
```

## Runtime rules

These come from the Snuggery runtime and must keep holding:

- No network access of any kind. Everything is bundled; there are no CDNs, web fonts or API calls. The only URL in the code is inside a comment in `vendor/RoomEnvironment.js`.
- Relative paths only. The three.js addons import `./three.module.js` directly, because there is no import map.
- No build step and no server. What is in the folder is what runs.
- No service workers or cross-origin iframes.
- State lives in `localStorage` only.
- Data files are re-read with `cache: 'no-store'`. `anatomy.json` is fetched again whenever the app regains focus, so edits made in Snuggery show up without a reload.

## How the app works

`app.js` is organised in commented sections, in this order:

| Section | What it does |
| --- | --- |
| helpers, state | `h()` element builder, `store` (localStorage with the key prefix `skeleton-viewer:`), the `S` state object |
| renderer | WebGL renderer with neutral tone mapping, a RoomEnvironment light probe, two directional lights, OrbitControls with damping |
| tweens, loop | A small tween runner; the frame renders only when something changed (render on demand) |
| loading, body switch | `load()` fetches the current body's `geometry.json` and `anatomy.json`, streams each `.bin` with progress, dequantises positions, computes normals, one mesh and material per part. `setBody()` disposes every mesh and runs `load()` again for the other folder |
| anatomy | `applyAnatomy()` indexes layers, regions and groups, computes explode vectors, builds the list and the About sheet |
| explode | Three-level offsets per part (see below), animated level changes |
| visibility and materials | `applyLook()` sets visibility, colour, selection tint, fade and X-ray opacity for every mesh in one pass |
| camera | `frame()` fits a bounding box per axis and leaves room for the bar, dock, card and panel |
| layers | Off / Faded / On per layer, Peel and Add, the layer panel |
| status, selection card | Hidden or isolated notice; the card with Focus, Isolate, X-ray and Hide |
| picking | Tap versus drag detection; raycasts only against solid, fully opaque meshes |
| structure list | Search and a layer, then group, then part tree with visibility checkboxes |
| about, theme, refresh, start | About text, dark-mode reaction, focus refresh, first-launch framing and the opening assembly animation |

Key behaviours:

- **Bodies.** `BODIES` maps `male` to `data/` and `female` to `data/female/`. The chosen body is stored as `body`. Keys that name structures (`hidden`, `isolate`, `layerModes`, `layerPrev`, `camera`) are stored per body: unprefixed for the male, `female:` for the female. A body's first visit hides the parts its data marks `defaultHidden` (the female's eight pregnancy pieces), and those are not counted in the "structures hidden" notice.
- **Layers.** Each layer is `on`, `fade` or `off` (`S.layers`, stored as `layerModes`). The skin defaults to `fade`. Peel turns off the first layer in `anatomy.json` layer order that is not off; bone and teeth are never peeled. Add turns back on the deepest layer that is off, restoring the mode it had before it was peeled (`layerPrev`). Faded layers are transparent, do not write depth and ignore taps.
- **Explode.** Each part's offset is `explode × (wR·(regionCentre − bodyCentre)·SPREAD.R + wG·(groupCentre − regionCentre)·SPREAD.G + wP·(partCentre − groupCentre)·SPREAD.P)`. The picker sets the weights: by region `[1,0,0]`, by group `[1,1,0]`, by part `[1,1,1]`. Regions can add an `explodeBias` in `anatomy.json`, used to lift the skull clear of the neck and push the ribs forward off the spine. The skin fades out between 3% and 28% explode.
- **Selection** can be a part, a group or a region. The card's chips jump between them. Double-tapping a part focuses it.
- **Persisted keys**: `body`, `explode`, `level`, `ghost` (shared); `layerModes`, `layerPrev`, `hidden`, `isolate`, `camera` (per body).

## Data formats

### geometry.json and the .bin files

```json
{ "triangles": 2986676,
  "files": [{ "url": "data/geometry.bin", "bytes": 11108088, "layer": "skeleton" }, ...],
  "parts": [{ "id": "FMA24474", "f": 0, "v": 2941, "i": 17337, "p": 0, "x": 17648, "t": 16,
              "min": [x, y, z], "max": [x, y, z] }, ...] }
```

For each part, in file `files[f]`:

- **Positions** are at byte offset `p`: `v × 3` uint16 values, quantised within the part's own `min`/`max` box.
- **Indices** are at byte offset `x`: `i` uint16 values if `t` is 16, uint32 if `t` is 32.
- **Alignment:** everything starts on a 4-byte boundary.
- **Coordinates** are in metres, Y up, +Z anterior (the body's front), +X the body's left. The feet sit at y = 0, and x and z are centred.

### anatomy.json

This is the file to edit (one per body). Geometry is matched to it by `id`.

- `body`: `{ id, name }` for the female file; the male file has none.
- `about`: `intro` (a paragraph), `gaps[]` (the "What is not included" list) and `sources[]` (paragraphs of credits) shown in the About sheet.
- `layers[]`: `id`, `name`, `short` (used in the Peel and Add buttons), `color`, `fade` (opacity when faded), `description`, and for muscles `connectiveColor`. **Array order is peel order, outside first.**
- `regions[]`: body regions such as head, neck, chest, arms and legs. Each has an `id`, `name`, `description` and an optional `explodeBias` `[x, y, z]` in metres.
- `groups[]`: `id`, `region`, `name`, optional `short` (the heading in the list), and `description`.
- `types{}`: shared `latin`, `description` and optional `color`, such as `femur`, `thoracic`, `liver` or `muscle`.
- `parts[]`: `id`, `name`, `layer`, `region`, `group`, `type`, and optionally `latin`, `note`, `description`, `color`, `side`, `label` (C5, Rib 3), `fdi` (tooth number), `tissue` (`connective`), `defaultHidden` (hidden until the user shows it), `segments` (how many source meshes were merged into this one) and `fma` (the FMA concept id of a vessel from BodyParts3D 4.0). A part's own fields override its type.

## Rebuilding the data

You only need this to change simplification budgets, layer classification or generated metadata. Hand edits to `anatomy.json` are overwritten by a rebuild, so rebuild first, then edit, or move the edits into `tools/build_full.py` (male), `tools/build_vessels.py` (male vessels) or `tools/build_female.py`.

Requirements: Node 18 or newer, Python 3.10 or newer, and about 1.6 GB of free disk space for the source meshes.

```sh
sh tools/build_all.sh        # installs tool dependencies, downloads the source once, rebuilds data/
sh tools/update_vendor.sh    # re-copies three.js and the fonts from tools/node_modules
```

| Step | Script | Output |
| --- | --- | --- |
| 1 | `fetch_stl.py` | 934 BodyParts3D 3.0 STL files into `tools/.cache/stl`, pinned to commit `f0eeb6e` of github.com/Kevin-Mattheus-Moerman/BodyParts3D |
| 2 | `build_skeleton.mjs` | `geometry.bin` and a skeleton-only `geometry.json`. Welds each mesh, converts mm Z-up to m Y-up, simplifies with meshoptimizer (keeps 45% of triangles or stops at 0.1% relative error, minimum 400), centres the body |
| 3 | `build_soft.py` | `geometry-<layer>.bin`. Classifies each mesh into a layer by name, assigns a body region by position, and decimates to the per-layer budget in `BUDGET` |
| 4 | `build_anatomy.py` | Skeleton entries in `anatomy.json`: display names, Latin terms, FDI tooth numbers, groups, notes |
| 5 | `build_full.py` | Adds soft tissue, layers, regions and types to `anatomy.json`, and merges the manifest into `geometry.json` |
| 6a | `fetch_atlas.py` | The Human-Atlas package (github.com/slorksmo/Human-Atlas, pinned commit `5bb5713`) into `tools/.cache/human-atlas`: BodyParts3D 4.0 and the female body, already simplified with meshoptimizer at 0.2% error, about 120 MB. DBCLS and humanatlas.io are not reachable from every network; this GitHub copy is |
| 6 | `build_vessels.py` | Replaces the artery and vein layers with the 4.0 vascular tree. Measures the offset between the two releases from bones present in both (the 4.0 frame sits 64 mm higher and 13 mm forward), merges the segments of each named vessel, decimates to 70%, rewrites `geometry-artery.bin`, `geometry-vein.bin`, `geometry.json` and `anatomy.json` |
| 7 | `build_female.py` | `data/female/`: classifies every source mesh into layers, regions and groups by system and name, merges enumerated pieces (renal pyramid a–k), decimates to the per-layer budget in its `BUDGET`, and writes the metadata, including the About text and the borrowed and donor notes |

`tools/source/stl_names.json` lists every source mesh with its English name, and `skeleton_ids.json` lists the 270 skeletal ones. `tools/atlaslib.py` reads the Human-Atlas chunk format and packs this app's. The pipeline is deterministic: a clean rebuild reproduces every file in `data/` byte for byte.

You can override paths with environment variables: `BP3D_STL_DIR` (source cache), `ATLAS_DIR` (Human-Atlas cache), `OUT_DATA` (output folder), `WORK_DIR` (intermediate files).

**Performance.** The main levers are `BUDGET` in `build_soft.py` (muscle 950,000 triangles, skin 160,000), the 0.7 ratio in `build_vessels.py` and `BUDGET` in `build_female.py`. The male body is about 1,550 draw calls and the female 1,135; the app renders only when something changes. The skeleton's ratio and error are at the top of `build_skeleton.mjs`. The app has been tested in desktop Chromium, including a 390 × 844 viewport, but not yet on a physical iPhone.

## Known gaps in the source data

Male:

- **Nerves:** the brain and optic nerves only. There is no spinal cord and no peripheral nerves, which is why that layer is called "Brain".
- **Vessels:** BodyParts3D 4.0 stops at the fingers and toes; in the head it models the arteries of the brain but no veins and no vessels of the face or scalp.
- **Bones:** the coccyx, the six ear ossicles and the third molars are missing.
- **Not modelled:** the lymphatic system. Bones are outer surfaces only.

Female:

- **Muscle:** only the hip and leg muscles (from the Visible Human Female), the eye muscles and the quadriceps tendon.
- **Bone:** the skull, ribs, shoulders, arms, hands and feet are borrowed male bones; only the spine, sternum, pelvis and leg bones are the body's own. The source has six lumbar vertebrae.
- **Vessels:** the aorta and the vessels of the heart, lungs, abdomen, pelvis and eyes; none in the limbs, neck or brain.
- **Organs:** no stomach, oesophagus, thyroid, adrenals or ears; the lymphatic system is the spleen, thymus and one reference lymph node. Eight structures of pregnancy are included and hidden by default.

The About sheet in the app says the same for whichever body is showing (`about` in each `anatomy.json`).

## Licences

- **Male geometry** in `data/*.bin`, derived from BodyParts3D, © The Database Center for Life Science (DBCLS): release 3.0 (CC BY-SA 2.1 Japan; DBCLS now publishes BodyParts3D under CC BY 4.0) for everything but the vessels, release 4.0 (CC BY 4.0) for the arteries and veins. The derived geometry must keep the attribution in `CREDITS.txt` and is shared under the same licences. Cite Mitsuhashi N. et al., *BodyParts3D: 3D structure database for anatomical concepts*, Nucleic Acids Research 37 (2009), doi:10.1093/nar/gkn613.
- **Female geometry** in `data/female/*.bin`: the HuBMAP Human Reference Atlas 3D Reference Organ Set for Female (Browne and Schlehlein), the Visible Human Female lower-limb muscles (Andreassen et al. 2023) and BodyParts3D 4.0 bones, all CC BY 4.0, as assembled by the Human-Atlas package (github.com/slorksmo/Human-Atlas). `CREDITS.txt` has the full citations.
- **three.js** r186 in `vendor/` is MIT licensed; see `vendor/three-LICENSE.txt`.
- **Fonts:** Atkinson Hyperlegible and Newsreader, SIL Open Font Licence 1.1.
- **App code** (`index.html`, `app.js`, `styles.css`, `tools/`) has no licence file yet. Add whichever licence the repo uses.

For learning and reference. Not for diagnosis or clinical use.
