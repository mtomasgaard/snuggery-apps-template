"""The frame maths of Warming World's snapshot: GISTEMP's grid and table read and checked against
their contract, annual and monthly frames, coverage, global means. warming-world/tools/CONTRACT.md
§1–§3 is the specification; every rule below names its paragraph.

Standard library only (gzip, struct through netcdf3.py, csv, math, datetime). Imported by
build_snapshot.py (the refresh) and nothing else: verify_snapshot.py recomputes the same frames
with code of its own, so the two routes can disagree.

    grid = read_grid(gz_bytes)            V1, the file's contract (CONTRACT §1.1); raises BuildError
    table = read_table(csv_bytes)         V2, GISS's global means (CONTRACT §1.2)
    year = annual_frame(grid, months, n)  one year's cells under the ≥ ⌈0.75 n⌉ rule (§3.6)
    month = month_frame(grid, t)          one month's cells, no rule
    stats(frame)                          coverage, beyond-scale counts, the area-weighted mean
"""
from __future__ import annotations

import csv
import datetime as dt
import gzip
import io
import math
import re

import netcdf3
from common import BuildError
from sources import GISTEMP

NX, NY = 180, 90
N = NX * NY                      # 16 200 cells, one byte each
FILL = 32767                     # _FillValue: no data
NONE = 255                       # the snapshot's no-data byte
OFFSET_TENTHS = 127              # byte b = tenths + 127, value = −12.7 + 0.1 b (CONTRACT §2)
MIN_MONTHS = 9                   # a complete year's cell needs 9 of 12 months (RESEARCH §1.4)
PARTIAL_MIN_MONTHS = 6           # the partial year is a step only with 6–11 published months (§1.5)
PARTIAL_SHARE = 0.75             # … and its cells need ⌈0.75 n⌉ of its n months
BEYOND = 40                      # ±4.0 °C in tenths: the map's scale (ramp.js); "beyond" is strict
MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
               'October', 'November', 'December']
EPOCH = dt.date(1800, 1, 1)

# Area weights: a 2° band's area is proportional to cos of its centre latitude, exactly (CONTRACT §2).
# Row j (north-first) has centre latitude 89 − 2j.
WEIGHT = [math.cos(math.radians(89 - 2 * j)) for j in range(NY)]
WEIGHT_ALL = NX * sum(WEIGHT)


def round_div(s: int, d: int) -> int:
    """s / d rounded half away from zero, on integers (d > 0). CONTRACT §3.6: 15 → 2 for d = 10,
    14 → 1, −15 → −2."""
    if d <= 0:
        raise ValueError(d)
    q = (2 * abs(s) + d) // (2 * d)
    return q if s >= 0 else -q


