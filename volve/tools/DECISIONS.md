# Volve pipeline: decisions and measurements

Plan 0012, D10 part 1 (the data pipeline; part 2 builds the app from Norne Reservoir 2.2). The owner
chose the seismic crop (reservoir top − 500 m to base + 500 m from the model's own depths, footprint
+ 250 m, 25 m traces, 8 bits), pinned mirrors plus our own OPM run, and no 4D. D11 binds the
seismic: anti-alias before decimating, original depths, one depth scale, no tie. Every number below
was measured on 2026-10-07 on this Mac (macOS arm64, Python 3.12, numpy 2.1.3, opm 2026.4) unless it
says otherwise; the OPM Flow run itself has not happened yet.

## 1. The deck comes from the mirror's first commit, not the pinned one

The brief named `tpp-grupo-166/opm-datasets@76fbc78`. At that commit 7 of the 34 files are that
repository's own edits for OPM (its commits `13049a4` to `a593cfa`, 9 May 2026): `VOLVE_2016.DATA`,
`SCH_010916_10DAYS.SCH`, the RSVD include and the four ADDZCORN fault includes. Commit `1c323c2`
added the files "from the 1.6 GB upstream bundle"; the other 27 files have the same git blob at
both commits. So the pipeline fetches `1c323c2` (folder `volve/`).

