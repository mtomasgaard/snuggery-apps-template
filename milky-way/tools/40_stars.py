#!/usr/bin/env python3
"""Step 40 — stars: the deep star cloud, the named stars, constellation figures, exoplanet hosts.

Writes (format: CONTRACT.md section 7)
    data/stars/deep.bin, deep.json    AT-HYG stars within 500 pc whose parallax is good to 10 %,
                                      8 bytes each, minus every star in named.json
    data/stars/colour.json            the colour lookup table (effective temperature -> sRGB)
    data/stars/named.json             naked-eye stars, everything within 20 pc, exoplanet hosts
                                      within 100 pc, IAU-named stars and constellation-figure stars
    data/stars/constellations.json    IAU / Sky & Telescope figures as row pairs into named.json
    data/stars/exoplanets.json        confirmed planets per named row (Open Exoplanet Catalogue)
    tools/credits/stars.json          the credits fragment

Sources (every one pinned by sha256, or for the OEC git tree by its tree id plus a sha256 of the
canonical file listing):
    AT-HYG v3.2 (astronexus, CC BY-SA 4.0): the m10 subset (V/VT <= 10 plus everything within
        100 ly) and the hyg_ids subset (every AT-HYG star linked to HYG, for joins only).
    HYG v4.1 (astronexus, CC BY-SA 4.0): Gliese companions and white dwarfs AT-HYG drops, spectral
        types and B-V that AT-HYG lost for Gliese-linked rows.
    Stellarium v26.2 hip_gaia3 catalogues 0-3: per-star parallax and parallax error, used at build
        time only to decide whether a star's shipped distance is good. No Stellarium value is
        shipped (the files carry no data licence of their own; see credits).
    Stellarium v26.2 modern_iau sky culture (CC BY-SA 4.0): constellation figures, IAU star names.
    Open Exoplanet Catalogue (MIT), git commit 77ab8690: confirmed planets and their hosts.
    E. Mamajek's dwarf colour/Teff table v2022.04.16 (from the MeanStars 3.6.1 wheel) and the
        Ballesteros (2012) B-V -> Teff relation (coefficients read from PyAstronomy 0.25.0).
    CIE 1931 2-degree colour-matching functions and the IEC 61966-2-1 sRGB matrix, from the pinned
        colour-science package in the venv (source file and data array hashed and checked).

Decisions that change what ships (all counted and printed; see CONTRACT.md section 7):
  * A distance is "good" when a per-star parallax error applies to it: the star was joined to
    Stellarium by its Gaia DR3 id and AT-HYG's distance is Gaia DR3, or Stellarium's independent
    parallax agrees with AT-HYG's distance within 3 sigma. Then parallax/error decides the flags.
    No RUWE cut (it throws out Sirius B, eps Eri and UV/BL Cet).
  * Named rows keep AT-HYG's distance source honestly: Gaia DR3, Gaia DR2, Hipparcos 2007, Gliese
    1991 or the Open Exoplanet Catalogue.
  * White dwarfs: spectral type matching ^D[ABCOQZX] (a bare ^D also catches 'DELTA DEL').
  * HIP 55203 (xi UMa, deleted from HYG in v3.5 but still used by Stellarium's figure for UMa) is
    mapped to HYG's xi UMa A row.
  * OEC hosts that no identifier joins are matched by position (<= 30 arcsec, distance within 5 %,
    same component letter) or else placed from OEC's own coordinates and distance.
  * No extinction correction anywhere: absolute magnitudes are V + 5 - 5 log10(d).
"""
import hashlib
import io
import json
import math
import os
import re
import subprocess
import sys
import tarfile
import warnings
import xml.etree.ElementTree as ET
import zipfile

import numpy as np
import pyarrow as pa
import pyarrow.csv as pacsv

from common import RETRIEVED, fetch, git_file, sha256_of, write_bin, write_json
from paths import CACHE, DATA, SEED, TOOLS

# --------------------------------------------------------------------------------------------
# Pinned sources
# --------------------------------------------------------------------------------------------
ATHYG_REPO = 'https://github.com/astronexus/ATHYG-Database'
ATHYG_COMMIT = '650346e2bc57f664eb411bc5f44ffd94b8006af2'
HYG_REPO = 'https://github.com/astronexus/HYG-Database'
HYG_COMMIT = 'c7f7f883fe678cc7680169a50ccd7dcc49b060ce'
STEL_REPO = 'https://github.com/Stellarium/stellarium'
STEL_COMMIT = '2b10b1a3bb534eb4e7586751054bf67b36c22e53'           # tag v26.2
OEC_REPO = 'https://github.com/OpenExoplanetCatalogue/open_exoplanet_catalogue.git'
OEC_COMMIT = '77ab86906b5b9cade8ebff60bef6aff3dfee3206'
OEC_SYSTEMS_TREE = 'bf4eae34598b941edbdc77396eb028bb83d6d293'      # git tree id of systems/
OEC_SYSTEMS_SHA256 = '370ce48f2851f2dff7556ed7ee8a4c9c9064f56d969471c2b868e4d5b436e44a'
OEC_README_SHA256 = 'a7470a832cad51bc98a2fc9bd6935284e097d345bb9eec038975ad32484be6b0'

GIT_FILES = {   # key: (repo, commit, path, cache name, sha256)
    'athyg_m10': (ATHYG_REPO, ATHYG_COMMIT, 'data/subsets/athyg_32_reduced_m10.csv.gz',
                  'stars/athyg_32_reduced_m10.csv.gz',
                  '1047d395fcd6a2298ededaf5815fbd53448d178fd3d4fcb1f98f95072f63ea4f'),
    'athyg_hygids': (ATHYG_REPO, ATHYG_COMMIT, 'data/subsets/athyg_32_hyg_ids.csv.gz',
                     'stars/athyg_32_hyg_ids.csv.gz',
                     'd1dd88f8dd46efffc4ee8a971313ae660f70f876ca54de1c58b9e21878dde372'),
    'athyg_license': (ATHYG_REPO, ATHYG_COMMIT, 'LICENSE', 'stars/athyg_LICENSE',
                      'f404190403d31e0ce7223f4cb7af954485ad88077358330754dc5c892a856627'),
    'athyg_ack': (ATHYG_REPO, ATHYG_COMMIT, 'ACKNOWLEDGMENTS.md', 'stars/athyg_ACKNOWLEDGMENTS.md',
                  '595d3f36dec582247b237448035e8aa4c9c8ab7b022912831338990846e84abb'),
    'athyg_v1builds': (ATHYG_REPO, ATHYG_COMMIT, 'data/details/v1_builds.md',
                       'stars/athyg_v1_builds.md',
                       '51ff6109cf4e71fd3a7447d2ff8acbd66af435a6c2a43b2aea890d77b297dab2'),
    'hyg': (HYG_REPO, HYG_COMMIT, 'hyg/CURRENT/hygdata_v41.csv', 'stars/hygdata_v41.csv',
            'd9f69fd86bbf90a4e4d52b4c5c53eacfa6dfc0bfdef85bfd94f095e0bebe4ebd'),
    'hyg_license': (HYG_REPO, HYG_COMMIT, 'hyg/CURRENT/LICENSE', 'stars/hyg_LICENSE',
                    'f404190403d31e0ce7223f4cb7af954485ad88077358330754dc5c892a856627'),
    'hyg_versioninfo': (HYG_REPO, HYG_COMMIT, 'hyg/version-info.md', 'stars/hyg_version-info.md',
                        'b7c87b3730b2f225793f5835e9afab8e548ae9dc04969a671eb43b1ef90bb394'),
    'stel0': (STEL_REPO, STEL_COMMIT, 'stars/hip_gaia3/stars_0_0v0_21.cat',
              'stars/stellarium/stars_0_0v0_21.cat',
              '2c9c1f9362ccdced4ed69fcbba2b5bfa175ffd51fda712ad18541724f9f34b69'),
    'stel1': (STEL_REPO, STEL_COMMIT, 'stars/hip_gaia3/stars_1_0v0_16.cat',
              'stars/stellarium/stars_1_0v0_16.cat',
              '61c906d7cf9f012f039d9cd8ff781522d353ca9610a2830ada5e3e811ee0a8bb'),
    'stel2': (STEL_REPO, STEL_COMMIT, 'stars/hip_gaia3/stars_2_0v0_17.cat',
              'stars/stellarium/stars_2_0v0_17.cat',
              'c1f417eebb535781fac60fa065c91857c87bb17599f92ed623dd52afcc0aecac'),
    'stel3': (STEL_REPO, STEL_COMMIT, 'stars/hip_gaia3/stars_3_0v0_10.cat',
              'stars/stellarium/stars_3_0v0_10.cat',
              '8c4c969e081f3e454e4f0245d2d7d9cdcfa0211c87a87fe26cd57c186fc93fe5'),
    'stel_copying': (STEL_REPO, STEL_COMMIT, 'COPYING', 'stars/stellarium/COPYING',
                     '3aeeb5bb98bf7041ab82cffe15efa28ac58ee2bdf162b71301f5c192be631259'),
    'iau_index': (STEL_REPO, STEL_COMMIT, 'skycultures/modern_iau/index.json',
                  'stars/stellarium/modern_iau_index.json',
                  '2b7aa4fa2860566ea68aca0c0b087ba815aea38a92d1bb9b3c04b6c0758f726b'),
    'iau_description': (STEL_REPO, STEL_COMMIT, 'skycultures/modern_iau/description.md',
                        'stars/stellarium/modern_iau_description.md',
                        '0f762dca0920fc84e35433b21c3c91b5a19a46579ca48ed362e0ba4f5804897c'),
}

