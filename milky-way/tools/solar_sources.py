"""Pinned sources and small shared helpers for the solar-system steps (10_ephemeris, 11_moons,
12_physical and verify_solar).

Every file here was located, downloaded and checked by the research pass; the pins below are the
sha256 of the whole file. The JPL kernels come from the USGS Astrogeology ISIS data area on S3,
a public mirror of NAIF's generic_kernels (the bucket is named in DOI-USGS/ISIS3
isis/config/rclone.conf). NAIF's own site is not reachable from the build container, so the text
PCKs come from the nyx-space/anise repository at a pinned commit; the same bytes are also in an
unrelated second repository (research note), and CSPICE reads them without complaint.
"""
import os

import common

S3_SPK = 'https://asc-isisdata.s3.amazonaws.com/usgs_data/base/kernels/spk/'

# name -> (url, cache name, sha256, bytes)
SPK = {
    'de430': (S3_SPK + 'de430.bsp', 'solar/de430.bsp',
              '6e1b277c5f07135a84950604b83e56b736be696a7f3560bcddb1d4aeb944fca1', 119741440),
    'mar097': (S3_SPK + 'mar097.bsp', 'solar/mar097.bsp',
               '18af4611f536b1bccc07be6bce304b47cf8a829536023972e90097b5cefd902c', 469902336),
    'jup310': (S3_SPK + 'jup310.bsp', 'solar/jup310.bsp',
               'ed64f05431a7da5486f9d00ecff3490213f871c247a293138a798d560fcfdebb', 1220766720),
    'sat425': (S3_SPK + 'sat425.bsp', 'solar/sat425.bsp',
               '2120505b93fe2c70f52a399f770a4e75dbb35fb44922ede48a18de71abb2d574', 254218240),
    'ura111': (S3_SPK + 'ura111.bsp', 'solar/ura111.bsp',
               '384647ab7fdc085eb573926a8db6326748518d4ad600d5ca6bdaa06f9c0d7bdc', 169928704),
    'nep081': (S3_SPK + 'nep081.bsp', 'solar/nep081.bsp',
               'a304baf7e6d853d41a44bea80ea0fb9a0a7e11239d057f618f683602fa8e49cb', 157869056),
}

ANISE = ('https://github.com/nyx-space/anise', 'a3aff9db1f6c92cd83d9fef70e8912993a4bff57')
PCK = ('data/pck00011.tpc', 'solar/pck00011.tpc',
       '3dff7b1dbeceaa01f25467767d3fa25816051c85d162d1edf04acb310ee28bb1')
GM = ('data/gm_de440.tpc', 'solar/gm_de440.tpc',
      '924ddf4fb9ead9fe8a1aa55780bcabde40b09d00065d58226e24b68d8092f140')

PYERFA_SDIST = ('https://files.pythonhosted.org/packages/71/39/'
                '63cc8291b0cf324ae710df41527faf7d331bce573899199d926b3e492260/pyerfa-2.0.1.5.tar.gz',
                'solar/pyerfa-2.0.1.5.tar.gz',
                '17d6b24fe4846c65d5e7d8c362dcb08199dc63b30a236aedd73875cc83e1f6c0', 818430)

ASTROPY = ('https://github.com/astropy/astropy', '8f2535d08a6e496134c6d3f63d5fcae67ded35dc')  # tag v7.1.0
ASTROPY_IAU2012 = ('astropy/constants/iau2012.py', 'solar/astropy-v7.1.0-iau2012.py',
                   '66b73e243bac684a661ea59862785e3834488f4916a95fbe51a01d1cffaeb061')

RMS_OOPS = ('https://github.com/SETI/rms-oops', '46b01e291102423df97a3a970abb4b9e3f312f4f')
RMS_OOPS_BODY = ('src/oops/body.py', 'solar/rms-oops-body.py',
                 'dc6b20924e69821bc8c6d4a5805f259ab07b0f4edbce388398511ab2427bd281')
RMS_OOPS_LICENSE = ('LICENSE.md', 'solar/rms-oops-LICENSE.md',
                    'd1ee81266b96305cdec883e60fad804aa1d04b4698dccb5942ca51816b10df57')

# The app's time ranges (TDB Julian dates).
PLANET_JD = (2415020.5, 2488069.5)     # 1900-01-01 .. 2100-01-01
MOON_JD = (2433282.5, 2469807.5)       # 1950-01-01 .. 2050-01-01, the span every satellite file covers


def spk_path(name):
    url, cache, sha, size = SPK[name]
    return common.fetch(url, cache, sha, size)


def pck_path():
    return common.git_file(ANISE[0], ANISE[1], PCK[0], PCK[1], PCK[2])


def gm_path():
    return common.git_file(ANISE[0], ANISE[1], GM[0], GM[1], GM[2])


def pyerfa_path():
    return common.fetch(*PYERFA_SDIST)


def astropy_iau2012_path():
    return common.git_file(ASTROPY[0], ASTROPY[1], *ASTROPY_IAU2012)


def rms_oops_body_path():
    return common.git_file(RMS_OOPS[0], RMS_OOPS[1], *RMS_OOPS_BODY)


def rms_oops_license_path():
    return common.git_file(RMS_OOPS[0], RMS_OOPS[1], *RMS_OOPS_LICENSE)


def load_kernel_pool():
    """Load pck00011 + gm_de440 into CSPICE's kernel pool (the toolkit's own text-kernel parser)."""
    import spiceypy as sp
    sp.kclear()
    sp.furnsh(pck_path())
    sp.furnsh(gm_path())
    return sp


def pool(sp, name):
    """A kernel-pool variable as a list of floats, or None when the kernel does not define it."""
    found = sp.expool(name)
    if not found:
        return None
    n = int(sp.dtpool(name)[0])
    return [float(v) for v in sp.gdpool(name, 0, n)]


def pole_unit_j2000(sp, bid):
    """Unit vector (ICRF) of body `bid`'s IAU north pole at J2000 TDB, full series, via CSPICE."""
    import numpy as np
    m = np.array(sp.tipbod('J2000', bid, 0.0))     # rows: ICRF -> body-fixed
    return m[2]


def fit_frame(sp, planet_id):
    """Rows: z = the planet's spin axis at J2000 (the IAU pole, reversed when the prime meridian
    runs backwards, as for Uranus, so that regular moons have inclinations near 0 and not near
    180 degrees, where the node is undefined), x = the ascending node of that equator on the ICRF
    equator, y = z cross x. ICRF vector -> fit-frame vector is F @ v."""
    import numpy as np
    z = pole_unit_j2000(sp, planet_id)
    if pool(sp, f'BODY{planet_id}_PM')[1] < 0:
        z = -z
    x = np.cross([0.0, 0.0, 1.0], z)
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    return np.array([x, y, z])


def rel(path):
    return os.path.relpath(path, os.path.dirname(os.path.abspath(__file__)))
