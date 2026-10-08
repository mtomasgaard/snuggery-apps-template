# Anatomy

A 3D human body you can peel layer by layer, pull apart, search and read. It runs as a Snuggery miniapp: fully offline, no build step, plain HTML, CSS and ES modules.

1 752 separate structures of an adult male reference body in nine layers: skin and hair, muscles and tendons, organs, arteries, veins, brain and nerves, cartilage, bone and teeth. Skin, muscles, organs, brain, cartilage and skeleton come from BodyParts3D 3.0. From BodyParts3D 4.0 come the 662 arteries and veins, which reach the fingers, toes and the arteries of the brain, and 219 finer structures: the parts of the eye and the tear glands, the larynx, pharynx and soft palate, the tongue and salivary glands, the nerves of the orbit, the heart's walls, chambers and valve cusps, the segmental bronchial tree and the bile ducts. About 3.4 million triangles, 32 MB of geometry.

Beside the body stands its signature, **the Levels** (`ART.md` section 1): the model's own spine, 24 labeled vertebrae and the sacrum, drawn as a rule of 25 levels at the plate's left edge, where the camera sees them, with the selected structure's span inked beside it and said in words (`T12 to L3`). Read off this body, the levels agree with the textbook: the kidneys T12 to L3 and T11 to L2, the celiac trunk at T12, the abdominal aorta T10 to L4, the hyoid C3 to C4, the cricoid C5 to C6.

## Run it

```sh
python3 -m http.server 8000     # from this folder
```

Open http://localhost:8000. Opening `index.html` directly from disk does not work: browsers block `fetch()` of the data files on `file://`, and the app says so in a sentence on the plate.

To import into Snuggery, zip this folder or run `python3 tools/package_snuggery.py`, which writes `dist/anatomy.zip` without the tools and docs.

## Folder map

```
index.html          The page: header, plate, caption band, Layers sheet, dissection band, Find, About
app.js              The app (ES module, no dependencies beyond vendor/ and js/)
js/units.js         Every number and unit the app writes (SI: U+202F groups and units, the true minus)
js/levels.js        The Levels' math: the vertebrae from the data, their bands, the level of a height,
                    the height-to-column map, the caption's sentences (pure; tested by tools/test_decode.mjs)
styles.css          The house system's tokens and chrome, light and dark, phone first, a phone on its side
miniapp.json        Snuggery display name, entry point and version
CREDITS.txt         Attribution and licenses (required by the geometry license)
ART.md              How the app looks, moves and speaks: the house system, the Levels, the palette
data/
  anatomy.json      Editable: layers, regions, groups, types, About text, and every part's name and text
  geometry.json     Manifest: which binary file holds each part, offsets, counts, bounds
  geometry.bin      Skeleton geometry (bone, cartilage, teeth), 11.1 MB
  geometry-*.bin    Soft tissue, one file per layer (skin, muscle, organ, artery, vein, nerve, cartilage)
vendor/             three.js r186 (three.module.js, three.core.js), OrbitControls, RoomEnvironment, MIT license
fonts/              Ysabeau Office (the template's house face, a subset) and its license, OFL.txt
tools/              The data pipeline, the palette script, and the checks. Not needed to run the app.
```

## Runtime rules

These come from the Snuggery runtime and must keep holding:

- No network access of any kind. Everything is bundled; there are no CDNs, web fonts or API calls. The only URL in the code is inside a comment in `vendor/RoomEnvironment.js`.
- Relative paths only. The three.js addons import `./three.module.js` directly, because there is no import map.
- No build step and no server. What is in the folder is what runs.
- No service workers or cross-origin iframes, no JavaScript bridge to the phone.
- State lives in `localStorage` only, every access in `try`/`catch`.
- Data files are re-read with `cache: 'no-store'`. `anatomy.json` is fetched again whenever the app regains focus, so edits made in Snuggery show up without a reload.

## How the app works

`app.js` is organized in commented sections, in this order:

