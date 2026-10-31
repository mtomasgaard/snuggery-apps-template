# Hello Map: the look

Hello Map takes the house system (the template's `HOUSE.md`): Ysabeau Office, the gray chrome, the
key column, the caption band, the readout card, About, focus mode, SI and the tell list. This file
says what the app adds: its signature, its palette inside the tonal budget, and how the chrome maps
onto a map with no time.

## 1. The kind, and the chrome it carries

A map without time (HOUSE.md 4.0). The header is two lines, the name over the status line, with the
units key and the `About` key at its right; it has no row of words, because the app has no views and
its two layers are switched on the plate. The plate is the map, edge to edge, with the key column at
its right (`Zoom in`, `Zoom out`, `Show the whole country`; `Hide the controls` alone in the last
plate). The caption band holds the instrument line (the scale bar and the latitude it is true at) and
the caption line (the collar's step). There is no player. The readout card holds the tapped point.

- **The layer switch** (`Map`, `Imagery`) is a two-key plate at the plate's foot, the chosen word in
  `--ink` at 620 over the 12 % on-plate, like Norway in 3D's view switch. It is the one control the
  view needs, so it stays in focus mode.
- **The status line** says what the pictures are doing (`Loading 6 tiles…`, `Every tile in view has
  loaded.`, `The map could not be loaded.`), one line at 390 px in every state, and names no source
  (HOUSE.md 4.15). It opens About.
- **The units key** cycles the scale between kilometers and miles, SI first; coordinates stay in
  degrees.
- **The ground** is gray (`#e8eef0`), as every map app's (HOUSE.md 12). The plate under the map while
  it loads, or when it cannot, is `#dfe5e3` in both themes: the map keeps the site's daylight colors
  in both themes, and its marks keep one style, as Norway in 3D's do.
- **Focus mode**: the header and the key column leave, hidden and inert; the map with its collar,
  the layer switch, the caption band and the `About` key (moved into the band) stay; the ghost key
  `Show the controls` takes the top-right corner. Remembered as `hellomap:focus`.

## 2. The signature: the quadrangle collar

A U.S. Geological Survey topographic quadrangle is printed inside a frame whose edges are ticked at
whole steps of latitude and longitude, with the degrees and minutes written at the ticks, and small
crosses where the grid would meet inside the map. The 7.5-minute quadrangle, the 1:24 000 sheet
American hikers know, covers 7.5′ each way and marks a cross every 2.5′. Hello Map draws that
instrument over the live map, for the view on screen.

**How it was found** (HOUSE.md 5.1):

1. *What a specialist calls the picture*: a quadrangle, and its collar is what makes a printed map a
   measured one.
2. *What a person does most*: pans and zooms, and asks where a place is. The collar answers the
   second question without a tap, and its step changes as the first changes.
3. *What no other app has*: Global Weather and Warming World lay a faint graticule under their data
   as background; no app ticks its edges, writes its degrees or marks a quadrangle's crosses. Global
   Weather's signature is the wind's streaks, Norway in 3D's the skyline on its track, Besseggen's
   the Burn on its time track; the collar copies none of them.
4. *The house's means*: one ink, one face, no hue, no motion of its own.

**The seven tests** (HOUSE.md 5.2):

1. *Delete the data and it disappears*: the collar is the view's own geography. With no view (a
   plate of zero size) nothing is drawn; it does not need the pictures, so it stays when the map
   cannot load, which is the point of an offline face that still works.
2. *Every property that varies is measured*: a tick's position is its latitude or longitude through
   Web Mercator; the step is the smallest of 1″, 2″, 5″, 10″, 15″, 20″, 30″, 1′, 2′, 2.5′, 5′, 7.5′,
   15′, 30′, 1°, 2°, 5°, 10° and 20° whose ticks stand at least 120 px apart along a parallel, and
   nothing else changes.
3. *It is captioned*: the caption line, `Ticks and crosses every 2′ of latitude and longitude.`,
   with the step it shows.
4. *It reads*: dark ink on a pale halo, measured over both layers' pictures (section 3).
5. *It survives Reduce Motion*: it has no motion; zooms by a key or a double-tap become cuts.
6. *About says what it shows and what it does not*: the ticks and crosses are true positions
   everywhere; the scale bar is true only along the latitude it names, because Web Mercator's scale
   grows toward the poles.
7. *It is the only bold element*: the chrome is gray, the map is the site's, and the one ink line on
   the map is the collar's (the marker uses the same ink, and only at a tapped point).

**What it draws**: ticks 8 px long into the plate on all four edges; labels at 11.5 px and 560 in
the house face, latitude along the left edge and longitude along the foot (the right and top edges
carry the keys and the ghost key, so they carry ticks only); a cross with 5 px arms at every
intersection at least 18 px inside the plate. Strokes are 1.4 px over a 3.4 px halo, labels over a
3 px halo. A label that would collide with another is left out, never squeezed, and a cross that
would touch a label is left out.

## 3. The palette (`tools/art/palette.py`, run from the template's root)

The chrome tokens are the house's, exactly (HOUSE.md 3.1). The map's colors are the site's, not this
app's to fit into a band, so the tonal budget is met by the halo: the collar's ink stands at the dark
end of the range, and its halo lifts whatever lies under it to the light end.

| | Both themes |
| --- | --- |
| Ground | the site's pictures (their darkest, 1st, 50th and 99th percentile and lightest pixels, read with Chromium on 2026-10-19 from Yosemite Valley at level 13, the Grand Canyon at 12, Denver at 11 and 14 and the country at 4 and 5, both layers), white, and the empty plate `#dfe5e3` |
| Signature | ink `#0f1c23` (OKLCh 0.218, 0.0228, 233) on a halo of `#f6f9fa` at 0.88 |
| Worst case | ink on its halo, 12.46:1, over the Grand Canyon imagery's black pixel (target 4.5, the collar's labels being text) |
| Ghost key at rest | stroke on its halo at 72 % opacity, worst 3.95:1 (target 3) |
| The collar on the empty plate | 13.59:1 |

