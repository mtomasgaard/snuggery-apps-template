"""A reader for classic NetCDF (CDF-1 and CDF-2, the formats GISTEMP's gridded file is written in),
standard library only, so the monthly refresh on a bare GitHub runner needs no netCDF4, HDF5 or
SciPy. Read-only, whole-variable or one record at a time; enough for GISTEMP, not a general library.

The format is the NetCDF Classic Format Specification (Unidata, "netcdf file format"): a big-endian
header (magic, numrecs, dimensions, global attributes, variables with their attributes, type, vsize
and begin offset), then the fixed-size variables, then the records. When exactly one variable has
the unlimited dimension, its records are packed without padding (the spec's special case).

    nc = NetCDF3(gzip.open(path).read())
    nc.dims        {'lat': 90, 'lon': 180, 'time': 1760, 'nv': 2}
    nc.vars['tempanomaly'].attrs  {'scale_factor': 0.01, '_FillValue': 32767, ...}
    nc.record('tempanomaly', 0)   raw int16 values of the first month, row-major (lat, lon)

Cross-checked against scipy.io.netcdf_file on the real file: warming-world/tools/RESEARCH.md §1.2.
"""
from __future__ import annotations

import struct

NC_TYPES = {1: ('b', 1), 2: ('c', 1), 3: ('h', 2), 4: ('i', 4), 5: ('f', 4), 6: ('d', 8)}
_DIM, _VAR, _ATT = 10, 11, 12


class Var:
    def __init__(self, name, dimids, attrs, nctype, vsize, begin):
        self.name, self.dimids, self.attrs = name, dimids, attrs
        self.nctype, self.vsize, self.begin = nctype, vsize, begin
        self.dims: tuple = ()
        self.shape: tuple = ()
        self.is_record = False

    @property
    def typecode(self):
        return NC_TYPES[self.nctype][0]

    @property
    def itemsize(self):
        return NC_TYPES[self.nctype][1]


class NetCDF3:
    def __init__(self, buf: bytes):
        self.buf = buf
        magic = buf[:4]
        if magic not in (b'CDF\x01', b'CDF\x02'):
            raise ValueError(f'not classic NetCDF (magic {magic!r}); NetCDF-4/HDF5 starts \\x89HDF')
        self.version = magic[3]
        self._o = 4
        self.numrecs = self._u32()
        dim_list = self._list(self._dim)
        self.dim_order = [n for n, _ in dim_list]
        self.dims = dict(dim_list)
        self.unlimited = next((n for n, s in dim_list if s == 0), None)
        if self.unlimited:
            self.dims[self.unlimited] = self.numrecs
        self.attrs = dict(self._list(self._att))
        self.vars = {v.name: v for v in self._list(self._var)}
        recvars = []
        for v in self.vars.values():
            v.dims = tuple(self.dim_order[i] for i in v.dimids)
            v.shape = tuple(self.dims[d] for d in v.dims)
            v.is_record = bool(v.dims) and v.dims[0] == self.unlimited
            if v.is_record:
                recvars.append(v)
        if len(recvars) == 1:
            v = recvars[0]
            n = 1
            for s in v.shape[1:]:
                n *= s
            self.recsize = n * v.itemsize            # the spec's special case: no padding
        else:
            self.recsize = sum(v.vsize for v in recvars)

    # -- header primitives ---------------------------------------------------------------
    def _u32(self):
        v = struct.unpack_from('>I', self.buf, self._o)[0]
        self._o += 4
        return v

    def _u64(self):
        v = struct.unpack_from('>Q', self.buf, self._o)[0]
        self._o += 8
        return v

    def _name(self):
        n = self._u32()
        s = self.buf[self._o:self._o + n].decode('utf-8')
        self._o += (n + 3) & ~3
        return s

    def _list(self, item):
        tag, n = self._u32(), self._u32()
        if tag == 0 and n == 0:
            return []
        return [item() for _ in range(n)]

    def _dim(self):
        return self._name(), self._u32()

    def _values(self, nctype, n):
        code, size = NC_TYPES[nctype]
        raw = self.buf[self._o:self._o + n * size]
        self._o += (n * size + 3) & ~3
        if code == 'c':
            return raw.rstrip(b'\x00').decode('utf-8', 'replace')
        vals = struct.unpack(f'>{n}{code}', raw)
        return vals[0] if n == 1 else list(vals)

    def _att(self):
        name = self._name()
        nctype, n = self._u32(), self._u32()
        return name, self._values(nctype, n)

    def _var(self):
        name = self._name()
        ndims = self._u32()
        dimids = [self._u32() for _ in range(ndims)]
        attrs = dict(self._list(self._att))
        nctype, vsize = self._u32(), self._u32()
        begin = self._u64() if self.version == 2 else self._u32()
        return Var(name, dimids, attrs, nctype, vsize, begin)

    # -- data ------------------------------------------------------------------------------
    def _unpack(self, v, offset, count):
        raw = self.buf[offset:offset + count * v.itemsize]
        if len(raw) != count * v.itemsize:
            raise ValueError(f'{v.name}: file truncated at byte {offset}')
        return struct.unpack(f'>{count}{v.typecode}', raw)

    def read(self, name):
        """A fixed-size variable, flat, in row-major order."""
        v = self.vars[name]
        if v.is_record:
            raise ValueError(f'{name} is a record variable; use record()')
        n = 1
        for s in v.shape:
            n *= s
        return self._unpack(v, v.begin, n)

    def record(self, name, r):
        """Record r (0-based along the unlimited dimension) of a record variable, flat."""
        v = self.vars[name]
        if not v.is_record:
            raise ValueError(f'{name} is not a record variable')
        if not 0 <= r < self.numrecs:
            raise IndexError(r)
        n = 1
        for s in v.shape[1:]:
            n *= s
        return self._unpack(v, v.begin + r * self.recsize, n)

    def frame(self, name, t):
        """Slice t along the first dimension, flat, whether that dimension is the unlimited one
        or a fixed one (GISTEMP writes `time` as a fixed dimension: numrecs is 0)."""
        v = self.vars[name]
        if v.is_record:
            return self.record(name, t)
        if not 0 <= t < v.shape[0]:
            raise IndexError(t)
        n = 1
        for s in v.shape[1:]:
            n *= s
        return self._unpack(v, v.begin + t * n * v.itemsize, n)