def min_months(n: int) -> int:
    """The cells' rule for a year with n months in the grid: 9 of 12, else ⌈0.75 n⌉ (6 of 7, 6 of 8,
    7 of 9, 8 of 10, 9 of 11). Integer arithmetic: ⌈3n/4⌉."""
    return MIN_MONTHS if n == 12 else -(-3 * n // 4)


def month_label(ym: str) -> str:
    y, m = ym.split('-')
    return f'{MONTH_NAMES[int(m) - 1]} {y}'


def cell_bounds(k: int) -> str:
    """The card's way of writing a cell (DESIGN §8): '64–66° N, 148–146° W'. Lat bounds ascending in
    absolute value; lon bounds from the cell's west edge to its east edge. No cell straddles 0° or
    the antimeridian: both are cell edges on this grid."""
    j, i = divmod(k, NX)
    top, bot = 90 - 2 * j, 88 - 2 * j
    if bot >= 0:
        lat = f'{bot}–{top}° N'
    else:
        lat = f'{-top}–{-bot}° S'
    west, east = -180 + 2 * i, -178 + 2 * i
    if west >= 0:
        lon = f'{west}–{east}° E'
    else:
        lon = f'{-west}–{-east}° W'
    return f'{lat}, {lon}'


# ---------------------------------------------------------------------------------------------
# the grid (V1)
# ---------------------------------------------------------------------------------------------

class Grid:
    """GISTEMP's gridded file, checked against sources.GISTEMP['contract'] (CONTRACT §1.1)."""

    def __init__(self, nc: netcdf3.NetCDF3, months: list[str], history: str, created: str):
        self.nc = nc
        self.months = months           # ['1880-01', …], one per time index
        self.history = history
        self.created = created         # '2026-08-10T06:37:42', as GISS wrote it, no zone
        self._cache: dict[int, tuple] = {}

    @property
    def newest(self) -> str:
        return self.months[-1]

    def source_frame(self, t: int) -> tuple:
        """Month t as GISS stores it: int16 hundredths, rows SOUTH first."""
        return self.nc.frame('tempanomaly', t)

    def frame(self, t: int) -> tuple:
        """Month t, rows flipped to NORTH first (snapshot row j = source row 89 − j), columns as
        they are. Kept for the 24 newest months' reuse; the annual pass reads each month once."""
        f = self._cache.get(t)
        if f is None:
            src = self.source_frame(t)
            out = []
            for j in range(NY):
                r = NY - 1 - j
                out.extend(src[r * NX:(r + 1) * NX])
            f = tuple(out)
        return f

    def keep(self, ts):
        """Cache the north-first frames of these months (the 24 newest are read twice)."""
        for t in ts:
            if t not in self._cache:
                self._cache[t] = self.frame(t)


def _month_of(days: int) -> str:
    d = EPOCH + dt.timedelta(days=days)
    return f'{d.year:04d}-{d.month:02d}'


def _next_month(ym: str) -> str:
    y, m = int(ym[:4]), int(ym[5:7])
    return f'{y + (m == 12):04d}-{m % 12 + 1:02d}'


def read_grid(gz: bytes) -> Grid:
    """Gunzip (gzip checks its CRC: a truncated or spliced download fails here), parse, and check
    every row of CONTRACT §1.1. Raises BuildError naming the item."""
    c = GISTEMP['contract']
    try:
        raw = gzip.decompress(gz)
    except (OSError, EOFError) as e:
        raise BuildError(f'V1 the grid is not a complete gzip file: {e}')
    if raw[:4] != c['magic']:
        raise BuildError(f'V1 magic {raw[:4]!r}, expected {c["magic"]!r} (classic NetCDF CDF-1)')
    nc = netcdf3.NetCDF3(raw)
    for d, n in c['dims'].items():
        if nc.dims.get(d) != n:
            raise BuildError(f'V1 dimension {d} is {nc.dims.get(d)}, expected {n}')
    if nc.dims.get('time', 0) < 1:
        raise BuildError('V1 no time dimension')
    v = nc.vars.get(c['variable'])
    if v is None:
        raise BuildError(f'V1 no variable {c["variable"]}; variables: {sorted(nc.vars)}')
    if v.dims != c['dims_of_variable']:
        raise BuildError(f'V1 {c["variable"]} dims {v.dims}, expected {c["dims_of_variable"]}')
    if v.typecode != c['type']:
        raise BuildError(f'V1 {c["variable"]} type {v.typecode}, expected {c["type"]} (int16)')
    sf = v.attrs.get('scale_factor')
    if not isinstance(sf, float) or abs(sf - c['scale_factor']) > 1e-9:
        raise BuildError(f'V1 scale_factor {sf!r}, expected float32 0.01')
    if v.attrs.get('_FillValue') != c['fill']:
        raise BuildError(f'V1 _FillValue {v.attrs.get("_FillValue")!r}, expected {c["fill"]}')
    if v.attrs.get('units') != c['units']:
        raise BuildError(f'V1 units {v.attrs.get("units")!r}, expected {c["units"]!r}')
    for name, (first, step) in (('lat', c['lat']), ('lon', c['lon'])):
        vals = nc.read(name)
        want = [first + step * i for i in range(len(vals))]
        if any(abs(a - b) > 1e-4 for a, b in zip(vals, want)):
            raise BuildError(f'V1 {name} is not {first}, {first + step}, … (got {vals[:3]} …)')
    if nc.vars['time'].attrs.get('units') != c['time_units']:
        raise BuildError(f'V1 time units {nc.vars["time"].attrs.get("units")!r}, expected {c["time_units"]!r}')
    times = nc.read('time')
    if len(times) != nc.dims['time']:
        raise BuildError('V1 the time variable does not match its dimension')
    months = [_month_of(int(t)) for t in times]
    if months[0] != c['first_month']:
        raise BuildError(f'V1 the first month is {months[0]}, expected {c["first_month"]}')
    for a, b in zip(months, months[1:]):
        if b != _next_month(a):
            raise BuildError(f'V1 the time axis jumps from {a} to {b}')
    history = re.sub(r'[\x00-\x1f\x7f]', '', str(nc.attrs.get('history', '')))
    for part in c['history_has']:
        if part not in history:
            raise BuildError(f'V1 history lacks {part!r}: {history!r}')
    m = re.search(r'Created (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})', history)
    if not m:
        raise BuildError(f'V1 history has no "Created YYYY-MM-DD HH:MM:SS": {history!r}')
    return Grid(nc, months, history, f'{m.group(1)}T{m.group(2)}')


# ---------------------------------------------------------------------------------------------
# GISS's table (V2)
# ---------------------------------------------------------------------------------------------

TABLE_HEADER = ['Year', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov',
                'Dec', 'J-D', 'D-N', 'DJF', 'MAM', 'JJA', 'SON']


def _hundredths(s: str) -> int | None:
    s = s.strip()
    if s == '***':
        return None
    if not re.fullmatch(r'-?\d*\.\d{1,2}|-?\d+', s):
        raise BuildError(f'V2 table value {s!r} is not a decimal with at most two places')
    x = float(s) * 100
    h = round(x)
    if abs(x - h) > 1e-6:
        raise BuildError(f'V2 table value {s!r} is not a whole number of hundredths')
    return h


class Table:
    def __init__(self, months: dict[int, list], jd: dict[int, int | None]):
        self.months = months           # year -> 12 hundredths or None
        self.jd = jd                   # year -> J-D hundredths or None

    @property
    def newest(self) -> str:
        y = max(self.months)
        n = sum(v is not None for v in self.months[y])
        return f'{y:04d}-{n:02d}'

    def month(self, ym: str) -> int | None:
        return self.months.get(int(ym[:4]), [None] * 12)[int(ym[5:7]) - 1]


def read_table(body: bytes) -> Table:
    """GLB.Ts+dSST.csv, CONTRACT §1.2 and V2."""
    text = body.decode('utf-8')
    rows = list(csv.reader(io.StringIO(text)))
    if not rows or 'Global Means' not in rows[0][0]:
        raise BuildError(f'V2 line 1 is {rows[0] if rows else None!r}, expected the title "Land-Ocean: Global Means"')
    if [h.strip() for h in rows[1]] != TABLE_HEADER:
        raise BuildError(f'V2 header {rows[1]!r}')
    months, jd = {}, {}
    body_rows = [r for r in rows[2:] if r and r[0].strip()]
    for i, r in enumerate(body_rows):
        if len(r) != len(TABLE_HEADER):
            raise BuildError(f'V2 row {r[0]!r} has {len(r)} fields')
        y = int(r[0])
        if y != 1880 + i:
            raise BuildError(f'V2 years are not contiguous from 1880: row {i} is {y}')
        ms = [_hundredths(v) for v in r[1:13]]
        n = sum(v is not None for v in ms)
        if any(v is None for v in ms[:n]) or any(v is not None for v in ms[n:]):
            raise BuildError(f'V2 {y}: missing months are not all after the published ones: {r[1:13]}')
        months[y] = ms
        jd[y] = _hundredths(r[13])
    years = sorted(months)
    for y in years[:-1]:
        if any(v is None for v in months[y]) or jd[y] is None:
            raise BuildError(f'V2 {y} is not the newest year but lacks months or J-D')
    last = years[-1]
    if any(v is None for v in months[last]) and jd[last] is not None:
        raise BuildError(f'V2 {last} is partial but has a J-D value')
    return Table(months, jd)


# ---------------------------------------------------------------------------------------------
# frames
# ---------------------------------------------------------------------------------------------

class Frame:
    """One step's cells. `tenths[k]` is the rounded value (int) or None; `mean[k]` the unrounded
    mean in hundredths (float) or None, for gridMean."""
    __slots__ = ('tenths', 'mean')

    def __init__(self, tenths, mean):
        self.tenths = tenths
        self.mean = mean

    def bytes(self) -> bytes:
        out = bytearray(N)
        for k, q in enumerate(self.tenths):
            if q is None:
                out[k] = NONE
            else:
                if not -127 <= q <= 127:
                    raise BuildError(f'V5 a value of {q / 10:+.1f} °C is outside the encoding\'s ±12.7 °C; never clamped')
                out[k] = q + OFFSET_TENTHS
        return bytes(out)


def annual_frame(frames: list[tuple], need: int) -> Frame:
    """CONTRACT §3.6: over the year's months, c = valid months and s = their sum (hundredths); a
    cell has a value when c ≥ need, and the value is round_div(s, 10c) tenths."""
    tenths, mean = [None] * N, [None] * N
    for k, vals in enumerate(zip(*frames)):
        vs = [v for v in vals if v != FILL]
        c = len(vs)
        if c >= need:
            s = sum(vs)
            tenths[k] = round_div(s, 10 * c)
            mean[k] = s / c
    return Frame(tenths, mean)


def month_frame(frame: tuple) -> Frame:
    tenths, mean = [None] * N, [None] * N
    for k, h in enumerate(frame):
        if h != FILL:
            tenths[k] = round_div(h, 10)
            mean[k] = float(h)
    return Frame(tenths, mean)


def stats(f: Frame) -> dict:
    """coverage (area and cells), beyondScale, the unrounded area-weighted mean (°C), the warmest and
    coldest cells by their shown tenths (ties: first in row-major). The pole means are the app's, from
    the shown tenths: build_snapshot.cap_mean."""
    w_have = 0.0
    wsum = 0.0
    cells = 0
    above = below = 0
    hi = lo = None
    for k, q in enumerate(f.tenths):
        if q is None:
            continue
        j = k // NX
        w = WEIGHT[j]
        cells += 1
        w_have += w
        wsum += w * f.mean[k]
        if q > BEYOND:
            above += 1
        elif q < -BEYOND:
            below += 1
        if hi is None or q > f.tenths[hi]:
            hi = k
        if lo is None or q < f.tenths[lo]:
            lo = k
    return {
        'area': w_have / WEIGHT_ALL,
        'cells': cells,
        'cellShare': cells / N,
        'above': above, 'below': below,
        'mean': (wsum / w_have / 100) if w_have else None,
        'hi': hi, 'lo': lo,
    }