WHEELS = {   # key: (url, cache name, sha256, member, member sha256)
    'pyastronomy': (
        'https://files.pythonhosted.org/packages/f8/3b/6ab024c988306bc86523dfd02cfa53e1f364abd100054d5954eae23c45fe/pyastronomy-0.25.0-py3-none-any.whl',
        'stars/pyastronomy-0.25.0-py3-none-any.whl',
        '8763000b240fdb55d5f61df9551fd1476f7c8fde5a811bdfd30ed9c9fbe6fbbe',
        'PyAstronomy/pyasl/asl/aslExt_1/ballesterosBV_T.py',
        '262a9bda39417bf2d6007e0e21d549efcc43d73f60634cdad972d8bd14dbd12a'),
    'meanstars': (
        'https://files.pythonhosted.org/packages/f2/0e/abdbf1733e84ad7a3afe53fbfd52d3cf001982f1c129e8ba601876d99b17/meanstars-3.6.1-py3-none-any.whl',
        'stars/meanstars-3.6.1-py3-none-any.whl',
        'ed740c346dcb522742d16eed00c8cd3a14df9157b0d6f7d5cf2bb9ef9538ff67',
        'MeanStars/EEM_dwarf_UBVIJHK_colors_Teff.txt',
        '5a6e5baa6e1e5bca570cb73e5ffdb8c6b2b28158908d13729cd3fec00b99b510'),
}

# colour-science (pinned in requirements.txt) supplies the CIE 1931 2-degree CMFs. Both the source
# file that tabulates them and the loaded 360-830 nm array are checked, so a different package
# version cannot change the colours silently.
CMFS_SOURCE_SHA256 = 'a53076b9e6be4843443067986c925898d40a3c32c4eef9cb32ff08ca42e6493d'
CMFS_ARRAY_SHA256 = 'e43a1d4390949c7d426088cd5d50e2547f020609e5566c368196ba1d1d3ae543'

# --------------------------------------------------------------------------------------------
# Selection constants
# --------------------------------------------------------------------------------------------
DEEP_MAX_PC = 500.0
DEEP_MIN_POE = 10.0
NAMED_VMAG = 6.5
NEAR_PC = 20.0
HOST_PC = 100.0
POE_FAIR = 5.0                 # 5 < parallax/error <= 10 -> flag bit 3; <= 5 -> not placed
AGREE_SIGMA = 3.0              # Stellarium parallax must agree with the shipped distance this well
STEL_PLX_QUANT = 0.02          # Stellarium stores parallax in 0.02 mas steps (half a step: 0.01)
POS_MATCH_ARCSEC = 30.0        # OEC positional fallback
POS_MATCH_DIST_FRAC = 0.05
POS_SCALE = 64                 # deep.bin: int16 = pc * 64
LUT_TMIN, LUT_TMAX, LUT_N = 500.0, 50000.0, 255   # entries 0..254; 255 = no colour measurement
UNKNOWN_COLOUR = 255

# Flag bits in named.json
F_HOST, F_WD, F_COMPANION, F_POE_FAIR, F_UNPLACED, F_IAU, F_ERR_UNKNOWN = (1 << b for b in range(7))

DIST_SRC_LABELS = ['none', 'Gaia DR3', 'Gaia DR2', 'Hipparcos 2007', 'Gliese 1991',
                   'Open Exoplanet Catalogue']
DS_NONE, DS_G3, DS_G2, DS_HIP, DS_GJ, DS_OEC = range(6)
ATHYG_DS = {'G_R3': DS_G3, 'G_R2': DS_G2, 'HIP': DS_HIP, 'GJ': DS_GJ, 'N': DS_NONE}

# quality of a shipped distance
Q_NONE, Q_BAD, Q_FAIR, Q_GOOD, Q_UNKNOWN = range(5)

TEFF_SRC_LABELS = ['none', 'B-V via Ballesteros 2012 (model)', 'BT-VT via Mamajek table',
                   'spectral type via Mamajek table', 'Open Exoplanet Catalogue Teff',
                   'BT-VT beyond the Mamajek table, clamped to its reddest entry']

WD_RE = re.compile(r'^D[ABCOQZX]')
GREEK = {'Alp': 'α', 'Bet': 'β', 'Gam': 'γ', 'Del': 'δ', 'Eps': 'ε', 'Zet': 'ζ', 'Eta': 'η',
         'The': 'θ', 'Iot': 'ι', 'Kap': 'κ', 'Lam': 'λ', 'Mu': 'μ', 'Nu': 'ν', 'Xi': 'ξ',
         'Omi': 'ο', 'Pi': 'π', 'Rho': 'ρ', 'Sig': 'σ', 'Tau': 'τ', 'Ups': 'υ', 'Phi': 'φ',
         'Chi': 'χ', 'Psi': 'ψ', 'Ome': 'ω'}
SUPERSCRIPT = str.maketrans('0123456789', '⁰¹²³⁴⁵⁶⁷⁸⁹')

report = {}          # measured numbers, printed at the end and reused in the credits


def log(*a):
    print(*a, flush=True)


# --------------------------------------------------------------------------------------------
# Loading
# --------------------------------------------------------------------------------------------
def src_path(key):
    repo, commit, path, name, sha = GIT_FILES[key]
    return git_file(repo, commit, path, name, sha)


def wheel_member(key):
    url, name, sha, member, msha = WHEELS[key]
    p = fetch(url, name, sha)
    with zipfile.ZipFile(p) as z:
        b = z.read(member)
    got = hashlib.sha256(b).hexdigest()
    if got != msha:
        sys.exit(f'{member} in {name}: sha256 {got} does not match the pin {msha}')
    return b


def read_csv(path, strings, ints=()):
    """CSV -> dict of numpy arrays. `strings` stay str ('' for empty), `ints` int64, the rest f64."""
    tbl = pacsv.read_csv(path, convert_options=pacsv.ConvertOptions(
        column_types={**{c: pa.string() for c in strings}, **{c: pa.int64() for c in ints}},
        strings_can_be_null=False))
    out = {}
    for c in tbl.column_names:
        col = tbl[c]
        if c in strings:
            out[c] = np.array(col.to_pylist(), dtype=object)
        elif c in ints:
            out[c] = col.to_numpy()
        else:
            out[c] = col.cast(pa.float64()).to_numpy(zero_copy_only=False)
    return out


ATHYG_STR = ['tyc', 'gaia', 'hyg', 'hip', 'hd', 'hr', 'gl', 'bayer', 'flam', 'con', 'proper',
             'pos_src', 'dist_src', 'mag_src', 'rv_src', 'pm_src', 'spect', 'spect_src']
HYG_STR = ['hip', 'hd', 'hr', 'gl', 'bf', 'proper', 'spect', 'bayer', 'flam', 'con', 'base', 'var']


def load_athyg():
    m10 = read_csv(src_path('athyg_m10'), ATHYG_STR, ints=['id'])
    ext = read_csv(src_path('athyg_hygids'), ATHYG_STR, ints=['id'])
    in_m10 = set(m10['id'].tolist())
    extra = np.array([i for i, x in enumerate(ext['id']) if x not in in_m10], dtype=np.int64)
    u = {c: np.concatenate([m10[c], ext[c][extra]]) for c in m10}
    u['in_m10'] = np.concatenate([np.ones(len(m10['id']), bool), np.zeros(len(extra), bool)])
    keep = u['dist_src'] != 'OTHER'            # Sol
    u = {c: v[keep] for c, v in u.items()}
    report['athyg_m10_rows'] = int(len(m10['id']))
    report['athyg_hygids_extra_rows'] = int(len(extra))
    log(f'  AT-HYG: {len(m10["id"])} m10 rows + {len(extra)} HYG-linked rows outside m10 '
        f'(joins only); Sol dropped')
    return u


def load_hyg():
    h = read_csv(src_path('hyg'), HYG_STR, ints=['id', 'comp', 'comp_primary'])
    keep = h['id'] != 0                        # Sol
    return {c: v[keep] for c, v in h.items()}


STEL_DT = np.dtype([('gaia', '<i8'), ('x0', '<i4'), ('x1', '<i4'), ('x2', '<i4'),
                    ('dx0', '<i4'), ('dx1', '<i4'), ('dx2', '<i4'), ('b_v', '<i2'),
                    ('vmag', '<i2'), ('plx', '<u2'), ('plx_err', '<u2'), ('rv', '<i2'),
                    ('sp', '<u2'), ('otype', 'u1'), ('hip', 'u1', (3,))])


def load_stellarium():
    """Stellarium hip_gaia3 'Star1' records (Star.hpp, 48 bytes; header 6 x uint32 + float epoch,
    then 20*4^level+1 zone counts). Only Gaia id, HIP id + component, parallax and its error are
    kept; nothing from here is shipped."""
    assert STEL_DT.itemsize == 48
    parts = []
    for k in ('stel0', 'stel1', 'stel2', 'stel3'):
        b = open(src_path(k), 'rb').read()
        magic, typ, _maj, _min, level, _mag = np.frombuffer(b[:24], '<u4')
        assert magic == 0x835f040a and typ == 0, (k, hex(magic), typ)
        nz = 20 * 4 ** int(level) + 1
        n = int(np.frombuffer(b[28:28 + 4 * nz], '<u4').sum())
        off = 28 + 4 * nz
        assert off + 48 * n == len(b), k
        parts.append(np.frombuffer(b[off:], STEL_DT))
    s = np.concatenate(parts)
    hc = (s['hip'][:, 0].astype(np.uint32) | (s['hip'][:, 1].astype(np.uint32) << 8)
          | (s['hip'][:, 2].astype(np.uint32) << 16))
    st = {'gaia': s['gaia'].astype(np.int64), 'hip': (hc >> 5).astype(np.int64),
          'comp': (hc & 31).astype(np.int64), 'plx': s['plx'] * 0.02, 'pe': s['plx_err'] * 0.01}
    report['stellarium_rows'] = int(len(s))
    log(f'  Stellarium hip_gaia3 0-3: {len(s)} records (build-time parallax errors only)')
    return st


