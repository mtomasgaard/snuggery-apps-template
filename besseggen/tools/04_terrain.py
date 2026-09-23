#!/usr/bin/env python3
"""Step 4 — turn the two master grids into the six terrain binaries and the manifest.

    core 2 m master ──halve──► 4 m ──halve──► 8 m ──halve──► 16 m ──halve──► 32 m ──halve──► 64 m
         L5             L4            L3            L2             L1            (core64)

    shell 64 m master  +  (core64 − shell) blended out over 512 m  ──►  L0

Every level of the core is a local decimation of ONE fetched grid, which is what keeps the joins
between levels clean: the service's own coarse products disagree with a local decimation by an
RMSE of 1.6 m at 4 m and 4.6 m at 8 m (cache/SOURCES.md section 1).

The corridor — which tiles exist at levels 3, 4 and 5 — is computed here from the route and the
six viewpoint anchors and written into the manifest, so the app never recomputes it.

Nothing larger than one row band is ever held as float64: the 2 m master is 84 million samples.
"""
from __future__ import annotations
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geom
from paths import DATA, DTM, WORK


def open_master(name, box, res):
    ny, nx = geom.grid_shape(box, res)
    path = os.path.join(DTM, f'{name}_{res}m_{nx}x{ny}_u16dm.raw')
    if not os.path.exists(path):
        raise SystemExit(f'{path} is missing — run 01_fetch_terrain.py first')
    return np.memmap(path, dtype=np.uint16, mode='r', shape=(ny, nx))


def keeper(route_xy, route_buf, anchor_buf, box, res):
    """A tile exists at this level iff its square intersects the level's region — the route buffer
    union the anchor buffers — which is exactly 'the nearest point of the square is within the
    buffer distance'. The parent test is applied by the caller."""
    if route_buf is None:
        return lambda tx, ty: True
    span = geom.CELLS * res
    rx, ry = route_xy

    def keep(tx, ty):
        bx0 = box['x0'] + tx * span
        by0 = box['y0'] + ty * span
        cx = np.clip(rx, bx0, bx0 + span)
        cy = np.clip(ry, by0, by0 + span)
        if bool((np.hypot(rx - cx, ry - cy) <= route_buf).any()):
            return True
        for ax, ay in geom.ANCHORS:
            dx = max(bx0 - ax, 0, ax - (bx0 + span))
            dy = max(by0 - ay, 0, ay - (by0 + span))
            if dx * dx + dy * dy <= anchor_buf * anchor_buf:
                return True
        return False
    return keep


def blend_shell(shell_dm, core64_dm):
    """The only blend in the pipeline. Inside the core the shell is replaced by the core's own
    64 m decimation; outside it, the difference is carried outward by nearest-edge replication and
    ramped to zero over BLEND_RAMP samples (512 m), so level 0 and level 1 agree to the decimetre
    at the core boundary — which is the only place a level-0 tile is ever drawn next to one."""
    ox = (geom.CORE['x0'] - geom.SHELL['x0']) // geom.SHELL_RES
    oy = (geom.SHELL['y1'] - geom.CORE['y1']) // geom.SHELL_RES
    ny_c, nx_c = core64_dm.shape
    ny_s, nx_s = shell_dm.shape
    base = shell_dm.astype(np.float64)
    delta = core64_dm.astype(np.float64) - base[oy:oy + ny_c, ox:ox + nx_c]
    rr = np.arange(ny_s)[:, None] - oy
    cc = np.arange(nx_s)[None, :] - ox
    src_r = np.clip(rr, 0, ny_c - 1)
    src_c = np.clip(cc, 0, nx_c - 1)
    dist = np.maximum(np.maximum(0 - rr, rr - (ny_c - 1)),
                      np.maximum(0 - cc, cc - (nx_c - 1)))
    ramp = np.clip(1.0 - np.maximum(dist, 0) / (geom.BLEND_RAMP + 1.0), 0.0, 1.0)
    out = np.rint(base + delta[src_r, src_c] * ramp).astype(np.int32)
    out[oy:oy + ny_c, ox:ox + nx_c] = core64_dm            # exact inside the core
    edge = np.concatenate([delta[0], delta[-1], delta[:, 0], delta[:, -1]])
    stats = {'maxM': float(np.abs(delta).max()) / 10.0,
             'rmsM': float(np.sqrt((delta ** 2).mean())) / 10.0,
             'edgeMaxM': float(np.abs(edge).max()) / 10.0,
             'edgeP95M': float(np.percentile(np.abs(edge), 95)) / 10.0,
             'edgeRmsM': float(np.sqrt((edge ** 2).mean())) / 10.0}
    return out, stats