| Section | What it does |
| --- | --- |
| helpers, state | `h()` element builder, `store` (localStorage with the key prefix `skeleton-viewer:`), the house's `--draw` curve, the `S` state object |
| notices, renderer | A problem with the data is a sentence on the plate; WebGL renderer with neutral tone mapping, a RoomEnvironment light probe, two directional lights, OrbitControls with damping |
| the loop, tweens | The loop asks for a frame only while something moves (a tween, the controls' damping, a change); otherwise it rests. Reduce Motion is read live: every tween becomes a cut |
| loading | Fetches `geometry.json` and `anatomy.json`, streams each `.bin` with the count in the stamp, dequantizes positions, computes normals, one mesh and material per part |
| anatomy | `applyAnatomy()` indexes layers, regions and groups, finds the vertebrae for the Levels, computes explode vectors, builds the depth words, the Layers sheet, Find and About |
| explode | Three-level offsets per part (see below), animated level changes |
| selection helpers, look | `applyLook()` sets visibility, color, fade and X-ray opacity for every mesh in one pass; a selection of up to 60 parts keeps its colors and gets the outline, a larger one takes the data's selection tint at 0.3; under X-ray the selection is drawn after the see-through layers, over them, in its own colors |
| outline | The house's selection mark: two back-face hulls per selected part (up to 60), pushed out by 3 and 1.5 screen pixels, the plate's halo then `--ink`; the selected parts write 1 into the stencil buffer and the hulls draw only where it is not 1, so the outline never draws inside the silhouette |
| camera | `frame()` fits a box into the plate's room (the plate less the Levels, the keys and, when the selection itself is framed, the card, each with its safe-area inset, read from a probe element) by its projected corners; a flight to a selection that the layers in front would hide turns X-ray on for that selection (rays from the destination to eight of its vertices); the views, the zoom keys; while the camera stays at a fit, a new plate size or a settled explode fits the body again |
| layers | Off / Faded / On per layer, the depth words, the remove and bring-back keys, the Layers sheet |
| status, card | Hidden or isolated, in words; the card with its place line, Levels row, Zoom to it, Isolate, X-ray and Hide, placed clear of the point a tap touched (never under the finger, and the opening tap's click never presses a key on it) and of the selection where it fits |
| picking | Tap versus drag detection; raycasts only against solid, fully opaque meshes; a touch ends a camera flight at its end |
| Find and About | Full-height dialogs: search and a layer, then group, then part tree with named visibility boxes; About from the `About` key at the header's right, its first *Sources and credits* line the credit line, `BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 JP and CC BY 4.0` |
| the Levels, caption | The column drawn on its own canvas after each render, waiting for the face; the caption line's sentences |
| focus mode, theme, refresh, start | Hide the controls and Show the controls, remembered; dark-mode reaction, focus refresh, hidden page; first-launch framing |

Key behaviors:

- **Default-hidden parts.** Parts the data marks `defaultHidden` (the four heart cavities) start hidden the first time a device sees them, even on a device that already has a saved `hidden` list; `defaultsApplied` records which ones have been applied, so a person who shows them again keeps them. They are not counted in the "structures hidden" notice.
- **Layers.** Each layer is `on`, `fade` or `off` (`S.layers`, stored as `layerModes`). The skin defaults to `fade`. The remove key turns off the first layer in `anatomy.json` layer order that is not off; bone and teeth are never removed. The bring-back key turns back on the deepest layer that is off, restoring the mode it had before (`layerPrev`). A depth word shows the body from that layer in: every layer outside it goes off, remembered the same way, and every layer inside it that is off comes back. Faded layers are transparent, do not write depth and ignore taps.
- **Explode.** Each part's offset is `explode × (wR·(regionCenter − bodyCenter)·SPREAD.R + wG·(groupCenter − regionCenter)·SPREAD.G + wP·(partCenter − groupCenter)·SPREAD.P)`. The explode words set the weights, and only that (Explode and the track do the moving): by region `[1,0,0]`, by group `[1,1,0]`, by part `[1,1,1]`. Regions can add an `explodeBias` in `anatomy.json`, used to lift the skull clear of the neck and push the ribs forward off the spine. The skin fades out between 3 % and 28 % explode. There is no opening animation: the body appears at the explode amount it was left at.
- **The Levels** (`js/levels.js`). A vertebra is a part whose `type` is `atlas`, `axis`, `cervical`, `thoracic`, `lumbar` or `sacrum` and which has a `label`; its band runs between the midpoints to its neighbors' box centers in `geometry.json`, C1's band to C1's box top and the sacrum's to its box bottom (70.0 cm of spine). The level of a height is the label of the band that holds it. A selection's span is its box's top and bottom read that way; the bar beside the column is placed by the same piecewise-linear map from a height to the vertebrae's projected centers. The column is drawn only when the projected spine is at least 120 px tall (80 px on a plate under 300 px, a phone on its side) and the camera looks no steeper than 64° from level; otherwise the caption says which of the two holds: turn the body upright, or come closer. Pulled apart by group, the thoracic vertebrae can rise past C7; the column keeps the spine's order and the block between them flattens.
- **Selection** can be a part, a group or a region. The card's place line selects the group or the region. Double-tapping a part flies to it. When Find or `Zoom to it` flies to a structure that the layers in front would hide, X-ray turns on and the live region says so; X-ray turned on that way goes off with the selection, while X-ray pressed by hand is kept. Under X-ray the selection is drawn over the see-through layers, so it keeps its own colors.
- **Focus mode.** `Hide the controls` takes away the header, the keys, the Layers sheet and the explode row; the plate, the Levels, the `About` key (moved into the caption band), the caption, the status plate and the one control the view keeps, the remove and bring-back keys, stay. `Show the controls` or Escape brings them back.
- **Persisted keys** (all under `skeleton-viewer:`): `explode`, `level`, `layerModes`, `layerPrev`, `hidden`, `isolate`, `ghost`, `camera`, `defaultsApplied`, and `focus` (`'1'` or `'0'`).

## Data formats

### geometry.json and the .bin files

```json
{ "triangles": 3448950,
  "files": [{ "url": "data/geometry.bin", "bytes": 11108088, "layer": "skeleton" }, ...],
  "parts": [{ "id": "FMA24474", "f": 0, "v": 2941, "i": 17337, "p": 0, "x": 17648, "t": 16,
              "min": [x, y, z], "max": [x, y, z] }, ...] }
```

For each part, in file `files[f]`:

- **Positions** are at byte offset `p`: `v × 3` uint16 values, quantized within the part's own `min`/`max` box.
- **Indices** are at byte offset `x`: `i` uint16 values if `t` is 16, uint32 if `t` is 32.
- **Alignment:** everything starts on a 4-byte boundary.
- **Coordinates** are in meters, Y up, +Z anterior (the body's front), +X the body's left. The feet sit at y = 0, and x and z are centered.

`tools/test_decode.mjs` decodes every vertebra and twenty named structures from the binaries with code of its own and checks each extent against its box.

### anatomy.json

This is the file to edit. Geometry is matched to it by `id`.

- `about`: `intro` (a paragraph), `gaps[]` (the "What is not included" list) and `sources[]` (paragraphs of credits). About prints `intro`, the first two `sources` and the `gaps` verbatim; `sources[2]` is the app's rendering and type credit, which About writes itself in the same words (`index.html`), so it is printed once.
- `layers[]`: `id`, `name`, `short` (the depth words and the remove and bring-back keys), `color`, `fade` (opacity when faded), `description`, and for muscles `connectiveColor`. **Array order is peel order, outside first.**
- `regions[]`: body regions such as head, neck, chest, arms and legs. Each has an `id`, `name`, `description` and an optional `explodeBias` `[x, y, z]` in meters.
- `groups[]`: `id`, `region`, `name`, optional `short` (the heading in the list), and `description`.
- `types{}`: shared `latin`, `description` and optional `color`, such as `femur`, `thoracic`, `liver` or `muscle`.
- `parts[]`: `id`, `name`, `layer`, `region`, `group`, `type`, and optionally `latin`, `note`, `description`, `color`, `side`, `label` (C5, Rib 3), `fdi` (tooth number), `tissue` (`connective`), `defaultHidden` (hidden until the person shows it), `segments` (how many source meshes were merged into this one) and `fma` (the FMA concept id of a structure from BodyParts3D 4.0). A part's own fields override its type.
- `colors`: `selected` and `selectedDark`, the selection's tint per theme.

**The data's own text** is US English. The prose of the four scripts that write it (`build_anatomy.py`, `build_full.py`, `build_vessels.py`, `build_extras.py`) was swept, and `anatomy.json` rebuilt from them, with every field but those strings unchanged; the second source paragraph's count of shared structures is now read from `tools/source/bodymap_pairs.json` (651), and the third is the app's own rendering and type credit. `tools/check.mjs` fails on a British spelling in the data's text (the Latin names and the source's own names aside). The record is in `tools/DECISIONS.md`.

## Rebuilding the data

You only need this to change simplification budgets, layer classification or generated metadata. Hand edits to `anatomy.json` are overwritten by a rebuild, so rebuild first, then edit, or move the edits into `tools/build_full.py`, `tools/build_vessels.py` (vessels) or `tools/build_extras.py` (the other 4.0 structures and the About text).

Requirements: Node 18 or newer, Python 3.10 or newer, and about 1.6 GB of free disk space for the source meshes.

```sh
sh tools/build_all.sh        # installs tool dependencies, downloads the source once, rebuilds data/
sh tools/update_vendor.sh    # re-copies three.js from tools/node_modules
```

| Step | Script | Output |
| --- | --- | --- |
| 1 | `fetch_stl.py` | 934 BodyParts3D 3.0 STL files into `tools/.cache/stl`, pinned to commit `f0eeb6e` of github.com/Kevin-Mattheus-Moerman/BodyParts3D |
| 2 | `build_skeleton.mjs` | `geometry.bin` and a skeleton-only `geometry.json`. Welds each mesh, converts mm Z-up to m Y-up, simplifies with meshoptimizer (keeps 45 % of triangles or stops at 0.1 % relative error, minimum 400), centers the body |
| 3 | `build_soft.py` | `geometry-<layer>.bin`. Classifies each mesh into a layer by name, assigns a body region by position, and decimates to the per-layer budget in `BUDGET` |
| 4 | `build_anatomy.py` | Skeleton entries in `anatomy.json`: display names, Latin terms, FDI tooth numbers, groups, notes |
| 5 | `build_full.py` | Adds soft tissue, layers, regions and types to `anatomy.json`, and merges the manifest into `geometry.json` |
| 6a | `fetch_atlas.py` | The Human-Atlas package (github.com/slorksmo/Human-Atlas, pinned commit `5bb5713`) into `tools/.cache/human-atlas`: BodyParts3D 4.0, already simplified with meshoptimizer at 0.2 % error, about 60 MB. DBCLS is not reachable from every network; this GitHub copy is |
| 6 | `build_vessels.py` | Replaces the artery and vein layers with the 4.0 vascular tree. Places each vertex with `atlaslib.BodyMap` (below), merges the segments of each named vessel, decimates to 70 %, rewrites `geometry-artery.bin`, `geometry-vein.bin`, `geometry.json` and `anatomy.json` |
| 7 | `build_extras.py` | Adds 219 finer 4.0 structures (eyes, larynx, pharynx, tongue, orbital nerves, heart, bronchial tree, bile ducts), placed the same way; removes the 3.0 structures they subdivide (eyeballs, heart wall, three valves, bronchial tree, nasal cartilages); moves ten brain structures that step 3 filed as muscle; repacks the layer files and writes the About text. It leaves out the 4.0 liver, colon and small intestine, which 4.0 reshaped |

`tools/source/stl_names.json` lists every source mesh with its English name, and `skeleton_ids.json` lists the 270 skeletal ones. `tools/atlaslib.py` reads the Human-Atlas chunk format and packs this app's.

**Placing 4.0 on 3.0.** The two releases share a frame only roughly. Release 4.0 moved the head 10 to 16 mm back and the heart about 4 mm, and remodeled the legs, whose bones sit up to 56 mm lower below the knee. `BodyMap` measures this from the 651 structures present in both releases, as one mesh or as a 3.0 structure that 4.0 splits into parts, from the per-axis scale and offset between their boxes. It then moves every 4.0 vertex by a Gaussian-weighted blend of the nearest measurements. Leaving each structure out in turn, it predicts that structure's position to a median 2.7 mm, against 8.3 mm for a single offset. The measurements live in `tools/source/bodymap_pairs.json`, taken from the untouched 3.0 body; `build_vessels.py` rewrites the file only when it runs straight after `build_full.py`, so reruns place meshes identically. A clean rebuild is not byte-identical everywhere. On the build Mac (2026-10-02: Python 3.12.14, numpy 2.5.3, fast-simplification 0.2.0, Node 26 with meshoptimizer 1.2.0) it reproduces `geometry.bin` byte for byte, but fast-simplification decimates a few soft-tissue meshes differently from the machine that built the committed data (3 448 956 triangles against 3 448 950), so every `geometry-*.bin`, `geometry.json` and the measurement in `bodymap_pairs.json` differ. `anatomy.json` does not depend on those figures: `build_all.sh` followed by a second run of `build_vessels.py` and `build_extras.py`, which is how the committed file was made (the second run puts the finer structures' groups before the vessels'), reproduces it byte for byte. A change to text therefore rebuilds `anatomy.json` alone and keeps the committed geometry.

You can override paths with environment variables: `BP3D_STL_DIR` (source cache), `ATLAS_DIR` (Human-Atlas cache), `OUT_DATA` (output folder), `WORK_DIR` (intermediate files).

**Performance.** The main levers are `BUDGET` in `build_soft.py` (muscle 950 000 triangles, skin 160 000), and the 0.7 and 0.6 ratios in `build_vessels.py` and `build_extras.py`. The body is about 1 750 draw calls; the app renders only when something changes and its loop rests otherwise. The skeleton's ratio and error are at the top of `build_skeleton.mjs`. The app has been driven in headless Chromium at phone sizes (`tools/shoot.mjs`), which says nothing about a phone's frame rate; the phone checks are listed in `tools/DECISIONS.md`.

## The checks

From this folder, each prints `ok` or `FAIL` per item and ends `all checks pass`:

```sh
node tools/check.mjs                 # the house's static rules, the data's and vendor/'s pins, the budgets, the ZIP
node tools/test_decode.mjs           # the binaries decoded, the Levels against formulas of its own, js/units.js
PLAYWRIGHT_MODULE=… node tools/shoot.mjs   # the app driven in headless Chromium, light and dark
python3 anatomy/tools/art/palette.py       # from Template/: every color and contrast in ART.md
```

## Known gaps in the source data

- **Nerves:** the brain, the optic nerves and the nerves of the orbit. There is no spinal cord and no peripheral nerve of the body.
- **Organs:** the liver, colon and small intestine are 3.0's single structures. Release 4.0 subdivides them but also reshaped them, so its parts would not fit.
- **Vessels:** BodyParts3D 4.0 stops at the fingers and toes; in the head it models the arteries of the brain but no veins and no vessels of the face or scalp.
- **Bones:** the coccyx, the six ear ossicles and the third molars are missing.
- **Not modeled:** the lymphatic system and female anatomy. Bones are outer surfaces only.

The About sheet in the app says the same (`about` in `anatomy.json`).

## Licenses

- **Geometry** in `data/*.bin`, derived from BodyParts3D, © The Database Center for Life Science (DBCLS): release 3.0 (CC BY-SA 2.1 Japan; DBCLS now publishes BodyParts3D under CC BY 4.0) for the skin, muscles, organs, brain and skeleton, release 4.0 (CC BY 4.0) for the arteries and veins and the finer structures listed above. The derived geometry must keep the attribution in `CREDITS.txt` and is shared under the same licenses. Cite Mitsuhashi N. et al., *BodyParts3D: 3D structure database for anatomical concepts*, Nucleic Acids Research 37 (2009), doi:10.1093/nar/gkn613.
- **three.js** r186 in `vendor/` is MIT licensed; see `vendor/three-LICENSE.txt`.
- **Type:** Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.
- **App code** (`index.html`, `app.js`, `js/`, `styles.css`, `tools/`) has no license file yet. Add whichever license the repo uses.

For learning and reference. Not for diagnosis or clinical use.