Two of the mirror's edits change the physics against Equinor's run: it commented out ADDZCORN (the
fault throws; see 2) and it inserted a WCONHIST keyword above five producer records at 1 Jan 2015,
which Equinor's run discarded (its PRT: `SPURIOUS DATA BEFORE DATES KEYWORD 'P-F-14' 'OPEN' 'ORAT'
298.200 ...`). The repository also has no licence file, so its edits are not ours to reuse. We take
Equinor's files only and make our own edits.

**Proof that the files are what Equinor ran** (`pipeline/check_provenance.py`): Eclipse echoes its
input into the run log. Equinor's `VOLVE_2016.PRT` (Eclipse 2015.1, from a different mirror) echoes
879 lines of the main deck and 1,544,302 lines of its includes; every one is found, in order, in
the fetched files (3 long comment lines match as truncated at Eclipse's 132 columns). Every non-blank
line of every include is echoed, except the grid file, which starts with its own NOECHO; in the main
deck the unechoed lines are the RUNSPEC block under NOECHO, INCLUDE file names, TUNING records, and
three lines read by hand (listed in the script). The same check on the mirror's `76fbc78` files
fails: 15 echoed lines missing and 849,905 include lines unexplained.

The grid, which Eclipse did not echo, is proved by `pipeline/check_static.py`: see 2.

## 2. Deck edits beyond report settings: required by OPM, each matched to what Eclipse did

The brief allowed report-setting edits only. That is not possible with OPM Flow 2026.04, measured:

- OPM's parser (opm 2026.4, default strict parse context) stops on Equinor's deck at ROCK's 13th row.
- Against opm-simulators' own tables at `release/2026.04/final` (`b82f21d`:
  `UnsupportedFlowKeywords.cpp`, `PartiallySupportedFlowKeywords.cpp`, pinned by sha256 in
  `tools/check_keywords.py`), three items are critical, so Flow stops: ADDZCORN, PRIORITY, and
  EQLOPTS' QUIESC and MOBILE. Flow's `--parsing-strictness=low` would only ignore them.

Each edit gives OPM the input Eclipse used (`pipeline/prepare_deck.py`; the list is copied into
`data/ATTRIBUTION.txt`):

| Edit | Why | Evidence |
| --- | --- | --- |
| ROCK's 13th row, RSVD's 13th table, the five keywordless records at 1 Jan 2015: commented out | Eclipse discarded them; OPM's parser rejects them | Equinor's PRT logs each as SPURIOUS DATA |
| ADDZCORN's 100 records applied to ZCORN; the keyword commented out | OPM parses ADDZCORN but does not apply it, and Flow stops on it | see below |
| PRIORITY removed | not in OPM; it only weights group production targets | the deck has no GCONPROD, GCONPRI or GUIDERAT anywhere |
| EQLOPTS: QUIESC and MOBILE removed, THPRES kept | not in OPM | MOBILE's effect is measured: 1,200 cells keep the deck's SOWCR and SOGCR |

**ADDZCORN.** Every record names one pillar line: `0 n` is the high side of cell n, `n 0` the low
side, for I and for J, layers 1 to 63, top and bottom corners of the box's cells only (neighbours
keep theirs, which makes the throw). Applied that way, OPM's cell depths equal the DEPTH in
Equinor's INIT in all 183,545 active cells (largest difference 0.0001 m). Without ADDZCORN, as the
mirror ran it, 2,862 cells (I 58–70, J 43–61) are off by up to 58.75 m. Only the changed ZCORN
numbers are rewritten (12,600 corner depths, in the file's own `%11.3f` layout); every other byte of
the 68.5 MB grid file is unchanged.

**What `check_static.py` measures** (OPM's model from the prepared deck against Equinor's INIT, over
Equinor's 183,545 active cells): depth 0.0001 m; porosity 5×10⁻¹⁰; PERMX/Y/Z 9×10⁻⁸ relative; pore
volume, after the EDIT section's multipliers, 6×10⁻⁸ relative; SWL, SWCR, SGU, SGCR, SWU, SGL equal;
FIPNUM, PVTNUM, SATNUM, EQLNUM, FLUXNUM equal in every cell; SOWCR and SOGCR differ in exactly the
1,200 cells of Eclipse's MOBILE correction (its PRT: "Mobile Fluid Endpoint Correction Required ...
YES"). Any other count fails.

**Not needed in 2026.04**, though the mirror made them for an earlier OPM: EQUIL item 9 = 20 (now
allowed from −20 to 20), MESSAGES (a warning), the `#N` comments after a slash (parsed), and field
summary keywords (the deck's include already requests them).

**The lead decides** whether these stated departures from "report settings only" are acceptable.
The alternative, `--parsing-strictness=low`, silently drops the same keywords and keeps ADDZCORN
out, which moves 2,862 cells by up to 59 m.

## 3. Report settings: monthly restarts, quarterly frames chosen by the extractor

RPTRST becomes `'BASIC=5' 'FREQ=1'` in all three places (the deck asked for every 4th month, then
every 3rd), and RPTSCHED loses `RESTART=4`, so RPTRST alone decides (OPM honours RPTSCHED's RESTART
while BASIC is 2 or less: `RSTConfig.cpp` at `0ea6297`). `extract.py` keeps the first restart in each
calendar quarter plus the first and last: 37 frames, 2007-12-31 to 2016-10-01, in the dry run on the
deck's report dates. This way OPM's month counting for FREQ does not matter and the spacing can change
without a new run; it costs about 0.6 GB of runner disk for about 107 restarts. `WGPT` (gas produced
per well) is added to the summary output; `tools/check_keywords.py` confirms through OPM's
SummaryConfig that all 15 vectors the pipeline reads are written.

## 4. OPM Flow from the official Docker image, pinned by digest

`openporousmedia/opmreleases@sha256:db8865d7…` is the `2026.04_amd64` image (built 2026-05-20;
Ubuntu 24.04 with `libopm-simulators-bin` from the release PPA and `openmpi-bin`; 425.9 MB of layers;
read from the registry's manifest and config, not pulled here). Chosen over the `opm-simulators`
wheel Norne uses because Volve has been run in this image family before (tpp-grupo-166 ran its
modified copy ten times in `opmreleases:latest`, 1,315–1,661 s each, hardware not stated), while
the Python `BlackOilSimulator` path is untested on Volve, and because the image carries MPI. The run
uses `mpirun --oversubscribe --bind-to none -np 4` on the runner's 4 vCPUs (the workflow's `processes`
input; 1 runs without MPI). Without a hostfile OpenMPI 4.1 gives one slot per physical core, and a
4-vCPU hosted runner may be 2 cores × 2 threads, which would refuse 4 ranks after the prepare stage
(review finding, not measured here); `--oversubscribe` removes that failure and `--bind-to none`
avoids binding more ranks than cores. The log prints `nproc` and `lscpu`, so the first run states
the hardware. With `--shm-size=2g` and `OMPI_MCA_btl_vader_single_copy_mechanism=none` for MPI inside Docker. The
image runs as its user `opm`, so the output folder is made world-writable. Time budget: the only
Volve times found are third-party (1,315–1,661 s for a modified deck on unstated hardware; an
unattributed 7,451 s serial run), so the workflow gives prepare 40 minutes, simulate 280 and finish
20 inside a 345-minute job (hosted runners allow 360). A step that times out is cancelled as a step,
and the `always()` log upload still runs. `GRIDFILE 2 0` still
gives an EGRID (`IOConfig.cpp` at `0ea6297`: "we will output EGRID file; irrespective").

## 5. Validation: Equinor's own run is the reference

`validate.py` compares our summary with Equinor's `VOLVE_2016.SMSPEC/UNSMRY` (Eclipse 2015.1, FOPT
9,980,819 Sm³ at 2016-10-01) and fails loudly outside these tolerances: field oil, water and gas
produced within 5 % at the end and 10 % at every date after 10 % of the total; water injected within
2 % (injectors are rate controlled); field pressure within 5 bar on average and 15 bar at worst; well
oil within 15 % and water within 25 % for wells with at least 2 % of the field's; injector water
within 2 %; OPM's active cells within 0.5 % of Equinor's 183,545, with depth and porosity equal where
both are active. The run must also end on Equinor's end date. The tolerances are a judgement: Norne
came within 0.4 % of its reference, and Volve loses QUIESC and MOBILE. `extract.py` refuses to run
unless `validation.json` says pass, and `validation.json` ships so the app can state the numbers.
The app's source sentence (`extract.py`) states what was measured: the largest end-of-run
difference, the largest difference along the way, and field pressure's mean and largest difference.
TRANX, TRANY and TRANZ (connectivity across the 100 ADDZCORN throws and MULTFLT; both INITs carry
them) are compared over the common active cells and reported, not gated: OPM and Eclipse need not
compute every face alike, and no OPM number exists yet to set a tolerance from.
Checked here on Equinor's run against itself (pass, all zero) and with FOPT × 1.06, FPR × 1.03 and
P-F-12's WOPT × 0.8 (each fails).

## 6. Extraction: Norne's, in the seismic's map frame