def wgs84_block():
    """The projection parameters the app needs, plus checkpoints computed with pyproj so the app's
    own 30-line inverse can be checked against something authoritative at startup."""
    from pyproj import Transformer
    tr = Transformer.from_crs('EPSG:25833', 'EPSG:4326', always_xy=True)
    pts = [(geom.CORE['x0'], geom.CORE['y0']), (geom.CORE['x1'], geom.CORE['y0']),
           (geom.CORE['x0'], geom.CORE['y1']), (geom.CORE['x1'], geom.CORE['y1']),
           (geom.ORIGIN['x'], geom.ORIGIN['y']),
           (170927, 6833456), (161241, 6834048),
           (geom.SHELL['x0'], geom.SHELL['y0']), (geom.SHELL['x1'], geom.SHELL['y1'])]
    cps = []
    for x, y in pts:
        lon, lat = tr.transform(x, y)
        cps.append({'x': x, 'y': y, 'lon': round(lon, 7), 'lat': round(lat, 7)})
    return {
        'proj': 'utm', 'zone': 33, 'north': True, 'datum': 'ETRS89',
        'ellipsoid': {'a': 6378137.0, 'invF': 298.257222101},
        'k0': 0.9996, 'falseEasting': 500000.0, 'falseNorthing': 0.0,
        'note': 'ETRS89 is within about 0.5 m of WGS84 in Norway; irrelevant at this scale',
        'checkpoints': cps,
    }