def oec_systems():
    """The OEC systems/ folder at the pinned commit, as {filename: bytes}. Fetched with git
    (from a MILKYWAY_SEED clone when one holds the commit, else from GitHub), then verified twice:
    the git tree id of systems/ and a sha256 over the sorted (path, length, bytes) listing."""
    gitdir = os.path.join(CACHE, 'stars', 'oec.git')

    def git(*args):
        return subprocess.run(['git', f'--git-dir={gitdir}', *args], check=True,
                              capture_output=True).stdout

    def has_commit(gd):
        return subprocess.run(['git', f'--git-dir={gd}', 'cat-file', '-e', OEC_COMMIT + '^{commit}'],
                              capture_output=True).returncode == 0

    if not (os.path.isdir(gitdir) and has_commit(gitdir)):
        os.makedirs(os.path.dirname(gitdir), exist_ok=True)
        subprocess.run(['git', 'init', '--bare', '-q', gitdir], check=True)
        src = OEC_REPO
        if SEED and os.path.isdir(SEED):
            for dp, dn, _fn in sorted(os.walk(SEED)):
                dn.sort()
                if '.git' in dn and has_commit(os.path.join(dp, '.git')):
                    src = dp
                    break
        log(f'  git fetch OEC {OEC_COMMIT[:12]} from {"seed " + src if src != OEC_REPO else src}')
        git('fetch', '--depth', '1', '-q', src, OEC_COMMIT)
    tree = git('rev-parse', f'{OEC_COMMIT}:systems').decode().strip()
    if tree != OEC_SYSTEMS_TREE:
        sys.exit(f'OEC systems/ tree {tree} does not match the pin {OEC_SYSTEMS_TREE}')
    tar = git('archive', '--format=tar', OEC_COMMIT, 'systems')
    files = {}
    with tarfile.open(fileobj=io.BytesIO(tar)) as tf:
        for m in tf.getmembers():
            if m.isfile():
                files[m.name] = tf.extractfile(m).read()
    h = hashlib.sha256()
    for k in sorted(files):
        h.update(k.encode() + b'\0' + str(len(files[k])).encode() + b'\0' + files[k])
    if h.hexdigest() != OEC_SYSTEMS_SHA256:
        sys.exit(f'OEC systems/ listing sha256 {h.hexdigest()} does not match the pin')
    readme = git('show', f'{OEC_COMMIT}:README.md')
    if hashlib.sha256(readme).hexdigest() != OEC_README_SHA256:
        sys.exit('OEC README.md does not match its pin')
    report['oec_files'] = len(files)
    return files


# --------------------------------------------------------------------------------------------
# Colour: Teff -> sRGB table, and colour index / spectral type -> Teff
# --------------------------------------------------------------------------------------------
def colour_lut():
    warnings.filterwarnings('ignore')          # colour-science warns about missing matplotlib
    import colour
    import colour.colorimetry.datasets.cmfs as cmfs_mod
    import scipy.constants as sc
    if sha256_of(cmfs_mod.__file__) != CMFS_SOURCE_SHA256:
        sys.exit('colour-science cmfs.py differs from the pinned file')
    cm = colour.MSDS_CMFS['CIE 1931 2 Degree Standard Observer']
    wl = np.asarray(cm.wavelengths, float)
    xyzb = np.asarray(cm.values, float)
    arr = np.ascontiguousarray(np.column_stack([wl, xyzb]).astype('<f8'))
    if hashlib.sha256(arr.tobytes()).hexdigest() != CMFS_ARRAY_SHA256:
        sys.exit('CIE 1931 2-degree CMF array differs from the pinned one')
    assert wl[0] == 360 and wl[-1] == 830 and np.all(np.diff(wl) == 1)
    M = np.asarray(colour.RGB_COLOURSPACES['sRGB'].matrix_XYZ_to_RGB, float)
    temps = LUT_TMIN * (LUT_TMAX / LUT_TMIN) ** (np.arange(LUT_N) / (LUT_N - 1))
    lam = wl * 1e-9
    srgb, lin = [], []
    for T in temps:
        x = sc.h * sc.c / (lam * sc.k * T)
        B = 1.0 / (lam ** 5 * np.expm1(x))    # Planck, arbitrary scale (normalised below)
        XYZ = (B[:, None] * xyzb).sum(0)      # 1 nm steps
        rgb = M @ XYZ
        rgb = np.clip(rgb, 0, None)
        rgb = rgb / rgb.max()
        enc = np.where(rgb <= 0.0031308, 12.92 * rgb, 1.055 * rgb ** (1 / 2.4) - 0.055)
        lin.append([round(float(v), 4) for v in rgb])
        srgb.append([round(float(v), 4) for v in enc])
    lin.append([1.0, 1.0, 1.0])
    srgb.append([1.0, 1.0, 1.0])
    return temps, srgb, lin, M


def teff_code(T):
    T = np.asarray(T, float)
    c = np.rint((LUT_N - 1) * np.log(np.clip(T, LUT_TMIN, LUT_TMAX) / LUT_TMIN)
                / math.log(LUT_TMAX / LUT_TMIN))
    return np.where(np.isfinite(T), c, UNKNOWN_COLOUR).astype(np.uint8)


class TeffModel:
    """Colour index / spectral type -> effective temperature, for display colours only."""

    def __init__(self):
        src = wheel_member('pyastronomy').decode()
        coef = {}
        for k in ('a', 'b', 'c', 'T0'):
            m = re.search(r'self\._%s\s*=\s*([0-9.]+)' % k, src)
            coef[k] = float(m.group(1))
        self.bal = coef
        report['ballesteros_coefficients'] = coef
        txt = wheel_member('meanstars').decode()
        rows = []
        started = False
        for line in txt.splitlines():
            if line.startswith('SpT '):
                cols = line.split()
                started = True
                continue
            if not started:
                continue
            if line.startswith('#') or not line.strip():
                if rows:
                    break
                continue
            rows.append(dict(zip(cols, line.split())))
        self.table_rows = len(rows)

        def num(s):
            try:
                return float(s)
            except ValueError:
                return math.nan
        teff = np.array([num(r['Teff']) for r in rows])
        btvt = np.array([num(r['Bt-Vt']) for r in rows])
        ok = np.isfinite(btvt) & np.isfinite(teff)
        o = np.argsort(btvt[ok], kind='stable')
        self.btvt_x = btvt[ok][o]
        self.btvt_logt = np.log10(teff[ok][o])
        assert np.all(np.diff(self.btvt_x) > 0), 'Bt-Vt column not strictly increasing'
        assert np.all(np.diff(self.btvt_logt) <= 0), 'Teff not falling with Bt-Vt'
        self.spt = {}
        for r, t in zip(rows, teff):
            m = re.match(r'^([OBAFGKMLTY])(\d+(?:\.\d+)?)V$', r['SpT'])
            if m and np.isfinite(t):
                self.spt.setdefault(m.group(1), []).append((float(m.group(2)), t))
        for k in self.spt:
            self.spt[k].sort()
        self.spt_median = {k: float(np.median([t for _, t in v])) for k, v in self.spt.items()}
        self._spt_cache = {}
        report['mamajek'] = {'rows': self.table_rows, 'btvt_range': [float(self.btvt_x[0]),
                                                                    float(self.btvt_x[-1])]}

    def ballesteros(self, bv):
        a, b, c, T0 = self.bal['a'], self.bal['b'], self.bal['c'], self.bal['T0']
        bv = np.asarray(bv, float)
        ok = np.isfinite(bv) & (a * bv + c > 0.05)
        safe = np.where(ok, bv, 0.0)
        return np.where(ok, T0 * (1 / (a * safe + b) + 1 / (a * safe + c)), np.nan)

    def from_btvt(self, x):
        x = np.asarray(x, float)
        inr = np.isfinite(x) & (x >= self.btvt_x[0]) & (x <= self.btvt_x[-1])
        T = np.where(inr, 10 ** np.interp(np.where(inr, x, 0), self.btvt_x, self.btvt_logt),
                     np.nan)
        clamped = np.where(np.isfinite(x) & ~inr,
                           10 ** np.where(x < self.btvt_x[0], self.btvt_logt[0],
                                          self.btvt_logt[-1]), np.nan)
        return T, clamped

    def from_spect(self, s):
        if s in self._spt_cache:
            return self._spt_cache[s]
        T = math.nan
        m = re.match(r'^(?:esd|usd|sd|d|g)?([OBAFGKMLTY])(\d+(?:\.\d+)?)?', s.strip())
        if m and m.group(1) in self.spt:
            tab = self.spt[m.group(1)]
            if m.group(2) is None:
                T = self.spt_median[m.group(1)]
            else:
                T = float(np.interp(float(m.group(2)), [p for p, _ in tab], [t for _, t in tab]))
        self._spt_cache[s] = T
        return T

    def teff(self, ci, ci_is_bv, spect, oec_teff=None):
        """Vectorised: returns (Teff array with NaN when unknown, source code array)."""
        n = len(ci)
        T = np.full(n, np.nan)
        src = np.zeros(n, np.int8)
        ci = np.asarray(ci, float)
        if oec_teff is not None:
            ot = np.asarray(oec_teff, float)
            m = np.isfinite(ot) & (ot > 0)
            T[m], src[m] = ot[m], 4
        bvT = self.ballesteros(np.where(ci_is_bv, ci, np.nan))
        m = np.isnan(T) & np.isfinite(bvT)
        T[m], src[m] = bvT[m], 1
        btT, clampT = self.from_btvt(np.where(~ci_is_bv, ci, np.nan))
        m = np.isnan(T) & np.isfinite(btT)
        T[m], src[m] = btT[m], 2
        for i in np.where(np.isnan(T))[0]:
            if spect[i]:
                t = self.from_spect(spect[i])
                if np.isfinite(t):
                    T[i], src[i] = t, 3
        m = np.isnan(T) & np.isfinite(clampT)
        T[m], src[m] = clampT[m], 5
        return T, src