`extract.py` is Norne's with these changes: corners come through `EGrid.xyz_from_active_index(a,
True)`, which applies MAPAXES (the binding's documented second argument), so the model is in
ED50 / UTM 31N like the seismic: on the dry run its corners agree with `seismic.py`'s own MAPAXES
transform to 1 mm. Neighbours use arrays instead of a per-cell loop; on 4,000 random cells they equal
Norne's loop exactly. Wells carry their WCONHIST/WCONINJE targets per frame (`targets`), the summary
carries history rates beside simulated ones, and NTG (absent from the deck) is 1. Dry-run sizes on
the real grid with Equinor's active set and INIT: geometry 17,620,320 B raw / 6,376,306 zipped,
neighbours 4,405,080 / 1,923,272, ijk 550,635 / 390,118, static 4,405,080 / 1,955,115. A re-run of
extract on the same input is byte-identical.

## 7. Seismic (D11)

- **Source.** The only depth stack anyone can reach anonymously: ST0202R08 PS PSDM full-offset
  stack in depth (OSDU bucket; 895,367,300 B, ETag `858b187f…-107`). PS is the converted-wave image.
- **Crop.** From the prepared grid's corners over Equinor's active cells: depths 2,797.34–3,549.33 m,
  so samples 2,295–4,050 m (352 at 5 m); footprint IL 10058.8–10302.2, XL 2110.8–2442.4, so IL
  10038–10324 and XL 2090–2464 after 250 m (20 bins) and rounding outward to whole 25 m steps.
  Output 144 × 188 × 352. The research's estimate (142 × 186) used an approximate active set.
- **Read.** IL 10008–10354 × XL 2060–2494 (the crop plus a 30-trace pad for the filter), one range
  request per inline: 150,945 traces, 580,232,580 B, sha256 `008aa30b…` (pinned; both reads here
  matched it). Every trace header is checked for its inline, crossline, sample count and interval.
  The read's wall time depends on the network path, not the pipeline: 321 s here on 2026-10-07,
  about 7.5 minutes in QA's sandbox; the prepare step's 40-minute budget allows for that.
- **Anti-alias.** A separable 61-tap Kaiser-windowed sinc (cutoff 0.225 cycles per bin, β 4.5335),
  applied on inlines and crosslines before keeping every second trace: pass band to 0.20 cycles/bin
  (62.5 m and longer) within 0.042 dB, at least 51 dB down from 0.25 (the 25 m grid's Nyquist, 50 m).
  The taps are constants so every machine filters with the same numbers. Measured in
  `tools/test_seismic.py` through the pipeline's own function: a 33 m crossline wave comes out at
  −67 dB, where dropping every second trace keeps it at full strength as a false 100 m wave; a
  45° dipping Ricker event has −67 dB of wrong-dip (aliased) energy after our decimation, −13 dB after a
  bare drop, −72 dB in the original; a 10° dip changes by 0.03 % of its peak.
- **Depth.** Untouched: 5 m samples at their original depths. The header gives first sample 0 m,
  5 m interval, 901 samples, and does not name the datum. Its processing list (C21–C40, now kept in
  `seismic.json`'s `textualHeader`) includes "TIDAL STATICS", which references the data to mean sea
  level, so `z.datum` states mean sea level as an inference, labelled so (`seismic.py` states it only
  when the header carries that step). The list also has "ROTATION TO RADIAL" and "CONVERSION TO PS
  TWT": the image is depth-converted with its own converted-wave velocities, so its reflectors can
  sit tens of metres off the PP-based horizons and the wells. `depthRelation` says so for About.
- **The model's datum, measured** (`tools/measure_datum.py`). The deck names no datum. The 668 cells
  the 9 surveyed deck wells are completed in (OPM's connection depths; x, y from the prepared grid's
  pillars and MAPAXES) lie a median 17.9 m (90 % within 30.1 m) in 3D from their surveyed paths taken
  below sea level, which is inside a cell (median 48.6 × 47.7 m, 1.1 m thick). Read as depths below
  the 54.9 m KB instead (each cell 54.9 m shallower below sea level) the median becomes 51.4 m;
  shifted 54.9 m the other way, 48.1 m. The best shift in 1 m steps from −30 to +30 m is −5 m at a median 17.6 m, a flat
  minimum: the steep wells cannot resolve a few metres. P-F-15C's completed cells span 2,888–2,923 m;
  Equinor's Hugin picks in that well are 2,889.95 and 2,923.7 m TVDSS. So the model is below mean sea
  level, and `model.json`'s `crs` says so.
- **Amplitude.** Symmetric clip at the 99.9th percentile of |a| over the output, 0.104697 (largest
  0.2046; 0.103 % of samples at the clip); code = 128 + round(127 a / clip), 1..255, zero is 128
  (mean code 128.017). No AGC; the header's own processing list includes "2DB EXP. GAIN CORRECTION".
- **Geometry.** One affine grid fitted to the CDP X/Y of all 150,945 traces read, solved exactly
  (integer sums, rational arithmetic), so it is the same on every machine: steps 12.50002 and
  12.50000 m, axes 90.00004° apart, inline direction 284.0° and crossline 14.0° (header C13–C14). The
  headers scatter up to 0.166 m (rms 0.077 m) around it in a rounding pattern; the acceptance is
  0.25 m. The textual header's four survey corners (given to 0.1 m) fit within 0.055 m.
- **Polarity.** From the textual header, line C39: "A POSITIVE SAMPLE CORRESPONDS TO A INCREASE IN
  ACOUSTIC IMPEDANCE." Kept verbatim and labelled as what the contractor's header states, with
  `polarityNote`: this is a PS image, whose amplitudes respond mainly to shear-impedance and density
  contrasts, so the line is read as the SEG sign convention, most likely the contractor's PZ
  boilerplate, not as an acoustic-impedance polarity. The binary header's polarity field (bytes
  3257–3258, SEG-Y rev 1) is 0 (not set); `seismic.py` read byte 3261 before, also 0.
- **Horizons.** Hugin Fm top and base (OSDU; picked on ST10010ZC11 in depth) sampled at the output
  traces into `horizons.bin`: 24,919 and 24,984 of 27,072 nodes. They are well-adjusted
  interpretations (file names `_adj`, `_adj2`, `EasyDC`), not the seismic's own depth. Their X/Y lie within 0.258 m of our
  grid at their IL/XL (one numbering), and the top agrees with Equinor's Hugin top well picks to a
  median 0.1 m over 14 wells (sea level). Shipped as delivered: they are not picks on the PS cube.
- **No tie.** Nothing shifts, stretches or ties seismic, horizons and model. The model's own top
  against the Hugin top horizon is the research's measurement (median +25 m); not repeated here.
- **Re-runs.** Two complete reads gave the same sha256, and three builds gave byte-identical
  `seismic.bin`, `seismic.json` and `horizons.bin`. A seeded fingerprint of filter, clip and
  quantization (`tools/test_seismic.py`) was measured on macOS arm64 only; the pipeline runs it with
  `--fingerprint-report-only`, so a libm difference cannot stop the run before the simulation. The
  identity that matters is checked directly: the workflow compares prepare's `seismic.bin`,
  `seismic.json`, `horizons.bin`, `wellpaths.json` and `production.json` with the committed files
  (sha256 and `git diff --stat`, a warning, never fatal).
- **Peak memory** 1.07 GB.

## 8. Wells and production

`wells.py` writes the 21 'ACTUAL' surveys with depth below sea level: TVD below the rotary Kelly
bushing minus the KB elevation from Equinor's own well picks (TVD − TVDSS, 54.9 m for every well;
F-9 A has no picks, so its slot's F-9 value is used). NPD's well headers in the awgeo mirror say
54.0 m for five wells; Equinor's picks are used because they are Equinor's and agree among
themselves to 0.05 m (checked per well). The picks travel with each path. Production is the
workbook's monthly sheet as JSON; its `15/9-F-11` (daily code `NO 15/9-F-11 H`) is the deck's
P-F-11B (oil 1,147,849 Sm³ against the deck's WOPTH 1,164,088).

## 9. Licence (Equinor's terms, as the gate read them)

- `data/ATTRIBUTION.txt` credits Equinor and the former Volve licence partners (ExxonMobil
  Exploration & Production Norway AS and Bayerngas Norge AS, or their successors, as the terms name
  them), links the terms, says the folder is free and not endorsed, and lists every adaptation
  (clause 3.2). `data/TERMS-Volve-2026-10-07.txt` is the text of Equinor's PDF (the copy its current
  listing links; the 2020 equinor.com copy has the same clauses word for word), with both PDFs'
  sha256.
- Nothing here uses Equinor's or the partners' names to market anything (clause 4).
- Owed outside `volve/`: a carve-out in `Template/LICENSE` (MIT covers code only; `volve/data` stays
  under Equinor's terms), and keeping Volve out of the paid app's pack, its screenshots and any
  marketing copy.

## 10. Sizes (measured unless marked)

| File | Raw (B) | Zipped (B) |
| --- | ---: | ---: |
| seismic.bin | 9,529,344 | 7,297,212 |
| horizons.bin | 216,576 | 159,923 |
| seismic.json | 8,105 | 4,076 |
| wellpaths.json | 137,824 | 34,569 |
| production.json | 29,772 | 6,999 |
| ATTRIBUTION.txt + TERMS | 35,529 | 11,924 |
| geometry, neighbours, ijk, static (dry run) | 26,981,115 | 10,644,811 |
| dynamic.bin, 37 frames | 27,164,660 | not measured: about 17.3 MB at Norne's ratio (0.637) |
| model.json (dry run) | 55,874 | 16,236 |

About 35.5 MB zipped for `data/` once the run is in, as the owner's gate expected; GitHub's 100 MB
per-file limit is far off (largest file 27 MB).

## 11. Not verified here

The OPM Flow run (no Linux, no Docker on this Mac): its wall time on the runner, whether MPI works in
the container as configured, whether it converges on Volve, and whether it passes `validate.py`. The
dynamic file's real size and compression. The PS cube's datum is inferred (tidal statics), not
stated. The opm Linux wheel and the fingerprint on Linux. The TRAN comparison's numbers.

## 12. Terms PDFs

`fetch_inputs.py` does not fetch Equinor's two terms PDFs in a rebuild: the text is committed as
`data/TERMS-Volve-2026-10-07.txt`, and Equinor has moved this material before (the blob copy was
modified in 2025-10), so an outage or a change there must not stop a data build. `--check-terms`
fetches them against the same pins and exits 3, after everything else, if one has changed.

---

# Part 2: the app (plan 0012, package 3.4c; D10, D11, D14), 2026-10-07

Built from Norne Reservoir 2.3 as the lead committed it (`73a50d7`): `index.html`, `app.js`, `style.css`,
`js/` (units, data, track, section, pane), `fonts/`, `config.json`, `miniapp.json`, `scripts/package.sh` and
the tools (`check.mjs`, `shoot.mjs`, `test_decode.mjs`, `test_section.mjs`, `tools/art/palette.py`). Norne has
no `vendor/` (plain WebGL 2), so none was copied. `pipeline/`, `data/` and this file's part 1 are untouched;
`data/` is byte-identical to the pipeline's commit (`check.mjs` pins all fourteen files). `NOTES.md` was
merged (part 1's pipeline notes kept, in US spelling, beside the app's), and it ships.

## What changed from Norne 2.3, and why

1. **Names and storage.** `Volve`, `volve-viewer:v1`, `window.__volve`; the credit constant is Equinor's
   terms' wording (`Data: the Volve field data set, © Equinor ASA and the former Volve license partners,
   under Equinor’s Terms and conditions for licence to data - Volve; not connected with, sponsored or
   endorsed by them`). Clause 4: Equinor's and the partners' names stand only in About (and the data, NOTES,
   ART); `check.mjs` 8 fails if they reach the front, `miniapp.json`, the app's other files or the README's
   Volve entry and rows.
2. **No formations, no net to gross.** The deck names no zones and its NTG is 1 in every cell, so the ZONE
   and NTG views, the formations' explode and labels, the formation tops and Norne's sand scale are not
   carried. Explode is by **Layers** (8 m a layer) or **Regions**; the fault segment becomes the deck's
   eleven fluid-in-place **regions** (FIPNUM, lateral blocks through every layer: measured from static.bin
   and ijk.bin), in Norne's four segment colors assigned so no two of the 21 touching pairs share one
   (`palette.py` checks it). The card names the region (`Cell I 59, J 56, K 62, region 5`).
3. **The period is read from the dates** (`periods()` in `js/data.js`): an 11-day first step, then 86 to
   100 days, `quarter`. Every Norne `month` string is reworded: the card's `in the 90 days to 10 Apr 2008`,
   About's `the quarter to …`, `quarters left`, `quarter by quarter`, the steps `Back one report date` and
   `Forward one report date`; track.js's comment; Page Up and Page Down move four dates, a year (`pageStep`).
   The lead counts from the run's start (`Start of the run`, `8.8 years into the run`): Volve's first report
   date (31 Dec 2007) is before first oil, which no report date marks, so `First oil` would be untrue.
4. **The cut's scale** is 1.5 px per 1 000 Sm³/d (0.25 per 1 000 bbl/d), three times Norne's: the field peaks
   at 10 779 Sm³/d, which Norne's scale would draw 5 px tall. The tick is 12 000 Sm³/d (75 000 bbl/d), over
   the tallest column, because its label stands at the track's left end over the 2008 to 2010 plateau: at
   2 px and 10 000 (the first build) the columns under the label reached 1.6 px above its foot at 320 px wide
   (`shoot.mjs`'s scale check, once given Volve's figures). *Owner call.*
5. **Wells**: the card adds each rate the field reported over the same interval (`Oil reported`, from
   `summary.history`) and the rates the deck sets from that date (`Oil rate set` …, from `targets`); the rates
   chart draws the reported rates dotted beside the simulated. Thirteen wells; PIL-NW never opens and is
   never drawn (as Norne's rule).
6. **Exaggeration ×3** (Norne ×5) for the 3D view and the section: Volve's field is thick for its width
   (750 m of relief over 4.4 km); at ×5 the section fills its pane by height and the model stands tall.
   *Owner call.*
7. **The pick keeps its id buffer per view** (`pickAt()`): Norne drew every cell to a framebuffer for each
   pick; Volve has 4.1 times the cells, and `shoot.mjs`'s 13 000 picks took over 20 minutes headless. The key
   is the view matrix, the face rebuild count and the stretch, so a pick after any change draws afresh.
   Norne could take this too.
8. **The pane's grip is centered on its edge**, not on the pane: with four line words the pane's middle falls
   on `Across` at 360 to 390 px wide, whose hit the grip bar cut to 42.25 px tall (`shoot.mjs`'s hit-target
   check). The line words scroll sideways where the pane is narrower than they are (they fade at the right,
   as the property words do); Draw and Close keep their 44 px.
9. **Section cells drawn for sub-pixel layers.** Volve's layers are a few meters thick: on a section a cell
   is 0.4 px thick at the median (`secCellPx`, measured on Across in the tall pane). Norne's drawing let
   anti-aliasing seams show the ground through every layer and stroked an edge on every cell, so a pixel
   read 15 to 30 % paler or darker than its block's color, and its gap mask hatched those seams as
   "no active cell" all through the model (both caught by `shoot.mjs`'s color check). Now: edges fade by the
   smaller of a cell's width and thickness; each color group is sealed with a 0.6 px stroke of its own color
   where cells are under 3 px; the gap mask is sealed 1 px wide (a gap under a pixel cannot be shown); the
   cut's outline is a layer of its own (`rimLayer`, every cell stroked, the insides erased in one sealed
   path); and the cells are drawn in a layer laid on at their cover, so a block's color over the seismic is
   one alpha whatever its edges do. `shoot.mjs` checks the colors where a block's neighbors share its color.

## The seismic in the section (D11, D14), as built

- **Families**: Inline and Crossline (the survey's own lines, `surveyLine()`), Along and Across (Norne's
  field lines and grid slices), Draw. Inline is the default, on the inline nearest the field's middle
  (10174). A survey line chosen anew is the one through the middle of the line shown before, so switching
  keeps the place. A survey line's ends are the survey's and take no touch; Draw draws a line of your own.
- **The sweep** steps every inline (144, IL 10038 to 10324 by 2) or crossline (188, XL 2090 to 2464 by 2);
  Along and Across through rows or columns as Norne's (Volve's Along runs east and west, so it sweeps rows,
  Across columns).
- **Lateral**: bilinear between the four traces around each point (`colPlan()`); on a survey line the point
  lies on its own traces (indices snapped within 1e-6), so only neighbors along it blend. D14's "no lateral
  interpolation" is read as: no trace is made from other lines; the blend between a line's own neighbors is
  the variable-density display's texture filter D11 asks for. Where the screen's columns lie more than half a
  trace apart, each column averages points across its width (a box low-pass before the bilinear), so a long
  line on a narrow screen never picks traces at a stride. *Owner call.*
- **Vertical**: a Kaiser-windowed sinc (6 samples each side, beta 6) at each screen row's depth, weights
  normalized to 1; where the rows lie farther apart than 5 m the kernel widens to the rows' Nyquist. Every
  on-screen draw resamples depth (rows never fall on the samples), so the sinc runs always, and the canvas
  then draws the image 1:1 (the browser never resamples it). This replaces the browser's own bilinear
  filtering in depth with a band-limited one, which is what D11 asks of any depth resampling.
- **Display**: Seismic, Model, **Both** (default): the seismic under, the cells over at **60 %** (0 to 100),
  the cut's outline whole; ramp **Gray** (default: the cells' colors stay the plot's only hues) or Red and
  blue (positive red, negative blue, zero near the ground); gain ×0.125 to ×8 in quarter powers of two; no
  AGC. The key prints the amplitude at the ramp's ends (`±0.105` at ×1, the clip). *Owner calls: the default
  mode, the 60 %, gray first, red for positive.*
- **Wiggles: not offered.** D11 makes them optional at close zoom; the pane does not zoom, and a trace is
  1.7 to 3 px wide on screen (an inline's 188 traces in 330 to 560 px), too narrow for a wiggle to read.
- **Depth**: one axis, meters below mean sea level, the figures alone and one rotated title (`Depth, m below
  mean sea level`, on two lines where the plot is short). With the seismic shown the window is the cut's
  depths ± 150 m inside the cube (`SEC_MARGIN`); with the model alone, Norne's padding. *Owner call: 150 m.*
- **Ends**: `IL n, XL n` beside A and A′ (the trace nearest each end); on a narrow plot the survey line's
  changing number only.
- **Horizons**: the Hugin top and base from `horizons.bin`, bilinear on its grid and broken where a node
  around has no pick (`horizonAt()`; a node with no weight no longer blanks a point beside it, which
  `test_section.mjs` caught), dashed, named in the plot; a halo only over the seismic alone, since over the
  cells it paled the blocks the line crosses.
- **About** says it all from the data: the survey and product, the crop (from seismic.json's margins), the
  anti-alias filter (its own string), the 8-bit quantization and the clip at the 99.9th percentile, the
  interpolation and display, the polarity line verbatim with its note, the datums and `depthRelation`
  verbatim, not tied, `model.source` verbatim, a check paragraph built from validation.json, the terms'
  address and dated copy, both former partners named, the non-endorsement, and ATTRIBUTION.txt's "What we
  changed" read from the file and shown word for word.

## Measured (all on this Mac, 2026-10-07)

- `node tools/test_seismic_display.mjs`: zero kept at code 128 (decode 0; a cube of 128s through five row
  plans and four ramps: 0 pixels off the zero color); the cube's mean code 128.0174; at the samples' own
  depths the sinc returns IL 10174 XL 2286's 352 samples to 5e-17; half a sample off it is −46.5 dB from the
  trace's own Fourier interpolation (linear: −30.1 dB); the kernel at half a sample is flat within 0.1 dB
  to 0.35 cycles a sample (14 m), −1.0 dB at 0.4; bilinear midway between two traces is their mean; a 20°
  dipping event (50 m Ricker, an event the 25 m traces carry) drawn obliquely with rows three times the
  samples' spacing: −22.2 dB of its energy off its dip, of which −24.6 dB is the bilinear blend between
  traces whose event sits 9 m apart in depth (present at the samples' own row spacing, not aliasing), against
  −13.1 dB drawn without the depth band limit and −7.8 dB by nearest trace and sample; a spike at its own
  depth to 0.036 m at four row spacings and phases; the traces' map points within 0.0009 m of seismic.json's
  corners.
- `tools/shoot.mjs`, in the browser: a cube of 128s drawn at gain ×8 is the ramp's zero color in every
  sampled pixel clear of the horizons and the words; a flat code-255 reflector at 3 000 m is drawn on the
  axis's own row for 3 000 m on all four families (within a device pixel) at the ramp's end color; the
  model's cut cells lie between the axis's rows for their own corners' depths; the sweep scrubbed fast by
  touch on Across, Inline and Crossline: 0 frames whose cells or seismic are not the slider's place, 0 with
  a canvas not at its own size. Load and memory (headless, a trend): WebKit about 450 ms to the first frame
  with every file in and about 600 MB more resident in its processes; Chromium about 970 ms and 645 MB more,
  a 7 to 8 MB JavaScript heap (the typed arrays and the GPU process are outside it). The resident figures
  are SwiftShader's software rendering of 183 545 cells as much as the app; the phone's are owed. Norne Reservoir 2.3 measured the
  same way (a scratch copy of that block, not kept): WebKit 211 ms and 266 MB more, Chromium 892 ms and
  572 MB more; so Volve costs WebKit about 2.2 times Norne's memory headless.
- Sizes (`node tools/check.mjs`): see ART.md section 6; both caps proposed for the lead's ruling.

## The tests, carried and changed

`check.mjs`: the fourteen data pins, the seismic.json and validation.json facts About restates, the terms
and the names (clause 4) including the README's Volve entry, the depths-as-delivered lines (8b), Volve's
caps (proposed), US spelling with data/ excepted and the terms' title. `test_decode.mjs`: Volve's figures
(pressure 203.2 to 447.1 bar, gas to 0.518, the rock's counts beyond their scales, the periods, the cut's
peak, crossover and last quarter, and the averages summed to validation.json's own totals). `test_section.mjs`:
no formation tops; the survey's lines, the horizons and the axis window added; the warped-face bound 6 m
(Volve's cells are thicker and more warped: 4.65 m measured, 0.88 px); the sweep's families read from the
data. `shoot.mjs`: every Norne check carried with Volve's dates and words; the field's fit by width or height
(Volve's field is about as tall as wide at ×3: on a wide short plate its height binds); the color checks on
blocks whose neighbors share their color; the side edge's double taps from rest (a headless frame at a new
pane size takes most of a second, and a tap queued behind it read as a single tap); new blocks: the survey
families and their sweep, the seismic end to end on synthetic cubes, the key, gain and ramps, WebKit and
Chromium load, memory and touch, and `APP_PNG=1` for the provisional README picture.

## Known limits and owner checks

- On its side with the sheet raised and the pane compact, the model is about 109 × 81 px on the 272 × 207
  plate: the keys' two rows take the plate's top and the field's height binds below them (Norne's flat field
  filled 85 % of the width there). An owner's look on a phone.
- Section cells are under a pixel thick at most sizes, so the section reads the model as bands, not cells;
  a tap on a block opens its card as Norne's does.
- Nothing about frame rate, memory or heat on a phone is known: 183 545 cells (4.1 times Norne's) and a
  9.5 MB cube. The device matrix row is the lead's to add.
- The pipeline's own `tools/test_seismic.py` needs numpy, which this Mac's Python does not have now; it was
  run in part 1 and nothing it tests changed.

## The review's fixes (3.4c fix pass, 2026-10-07)

The review's one must and five shoulds, each against what it found; the nits taken where free.

- **The key states the polarity (must).** The key under the pane was `[ramp] ±0.105`, which never said
  which end is positive, and the gray ramp's positive end is dark on the light theme and bright on the
  dark. It is now `−0.105 [ramp] +0.105`, negative at the left. Where the row is too narrow for the
  wells key beside both ends (320 px with the sheet raised, 844 × 390 with it raised), the left end keeps
  only its sign (`− [ramp] +0.105`) so the wells key is not pushed off the 15 px row; the swatch's
  spoken label gives both ends and the positive color (`…, positive dark`). About's display paragraph
  now names the positive color for each ramp and theme, worked out from config.json's ramps themselves
  (`positiveEnd()`), so a change of ramp cannot leave it wrong: *In gray, positive amplitudes are dark and
  negative ones bright on a light page, the reverse on a dark one; in red and blue, positive is red and
  negative blue.* shoot.mjs pins the signed ends, the spoken label and the About sentence.
- **Lengths kept to the data's precision (should).** About printed the bins as `13 m` and the pass band
  as `63 m` (the scale bar's whole-meter `length()`). A new `U.exactLength()` keeps the stated decimals
  (`12.5 m`, `62.5 m`; `41.0 ft`, `205.1 ft`); the pass band is read from seismic.json's own `passBand`
  words (check.mjs already pins them), no longer a constant in app.js. test_decode.mjs pins the helper;
  shoot.mjs's About check pins both strings.
- **The ends' numbers at every size (should).** The words were fitted only between A and A′, so a narrow
  plot (Across and Draw at 390 px, height-bound at ×3) showed none. Each end now tries, in order: the
  full `IL n, XL n` inside the plot or outside it in the canvas's margin (either end independently);
  on a survey line, the one number that changes along it, inside or out; and last `IL n` over `XL n` in
  the margin. Nothing may cross the depth figures or the axis title. shoot.mjs checks every family,
  compact and tall, sheet closed and raised, at 390 × 844 and 320 × 640: none is left without them.
  A drawn end that lies off the cropped cube has no trace, so no numbers are printed there (the plot's
  spoken label says "off the survey"); that is the one state left without them.
  The mixed case (A's numbers inside, A′'s outside) reads letter-then-numbers at both ends. *Owner
  call* if both ends should always sit the same side.
- **The horizons' names off the cells and wells (should).** A coarse mask (3 px squares) marks each cut
  cell's box where the cells are drawn and each well's path (±3 px); a horizon's name is set only on a
  clear place, tried at twelve points along its longest run, the top over its line first and the base
  under it first. A name with no clear place is left off: the dashes stay, and About says what they
  are (the review's own option). Measured: Inline 10174 at 390 compact names `Hugin base` only, Across
  and a drawn line at 390 name neither, Crossline names both. shoot.mjs checks no named box crosses a
  cut cell's box in any of the states above. *Owner call*: fewer names on small plots, by design.
- **The axis title at 320 px (should).** The two-line form was fitted to the axis but never checked
  against it. Now: one line if it fits the axis, two if they do; else two lines run past the plot's ends
  along the canvas's height (centred on the axis, clamped inside the canvas); else `Depth, m below` is
  shortened to `m below` over `mean sea level`, and last `m below` over `sea level`, which still names the
  datum. At 320 × 640 with the sheet raised the canvas is too short for `mean sea level`, so the last
  form shows. shoot.mjs checks the title is whole inside the canvas and names sea level in every state.
  The old key check's `a && b || c` let any split title pass whatever the rest said; it is bracketed now.
- **Device row and manual steps (should).** Outside this pass's write scope (docs/); listed for the lead.
- **Nits taken.** The distance ticks keep one stride: a stride is accepted only where the last tick falls
  on it and nothing touches, else the first and last, else the last alone (the review's drawn line at
  390 px, `0 500 2 000 m`, now reads `0 2 000 m`). Norne carries the same code; the lead's call to port it. Not taken: the corridor's
  `492 ft` (family-wide), the 60 % cover's pale water cells (owner call), the README's row order (lead).
- **A bug found on the way: play could ask for report date −1.** One shoot run failed in Chromium with
  `Start offset -734180 is outside the bounds of the buffer`: a frame's `requestAnimationFrame` time can
  precede the `performance.now()` that Play stamped, so the elapsed time was negative and the date
  `from − 1`, which is −1 from the first date. The elapsed time is now clamped at zero. Norne's app.js
  carries the same line (`norne-reservoir/app.js`, `loop()`); the lead's call to port it.
- **Size.** App code 306 001 B against the build's 298 268 B; the proposed cap in check.mjs is raised to
  307 000 B pending the lead's ruling. Nothing cut. ZIP 33 393 555 B (cap 33 500 000 B unchanged).

## The final verifier's fixes (3.4c, second fix pass, 2026-10-07)

- **The horizons' names stand by their own line (must).** The fix pass's placement checked a name's box
  against cells, wells and words but never against the other horizon, and `place()` clamped a box at the
  plot's right end into columns where the other line ran between the name and its own: the verifier's probe
  found names nearer the other horizon in 17 of 147 states at 390 × 844 (sheet closed), 10 of 77 raised, 15
  of 146 at 844 × 390 and 13 of 83 raised. Now a place is accepted only when, at every column across the
  box (every 1.5 px, and its last), its own line is there and runs beside the box, not through it (2 px of
  slack) and within 20 px of it, and the other horizon is 3 px or more farther from the box than its own,
  so it cannot pass between them; each place is set against its line's highest point across the name's
  width (over) or lowest (under), so the name hugs its line where the line slopes (a first build anchored
  the height at one point, and the final shoot's tall Along showed `Hugin base` under its line at one end
  and some 100 px below it at the other: nearer its own line, but floating; 12 px kept 53 names of 222 at
  390 × 844, 20 px keeps 95); `place()` takes a `shift` limit and skips a place the clamp would move more than 3 px
  (never moves it); and each name tries 48 places (12 points on its longest run, starting or ending at
  each, over and under). The runs now end exactly at A′ (`horizonRuns()` adds the plot's last column), so
  a name at the right end has its own line under its last pixel. A name with no such place is left off.
  Measured with the verifier's probe (`hzprobe.mjs`, Chromium, 111 lines each): 0 names nearer the other horizon of 95 at 390 × 844, 24 raised (its second stop), 89 at 844 × 390 and 20 raised, and 0 lines without their end numbers. Fewer names
  stand than before (the cost of setting each only where it plainly belongs to its line). *Owner call*,
  as before: fewer names, by design, and none on the shortest panes.
- **The ends' numbers in every state (should).** Two causes: the words were tried only as a pair, so an
  end off the survey blanked the other; and on a height-bound plot (46 × 65 px on its side with the sheet
  raised, 26 to 54 px wide at 320 px raised) neither end had room, the margin by A being the depth
  figures'. Now: `secFrame()` lays the frame's words out before the section is drawn (the depth ticks, the
  title, the ends); each end is laid on its own; the stacked form may stand after its letter with its
  second line just inside the plot on a halo; one end's words keep 10 px from the other's letter and words
  (an `out`/`in` pair read `IL 10066 A IL 10276 A′` with 4 px between); and where nothing fits by the ends,
  the numbers go in a key right of A′ (`A IL n, XL n` over `A′ …`, or IL over XL under each letter,
  `secKeys()`), the plot's box narrowed for it so the plot moves left, the key form chosen that keeps the
  plot largest. The gap and rim layers' key now holds the plot's x0 and scale, since the plot can move.
  Measured over every family swept (about 24 places each) at 390 × 844, 844 × 390 and 320 × 640, sheet
  closed and raised, compact and tall: 0 ends without their numbers (the verifier's probe found 49 of 111
  on its side raised and 3 at 390). About's sentence now says the numbers stand "by A and A′ (on a small
  plot, in a key beside it)". *Owner call*: the key's place (right of the plot) and its two forms.
- **shoot.mjs.** The review's 32-state block now covers 844 × 390 too (52 states: drawn lines on its side,
  `#sec-side` for the size keys), requires numbers at every end on the survey (`endNums`, new in the
  hook, with `endForm`) and two distance words or more. A new block sweeps inlines, crosslines, Along and
  Across at the three sizes in 12 states and fails on any name nearer the other horizon, at its box's edge
  or its middle, or with no line of its own under any column, and on any end on the survey whose words
  are missing or name another trace. It shoots `sweep-side-raised-along-light.png` into `tools/.work`.
  One existing step was made steadier: the key check taps *Red and blue* after two quick grip taps, and
  in one run the sheet settled with those words below the fold, so the tap missed and the spoken label
  still said `positive dark` (it passed in the run before). The words are now scrolled into view first,
  as a finger would scroll to them. And the flat-reflector test reads every 12 device px, not 25: with
  the names set tight on their lines near 3 000 m, the reflector's depth, a run read only 6 of
  Crossline's 11 columns (it needs 8); its criteria are unchanged.