def main():
    route = json.load(open(os.path.join(WORK, 'route2d.json'), encoding='utf-8'))
    route_xy = (np.array(route['x'], dtype=np.float64), np.array(route['y'], dtype=np.float64))

    print('  decimating the 2 m master')
    levels_dm = {}
    levels_dm[5] = open_master('core', geom.CORE, geom.MASTER_RES)
    l4_path = os.path.join(WORK, 'core_L4_4m.raw')
    l4 = np.memmap(l4_path, dtype=np.uint16, mode='w+', shape=geom.grid_shape(geom.CORE, 4))
    geom.halve_banded(levels_dm[5], l4)
    l4.flush()
    levels_dm[4] = l4
    for lv, res in ((3, 8), (2, 16), (1, 32)):
        dst = np.zeros(geom.grid_shape(geom.CORE, res), dtype=np.int32)
        geom.halve_banded(levels_dm[lv + 1], dst)
        levels_dm[lv] = dst
        print(f'    L{lv} {res:2d} m  {dst.shape[1]} x {dst.shape[0]} samples')
    core64 = np.zeros(geom.grid_shape(geom.CORE, 64), dtype=np.int32)
    geom.halve_banded(levels_dm[1], core64)

    print('  blending the shell onto the core at 64 m')
    shell = open_master('shell', geom.SHELL, geom.SHELL_RES)
    shell_dm, blend = blend_shell(shell, core64)
    print(f"    core minus service-64 m over the core: rms {blend['rmsM']:.2f} m, "
          f"max {blend['maxM']:.1f} m")
    print(f"    on the core boundary, where the join is actually seen: rms {blend['edgeRmsM']:.2f} m,"
          f" p95 {blend['edgeP95M']:.2f} m, max {blend['edgeMaxM']:.1f} m "
          f"(ramped to zero over {geom.BLEND_RAMP * geom.SHELL_RES} m)")

    print('  cutting tiles')
    levels_meta = []
    kept = {}
    lo_dm, hi_dm = 1 << 30, -(1 << 30)
    for lv, res, region, rbuf, abuf in geom.LEVELS:
        box = geom.SHELL if region == 'shell' else geom.CORE
        grid = shell_dm if lv == 0 else levels_dm[lv]
        base = keeper(route_xy, rbuf, abuf, box, res)
        parent = kept.get(lv - 1) if lv >= 3 else None

        def keep(tx, ty, base=base, parent=parent):
            if not base(tx, ty):
                return False
            return parent is None or (tx // 2, ty // 2) in parent
        name = f'terrain-L{lv}.bin'
        entries, nx, ny = geom.cut_tiles(grid, box, res, keep, os.path.join(DATA, name))
        kept[lv] = {(e['tx'], e['ty']) for e in entries}
        lo_dm = min(lo_dm, min(e['dmin'] for e in entries))
        hi_dm = max(hi_dm, max(e['dmax'] for e in entries))
        levels_meta.append({
            'level': lv, 'res': res, 'tileSpan': geom.CELLS * res, 'region': region,
            'file': name, 'bytes': len(entries) * geom.TILE_BYTES,
            'grid': {'x0': box['x0'], 'y0': box['y0'], 'nx': nx, 'ny': ny},
            'tiles': entries,
        })
        print(f'    L{lv} res {res:2d} m  {len(entries):5d}/{nx*ny:5d} tiles  '
              f'{len(entries)*geom.TILE_BYTES:10,d} B  -> {name}')

    core_lo = min(e['dmin'] for m in levels_meta if m['level'] >= 1 for e in m['tiles'])
    core_hi = max(e['dmax'] for m in levels_meta if m['level'] >= 1 for e in m['tiles'])
    total = sum(m['bytes'] for m in levels_meta)
    print(f'    {sum(len(m["tiles"]) for m in levels_meta)} tiles, {total:,} B total')

    manifest = {
        'format': 'besseggen-terrain/1',
        'generated': geom.GENERATED,
        'crs': 'EPSG:25833',
        'units': 'metres',
        'origin': geom.ORIGIN,
        'core': geom.CORE,
        'shell': geom.SHELL,
        'tile': {'cells': geom.CELLS, 'samples': geom.SAMPLES, 'bytes': geom.TILE_BYTES,
                 'dtype': 'uint16', 'endian': 'little',
                 'rowOrder': 'north-to-south', 'colOrder': 'west-to-east'},
        'quantisation': {
            'scheme': 'per-tile-linear', 'store': 'decimetres',
            'decode': 'z_metres = (dmin + round(q * (dmax - dmin) / 65535)) * 0.1',
            'note': 'round to the integer decimetre BEFORE dividing, or tiles that share an edge '
                    'disagree by up to half a decimetre'},
        # the whole model, level 0 included, so the shell's valleys and Glittertind are in it;
        # `core` is the detailed box on its own, which is what an elevation ramp should key off
        'elevation': {'minM': round(lo_dm / 10.0, 1), 'maxM': round(hi_dm / 10.0, 1),
                      'core': {'minM': round(core_lo / 10.0, 1),
                               'maxM': round(core_hi / 10.0, 1)}},
        'wgs84': wgs84_block(),
        'levels': levels_meta,
        'corridor': {
            'level3': {'routeBuffer': 4000, 'anchorBuffer': 4000},
            'level4': {'routeBuffer': 800, 'anchorBuffer': 1000},
            'level5': {'routeBuffer': 400, 'anchorBuffer': 600},
            'anchors': [[int(a), int(b)] for a, b in geom.ANCHORS],
        },
        'source': {
            'terrain': 'Nasjonal høydemodell DTM1 (1 m), © Kartverket, NLOD 2.0 / CC BY 4.0',
            'service': 'hoyde-dtm-nhm-25833 WCS / NHM_DTM_25833 ImageServer',
            'retrieved': geom.RETRIEVED,
            'resolutionM': 1,
            'masterResolutionM': geom.MASTER_RES,
            'shellBlend': {'rampM': geom.BLEND_RAMP * geom.SHELL_RES,
                           'coreBoundaryRmsM': round(blend['edgeRmsM'], 2),
                           'coreBoundaryMaxM': round(blend['edgeMaxM'], 1)},
            'projects': ['NDH Jotunheimen 4pkt 2017', 'NDH Jotunheimen 2pkt 2022',
                         'NDH Vågå-Lom-Skjåk 5pkt 2018', 'NDH Vågå-Lom-Skjåk 2pkt 2019',
                         'Jotunheimen isbre 2009'],
        },
    }
    path = os.path.join(DATA, 'manifest.json')
    geom.write_json(path, manifest, compact_keys=('tiles', 'checkpoints', 'anchors'))
    print(f'    manifest.json {os.path.getsize(path):,} B, '
          f'elevation {manifest["elevation"]["minM"]}..{manifest["elevation"]["maxM"]} m')

    # the flat analysis grids the app rebuilds from tiles are worth reporting on here
    np.save(os.path.join(WORK, 'core_L2_16m.npy'), levels_dm[2])
    np.save(os.path.join(WORK, 'core64.npy'), core64)
    np.save(os.path.join(WORK, 'shell_L0_64m.npy'), shell_dm)


if __name__ == '__main__':
    main()
