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