# --------------------------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------------------------
def unit(ra_deg, dec_deg):
    a, d = np.radians(ra_deg), np.radians(dec_deg)
    return np.stack([np.cos(d) * np.cos(a), np.cos(d) * np.sin(a), np.sin(d)], -1)


def as_int(s):
    try:
        return int(s)
    except (TypeError, ValueError):
        return 0


def norm_gl(s):
    m = re.match(r'^(?:GJ|Gl|GL|Gliese)\s*(\d+(?:\.\d+)?)\s*([A-Za-z]{0,2})$', s.strip())
    return f'GJ {m.group(1)}{m.group(2).upper()}' if m else None


def desig(bayer, flam, con):
    if bayer:
        base, _, sup = bayer.partition('-')
        g = GREEK.get(base)
        if g:
            return f'{g}{sup.translate(SUPERSCRIPT)} {con}'.strip()
    if flam:
        return f'{flam} {con}'.strip()
    return ''


def sexa(s, hours):
    s = s.replace('−', '-').strip()
    neg = s.startswith('-')
    p = [abs(float(x)) for x in s.split()]
    v = p[0] + (p[1] / 60 if len(p) > 1 else 0) + (p[2] / 3600 if len(p) > 2 else 0)
    return (-v if neg else v) * (15 if hours else 1)


def fnum(e, tag):
    if e is None:
        return None
    t = e.findtext(tag)
    try:
        v = float(t)
        return v if math.isfinite(v) else None
    except (TypeError, ValueError):
        return None


def sig(v, n=4):
    return None if v is None else float(f'{v:.{n}g}')


def round_pos(v, dist):
    dec = int(max(1, min(5, 5 - math.floor(math.log10(max(dist, 1e-3))))))
    return [round(float(x), dec) for x in v]


# --------------------------------------------------------------------------------------------
# Distance quality
# --------------------------------------------------------------------------------------------
def join_stellarium(u, st):
    """Per AT-HYG row: Stellarium index (-1 none) and how (1 Gaia id, 2 HIP primary)."""
    gi = {}
    for i, g in enumerate(st['gaia'].tolist()):
        if g > 0 and g not in gi:
            gi[g] = i
    hi = {}
    for i, (h, c) in enumerate(zip(st['hip'].tolist(), st['comp'].tolist())):
        if h > 0 and c <= 1 and h not in hi:
            hi[h] = i
    n = len(u['id'])
    j = np.full(n, -1, np.int64)
    how = np.zeros(n, np.int8)
    for k in range(n):
        g = as_int(u['gaia'][k])
        if g and g in gi:
            j[k], how[k] = gi[g], 1
            continue
        h = as_int(u['hip'][k])
        if h and h in hi:
            j[k], how[k] = hi[h], 2
    return j, how


def quality(u, st, j, how):
    """Quality of each AT-HYG row's shipped distance (see module docstring)."""
    n = len(u['id'])
    dist = u['dist']
    has = np.isfinite(dist) & (dist > 0)
    joined = j >= 0
    plx = np.where(joined, st['plx'][np.maximum(j, 0)], np.nan)
    pe = np.where(joined, st['pe'][np.maximum(j, 0)], np.nan)
    poe = np.where(joined & (plx > 0) & (pe > 0), plx / np.where(pe > 0, pe, 1), np.nan)
    same = (how == 1) & (u['dist_src'] == 'G_R3')
    sigma = np.sqrt(pe ** 2 + (STEL_PLX_QUANT / 2) ** 2)
    agree = has & joined & (plx > 0) & (np.abs(1000.0 / np.where(has, dist, 1) - plx)
                                        <= AGREE_SIGMA * sigma)
    applies = has & np.isfinite(poe) & (same | agree)
    q = np.full(n, Q_UNKNOWN, np.int8)
    q[~has] = Q_NONE
    q[applies & (poe > DEEP_MIN_POE)] = Q_GOOD
    q[applies & (poe > POE_FAIR) & (poe <= DEEP_MIN_POE)] = Q_FAIR
    q[applies & (poe <= POE_FAIR)] = Q_BAD
    report['quality_athyg'] = {
        'joined_by_gaia': int((how == 1).sum()), 'joined_by_hip': int((how == 2).sum()),
        'not_joined': int((~joined).sum()),
        'error_applies_same_gaia_source': int((has & np.isfinite(poe) & same).sum()),
        'error_applies_by_3sigma_agreement': int((applies & ~same).sum()),
        'disagree_or_no_error': int((has & ~applies).sum())}
    return q, poe