`tools/check.mjs` pins `--collar`, `--collar-halo`, `--plate` and the ghost key's rest to the
script's `--json`, and `tools/shoot.mjs` measures the collar's drawn pixels over the rendered map in
both themes and both layers.

## 4. The tell list (HOUSE.md 9)

| Tell | Hello Map |
| --- | --- |
| 1. Cream ground, serif display, terracotta | The house's cool gray ground and one Renaissance sans; no accent; the only warm hues are the site's map. |
| 2. Near-black ground, acid accent | The dark theme is the house slate; no accent. |
| 3. Broadsheet hairlines and zero radius | One column; hairlines only in About and between keys; radii 6, 8 and 4 px by role. |
| 4. The SaaS-card kit | One card (the tapped point), one sheet (About), the notice; no shadows; no gradients at all. |
| 5. Capitals and tracking | None; sentence case; `letter-spacing` 0. |
| 6. Middle-dot meta strings | None: the stamp is one sentence, About's facts one per line. |
| 7. "WORD — fragment" | None. |
| 8. A tinted black for black | Ink is `#0f1c23`, the house ink; no `#000` or `#111`. |
| 9. Monospace for data | None: the face's figures are tabular. |
| 10. Arrows on links and buttons | None; `check.mjs` fails on →, ➤ and ⋯. |
| 11. One accented word | None. |
| 12. Labels above content | None: the collar's labels sit at the ticks they name. |
| 13. Numbered markers | None. |
| 14. Big number, small label, gradient | The one large figure is the tapped point's coordinates, 21 px, in the card. |
| 15. Entrances and hover on cards | No entrances; the card's 120 ms rise answers a tap; hover only on keys. |

## 5. Budgets

App code at most 80 000 B, fonts 40 075 B (the house face and its license), the ZIP at most
200 000 B (the plan's cap for this starter). `tools/check.mjs` prints the figures of the day.