- **The distance axis (nit).** Where no stride fits, `0` at A and the last tick are tried 6 px apart,
  the last ending at its place, centered on it or starting at it; the last alone only failing those. No
  distance word may run left of A into the depth figures, off the canvas, or into the ends' words. On the
  drawn line at 320 px raised (a 26 × 30 px plot) the axis reads `0  1 000 m`, not `1 000 m`.
- **The pictures.** `screenshots/` re-shot with `SCREENSHOTS=1 APP_PNG=1`, so `app.png` is the app as it
  ships. `webkit-section-light.png` moved to `tools/.work/` and shoot.mjs no longer copies it into
  `screenshots/` (no other app ships one).
- **Caps: the lead's rulings of 2026-10-07**, set in `check.mjs` with a comment naming them: code 310 000
  B, ZIP 33 600 000 B. Measured at the end: app code 311 642 B (app.js 175 365), **1 642 B over the code
  cap**; check.mjs fails on it and nothing was cut. The pass added 5 641 B to app.js (secFrame and
  secKeys, the names' own-line test, the ticks' fallback; its own comments trimmed, nothing of the
  earlier code). ZIP 33 395 959 B, within its cap. ART.md section 6 and NOTES.md state those figures.
- **The site's bundle.** The lead ruled that Volve joins the site's *More examples* bundle (the owner's D8
  amendment: the apps the app does not install itself). `publish-web.yml` takes any app with an
  `index.html`, so nothing under `volve/` changes for it; ART.md's "not in Snuggery's bundled pack" is
  about the app's built-in pack and stays true. The README's install row stays where it is.
- **For the lead, not in this pass's scope:** the device row, the manual steps, the Site count and Norne's
  port of the play clamp. Norne carries the same distance-tick and end-word code, if the lead wants the
  ticks' fallback and the key there.

## The lead's second ruling on the code cap (2026-10-07)

The final verifier's one must was check.mjs failing on code: 311 642 B against the 310 000 B cap,
after the second fix pass added 5 641 B for the end words, the key, the own-line test for horizon
names and the ticks' fallback. Those are fixes the final asked for, so the cap is 312 000 B. Nothing
was cut. The verifier's other findings are nits, recorded above and left as they are.
