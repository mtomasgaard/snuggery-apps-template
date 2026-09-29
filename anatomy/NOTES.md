# Anatomy

A 3D human body you can peel layer by layer, explode, search and inspect. It runs as a Snuggery miniapp: fully offline, no build step, plain HTML, CSS and ES modules.

1,752 separate structures of an adult male reference body in nine layers: skin and hair, muscles and tendons, organs, arteries, veins, brain and nerves, cartilage, bone and teeth. Skin, muscles, organs, brain, cartilage and skeleton come from BodyParts3D 3.0. From BodyParts3D 4.0 come the 662 arteries and veins, which reach the fingers, toes and the arteries of the brain, and 219 finer structures: the parts of the eye and the tear glands, the larynx, pharynx and soft palate, the tongue and salivary glands, the nerves of the orbit, the heart's walls, chambers and valve cusps, the segmental bronchial tree and the bile ducts. About 3.4 million triangles, 32 MB of geometry.

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
data/
  anatomy.json      Editable: layers, regions, groups, types, About text, and every part's name and text
  geometry.json     Manifest: which binary file holds each part, offsets, counts, bounds
  geometry.bin      Skeleton geometry (bone, cartilage, teeth), 11.1 MB
  geometry-*.bin    Soft tissue, one file per layer (skin, muscle, organ, artery, vein, nerve, cartilage)
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
| loading | Fetches `geometry.json` and `anatomy.json`, streams each `.bin` with progress, dequantises positions, computes normals, one mesh and material per part |
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

- **Default-hidden parts.** Parts the data marks `defaultHidden` (the four heart cavities) start hidden the first time a device sees them, even on a device that already has a saved `hidden` list; `defaultsApplied` records which ones have been applied, so a user who shows them again keeps them. They are not counted in the "structures hidden" notice.
- **Layers.** Each layer is `on`, `fade` or `off` (`S.layers`, stored as `layerModes`). The skin defaults to `fade`. Peel turns off the first layer in `anatomy.json` layer order that is not off; bone and teeth are never peeled. Add turns back on the deepest layer that is off, restoring the mode it had before it was peeled (`layerPrev`). Faded layers are transparent, do not write depth and ignore taps.
- **Explode.** Each part's offset is `explode × (wR·(regionCentre − bodyCentre)·SPREAD.R + wG·(groupCentre − regionCentre)·SPREAD.G + wP·(partCentre − groupCentre)·SPREAD.P)`. The picker sets the weights: by region `[1,0,0]`, by group `[1,1,0]`, by part `[1,1,1]`. Regions can add an `explodeBias` in `anatomy.json`, used to lift the skull clear of the neck and push the ribs forward off the spine. The skin fades out between 3% and 28% explode.
- **Selection** can be a part, a group or a region. The card's chips jump between them. Double-tapping a part focuses it.
- **Persisted keys**: `explode`, `level`, `layerModes`, `layerPrev`, `hidden`, `isolate`, `ghost`, `camera`, `defaultsApplied`.

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

This is the file to edit. Geometry is matched to it by `id`.

- `about`: `intro` (a paragraph), `gaps[]` (the "What is not included" list) and `sources[]` (paragraphs of credits) shown in the About sheet.
- `layers[]`: `id`, `name`, `short` (used in the Peel and Add buttons), `color`, `fade` (opacity when faded), `description`, and for muscles `connectiveColor`. **Array order is peel order, outside first.**
- `regions[]`: body regions such as head, neck, chest, arms and legs. Each has an `id`, `name`, `description` and an optional `explodeBias` `[x, y, z]` in metres.
- `groups[]`: `id`, `region`, `name`, optional `short` (the heading in the list), and `description`.
- `types{}`: shared `latin`, `description` and optional `color`, such as `femur`, `thoracic`, `liver` or `muscle`.
- `parts[]`: `id`, `name`, `layer`, `region`, `group`, `type`, and optionally `latin`, `note`, `description`, `color`, `side`, `label` (C5, Rib 3), `fdi` (tooth number), `tissue` (`connective`), `defaultHidden` (hidden until the user shows it), `segments` (how many source meshes were merged into this one) and `fma` (the FMA concept id of a structure from BodyParts3D 4.0). A part's own fields override its type.

## Rebuilding the data