# --------------------------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------------------------
def main():
    log('step 40 — stars')
    u = load_athyg()
    hyg = load_hyg()
    st = load_stellarium()
    oec = oec_systems()
    iau = json.load(open(src_path('iau_index'), encoding='utf-8'))
    for k in ('athyg_license', 'athyg_ack', 'athyg_v1builds', 'hyg_license', 'hyg_versioninfo',
              'stel_copying', 'iau_description'):
        src_path(k)                            # pinned licence/provenance texts for the credits
    temps, srgb, lin, M = colour_lut()
    tm = TeffModel()

    nU = len(u['id'])
    ra_u = u['ra'] * 15.0
    dec_u = u['dec']
    dir_u = unit(ra_u, dec_u)
    j, how = join_stellarium(u, st)
    q, poe = quality(u, st, j, how)
    ds_u = np.array([ATHYG_DS[s] for s in u['dist_src']], np.int8)

    # HYG links for spectral types and B-V that AT-HYG lost on Gliese-linked rows
    hyg_row = {int(x): i for i, x in enumerate(hyg['id'].tolist())}
    u_hyg = np.array([hyg_row.get(as_int(x), -1) for x in u['hyg']], np.int64)
    spect_u = u['spect'].copy()
    fill = (spect_u == '') & (u_hyg >= 0)
    spect_u[fill] = hyg['spect'][u_hyg[fill]]
    report['spect_filled_from_hyg'] = int((fill & (spect_u != '')).sum())
    ci_u = u['ci'].copy()
    ci_is_bv = u['mag_src'] != 'T'
    fillc = ~np.isfinite(ci_u) & (u_hyg >= 0)
    ci_u[fillc] = hyg['ci'][u_hyg[fillc]]
    ci_is_bv = ci_is_bv | fillc                 # HYG colour indices are Johnson B-V
    report['ci_filled_from_hyg'] = int((fillc & np.isfinite(ci_u)).sum())

    # V magnitude: AT-HYG 'mag' is VT for Tycho-2 rows; V = VT - 0.090 (BT-VT) (AT-HYG notes)
    vmag_u = u['mag'].copy()
    tyc = (u['mag_src'] == 'T') & np.isfinite(u['ci'])
    vmag_u[tyc] = u['mag'][tyc] - 0.090 * u['ci'][tyc]
    report['vt_to_v_converted'] = int(tyc.sum())
    report['vt_kept_no_btvt'] = int(((u['mag_src'] == 'T') & ~np.isfinite(u['ci'])).sum())

    teff_u, tsrc_u = tm.teff(ci_u, ci_is_bv, spect_u)

    # ---------------- HYG rows AT-HYG lacks (companions, Gliese-only stars) -----------------
    in_u_hyg = set(as_int(x) for x in u['hyg'] if x)
    u_by_hyg = {}
    for i, x in enumerate(u['hyg']):
        if x:
            u_by_hyg.setdefault(int(x), i)
    hx = [i for i in range(len(hyg['id'])) if int(hyg['id'][i]) not in in_u_hyg]
    report['hyg_rows_not_in_athyg'] = len(hx)
    extra = []          # dicts
    for i in hx:
        hid = int(hyg['id'][i])
        prim = int(hyg['comp_primary'][i])
        d_h = float(hyg['dist'][i]) if hyg['dist'][i] < 99999 else math.nan
        row = dict(kind='hyg', hyg=i, hid=hid, ra=float(hyg['ra'][i]) * 15, dec=float(hyg['dec'][i]),
                   vmag=float(hyg['mag'][i]), spect=hyg['spect'][i], ci=float(hyg['ci'][i]),
                   hip=as_int(hyg['hip'][i]), gl=hyg['gl'][i], hd=as_int(hyg['hd'][i]),
                   hr=as_int(hyg['hr'][i]), bayer=hyg['bayer'][i], flam=hyg['flam'][i],
                   con=hyg['con'][i], proper=hyg['proper'][i], flags=0)
        pu = u_by_hyg.get(prim) if prim != hid else None
        if pu is not None:
            # companion: placed at its primary's AT-HYG distance, along its own HYG direction
            row.update(dist=float(u['dist'][pu]), ds=int(ds_u[pu]), q=int(q[pu]),
                       flags=F_COMPANION, primary_u=pu)
        elif prim != hid and prim in hyg_row and prim not in in_u_hyg:
            pj = hyg_row[prim]
            dp = float(hyg['dist'][pj]) if hyg['dist'][pj] < 99999 else math.nan
            row.update(dist=dp, ds=DS_HIP if as_int(hyg['hip'][pj]) else DS_GJ,
                       q=Q_UNKNOWN if math.isfinite(dp) else Q_NONE, flags=F_COMPANION)
        else:
            row.update(dist=d_h, ds=DS_HIP if row['hip'] else DS_GJ,
                       q=Q_UNKNOWN if math.isfinite(d_h) else Q_NONE)
        if not math.isfinite(row['dist']):
            row['ds'] = DS_NONE
            row['q'] = Q_NONE
        extra.append(row)

    # ---------------- IAU names and constellation figures (Stellarium modern_iau) ------------
    hip_u = {}
    for i, h in enumerate(u['hip'].tolist()):
        h = as_int(h)
        if h and h not in hip_u:
            hip_u[h] = i
    gaia_u = {}
    for i, g in enumerate(u['gaia'].tolist()):
        g = as_int(g)
        if g and g not in gaia_u:
            gaia_u[g] = i
    # HIP 55203 = xi UMa: deleted from HYG (version-info v3.5), still used by the UMa figure.
    xi = [i for i in range(len(hyg['id'])) if hyg['bayer'][i] == 'Xi' and hyg['con'][i] == 'UMa'
          and int(hyg['comp'][i]) == 1]
    assert len(xi) == 1 and int(hyg['id'][xi[0]]) in u_by_hyg, 'xi UMa A not found'
    hip_alias = {55203: ('u', u_by_hyg[int(hyg['id'][xi[0]])])}

    def resolve_hip(h):
        if h in hip_alias:
            return hip_alias[h]
        if h in hip_u:
            return ('u', hip_u[h])
        for k, r in enumerate(extra):
            if r['hip'] == h:
                return ('x', k)
        return None

    iau_name = {}        # ('u'|'x', index) -> name
    iau_unplaced = []
    for key, entries in sorted(iau['common_names'].items()):
        k = key.strip()
        eng = next((e.get('english') for e in entries if 2 in (e.get('references') or [])), None)
        if not eng:
            continue
        m = re.match(r'^HIP\s*(\d+)\s*([A-Z]?)$', k)
        g = re.match(r'^Gaia DR3\s*(\d+)$', k)
        ref = None
        if m and m.group(2) in ('', 'A'):
            ref = resolve_hip(int(m.group(1)))
        elif m:                                   # a B/C component: its own HYG row, if any
            base = resolve_hip(int(m.group(1)))
            if base and base[0] == 'u':
                hid = as_int(u['hyg'][base[1]])
                comps = [x for x, r in enumerate(extra) if int(hyg['comp_primary'][r['hyg']]) == hid
                         and r['gl'].strip().endswith(m.group(2))]
                if len(comps) == 1:
                    ref = ('x', comps[0])
        elif g:
            gg = int(g.group(1))
            ref = ('u', gaia_u[gg]) if gg in gaia_u else None
        else:
            continue
        if ref is None:
            iau_unplaced.append(f'{k} ({eng})')
        elif ref not in iau_name:
            iau_name[ref] = eng
    report['iau_names_used'] = len(iau_name)
    report['iau_names_without_catalogue_row'] = iau_unplaced

    line_refs = {}
    cons = []
    for c in iau['constellations']:
        abbr = c['id'].split()[-1]
        cons.append((abbr, c['common_name']['english'], c['lines']))
        for pl in c['lines']:
            for h in pl:
                r = resolve_hip(int(h))
                if r is None:
                    sys.exit(f'constellation {abbr}: HIP {h} has no catalogue row')
                line_refs[int(h)] = r

    # ---------------- Open Exoplanet Catalogue: confirmed planets and their hosts ------------
    def confirmed(p):
        return any((l.text or '').strip() == 'Confirmed planets' for l in p.findall('list'))

    def planet_dict(p, circum):
        yr = fnum(p, 'discoveryyear')
        d = dict(name=(p.findtext('name') or '').strip(), period_d=sig(fnum(p, 'period')),
                 a_au=sig(fnum(p, 'semimajoraxis')), mass_mj=sig(fnum(p, 'mass')),
                 radius_rj=sig(fnum(p, 'radius')), year=int(yr) if yr else None,
                 method=(p.findtext('discoverymethod') or '').strip() or None)
        if circum:
            d['circumbinary'] = True
        return d

    hosts = []            # one per host star (or per binary for circumbinary planets)
    oec_stats = dict(planets_confirmed=0, planets_other_lists=0, free_floating_skipped=0,
                     circumbinary=0)
    for fn in sorted(oec):
        root = ET.fromstring(oec[fn])
        sysd = root.find('distance')
        sysdist = fnum(root, 'distance')
        sys_err = None
        if sysd is not None and sysdist:
            em, ep = sysd.get('errorminus'), sysd.get('errorplus')
            try:
                sys_err = 0.5 * (float(em) + float(ep))
            except (TypeError, ValueError):
                sys_err = None
        ra_s, de_s = root.findtext('rightascension'), root.findtext('declination')
        sysinfo = dict(file=fn, sysdist=sysdist, sys_err=sys_err, ra_s=ra_s, de_s=de_s)

        def visit(e):
            for c in e:
                if c.tag == 'planet':
                    if confirmed(c):
                        oec_stats['planets_confirmed'] += 1
                    else:
                        oec_stats['planets_other_lists'] += 1
                visit(c)
        visit(root)
        for p in root.findall('planet'):
            if confirmed(p):
                oec_stats['free_floating_skipped'] += 1
        for star in root.iter('star'):
            pl = [planet_dict(p, False) for p in star.findall('planet') if confirmed(p)]
            if pl:
                hosts.append(dict(sysinfo, names=[(n.text or '').strip() for n in star.findall('name')],
                                  star=star, planets=pl))
        for b in root.iter('binary'):
            pl = [planet_dict(p, True) for p in b.findall('planet') if confirmed(p)]
            if pl:
                oec_stats['circumbinary'] += len(pl)
                stars = [s for s in b.iter('star')]
                names = [(n.text or '').strip() for s in stars for n in s.findall('name')]
                bnames = [(n.text or '').strip() for n in b.findall('name')]
                hosts.append(dict(sysinfo, names=names, bnames=bnames,
                                  star=stars[0] if stars else None, planets=pl, binary=True))
    report['oec'] = oec_stats
    report['oec_host_entries'] = len(hosts)

    # identifier index over AT-HYG rows (m10 + HYG-linked) and HYG extra rows
    idx = {}

    def add(key, ref):
        if key not in idx:
            idx[key] = ref
    for i in range(nU):
        if u['gaia'][i]:
            add(('gaia', int(u['gaia'][i])), ('u', i))
        if u['hip'][i]:
            add(('hip', int(u['hip'][i])), ('u', i))
        if u['tyc'][i]:
            add(('tyc', u['tyc'][i]), ('u', i))
        if u['hd'][i]:
            add(('hd', int(u['hd'][i])), ('u', i))
        g = norm_gl(u['gl'][i]) if u['gl'][i] else None
        if g:
            add(('gl', g), ('u', i))
    for k, r in enumerate(extra):
        if r['hip']:
            add(('hip', r['hip']), ('x', k))
        if r['hd']:
            add(('hd', r['hd']), ('x', k))
        g = norm_gl(r['gl']) if r['gl'] else None
        if g:
            add(('gl', g), ('x', k))

    def oec_keys(names):
        out = []
        for n in names:
            m = re.match(r'^Gaia DR3\s*(\d+)$', n)
            if m:
                out.append((0, ('gaia', int(m.group(1)))))
                continue
            m = re.match(r'^HIP\s*(\d+)\s*([A-Z]?)$', n)
            if m and m.group(2) in ('', 'A'):
                out.append((1, ('hip', int(m.group(1)))))
                continue
            m = re.match(r'^TYC\s*(\d+-\d+-\d+)$', n)
            if m:
                out.append((2, ('tyc', m.group(1))))
                continue
            m = re.match(r'^HD\s*(\d+)\s*([A-Z]?)$', n)
            if m and m.group(2) in ('', 'A'):
                out.append((3, ('hd', int(m.group(1)))))
                continue
            g = norm_gl(n)
            if g:
                out.append((4, ('gl', g)))
        return [k for _, k in sorted(out, key=lambda t: t[0])]

    # positional fallback over rows with a distance
    from scipy.spatial import cKDTree
    pos_dir = np.concatenate([dir_u, unit(np.array([r['ra'] for r in extra]),
                                          np.array([r['dec'] for r in extra]))])
    pos_dist = np.concatenate([u['dist'], np.array([r['dist'] for r in extra])])
    pos_gl = list(u['gl']) + [r['gl'] for r in extra]
    tree = cKDTree(pos_dir)

    def comp_letter(s):
        m = re.search(r'\s([A-D])$', s or '')
        return m.group(1) if m else ''

    def gl_comp(s):
        g = norm_gl(s) if s else None
        m = re.search(r'\d([A-D])$', g) if g else None
        return m.group(1) if m else ''

    join_stats = dict(by_id=0, by_position=0, oec_only=0)
    for h in hosts:
        ref = None
        for k in oec_keys(h['names'] + h.get('bnames', [])):
            if k in idx:
                ref = idx[k]
                break
        h['ra'] = sexa(h['ra_s'], True) if h['ra_s'] else None
        h['dec'] = sexa(h['de_s'], False) if h['de_s'] else None
        h['how'] = 'id' if ref else None
        if ref is None and h['ra'] is not None and h['sysdist']:
            v = unit(h['ra'], h['dec'])
            best = None
            for c in tree.query_ball_point(v, math.radians(POS_MATCH_ARCSEC / 3600)):
                dd = pos_dist[c]
                if not (np.isfinite(dd) and abs(dd / h['sysdist'] - 1) <= POS_MATCH_DIST_FRAC):
                    continue
                hc, rc = comp_letter(h['names'][0] if h['names'] else ''), gl_comp(pos_gl[c])
                if hc and rc and hc != rc:
                    continue
                sep = math.degrees(math.acos(min(1.0, float(pos_dir[c] @ v)))) * 3600
                if best is None or sep < best[0]:
                    best = (sep, c)
            if best:
                c = best[1]
                ref = ('u', c) if c < nU else ('x', c - nU)
                h['how'] = 'position'
                h['sep_arcsec'] = best[0]
        h['ref'] = ref
        join_stats['by_id' if h['how'] == 'id' else 'by_position' if h['how'] else 'oec_only'] += 1
    report['oec_join'] = join_stats

    # ---------------- assemble named rows ---------------------------------------------------
    named = {}           # ref -> row dict ; ref = ('u', i) | ('x', k) | ('o', n)

    def u_row(i):
        return dict(kind='u', ui=i, ra=float(ra_u[i]), dec=float(dec_u[i]), dist=float(u['dist'][i]),
                    ds=int(ds_u[i]), q=int(q[i]), vmag=float(vmag_u[i]), spect=spect_u[i],
                    teff=float(teff_u[i]), tsrc=int(tsrc_u[i]), flags=0,
                    hip=as_int(u['hip'][i]), gl=u['gl'][i], gaia=as_int(u['gaia'][i]),
                    hd=as_int(u['hd'][i]), tyc=u['tyc'][i], bayer=u['bayer'][i],
                    flam=u['flam'][i], con=u['con'][i], proper=u['proper'][i])

    def x_row(k):
        r = dict(extra[k])
        T, s = tm.teff(np.array([r['ci']]), np.array([True]), np.array([r['spect']], object))
        r.update(kind='x', teff=float(T[0]), tsrc=int(s[0]))
        return r

    def get(ref):
        if ref not in named:
            named[ref] = u_row(ref[1]) if ref[0] == 'u' else x_row(ref[1])
            named[ref]['why'] = set()
        return named[ref]

    placed_u = (q != Q_NONE) & (q != Q_BAD)
    why_counts = {}
    # 1. naked eye
    for i in np.where(vmag_u < NAMED_VMAG)[0]:
        get(('u', int(i)))['why'].add('V<6.5')
    for k, r in enumerate(extra):
        if r['vmag'] < NAMED_VMAG:
            get(('x', k))['why'].add('V<6.5')
    # 2. within 20 pc (by the distance that is shipped)
    for i in np.where(np.isfinite(u['dist']) & (u['dist'] <= NEAR_PC))[0]:
        get(('u', int(i)))['why'].add('<=20pc')
    for k, r in enumerate(extra):
        if math.isfinite(r['dist']) and r['dist'] <= NEAR_PC:
            get(('x', k))['why'].add('<=20pc')
    # 3. IAU-named stars and 4. constellation-figure stars
    for ref in iau_name:
        get(ref)['why'].add('IAU name')
    for ref in line_refs.values():
        get(ref)['why'].add('figure')
    # 5. exoplanet hosts within 100 pc (or any host already named)
    oec_rows = 0
    host_of = {}
    for n, h in enumerate(hosts):
        ref = h['ref']
        row = named.get(ref) if ref else None
        if ref:
            base = row or (u_row(ref[1]) if ref[0] == 'u' else x_row(ref[1]))
            usable = base['q'] not in (Q_NONE, Q_BAD)
            best = base['dist'] if usable else h['sysdist']
        else:
            best = h['sysdist']
        if not (row is not None or (best is not None and best <= HOST_PC)):
            continue
        if ref is None:
            if h['ra'] is None or not h['sysdist']:
                continue
            star = h['star']
            poe_o = h['sysdist'] / h['sys_err'] if h['sys_err'] else None
            qq = (Q_UNKNOWN if poe_o is None else Q_GOOD if poe_o > DEEP_MIN_POE
                  else Q_FAIR if poe_o > POE_FAIR else Q_BAD)
            oname = (h['bnames'][0] if h.get('binary') and h.get('bnames') else
                     h['names'][0] if h['names'] else h['file'][len('systems/'):-4])
            ot = fnum(star, 'temperature')
            ospt = ((star.findtext('spectraltype') or '').strip() if star is not None else '')
            T, s = tm.teff(np.array([np.nan]), np.array([False]), np.array([ospt], object),
                           oec_teff=np.array([ot if ot else np.nan]))
            vm = fnum(star, 'magV')
            ref = ('o', n)
            named[ref] = dict(kind='o', ra=h['ra'], dec=h['dec'], dist=h['sysdist'], ds=DS_OEC,
                              q=qq, vmag=vm if vm is not None else math.nan, spect=ospt,
                              teff=float(T[0]), tsrc=int(s[0]), flags=0, oec_name=oname,
                              bayer='', flam='', con='', proper='', why=set())
            oec_rows += 1
        else:
            r = get(ref)
            if r['q'] in (Q_NONE, Q_BAD) and h['sysdist']:
                poe_o = h['sysdist'] / h['sys_err'] if h['sys_err'] else None
                r.update(dist=h['sysdist'], ds=DS_OEC,
                         q=(Q_UNKNOWN if poe_o is None else Q_GOOD if poe_o > DEEP_MIN_POE
                            else Q_FAIR if poe_o > POE_FAIR else Q_BAD), oec_distance=True)
        named[ref]['why'].add('exoplanet host')
        host_of.setdefault(ref, []).extend(h['planets'])
    report['oec_only_rows'] = oec_rows
    report['hosts_rows_upgraded_to_oec_distance'] = sum(1 for r in named.values()
                                                       if r.get('oec_distance'))

    for r in named.values():
        for w in r['why']:
            why_counts[w] = why_counts.get(w, 0) + 1
    report['named_reasons'] = dict(sorted(why_counts.items()))

    # ---------------- per-row fields ---------------------------------------------------------
    rows = []
    for ref, r in named.items():
        f = r['flags']
        if ref in host_of:
            f |= F_HOST
        if WD_RE.match(r['spect'] or ''):
            f |= F_WD
        if r['q'] == Q_FAIR:
            f |= F_POE_FAIR
        if r['q'] in (Q_NONE, Q_BAD):
            f |= F_UNPLACED
        if r['q'] == Q_UNKNOWN:
            f |= F_ERR_UNKNOWN
        name = ''
        if ref in iau_name:
            name, f = iau_name[ref], f | F_IAU
        elif r.get('proper'):
            name = r['proper']
        if r['kind'] == 'u':
            i = r['ui']
            ident = (f'HIP {r["hip"]}' if r['hip'] else r['gl'] if r['gl'] else
                     f'Gaia DR3 {r["gaia"]}' if r['gaia'] else f'HD {r["hd"]}' if r['hd'] else
                     f'TYC {r["tyc"]}' if r['tyc'] else f'AT-HYG {int(u["id"][i])}')
        elif r['kind'] == 'x':
            ident = (f'HIP {r["hip"]}' if r['hip'] else r['gl'] if r['gl'] else
                     f'HD {r["hd"]}' if r['hd'] else f'HR {r["hr"]}' if r['hr'] else
                     f'HYG {r["hid"]}')
        else:
            ident = r['oec_name']
        placed = not (f & F_UNPLACED)
        d = r['dist'] if placed else 1.0
        v = unit(r['ra'], r['dec']) * d
        vm = r['vmag'] if math.isfinite(r['vmag']) else None
        am = (vm + 5 - 5 * math.log10(r['dist'])) if (vm is not None and placed) else None
        rows.append(dict(ref=ref, id=ident, name=name, desig=desig(r['bayer'], r['flam'], r['con']),
                         con=r['con'], xyz=round_pos(v, d), vmag=None if vm is None else round(vm, 2),
                         absmag=None if am is None else round(am, 2),
                         colour=int(teff_code([r['teff']])[0]), spect=r['spect'] or '',
                         ds=int(r['ds']), flags=int(f), tsrc=r['tsrc'], dist=r['dist'],
                         placed=placed,
                         why=sorted(r['why'])))
    ids = [r['id'] for r in rows]
    dup = sorted({x for x in ids if ids.count(x) > 1}) if len(set(ids)) != len(ids) else []
    for r in rows:                              # disambiguate the rare duplicated designation
        if r['id'] in dup:
            r['id'] = f'{r["id"]} ({"AT-HYG " + str(int(u["id"][r["ref"][1]])) if r["ref"][0] == "u" else "HYG " + str(named[r["ref"]].get("hid", "")) if r["ref"][0] == "x" else "OEC"})'
    assert len({r['id'] for r in rows}) == len(rows), 'named ids not unique'
    report['named_duplicate_ids_disambiguated'] = dup
    rows.sort(key=lambda r: (r['vmag'] is None, r['vmag'] if r['vmag'] is not None else 0, r['id']))
    row_of = {r['ref']: k for k, r in enumerate(rows)}

    named_json = {
        'count': len(rows),
        'id': [r['id'] for r in rows], 'name': [r['name'] for r in rows],
        'desig': [r['desig'] for r in rows], 'con': [r['con'] for r in rows],
        'x': [r['xyz'][0] for r in rows], 'y': [r['xyz'][1] for r in rows],
        'z': [r['xyz'][2] for r in rows],
        'vmag': [r['vmag'] for r in rows], 'absmag': [r['absmag'] for r in rows],
        'colour': [r['colour'] for r in rows], 'spect': [r['spect'] for r in rows],
        'dist_src': [r['ds'] for r in rows], 'flags': [r['flags'] for r in rows],
        'dist_src_labels': DIST_SRC_LABELS,
        'flag_bits': {'0': 'exoplanet host (confirmed planets in exoplanets.json)',
                      '1': 'white dwarf (spectral type ^D[ABCOQZX])',
                      '2': "companion placed at its primary's distance",
                      '3': 'parallax/error between 5 and 10',
                      '4': 'no usable parallax: x,y,z is the unit direction, not a position',
                      '5': 'name is from the IAU Catalog of Star Names',
                      '6': 'no per-star parallax error available for the shipped distance'},
        'frame': 'ICRS, heliocentric, parsecs; J2000.0 positions; no extinction correction',
    }

    # ---------------- constellations --------------------------------------------------------
    con_json = {}
    seg_total = seg_unique = seg_sky = 0
    for abbr, cname, lines in cons:
        seen = set()
        lines3, sky = [], []
        for pl in lines:
            for a, b in zip(pl[:-1], pl[1:]):
                seg_total += 1
                ia, ib = row_of[line_refs[int(a)]], row_of[line_refs[int(b)]]
                key = (min(ia, ib), max(ia, ib))
                if key in seen or ia == ib:
                    continue
                seen.add(key)
                seg_unique += 1
                if (rows[ia]['flags'] | rows[ib]['flags']) & F_UNPLACED:
                    sky.append([ia, ib])
                    seg_sky += 1
                else:
                    lines3.append([ia, ib])
        con_json[abbr] = {'name': cname, 'lines': lines3, 'lines_sky_only': sky}
    report['constellations'] = dict(count=len(con_json), polyline_segments=seg_total,
                                    unique_segments=seg_unique, dropped_from_3d=seg_sky)

    # ---------------- exoplanets ------------------------------------------------------------
    exo = {'hosts': {}}
    n_pl = 0
    for ref, pls in host_of.items():
        seen = set()
        out = []
        for p in pls:
            if p['name'] in seen:
                continue
            seen.add(p['name'])
            out.append(p)
        out.sort(key=lambda p: p['name'])
        exo['hosts'][str(row_of[ref])] = out
        n_pl += len(out)
    exo['source'] = f'Open Exoplanet Catalogue, git commit {OEC_COMMIT}; list = Confirmed planets'
    report['exoplanets'] = dict(hosts=len(exo['hosts']), planets=n_pl)

    # ---------------- deep cloud -------------------------------------------------------------
    in_named = np.zeros(nU, bool)
    for ref in named:
        if ref[0] == 'u':
            in_named[ref[1]] = True
    base = (u['in_m10'] & np.isin(u['dist_src'], ['G_R3', 'HIP', 'G_R2', 'GJ'])
            & (u['dist'] <= DEEP_MAX_PC))
    sel = base & (q == Q_GOOD) & ~in_named
    report['deep_selection'] = {
        'm10_within_500pc_with_distance': int(base.sum()),
        'error_applies_and_poe_gt_10': int((base & (q == Q_GOOD)).sum()),
        'dropped_poe_le_10': int((base & ((q == Q_FAIR) | (q == Q_BAD))).sum()),
        'dropped_no_applicable_error': int((base & (q == Q_UNKNOWN)).sum()),
        'moved_to_named': int((base & (q == Q_GOOD) & in_named).sum()),
        'shipped': int(sel.sum())}
    di = np.where(sel)[0]
    xyz = dir_u[di] * u['dist'][di][:, None]
    qx = np.rint(xyz * POS_SCALE)
    assert np.abs(qx).max() <= 32767
    Mv = vmag_u[di] + 5 - 5 * np.log10(u['dist'][di])
    mcode_f = np.rint((Mv + 8.0) * 10)
    report['deep_absmag_clamped'] = int(((mcode_f < 0) | (mcode_f > 255)).sum())
    mcode = np.clip(mcode_f, 0, 255).astype(np.uint8)
    ccode = teff_code(teff_u[di])
    order = np.lexsort((u['id'][di], np.rint(u['dist'][di] * 1000), mcode))
    rec = np.zeros(len(di), dtype=[('x', '<i2'), ('y', '<i2'), ('z', '<i2'), ('m', 'u1'),
                                   ('c', 'u1')])
    rec['x'], rec['y'], rec['z'] = qx[order, 0], qx[order, 1], qx[order, 2]
    rec['m'], rec['c'] = mcode[order], ccode[order]
    write_bin('stars/deep.bin', rec.tobytes())
    ms = np.sort(rec['m'])
    mv_prefix = {str(t): int(np.searchsorted(ms, (t + 8) * 10, side='right'))
                 for t in range(-8, 18)}
    tsd = tsrc_u[di]
    dsd = u['dist_src'][di]
    deep_json = {
        'count': int(len(di)), 'record_bytes': 8,
        'fields': [{'name': 'x', 'type': 'int16', 'offset': 0},
                   {'name': 'y', 'type': 'int16', 'offset': 2},
                   {'name': 'z', 'type': 'int16', 'offset': 4},
                   {'name': 'absmag_code', 'type': 'uint8', 'offset': 6},
                   {'name': 'colour_code', 'type': 'uint8', 'offset': 7}],
        'units_per_pc': POS_SCALE,
        'absmag': {'M_V': 'code / 10 - 8', 'min': -8.0, 'max': 17.5,
                   'note': 'V + 5 - 5 log10(d_pc); no extinction correction'},
        'colour': 'index into stars/colour.json (255 = no colour measurement)',
        'frame': 'ICRS, heliocentric; x -> RA 0 Dec 0, z -> north celestial pole',
        'order': 'absmag_code ascending (intrinsically brightest first), then distance, then '
                 'AT-HYG id; the first mv_prefix[k] records are every star with M_V <= k',
        'mv_prefix': mv_prefix,
        'selection': ('AT-HYG v3.2 m10 subset, distance <= 500 pc, parallax/error > 10 where a '
                      'Stellarium per-star error applies to the shipped distance; every star in '
                      'named.json removed'),
        'dist_src_counts': {DIST_SRC_LABELS[ATHYG_DS[k]]: int((dsd == k).sum())
                            for k in ('G_R3', 'G_R2', 'HIP', 'GJ')},
        'colour_src_counts': {TEFF_SRC_LABELS[k]: int((tsd == k).sum()) for k in range(6)},
        'quantisation_pc': 1 / POS_SCALE,
    }
    write_json('stars/deep.json', deep_json, pretty=True)

    # ---------------- colour table ------------------------------------------------------------
    colour_json = {
        'count': 256, 'unknown_index': UNKNOWN_COLOUR,
        'teff_k': [int(round(t)) for t in temps] + [None],
        'srgb': srgb, 'linear': lin,
        'index_from_teff': (f'round(254 * ln(T / {LUT_TMIN:g}) / ln({LUT_TMAX:g} / {LUT_TMIN:g})), '
                            f'clamped to 0..254'),
        'method': ('Planck spectrum at T integrated at 1 nm over 360-830 nm against the CIE 1931 '
                   '2-degree colour-matching functions -> XYZ -> linear sRGB with the IEC '
                   '61966-2-1 matrix (D65 white) -> negative components set to 0 -> divided by the '
                   'largest component (chromaticity only; brightness comes from the magnitude) '
                   '-> "srgb" is sRGB-encoded (IEC 61966-2-1 transfer curve), "linear" is not.'),
        'xyz_to_linear_srgb': [[float(v) for v in row] for row in M],
        'teff_note': ('Display temperatures, not measurements: from B-V by the Ballesteros (2012) '
                      'blackbody model, from BT-VT or spectral type through Mamajek\'s dwarf '
                      'sequence (v2022.04.16), or from the Open Exoplanet Catalogue. Observed '
                      'colours: interstellar reddening is not removed. Entry 255 is neutral white '
                      'for stars with no colour index, spectral type or catalogue Teff.'),
    }
    write_json('stars/colour.json', colour_json, ndigits=6)

    write_json('stars/named.json', named_json, ndigits=6)
    write_json('stars/constellations.json', con_json)
    write_json('stars/exoplanets.json', exo, ndigits=6)

    # ---------------- summary ----------------------------------------------------------------
    flags = np.array(named_json['flags'])
    dsn = np.array(named_json['dist_src'])
    near = np.array(['<=20pc' in r['why'] for r in rows])
    report['named'] = dict(
        rows=len(rows),
        flag_counts={named_json['flag_bits'][str(b)]: int(((flags >> b) & 1).sum()) for b in range(7)},
        within_20pc=int(near.sum()),
        within_20pc_dist_src={DIST_SRC_LABELS[k]: int(((dsn == k) & near).sum())
                              for k in range(len(DIST_SRC_LABELS))},
        colour_src={TEFF_SRC_LABELS[k]: int(sum(1 for r in rows if r['tsrc'] == k)) for k in range(6)})
    report['deep_count'] = int(len(di))
    sizes = {}
    for f in ('deep.bin', 'deep.json', 'colour.json', 'named.json', 'constellations.json',
              'exoplanets.json'):
        sizes[f] = os.path.getsize(os.path.join(DATA, 'stars', f))
    report['sizes'] = sizes
    assert sizes['deep.bin'] <= 1_900_000, sizes
    assert sizes['named.json'] + sizes['constellations.json'] + sizes['exoplanets.json'] <= 900_000
    write_credits()
    log(json.dumps(report, indent=1, ensure_ascii=False, sort_keys=True))


