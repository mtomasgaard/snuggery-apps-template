"""Step 40 — the time series: data/curves.json, and the per-map tiles in tools/work/tiles.json.

One grid for every series, t = 0, 1, ... 750 Ma (751 points, index = age in Ma), so the curves strip
maps it straight onto the slider's axis (750 Ma to today). A series is null wherever its source has
no value; nothing is extrapolated. Layout: tools/CONTRACT.md §8; tiles: §1.

    temperature_c   PhanDA scotese_07 global mean (data/climate.json), 0..540 Ma
    co2_ppm         Foster et al. 2017 LOESS fit with its 68 % band, 0..419 Ma; null from 420 Ma
    co2_model_ppm   the CO2 PhanDA's scotese_07 runs were forced with (ExperimentInfo.xlsx), 0..540 Ma
    sea_level_m     van der Meer et al. 2022 TGE sea level, AVG / MIN / MAX columns, 0..540 Ma
    land_pct        PaleoDEM land (z > 0 m), 0..540 Ma
    shelf_pct       PaleoDEM shallow sea (-200 < z <= 0 m), 0..540 Ma

Reads data/climate.json and tools/work/climate.json, so it runs after 30_climate.py.

    .venv/bin/python 40_curves.py
"""
import json
import math
import os
import zipfile

import numpy as np

from common import RETRIEVED, json_text, write_fragment, write_json, write_work
from geo import paleodem_grids, paleodem_land_shelf, paleodem_z, read_slices, source
from paths import DATA, TOOLS, WORK
from sources import SOURCES
from xlsx import read_workbook

T_MAX = 750
GRID = np.arange(T_MAX + 1, dtype=np.float64)
CAP = 80_000
MATCH_MYR = 2.5


def foster():
    """Foster et al. 2017 Supplementary Data 2, 'LOESS Fit': (age, central, lw95, lw68, up68, up95)."""
    cells = read_workbook(source('foster2017_sd2'))['LOESS Fit']
    assert cells[(1, 1)].startswith('Supplementary Data 2. LOESS fit to the CO2 data set')
    head = [cells[(2, c)] for c in range(1, 7)]
    assert head == ['Age (Ma)', 'pCO2 probability maximum', 'lw95%', 'lw68%', 'up68%', 'up95%'], head
    rows = []
    r = 3
    while (r, 1) in cells:
        rows.append([cells[(r, c)] for c in range(1, 7)])
        r += 1
    a = np.array(rows, dtype=np.float64)
    assert len(a) == 840 and a[0, 0] == 0.0039 and a[-1, 0] == 419.5039
    assert np.allclose(np.diff(a[:, 0]), 0.5), 'Foster rows are not every 0.5 Myr'
    assert np.isfinite(a).all()
    return a


def vandermeer():
    """van der Meer et al. 2022 mmc1 'SuppTable': age and TGE_SL_isocorr_m AVG, MIN, MAX (AI-AK).
    Rows without an age in column A (546 onward) are ignored. GAT_degC is never read."""
    cells = read_workbook(source('vdm2022_table'))['SuppTable']
    assert cells[(3, 1)] == 'Ma' and cells[(2, 35)] == 'Fig10'
    assert [cells[(3, c)] for c in (35, 36, 37)] == ['TGE_SL_isocorr_m'] * 3
    assert [cells[(4, c)] for c in (35, 36, 37)] == ['AVG', 'MIN', 'MAX']
    rows = []
    r = 5
    while (r, 1) in cells:
        rows.append([cells[(r, 1)], cells[(r, 35)], cells[(r, 36)], cells[(r, 37)]])
        r += 1
    a = np.array(rows, dtype=np.float64)
    assert np.array_equal(a[:, 0], np.arange(541)), 'van der Meer ages are not 0..540 by 1'
    assert np.isfinite(a).all()
    return a