You only need this to change simplification budgets, layer classification or generated metadata. Hand edits to `anatomy.json` are overwritten by a rebuild, so rebuild first, then edit, or move the edits into `tools/build_full.py`, `tools/build_vessels.py` (vessels) or `tools/build_extras.py` (the other 4.0 structures and the About text).

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
| 6a | `fetch_atlas.py` | The Human-Atlas package (github.com/slorksmo/Human-Atlas, pinned commit `5bb5713`) into `tools/.cache/human-atlas`: BodyParts3D 4.0, already simplified with meshoptimizer at 0.2% error, about 60 MB. DBCLS is not reachable from every network; this GitHub copy is |
| 6 | `build_vessels.py` | Replaces the artery and vein layers with the 4.0 vascular tree. Places each vertex with `atlaslib.BodyMap` (below), merges the segments of each named vessel, decimates to 70%, rewrites `geometry-artery.bin`, `geometry-vein.bin`, `geometry.json` and `anatomy.json` |
| 7 | `build_extras.py` | Adds 219 finer 4.0 structures (eyes, larynx, pharynx, tongue, orbital nerves, heart, bronchial tree, bile ducts), placed the same way; removes the 3.0 structures they subdivide (eyeballs, heart wall, three valves, bronchial tree, nasal cartilages); moves ten brain structures that step 3 filed as muscle; repacks the layer files and writes the About text. It leaves out the 4.0 liver, colon and small intestine, which 4.0 reshaped |

`tools/source/stl_names.json` lists every source mesh with its English name, and `skeleton_ids.json` lists the 270 skeletal ones. `tools/atlaslib.py` reads the Human-Atlas chunk format and packs this app's.

**Placing 4.0 on 3.0.** The two releases share a frame only roughly. Release 4.0 moved the head 10–16 mm back and the heart about 4 mm, and remodelled the legs, whose bones sit up to 56 mm lower below the knee. `BodyMap` measures this from the 651 structures present in both releases, as one mesh or as a 3.0 structure that 4.0 splits into parts, from the per-axis scale and offset between their boxes. It then moves every 4.0 vertex by a Gaussian-weighted blend of the nearest measurements. Leaving each structure out in turn, it predicts that structure's position to a median 2.7 mm, against 8.3 mm for a single offset. The measurements live in `tools/source/bodymap_pairs.json`, taken from the untouched 3.0 body; `build_vessels.py` rewrites the file only when it runs straight after `build_full.py`, so reruns place meshes identically. The pipeline is deterministic: a clean rebuild reproduces every file in `data/` byte for byte.

You can override paths with environment variables: `BP3D_STL_DIR` (source cache), `ATLAS_DIR` (Human-Atlas cache), `OUT_DATA` (output folder), `WORK_DIR` (intermediate files).

**Performance.** The main levers are `BUDGET` in `build_soft.py` (muscle 950,000 triangles, skin 160,000), and the 0.7 and 0.6 ratios in `build_vessels.py` and `build_extras.py`. The body is about 1,750 draw calls; the app renders only when something changes. The skeleton's ratio and error are at the top of `build_skeleton.mjs`. The app has been tested in desktop Chromium, including a 390 × 844 viewport, but not yet on a physical iPhone.

## Known gaps in the source data

- **Nerves:** the brain, the optic nerves and the nerves of the orbit. There is no spinal cord and no peripheral nerve of the body.
- **Organs:** the liver, colon and small intestine are 3.0's single structures. Release 4.0 subdivides them but also reshaped them, so its parts would not fit.
- **Vessels:** BodyParts3D 4.0 stops at the fingers and toes; in the head it models the arteries of the brain but no veins and no vessels of the face or scalp.
- **Bones:** the coccyx, the six ear ossicles and the third molars are missing.
- **Not modelled:** the lymphatic system and female anatomy. Bones are outer surfaces only.

The About sheet in the app says the same (`about` in `anatomy.json`).

## Licences

- **Geometry** in `data/*.bin`, derived from BodyParts3D, © The Database Center for Life Science (DBCLS): release 3.0 (CC BY-SA 2.1 Japan; DBCLS now publishes BodyParts3D under CC BY 4.0) for the skin, muscles, organs, brain and skeleton, release 4.0 (CC BY 4.0) for the arteries and veins and the finer structures listed above. The derived geometry must keep the attribution in `CREDITS.txt` and is shared under the same licences. Cite Mitsuhashi N. et al., *BodyParts3D: 3D structure database for anatomical concepts*, Nucleic Acids Research 37 (2009), doi:10.1093/nar/gkn613.
- **three.js** r186 in `vendor/` is MIT licensed; see `vendor/three-LICENSE.txt`.
- **Fonts:** Atkinson Hyperlegible and Newsreader, SIL Open Font Licence 1.1.
- **App code** (`index.html`, `app.js`, `styles.css`, `tools/`) has no licence file yet. Add whichever licence the repo uses.

For learning and reference. Not for diagnosis or clinical use.