# --------------------------------------------------------------------------------------------
# Credits fragment
# --------------------------------------------------------------------------------------------
def write_credits():
    r = report
    dq = r['deep_selection']
    nm = r['named']
    blocks = [
        dict(id='athyg', title='AT-HYG v3.2 (Augmented Tycho-HYG), subsets athyg_32_reduced_m10 and athyg_32_hyg_ids',
             owner='David Nash (astronexus)',
             source=('Compiled from Tycho-2 (Høg et al. 2000) and its first supplement, Hipparcos (ESA 1997; '
                     'van Leeuwen 2007 reduction via HYG), Gaia DR3 and DR2 parallaxes (ESA/Gaia/DPAC, '
                     'through gaiadr3.gaia_source_lite and SIMBAD look-ups), the Yale Bright Star Catalog, '
                     'the Gliese & Jahreiss 1991 nearby-star catalogue, the Tycho-2 Spectral Type Catalog '
                     '(Wright et al. 2003) and SIMBAD cross-identifications.'),
             url=f'https://github.com/astronexus/ATHYG-Database/tree/{ATHYG_COMMIT}',
             licence='CC BY-SA 4.0',
             licence_quote=('"This work is licensed under a [Creative Commons Attribution-ShareAlike 4.0 '
                            'International License][cc-by-sa]." (LICENSE)'),
             retrieved=RETRIEVED,
             adaptations=(f'Positions converted to ICRS Cartesian parsecs from ra/dec/dist; V derived from '
                          f'Tycho VT as V = VT - 0.090 (BT-VT) (the formula in AT-HYG\'s own build notes) for '
                          f'{r["vt_to_v_converted"]} rows; absolute magnitudes recomputed as V + 5 - 5 log10 d '
                          f'without extinction correction; colours turned into display temperatures; '
                          f'{dq["shipped"]} stars within 500 pc with parallax/error > 10 packed into deep.bin '
                          f'(pc x 64 in int16, M_V in 0.1 mag steps). The shipped files stay under CC BY-SA 4.0.'),
             accuracy=('Distances are 1/parallax with no prior (Gaia DR3 for 98% of rows). Positions are '
                       'J2000.0, J1991.25 for a few Hipparcos-only stars. The Gaia parallaxes inside AT-HYG '
                       'come from ESA/Gaia/DPAC, whose own licence could not be read from this network: a '
                       'downloaded third-party package states CC BY-SA 3.0 IGO, Celestia and '
                       'celestia-gaia-stardb files state CC BY-NC 3.0 IGO, and the AWS registry says '
                       '"Attribution required". Treat the Gaia-derived values as non-commercial until '
                       'confirmed. AT-HYG\'s ACKNOWLEDGMENTS omit SIMBAD and Tycho-2 although its build notes '
                       'use both; they are credited here.')),
        dict(id='hyg', title='HYG database v4.1 (hygdata_v41.csv)', owner='David Nash (astronexus)',
             source=('Hipparcos (ESA 1997, 2007 new reduction), Yale Bright Star Catalog 5th ed. (Hoffleit '
                     '1991), Gliese & Jahreiss 1991 (CNS3 preliminary); IAU WGSN names.'),
             url=f'https://github.com/astronexus/HYG-Database/tree/{HYG_COMMIT}',
             licence='CC BY-SA 4.0',
             licence_quote=('"The licensing for HYG v4.0 is Creative Commons CC BY-SA 4.0, unlike previous '
                            'versions of the HYG catalog." (hyg/version-info.md)'),
             retrieved=RETRIEVED,
             adaptations=(f'Used for the {r["hyg_rows_not_in_athyg"]} HYG rows AT-HYG does not carry: '
                          f'Gliese companions (placed at their primary\'s AT-HYG distance along their own '
                          f'direction, flag bit 2) and Gliese-only stars (at their Gliese 1991 distance, '
                          f'flag bit 6); spectral types filled for {r["spect_filled_from_hyg"]} and B-V for '
                          f'{r["ci_filled_from_hyg"]} AT-HYG rows that had none; HIP 55203 (xi UMa, deleted '
                          f'in HYG v3.5) mapped to HYG\'s xi UMa A.'),
             accuracy=('Gliese 1991 distances are often photometric: for Gliese-only stars within 20 pc '
                       'that AT-HYG matched to Gaia DR3, 72% agree within 20% and 5% are off by more than a '
                       'factor of two (measured on these files).')),
        dict(id='stellarium-hipgaia3', title='Stellarium v26.2 hip_gaia3 star catalogues 0-3 (build-time filter only)',
             owner='Stellarium team; catalogues built by Henry Leung (henrysky/stellarium_star_catalogs)',
             source='Gaia DR3 (ESA/Gaia/DPAC) and Hipparcos/XHIP values via SIMBAD',
             url=f'https://github.com/Stellarium/stellarium/tree/{STEL_COMMIT}/stars/hip_gaia3',
             licence='No data licence stated; the files ship in a GPL-2.0-or-later source tree',
             licence_quote='COPYING: "GNU GENERAL PUBLIC LICENSE Version 2, June 1991"; no data-specific notice.',
             retrieved=RETRIEVED,
             adaptations=(f'Nothing shipped. Each AT-HYG star was joined by Gaia DR3 id or HIP number to read '
                          f'its parallax error. The error qualifies AT-HYG\'s distance only when both come from '
                          f'the same Gaia DR3 source ({r["quality_athyg"]["error_applies_same_gaia_source"]} '
                          f'rows) or when Stellarium\'s parallax agrees with it within 3 sigma '
                          f'({r["quality_athyg"]["error_applies_by_3sigma_agreement"]} rows).'),
             accuracy='Parallax quantised to 0.02 mas; the catalogue author calls the files experimental.'),
        dict(id='stellarium-modern-iau', title='Stellarium v26.2 sky culture "modern_iau"',
             owner="Stellarium's team",
             source=('Constellation figures from the IAU "The Constellations" pages (Sky & Telescope: Roger '
                     'Sinnott, Rick Fienberg, Alan MacRobert); star names from the IAU Catalog of Star Names '
                     '(IAU WGSN).'),
             url=f'https://github.com/Stellarium/stellarium/tree/{STEL_COMMIT}/skycultures/modern_iau',
             licence='CC BY-SA 4.0', licence_quote='description.md, "## License": "CC BY-SA 4.0"',
             retrieved=RETRIEVED,
             adaptations=(f'{r["constellations"]["unique_segments"]} unique figure segments resolved to named '
                          f'rows ({r["constellations"]["dropped_from_3d"]} touch a star with no usable parallax '
                          f'and are kept only for the sky view); {r["iau_names_used"]} IAU names attached.'),
             accuracy='Figures are a drawing convention, not a measurement; IAU constellations are defined by their boundaries.'),
        dict(id='oec', title='Open Exoplanet Catalogue', owner='Hanno Rein and contributors',
             source='Community-curated compilation (Rein 2012, arXiv:1211.7121); recent entries imported from the NASA Exoplanet Archive.',
             url=f'https://github.com/OpenExoplanetCatalogue/open_exoplanet_catalogue/tree/{OEC_COMMIT}',
             licence='MIT',
             licence_quote=('"The database is licensed under an MIT license (see below), which basically says '
                            'you can do everything with it." (README.md)'),
             retrieved=RETRIEVED,
             adaptations=(f'Planets with list "Confirmed planets" only ({r["exoplanets"]["planets"]} planets on '
                          f'{r["exoplanets"]["hosts"]} named rows); hosts joined to AT-HYG/HYG by identifier '
                          f'({r["oec_join"]["by_id"]}) or position ({r["oec_join"]["by_position"]}); '
                          f'{r["oec_only_rows"]} hosts placed from the catalogue\'s own coordinates and distance.'),
             accuracy=('Catalogue as of the pinned commit; not complete (e.g. no planet listed for Barnard\'s '
                       'Star; eps Eridani b is "Controversial" and so not shown).')),
        dict(id='mamajek', title='A Modern Mean Dwarf Stellar Color and Effective Temperature Sequence, v2022.04.16',
             owner='Eric Mamajek', source='Pecaut & Mamajek 2013, ApJS 208, 9 (Table 5); copy bundled in the MeanStars 3.6.1 wheel (PyPI)',
             url='https://pypi.org/project/MeanStars/3.6.1/', licence='No licence stated on the table (MeanStars code: BSD-3-Clause)',
             licence_quote='"that reference should be cited until an updated version of the table is published" (file header)',
             retrieved=RETRIEVED,
             adaptations='Bt-Vt and spectral-type columns interpolated to effective temperature for display colours; only the derived colour table ships.',
             accuracy='Dwarf sequence applied to all luminosity classes; display use only.'),
        dict(id='ballesteros', title='B-V to effective temperature relation (Ballesteros 2012, EPL 97, 34008)',
             owner='F. J. Ballesteros; coefficients as coded in PyAstronomy 0.25.0 (MIT)',
             source='PyAstronomy/pyasl/asl/aslExt_1/ballesterosBV_T.py',
             url='https://pypi.org/project/PyAstronomy/0.25.0/', licence='MIT (PyAstronomy)',
             licence_quote='PyAstronomy 0.25.0 METADATA: "License: MIT"', retrieved=RETRIEVED,
             adaptations=f'T = T0 (1/(a BV + b) + 1/(a BV + c)) with {r["ballesteros_coefficients"]}; a model, labelled as one.',
             accuracy='Blackbody-based model; underestimates hot stars (B-V -0.2 gives ~13,600 K).'),
        dict(id='cie1931', title='CIE 1931 2-degree standard observer colour-matching functions',
             owner='CIE (tabulated by CVRL), via colour-science 0.4.6 (BSD-3-Clause)',
             source='colour/colorimetry/datasets/cmfs.py', url='https://pypi.org/project/colour-science/0.4.6/',
             licence='Standard reference data; colour-science BSD-3-Clause',
             licence_quote='colour-science LICENSE: "Redistribution and use in source and binary forms, with or without modification, are permitted..."',
             retrieved=RETRIEVED,
             adaptations='Planck spectra integrated against the CMFs, converted with the IEC 61966-2-1 sRGB matrix, normalised to the largest channel.',
             accuracy='Chromaticity of an ideal blackbody; real stellar spectra differ, especially for M stars.'),
    ]
    os.makedirs(os.path.join(TOOLS, 'credits'), exist_ok=True)
    with open(os.path.join(TOOLS, 'credits', 'stars.json'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(blocks, indent=1, ensure_ascii=False, sort_keys=True) + '\n')


if __name__ == '__main__':
    main()