def paleodem_stats():
    """{plate age: (land %, shelf %, member)} for the 109 PaleoDEM grids (CONTRACT §7)."""
    out = {}
    for age, (member, _mid) in sorted(paleodem_grids().items()):
        land, shelf = paleodem_land_shelf(paleodem_z(member))
        out[age] = (land, shelf, member)
    return out


def interp_or_null(x, xp, fp, lo, hi):
    """Linear interpolation of (xp, fp) at x; None outside [lo, hi]."""
    v = np.interp(x, xp, fp)
    return [float(v[i]) if lo <= x[i] <= hi else None for i in range(len(x))]


def main():
    climate = json.load(open(os.path.join(DATA, 'climate.json'), encoding='utf-8'))
    cmatch = json.load(open(os.path.join(WORK, 'climate.json'), encoding='utf-8'))['maps']
    cs = climate['slices']
    pa = np.array([s['plate_age_ma'] for s in cs])
    assert np.array_equal(pa, 5.0 * np.arange(109))
    top = float(pa[-1])                                   # 540

    # --- temperature and the model's CO2 input, from the climate slices -------------------------
    temp = interp_or_null(GRID, pa, np.array([s['global_mean_c'] for s in cs]), 0, top)
    co2_model = interp_or_null(GRID, pa, np.array([s['co2_ppm'] for s in cs]), 0, top)

    # --- Foster CO2 ------------------------------------------------------------------------------
    f = foster()
    age, mid, lw95, lw68, up68, up95 = f.T
    assert (mid > 0).all() and (up68 > 0).all(), 'Foster central or upper 68 % not positive'
    clipped_rows = lw68 < 0
    lw68c = np.where(clipped_rows, 0.0, lw68)
    neg95 = lw95 < 0
    last = float(age[-1])
    co2 = interp_or_null(GRID, age, mid, 0, last)        # t = 0 takes the first row (0.0039 Ma)
    lo68 = interp_or_null(GRID, age, lw68c, 0, last)
    hi68 = interp_or_null(GRID, age, up68, 0, last)
    # A grid age is flagged when either bracketing native row was clipped.
    clip_idx = set(np.flatnonzero(clipped_rows).tolist())
    lo68_clipped_ma = []
    for t in range(T_MAX + 1):
        if t > last:
            break
        j = int(np.searchsorted(age, t, side='right'))
        if {max(j - 1, 0), min(j, len(age) - 1)} & clip_idx:
            lo68_clipped_ma.append(t)
    fit_to = max(t for t in range(T_MAX + 1) if co2[t] is not None)

    # --- van der Meer sea level --------------------------------------------------------------
    v = vandermeer()
    sl = [interp_or_null(GRID, v[:, 0], v[:, k], 0, 540) for k in (1, 2, 3)]
    min_gt_max = [int(x) for x in v[v[:, 2] > v[:, 3], 0]]
    lo_env, hi_env = np.minimum(v[:, 2], v[:, 3]), np.maximum(v[:, 2], v[:, 3])
    avg_outside = [int(x) for x in v[(v[:, 1] < lo_env) | (v[:, 1] > hi_env), 0]]

    # --- PaleoDEM land and shallow sea ------------------------------------------------------
    dem = paleodem_stats()
    dem_ages = np.array(sorted(dem))
    assert np.array_equal(dem_ages, pa), 'PaleoDEM plate ages differ from the climate slices'
    land = interp_or_null(GRID, dem_ages, np.array([dem[a][0] for a in dem_ages]), 0, top)
    shelf = interp_or_null(GRID, dem_ages, np.array([dem[a][1] for a in dem_ages]), 0, top)

    native5 = [int(a) for a in pa]
    curves = {
        'grid': {'t0_ma': 0, 'dt_ma': 1, 'n': T_MAX + 1,
                 'note': 'index = age in Ma, 0 (today) to 750; null where a series has no value'},
        'series': {
            'temperature_c': {
                'values': temp, 'native_ma': native5, 'interp': 'linear', 'source': 'phanda',
                'what': ('climate model global mean annual air temperature 1.5 m above the surface '
                         '(HadCM3L, suite scotese_07), area-weighted'),
                'unit': 'C'},
            'co2_ppm': {
                'values': co2, 'lo68': lo68, 'hi68': hi68, 'source': 'foster2017', 'unit': 'ppm',
                'what': 'LOESS fit to proxy CO2 (probability maximum) with its 68 % band',
                'interp': 'linear', 'native_step_ma': 0.5, 'first_ma': float(age[0]),
                'last_ma': last, 'fit_to_ma': fit_to,
                'lo68_clipped_ma': lo68_clipped_ma, 'clipped_lo68_rows': int(clipped_rows.sum()),
                'lo68_rule': 'lower 68 % edge clipped at 0 ppm; lo68_clipped_ma lists the grid ages it touched',
                'lo95_negative_rows': int(neg95.sum()),
                'lo95_negative_from_ma': float(age[neg95].min()) if neg95.any() else None,
                'lo95_negative_to_ma': float(age[neg95].max()) if neg95.any() else None,
                'band95': 'not shipped (its lower edge is negative in the rows counted above)'},
            'co2_model_ppm': {
                'values': co2_model, 'native_ma': native5, 'interp': 'linear', 'source': 'phanda',
                'unit': 'ppm',
                'what': ('the CO2 the climate model was run with (ExperimentInfo.xlsx, scotese_07), '
                         'a model input and not a proxy fit; draw it where co2_ppm is null')},
            'sea_level_m': {
                'values': sl[0], 'min': sl[1], 'max': sl[2], 'native_step_ma': 1, 'interp': 'none',
                'source': 'vandermeer2022', 'unit': 'm',
                'column': 'TGE_SL_isocorr_m (Fig10), AVG/MIN/MAX',
                'what': 'tectono-glacio-eustatic global mean sea level relative to today',
                'band_rule': ('draw the band between the lower and the higher of min and max: the '
                              'columns are not ordered bounds at every age (min_above_max_ma)'),
                'min_above_max_ma': min_gt_max, 'avg_outside_band_ma': avg_outside},
            'land_pct': {
                'values': land, 'native_ma': native5, 'interp': 'linear', 'source': 'paleodem',
                'unit': '%', 'what': 'share of the globe above sea level (PaleoDEM z > 0 m)'},
            'shelf_pct': {
                'values': shelf, 'native_ma': native5, 'interp': 'linear', 'source': 'paleodem',
                'unit': '%', 'what': 'share of the globe under shallow sea (PaleoDEM -200 < z <= 0 m)'},
        },
    }
    txt = json_text(curves, ndigits=3)
    assert len(txt.encode('utf-8')) <= CAP, f'curves.json {len(txt.encode())} bytes > {CAP}'

    # --- tiles per map (CONTRACT §1): values at the map's own age, from the native data ----------
    slices = read_slices()
    assert len(cmatch) == len(slices) == 90
    today_fit = float(mid[0])
    tiles = []
    for i, s in enumerate(slices):
        a = s['age_ma']
        m = cmatch[i]
        assert m['map'] == s['map']
        c = m['climate']
        t = {}
        t['temperature'] = None if c is None else {
            'c': cs[c]['global_mean_c'], 'slice_age_ma': cs[c]['plate_age_ma'], 'source': 'phanda'}
        if a <= last:
            aa = max(a, float(age[0]))
            t['co2'] = {'ppm': float(np.interp(aa, age, mid)), 'lo68': float(np.interp(aa, age, lw68c)),
                        'hi68': float(np.interp(aa, age, up68)), 'today_ppm': today_fit,
                        'kind': 'proxy_fit', 'at_ma': a, 'source': 'foster2017'}
        elif c is not None:
            t['co2'] = {'ppm': cs[c]['co2_ppm'], 'lo68': None, 'hi68': None,
                        'today_ppm': cs[0]['co2_ppm'], 'kind': 'model_input',
                        'at_ma': cs[c]['plate_age_ma'], 'source': 'phanda'}
        else:
            t['co2'] = None
        t['sea_level'] = None if a > 540 else {
            'm': float(np.interp(a, v[:, 0], v[:, 1])), 'min_m': float(np.interp(a, v[:, 0], v[:, 2])),
            'max_m': float(np.interp(a, v[:, 0], v[:, 3])), 'at_ma': a, 'source': 'vandermeer2022'}
        # PaleoDEM plate ages equal the climate slices' (asserted above), so the match is the same.
        t['land'] = None if c is None else {
            'land_pct': dem[pa[c]][0], 'shelf_pct': dem[pa[c]][1], 'dem_age_ma': float(pa[c]),
            'source': 'paleodem'}
        tiles.append({'i': i, 'map': s['map'], 'age_ma': a, 'tiles': t})

    # PaleoDEM zip's licence is the atlas's, byte for byte (RESEARCH.md §1).
    with zipfile.ZipFile(source('paleodem_1deg')) as z:
        dem_licence = z.read('License.txt')
    with open(os.path.join(TOOLS, 'credits', 'PaleoAtlas_v3_License.txt'), 'rb') as fh:
        kept = fh.read()
    assert dem_licence == kept, "the PaleoDEM zip's License.txt differs from the atlas's"

    # Only after every check: write.
    write_json('curves.json', curves, ndigits=3)
    write_work('tiles.json', {'maps': tiles,
                              'dem': {str(int(k)): {'land_pct': d[0], 'shelf_pct': d[1], 'member': d[2]}
                                      for k, d in dem.items()}})

    fs, vs, ds = SOURCES['foster2017_sd2'], SOURCES['vdm2022_table'], SOURCES['paleodem_1deg']
    x = SOURCES['phanda_info']
    write_fragment('curves', [
        {'id': 'foster2017', 'title': 'CO2 over the last 420 million years (LOESS fit)',
         'owner': 'G. L. Foster, D. L. Royer & D. J. Lunt',
         'source': (f'{fs["name"]} (sha256 {fs["sha256"]}): Supplementary Data 2, sheet "LOESS Fit", '
                    '840 rows, 0.0039-419.5039 Ma every 0.5 Myr.'),
         'url': fs['url'], 'licence': 'CC BY 4.0',
         'licence_uri': 'http://creativecommons.org/licenses/by/4.0/',
         'licence_quote': ('"This work is licensed under a Creative Commons Attribution 4.0 '
                           'International License." (Nature Communications article page, Rights and '
                           'permissions)'),
         'retrieved': RETRIEVED,
         'adaptations': ('Resampled by linear interpolation to whole millions of years; the lower edge '
                         f'of the 68 % band clipped at 0 ppm ({int(clipped_rows.sum())} rows needed it); '
                         'the 95 % band left out because its lower edge is negative in '
                         f'{int(neg95.sum())} rows ({float(age[neg95].min()):g}-{float(age[neg95].max()):g} Ma).'),
         'accuracy': ('A statistical fit through proxy measurements; the 68 % band is its stated '
                      'uncertainty. Coverage ends at 419.5 million years ago.'),
         'cite': fs['attribution']},
        {'id': 'vandermeer2022', 'title': 'Phanerozoic global mean sea level',
         'owner': ('D. G. van der Meer, C. R. Scotese, B. J. W. Mills, A. Sluijs, '
                   'A.-P. van den Berg van Saparoea & R. M. B. van de Weg'),
         'source': (f'{vs["name"]} (sha256 {vs["sha256"]}): sheet "SuppTable", column group Fig10, '
                    'TGE_SL_isocorr_m AVG / MIN / MAX, 0-540 Ma every 1 Myr.'),
         'url': vs['url'], 'licence': 'CC BY 4.0',
         'licence_uri': 'http://creativecommons.org/licenses/by/4.0/',
         'licence_quote': ('"This is an open access article under the CC BY license." (the article\'s '
                           'license statement; the supplement carries none of its own, and Elsevier gives an open '
                           'access article\'s supplementary files the article\'s license)'),
         'retrieved': RETRIEVED,
         'adaptations': 'Values used as published, rounded to the millimeter; interpolated to map ages.',
         'accuracy': ('A reconstruction from strontium isotope variations and estimates of '
                      'continental glaciation (the paper\'s title). MIN and MAX are the supplement\'s '
                      f'columns as labeled; they are not ordered at {min_gt_max} Ma, and AVG lies '
                      f'outside them at {avg_outside} Ma.'),
         'cite': vs['attribution']},
        {'id': 'paleodem', 'part': 'land and shallow-sea area',
         'title': 'PALEOMAP Paleodigital Elevation Models (PaleoDEMs), 1 degree',
         'owner': 'C. R. Scotese & N. M. Wright, PALEOMAP Project',
         'source': (f'{ds["name"]} (sha256 {ds["sha256"]}), Zenodo record 5460860: the 109 NetCDF '
                    'grids, keyed by the Plate Model Age in the zip\'s interval CSV.'),
         'url': ds['url'], 'licence': 'CC BY 4.0',
         'licence_uri': 'http://creativecommons.org/licenses/by/4.0/',
         'licence_quote': ' '.join(kept.decode('utf-8').split()),
         'retrieved': RETRIEVED,
         'adaptations': ('Land (above 0 m) and shallow sea (0 to 200 m deep) as shares of the globe, '
                         'weighted by the cosine of latitude, one value per grid.'),
         'accuracy': 'The authors call these elevation models a first draft.',
         'cite': ds['attribution']},
        {'id': 'phanda', 'part': 'curves',
         'title': 'PhanDA HadCM3L model priors, suite scotese_07',
         'owner': ('E. J. Judd, J. E. Tierney, D. J. Lunt, I. P. Montanez, B. T. Huber, S. L. Wing & '
                   'P. J. Valdes; simulations by the BRIDGE group, University of Bristol'),
         'source': (f'{x["name"]} (sha256 {x["sha256"]}): columns P-Q (scotese_07 PUMA ID and CO2); '
                    'global means from data/climate.json.'),
         'url': 'https://zenodo.org/records/8237751', 'licence': 'CC BY 4.0',
         'licence_uri': 'http://creativecommons.org/licenses/by/4.0/',
         'licence_quote': 'Zenodo record 8237751: license cc-by-4.0 (Creative Commons Attribution 4.0 International).',
         'retrieved': RETRIEVED,
         'adaptations': 'Global mean temperature and the CO2 input interpolated linearly between the 5-million-year runs.',
         'accuracy': 'Model output and a model input, not measurements.',
         'cite': x['attribution']},
    ])

    def rng(vals):
        xs = [(t, y) for t, y in enumerate(vals) if y is not None]
        lo = min(xs, key=lambda p: p[1])
        hi = max(xs, key=lambda p: p[1])
        return f'{lo[1]:.3f} at {lo[0]} Ma .. {hi[1]:.3f} at {hi[0]} Ma ({len(xs)} values, {xs[0][0]}..{xs[-1][0]} Ma)'

    print(f'curves.json: {len(txt.encode()):,} bytes, grid 0..{T_MAX} Ma ({T_MAX + 1} points)')
    for k, s in curves['series'].items():
        print(f'  {k}: {rng(s["values"])}')
    print(f'  co2 lo68 clipped rows: {int(clipped_rows.sum())}; lo95 negative: {int(neg95.sum())} rows, '
          f'{curves["series"]["co2_ppm"]["lo95_negative_from_ma"]}..{curves["series"]["co2_ppm"]["lo95_negative_to_ma"]} Ma')
    print(f'  sea level MIN > MAX at {min_gt_max} Ma; AVG outside [MIN, MAX] at {avg_outside} Ma')
    print(f'  PaleoDEM at 0 Ma: land {dem[0.0][0]:.2f} %, shelf {dem[0.0][1]:.2f} %')
    print(f'tiles: {len(tiles)} maps -> {os.path.join("tools", "work", "tiles.json")}')


if __name__ == '__main__':
    main()
