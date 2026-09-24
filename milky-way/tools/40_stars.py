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
    HYG v4.1 (astronexus, CC BY-SA 4.0): Gliese companions and white dwarfs AT-HYG drops, and the
        spectral types AT-HYG lost on its Gliese-linked rows.
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
  * An OEC identifier whose row lies > 1 degree from OEC's own coordinates and > 50 % off OEC's
    distance is a slip in the catalogue ('HIP 904' for HD 11964 A) and is skipped for the next one.
  * OEC hosts that no identifier joins are matched by position (<= 30 arcsec, distance within 5 %,
    same component letter) or else placed from OEC's own coordinates and distance, unless OEC's
    quoted distance error leaves parallax/error <= 5. eps Eri b is 'Controversial' in OEC, so
    eps Eri is not a host here; OEC lists no planet for Barnard's Star.
  * Colours are display temperatures: B-V through Ballesteros 2012 (a model), BT-VT and spectral
    type through Mamajek's dwarf table, OEC's Teff for OEC-only hosts; Teff -> sRGB by a Planck
    spectrum against the CIE 1931 2-degree observer.
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

from common import RETRIEVED, fetch, sha256_of, write_bin, write_json
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

GIT_FILES = {   # key: (repo, commit, path, cache name, sha256, bytes)
    'athyg_m10': (ATHYG_REPO, ATHYG_COMMIT, 'data/subsets/athyg_32_reduced_m10.csv.gz',
                  'stars/athyg_32_reduced_m10.csv.gz',
                  '1047d395fcd6a2298ededaf5815fbd53448d178fd3d4fcb1f98f95072f63ea4f', 27940364),
    'athyg_hygids': (ATHYG_REPO, ATHYG_COMMIT, 'data/subsets/athyg_32_hyg_ids.csv.gz',
                     'stars/athyg_32_hyg_ids.csv.gz',
                     'd1dd88f8dd46efffc4ee8a971313ae660f70f876ca54de1c58b9e21878dde372', 10673502),
    'athyg_license': (ATHYG_REPO, ATHYG_COMMIT, 'LICENSE', 'stars/athyg_LICENSE',
                      'f404190403d31e0ce7223f4cb7af954485ad88077358330754dc5c892a856627', 422),
    'athyg_ack': (ATHYG_REPO, ATHYG_COMMIT, 'ACKNOWLEDGMENTS.md', 'stars/athyg_ACKNOWLEDGMENTS.md',
                  '595d3f36dec582247b237448035e8aa4c9c8ab7b022912831338990846e84abb', 1124),
    'athyg_v1builds': (ATHYG_REPO, ATHYG_COMMIT, 'data/details/v1_builds.md',
                       'stars/athyg_v1_builds.md',
                       '51ff6109cf4e71fd3a7447d2ff8acbd66af435a6c2a43b2aea890d77b297dab2', 15910),
    'hyg': (HYG_REPO, HYG_COMMIT, 'hyg/CURRENT/hygdata_v41.csv', 'stars/hygdata_v41.csv',
            'd9f69fd86bbf90a4e4d52b4c5c53eacfa6dfc0bfdef85bfd94f095e0bebe4ebd', 33932548),
    'hyg_license': (HYG_REPO, HYG_COMMIT, 'hyg/CURRENT/LICENSE', 'stars/hyg_LICENSE',
                    'f404190403d31e0ce7223f4cb7af954485ad88077358330754dc5c892a856627', 422),
    'hyg_versioninfo': (HYG_REPO, HYG_COMMIT, 'hyg/version-info.md', 'stars/hyg_version-info.md',
                        'b7c87b3730b2f225793f5835e9afab8e548ae9dc04969a671eb43b1ef90bb394', 19933),
    'stel0': (STEL_REPO, STEL_COMMIT, 'stars/hip_gaia3/stars_0_0v0_21.cat',
              'stars/stellarium/stars_0_0v0_21.cat',
              '2c9c1f9362ccdced4ed69fcbba2b5bfa175ffd51fda712ad18541724f9f34b69', 242320),
    'stel1': (STEL_REPO, STEL_COMMIT, 'stars/hip_gaia3/stars_1_0v0_16.cat',
              'stars/stellarium/stars_1_0v0_16.cat',
              '61c906d7cf9f012f039d9cd8ff781522d353ca9610a2830ada5e3e811ee0a8bb', 1037728),
    'stel2': (STEL_REPO, STEL_COMMIT, 'stars/hip_gaia3/stars_2_0v0_17.cat',
              'stars/stellarium/stars_2_0v0_17.cat',
              'c1f417eebb535781fac60fa065c91857c87bb17599f92ed623dd52afcc0aecac', 6804736),
    'stel3': (STEL_REPO, STEL_COMMIT, 'stars/hip_gaia3/stars_3_0v0_10.cat',
              'stars/stellarium/stars_3_0v0_10.cat',
              '8c4c969e081f3e454e4f0245d2d7d9cdcfa0211c87a87fe26cd57c186fc93fe5', 20075344),
    'stel_copying': (STEL_REPO, STEL_COMMIT, 'COPYING', 'stars/stellarium/COPYING',
                     '3aeeb5bb98bf7041ab82cffe15efa28ac58ee2bdf162b71301f5c192be631259', 17992),
    'iau_index': (STEL_REPO, STEL_COMMIT, 'skycultures/modern_iau/index.json',
                  'stars/stellarium/modern_iau_index.json',
                  '2b7aa4fa2860566ea68aca0c0b087ba815aea38a92d1bb9b3c04b6c0758f726b', 134936),
    'iau_description': (STEL_REPO, STEL_COMMIT, 'skycultures/modern_iau/description.md',
                        'stars/stellarium/modern_iau_description.md',
                        '0f762dca0920fc84e35433b21c3c91b5a19a46579ca48ed362e0ba4f5804897c', 8236),
}

WHEELS = {   # key: (url, cache name, sha256, member, member sha256, bytes)
    'pyastronomy': (
        'https://files.pythonhosted.org/packages/f8/3b/6ab024c988306bc86523dfd02cfa53e1f364abd100054d5954eae23c45fe/pyastronomy-0.25.0-py3-none-any.whl',
        'stars/pyastronomy-0.25.0-py3-none-any.whl',
        '8763000b240fdb55d5f61df9551fd1476f7c8fde5a811bdfd30ed9c9fbe6fbbe',
        'PyAstronomy/pyasl/asl/aslExt_1/ballesterosBV_T.py',
        '262a9bda39417bf2d6007e0e21d549efcc43d73f60634cdad972d8bd14dbd12a', 582994),
    'meanstars': (
        'https://files.pythonhosted.org/packages/f2/0e/abdbf1733e84ad7a3afe53fbfd52d3cf001982f1c129e8ba601876d99b17/meanstars-3.6.1-py3-none-any.whl',
        'stars/meanstars-3.6.1-py3-none-any.whl',
        'ed740c346dcb522742d16eed00c8cd3a14df9157b0d6f7d5cf2bb9ef9538ff67',
        'MeanStars/EEM_dwarf_UBVIJHK_colors_Teff.txt',
        '5a6e5baa6e1e5bca570cb73e5ffdb8c6b2b28158908d13729cd3fec00b99b510', 32811),
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
ID_JOIN_MAX_DEG = 1.0          # an OEC identifier join this far from OEC's coordinates ...
ID_JOIN_MAX_DIST_FRAC = 0.5    # ... and this far off OEC's distance is a wrong identifier
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
                   'BT-VT outside the Mamajek table, clamped to its nearest end']

WD_RE = re.compile(r'^D[ABCOQZX]')
GREEK = {'Alp': 'α', 'Bet': 'β', 'Gam': 'γ', 'Del': 'δ', 'Eps': 'ε', 'Zet': 'ζ', 'Eta': 'η',
         'The': 'θ', 'Iot': 'ι', 'Kap': 'κ', 'Lam': 'λ', 'Mu': 'μ', 'Nu': 'ν', 'Xi': 'ξ',
         'Omi': 'ο', 'Pi': 'π', 'Rho': 'ρ', 'Sig': 'σ', 'Tau': 'τ', 'Ups': 'υ', 'Phi': 'φ',
         'Chi': 'χ', 'Psi': 'ψ', 'Ome': 'ω'}
SUPERSCRIPT = str.maketrans('0123456789', '⁰¹²³⁴⁵⁶⁷⁸⁹')

report = {}          # measured numbers, printed at the end and reused in the credits
OEC_LICENCE_TEXT = []    # the OEC README's MIT notice, read from the pinned file by oec_systems()


def log(*a):
    print(*a, flush=True)


# --------------------------------------------------------------------------------------------
# Loading
# --------------------------------------------------------------------------------------------
def src_path(key):
    """A pinned file from a GitHub repository at a pinned commit. Same URL git_file() builds, but
    through fetch() with the byte size, so the MILKYWAY_SEED lookup only hashes same-size files."""
    repo, commit, path, name, sha, size = GIT_FILES[key]
    slug = repo[len('https://github.com/'):]
    return fetch(f'https://raw.githubusercontent.com/{slug}/{commit}/{path}', name, sha, size)


def wheel_member(key):
    url, name, sha, member, msha, size = WHEELS[key]
    p = fetch(url, name, sha, size)
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
        with open(src_path(k), 'rb') as f:
            b = f.read()
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
            for dp, dn, _fn in os.walk(SEED):
                dn.sort()                      # deterministic walk; the tree id is checked anyway
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
    # The MIT terms ask for the copyright and permission notice to go with every copy, so the
    # credits quote it verbatim from the pinned README ("License" section, to the end of the file).
    txt = readme.decode('utf-8')
    lic = txt[txt.index('Copyright (C) 2012 Hanno Rein'):]
    OEC_LICENCE_TEXT.append(' '.join(' '.join(p.split()) for p in lic.split('\n\n') if p.strip()))
    report['oec_files'] = len(files)
    return files


# --------------------------------------------------------------------------------------------
# Colour: Teff -> sRGB table, and colour index / spectral type -> Teff
# --------------------------------------------------------------------------------------------
def colour_lut():
    with warnings.catch_warnings():            # colour-science warns that matplotlib is absent
        warnings.simplefilter('ignore')
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
            rows.append(dict(zip(cols, line.split(), strict=True)))
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
        for r, t in zip(rows, teff, strict=True):
            m = re.match(r'^([OBAFGKMLTY])(\d+(?:\.\d+)?)V$', r['SpT'])
            if m and np.isfinite(t):
                self.spt.setdefault(m.group(1), []).append((float(m.group(2)), t))
        for k in self.spt:
            self.spt[k].sort()
        self.spt_median = {k: float(np.median([t for _, t in v])) for k, v in self.spt.items()}
        self._spt_cache = {}
        report['mamajek'] = {'rows': self.table_rows, 'btvt_range': [float(self.btvt_x[0]),
                                                                    float(self.btvt_x[-1])]}
        spt = {r['SpT']: t for r, t in zip(rows, teff, strict=True)}
        report['ballesteros_check'] = {
            'bv_-0.215_K': int(round(float(self.ballesteros(-0.215)))), 'mamajek_B2V_K': int(spt['B2V']),
            'bv_0.65_K': int(round(float(self.ballesteros(0.65)))), 'mamajek_G2V_K': int(spt['G2V'])}

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
    """Four significant digits of the distance (1e-4 relative, finer than any parallax here)."""
    dec = int(max(1, min(5, 3 - math.floor(math.log10(max(dist, 1e-3))))))
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
    for i, (h, c) in enumerate(zip(st["hip"].tolist(), st["comp"].tolist(), strict=True)):
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
    return q, poe, pe


# --------------------------------------------------------------------------------------------
# Stage 1: AT-HYG with the derived columns every later stage uses
# --------------------------------------------------------------------------------------------
class Catalogue:
    """AT-HYG rows (m10 plus the HYG-linked rows outside it) with direction, distance quality,
    V magnitude, spectral type and display temperature."""

    def __init__(self, u, hyg, st, tm):
        self.u = u
        self.n = len(u['id'])
        self.ra = u['ra'] * 15.0
        self.dec = u['dec']
        self.dir = unit(self.ra, self.dec)
        j, how = join_stellarium(u, st)
        self.q, self.poe, self.pe = quality(u, st, j, how)
        self.ds = np.array([ATHYG_DS[s] for s in u['dist_src']], np.int8)

        # AT-HYG dropped the spectral type of Gliese-linked rows; HYG still has it.
        hyg_row = {int(x): i for i, x in enumerate(hyg['id'].tolist())}
        uh = np.array([hyg_row.get(as_int(x), -1) for x in u['hyg']], np.int64)
        self.spect = u['spect'].copy()
        fill = (self.spect == '') & (uh >= 0)
        self.spect[fill] = hyg['spect'][uh[fill]]
        report['spect_filled_from_hyg'] = int((fill & (self.spect != '')).sum())
        ci = u['ci'].copy()
        ci_is_bv = u['mag_src'] != 'T'            # 'ci' is BT-VT for Tycho-2 rows, else B-V
        fillc = ~np.isfinite(ci) & (uh >= 0)
        ci[fillc] = hyg['ci'][uh[fillc]]
        ci_is_bv = ci_is_bv | fillc               # HYG colour indices are Johnson B-V
        report['ci_filled_from_hyg'] = int((fillc & np.isfinite(ci)).sum())

        # V: AT-HYG 'mag' is VT for Tycho-2 rows; V = VT - 0.090 (BT-VT) (AT-HYG v1 build notes)
        self.vmag = u['mag'].copy()
        tyc = (u['mag_src'] == 'T') & np.isfinite(u['ci'])
        self.vmag[tyc] = u['mag'][tyc] - 0.090 * u['ci'][tyc]
        report['vt_to_v_converted'] = int(tyc.sum())
        report['vt_kept_no_btvt'] = int(((u['mag_src'] == 'T') & ~np.isfinite(u['ci'])).sum())

        self.teff, self.tsrc = tm.teff(ci, ci_is_bv, self.spect)

        self.by_hyg, self.by_hip, self.by_gaia = {}, {}, {}
        for i in range(self.n):
            if u['hyg'][i]:
                self.by_hyg.setdefault(int(u['hyg'][i]), i)
            if u['hip'][i]:
                self.by_hip.setdefault(int(u['hip'][i]), i)
            if u['gaia'][i]:
                self.by_gaia.setdefault(int(u['gaia'][i]), i)

    def row(self, i):
        u = self.u
        return dict(kind='u', ui=i, ra=float(self.ra[i]), dec=float(self.dec[i]),
                    dist=float(u['dist'][i]), ds=int(self.ds[i]), q=int(self.q[i]),
                    vmag=float(self.vmag[i]), spect=self.spect[i], teff=float(self.teff[i]),
                    tsrc=int(self.tsrc[i]), flags=0, hip=as_int(u['hip'][i]), gl=u['gl'][i],
                    gaia=as_int(u['gaia'][i]), hd=as_int(u['hd'][i]), tyc=u['tyc'][i],
                    bayer=u['bayer'][i], flam=u['flam'][i], con=u['con'][i],
                    proper=u['proper'][i])


# --------------------------------------------------------------------------------------------
# Stage 2: HYG rows AT-HYG does not carry (Gliese companions, Gliese-only stars)
# --------------------------------------------------------------------------------------------
def hyg_extra_rows(cat, hyg):
    u = cat.u
    in_u = set(cat.by_hyg)
    hyg_row = {int(x): i for i, x in enumerate(hyg['id'].tolist())}

    def hdist(i):
        return float(hyg['dist'][i]) if hyg['dist'][i] < 99999 else math.nan   # 100000 = none

    extra = []
    for i in range(len(hyg['id'])):
        hid = int(hyg['id'][i])
        if hid in in_u:
            continue
        prim = int(hyg['comp_primary'][i])
        r = dict(kind='x', hyg=i, hid=hid, ra=float(hyg['ra'][i]) * 15, dec=float(hyg['dec'][i]),
                 vmag=float(hyg['mag'][i]), spect=hyg['spect'][i], ci=float(hyg['ci'][i]),
                 hip=as_int(hyg['hip'][i]), gl=hyg['gl'][i], hd=as_int(hyg['hd'][i]),
                 hr=as_int(hyg['hr'][i]), bayer=hyg['bayer'][i], flam=hyg['flam'][i],
                 con=hyg['con'][i], proper=hyg['proper'][i], flags=0, primary_hyg=prim)
        if prim != hid and prim in cat.by_hyg:
            # a companion: at its primary's AT-HYG distance, along its own HYG direction
            pu = cat.by_hyg[prim]
            r.update(dist=float(u['dist'][pu]), ds=int(cat.ds[pu]), q=int(cat.q[pu]),
                     flags=F_COMPANION)
        elif prim != hid and prim in hyg_row:
            # a companion of another HYG-only row: at that primary's HYG distance
            pj = hyg_row[prim]
            r.update(dist=hdist(pj), ds=DS_HIP if as_int(hyg['hip'][pj]) else DS_GJ, q=Q_UNKNOWN,
                     flags=F_COMPANION)
        else:
            r.update(dist=hdist(i), ds=DS_HIP if r['hip'] else DS_GJ, q=Q_UNKNOWN)
        if not math.isfinite(r['dist']):
            r.update(ds=DS_NONE, q=Q_NONE)
        extra.append(r)
    report['hyg_rows_not_in_athyg'] = len(extra)
    return extra


def gliese_vs_gaia(cat, hyg):
    """How Gliese 1991 distances compare with Gaia DR3, measured on the Gliese-only (no HIP) HYG
    stars within 20 pc that AT-HYG did match to a Gaia DR3 parallax."""
    r = []
    for i in range(len(hyg['id'])):
        if hyg['hip'][i] or not hyg['dist'][i] <= NEAR_PC:
            continue
        j = cat.by_hyg.get(int(hyg['id'][i]))
        if j is not None and cat.u['dist_src'][j] == 'G_R3':
            r.append(cat.u['dist'][j] / hyg['dist'][i])
    r = np.array(r)
    report['gliese_vs_gaia_within_20pc'] = dict(
        stars=int(len(r)), median_ratio=round(float(np.median(r)), 3),
        within_20pct=round(float(np.mean(np.abs(r - 1) < 0.2)), 3),
        off_by_factor_2=round(float(np.mean((r > 2) | (r < 0.5))), 3))


def extra_row(r, tm):
    T, s = tm.teff(np.array([r['ci']]), np.array([True]), np.array([r['spect']], object))
    return dict(r, teff=float(T[0]), tsrc=int(s[0]))


# --------------------------------------------------------------------------------------------
# Stage 3: IAU names and constellation figures (Stellarium modern_iau)
# --------------------------------------------------------------------------------------------
def iau_names_and_figures(iau, cat, hyg, extra):
    xhip = {}
    for k, r in enumerate(extra):
        if r['hip']:
            xhip.setdefault(r['hip'], k)
    # HIP 55203 = xi UMa: deleted from HYG (version-info, v3.5), still used by the UMa figure.
    xi = [i for i in range(len(hyg['id'])) if hyg['bayer'][i] == 'Xi' and hyg['con'][i] == 'UMa'
          and int(hyg['comp'][i]) == 1]
    assert len(xi) == 1 and int(hyg['id'][xi[0]]) in cat.by_hyg, 'xi UMa A not found'
    alias = {55203: ('u', cat.by_hyg[int(hyg['id'][xi[0]])])}

    def resolve_hip(h):
        if h in alias:
            return alias[h]
        if h in cat.by_hip:
            return ('u', cat.by_hip[h])
        if h in xhip:
            return ('x', xhip[h])
        return None

    names, unplaced = {}, []
    for key, entries in sorted(iau['common_names'].items()):
        k = key.strip()                        # one Gaia key carries a trailing space
        eng = next((e.get('english') for e in entries if 2 in (e.get('references') or [])), None)
        m = re.match(r'^HIP\s*(\d+)\s*([A-Z]?)$', k)
        g = re.match(r'^Gaia DR3\s*(\d+)$', k)
        if not eng or not (m or g):
            continue                           # deep-sky names, or not from the IAU-CSN list
        ref = None
        if m and m.group(2) in ('', 'A'):      # 'HIP 88267A', 'HIP 73695 A': the primary's row
            ref = resolve_hip(int(m.group(1)))
        elif m:                                # 'HIP 72105 B': only the B component's own row
            base = resolve_hip(int(m.group(1)))
            if base and base[0] == 'u':
                hid = as_int(cat.u['hyg'][base[1]])
                c = [x for x, r in enumerate(extra) if r['primary_hyg'] == hid
                     and r['gl'].strip().endswith(m.group(2))]
                ref = ('x', c[0]) if len(c) == 1 else None
        else:
            gg = int(g.group(1))
            ref = ('u', cat.by_gaia[gg]) if gg in cat.by_gaia else None
        if ref is None:
            unplaced.append(f'{k} ({eng})')
        else:
            names.setdefault(ref, eng)
    report['iau_names_used'] = len(names)
    report['iau_names_without_catalogue_row'] = unplaced

    cons, line_refs = [], {}
    for c in iau['constellations']:
        abbr = c['id'].split()[-1]
        cons.append((abbr, c['common_name']['english'], c['lines']))
        for pl in c['lines']:
            for h in pl:
                r = resolve_hip(int(h))
                if r is None:
                    sys.exit(f'constellation {abbr}: HIP {h} has no catalogue row')
                line_refs[int(h)] = r
    return names, cons, line_refs


# --------------------------------------------------------------------------------------------
# Stage 4: Open Exoplanet Catalogue — confirmed planets, their hosts, and the join
# --------------------------------------------------------------------------------------------
def parse_oec(files):
    def confirmed(p):
        return any((x.text or '').strip() == 'Confirmed planets' for x in p.findall('list'))

    def planet(p, circum):
        yr = fnum(p, 'discoveryyear')
        return dict(name=(p.findtext('name') or '').strip(), period_d=sig(fnum(p, 'period')),
                    a_au=sig(fnum(p, 'semimajoraxis')), mass_mj=sig(fnum(p, 'mass')),
                    radius_rj=sig(fnum(p, 'radius')), year=int(yr) if yr else None,
                    method=(p.findtext('discoverymethod') or '').strip() or None,
                    circumbinary=circum)

    hosts = []
    stats = dict(planets_confirmed=0, planets_other_lists=0, free_floating_skipped=0,
                 circumbinary=0)
    for fn in sorted(files):
        root = ET.fromstring(files[fn])
        sysdist = fnum(root, 'distance')
        err = None
        de = root.find('distance')
        if de is not None and sysdist:
            try:
                err = 0.5 * (float(de.get('errorminus')) + float(de.get('errorplus')))
            except (TypeError, ValueError):
                err = None
        ra_s, de_s = root.findtext('rightascension'), root.findtext('declination')
        base = dict(file=fn, sysdist=sysdist, sys_err=err,
                    ra=sexa(ra_s, True) if ra_s else None, dec=sexa(de_s, False) if de_s else None)
        for p in root.iter('planet'):
            stats['planets_confirmed' if confirmed(p) else 'planets_other_lists'] += 1
        stats['free_floating_skipped'] += sum(1 for p in root.findall('planet') if confirmed(p))
        for star in root.iter('star'):
            pl = [planet(p, False) for p in star.findall('planet') if confirmed(p)]
            if pl:
                hosts.append(dict(base, names=[(n.text or '').strip() for n in star.findall('name')],
                                  bnames=[], star=star, planets=pl))
        for b in root.iter('binary'):
            pl = [planet(p, True) for p in b.findall('planet') if confirmed(p)]
            if pl:
                stats['circumbinary'] += len(pl)
                stars = list(b.iter('star'))
                hosts.append(dict(base, names=[(n.text or '').strip() for s in stars
                                               for n in s.findall('name')],
                                  bnames=[(n.text or '').strip() for n in b.findall('name')],
                                  star=stars[0] if stars else None, planets=pl))
    report['oec'] = stats
    report['oec_host_entries'] = len(hosts)
    return hosts


def oec_keys(names):
    """Identifier keys in an OEC name list, most reliable first. A B/C component suffix on a HIP
    or HD number means a different star than the catalogue row with that number, so those are
    not used; Gliese names keep their component letter."""
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


def join_oec(hosts, cat, extra):
    """h['ref'] = ('u', i) | ('x', k) | None, by identifier, else by position and distance."""
    from scipy.spatial import cKDTree
    u = cat.u
    idx = {}
    for i in range(cat.n):
        for key in (('gaia', as_int(u['gaia'][i])), ('hip', as_int(u['hip'][i])),
                    ('tyc', u['tyc'][i]), ('hd', as_int(u['hd'][i])),
                    ('gl', norm_gl(u['gl'][i]) if u['gl'][i] else None)):
            if key[1]:
                idx.setdefault(key, ('u', i))
    for k, r in enumerate(extra):
        for key in (('hip', r['hip']), ('hd', r['hd']), ('gl', norm_gl(r['gl']) if r['gl'] else None)):
            if key[1]:
                idx.setdefault(key, ('x', k))

    pos_dir = np.concatenate([cat.dir, unit(np.array([r['ra'] for r in extra]),
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

    def plausible(ref, h):
        """Keep an identifier join unless the row is more than ID_JOIN_MAX_DEG from OEC's own
        coordinates AND disagrees with OEC's distance by more than ID_JOIN_MAX_DIST_FRAC (or OEC
        gives none). Both at once mean OEC's identifier is wrong: 'HIP 904' for HD 11964 A (HIP
        9094), 'HIP 1291 A' for Gliese 3021 A (HIP 1292). One alone is usually an OEC coordinate
        slip (HIP 3206) or a system position for a wide member (Proxima in 'Alpha Centauri')."""
        if h['ra'] is None:
            return True
        k = ref[1] if ref[0] == 'u' else cat.n + ref[1]
        sep = math.degrees(math.acos(min(1.0, float(pos_dir[k] @ unit(h['ra'], h['dec'])))))
        if sep <= ID_JOIN_MAX_DEG:
            return True
        dd = pos_dist[k]
        return bool(h['sysdist'] and np.isfinite(dd)
                    and abs(dd / h['sysdist'] - 1) <= ID_JOIN_MAX_DIST_FRAC)

    stats = dict(by_id=0, by_position=0, oec_only=0)
    rejected = []
    for h in hosts:
        cands = [idx[k] for k in oec_keys(h['names'] + h['bnames']) if k in idx]
        ok = [c for c in cands if plausible(c, h)]
        ref = ok[0] if ok else None
        if cands and ref != cands[0]:
            rejected.append(h['names'][0] if h['names'] else h['file'])
        how = 'id' if ref else None
        if ref is None and h['ra'] is not None and h['sysdist']:
            v = unit(h['ra'], h['dec'])
            hc = comp_letter(h['names'][0] if h['names'] else '')
            best = None
            for c in sorted(tree.query_ball_point(v, math.radians(POS_MATCH_ARCSEC / 3600))):
                dd = pos_dist[c]
                if not (np.isfinite(dd) and abs(dd / h['sysdist'] - 1) <= POS_MATCH_DIST_FRAC):
                    continue
                rc = gl_comp(pos_gl[c])
                if hc and rc and hc != rc:     # e.g. OEC 'Gliese 667 C' is not Gl 667A
                    continue
                sep = math.degrees(math.acos(min(1.0, float(pos_dir[c] @ v)))) * 3600
                if best is None or sep < best[0]:
                    best = (sep, c)
            if best:
                ref = ('u', best[1]) if best[1] < cat.n else ('x', best[1] - cat.n)
                how = 'position'
        h['ref'] = ref
        stats['by_id' if how == 'id' else 'by_position' if how else 'oec_only'] += 1
    report['oec_join'] = stats
    report['oec_id_joins_rejected'] = sorted(rejected)


def oec_quality(h):
    """Distance quality for a host placed from OEC's own distance, from its quoted error."""
    if not h['sys_err']:
        return Q_UNKNOWN
    poe = h['sysdist'] / h['sys_err']
    return Q_GOOD if poe > DEEP_MIN_POE else Q_FAIR if poe > POE_FAIR else Q_BAD


# --------------------------------------------------------------------------------------------
# Stage 5: which stars are named, and their rows
# --------------------------------------------------------------------------------------------
def select_named(cat, extra, tm, iau_names, line_refs, hosts):
    named = {}                 # ref -> row dict; ref = ('u', i) | ('x', k) | ('o', n)

    def get(ref):
        if ref not in named:
            named[ref] = cat.row(ref[1]) if ref[0] == 'u' else extra_row(extra[ref[1]], tm)
            named[ref]['why'] = set()
        return named[ref]

    for i in np.where(cat.vmag < NAMED_VMAG)[0]:
        get(('u', int(i)))['why'].add('V<6.5')
    for i in np.where(np.isfinite(cat.u['dist']) & (cat.u['dist'] <= NEAR_PC))[0]:
        get(('u', int(i)))['why'].add('<=20pc')
    for k, r in enumerate(extra):
        if r['vmag'] < NAMED_VMAG:
            get(('x', k))['why'].add('V<6.5')
        if math.isfinite(r['dist']) and r['dist'] <= NEAR_PC:
            get(('x', k))['why'].add('<=20pc')
    for ref in iau_names:
        get(ref)['why'].add('IAU name')
    for ref in line_refs.values():
        get(ref)['why'].add('constellation figure')

    host_of = {}
    n_oec = n_bad = n_switched = 0
    for n, h in enumerate(hosts):
        ref = h['ref']
        if ref is not None:
            row = named.get(ref) or (cat.row(ref[1]) if ref[0] == 'u' else extra_row(extra[ref[1]], tm))
            usable = row['q'] not in (Q_NONE, Q_BAD)
            best = row['dist'] if usable else h['sysdist']
            if ref not in named and not (best is not None and best <= HOST_PC):
                continue
            r = get(ref)
            if not usable and h['sysdist'] and oec_quality(h) != Q_BAD:
                r.update(dist=h['sysdist'], ds=DS_OEC, q=oec_quality(h))
                n_switched += 1
        else:
            if h['ra'] is None or not h['sysdist'] or h['sysdist'] > HOST_PC:
                continue
            if oec_quality(h) == Q_BAD:        # OEC's own distance is too uncertain to place
                n_bad += 1
                continue
            star = h['star']
            spt = (star.findtext('spectraltype') or '').strip() if star is not None else ''
            ot = fnum(star, 'temperature')
            T, s = tm.teff(np.array([np.nan]), np.array([False]), np.array([spt], object),
                           oec_teff=np.array([ot if ot else np.nan]))
            vm = fnum(star, 'magV')
            ref = ('o', n)
            named[ref] = dict(
                kind='o', ra=h['ra'], dec=h['dec'], dist=h['sysdist'], ds=DS_OEC, q=oec_quality(h),
                vmag=vm if vm is not None else math.nan, spect=spt, teff=float(T[0]),
                tsrc=int(s[0]), flags=0, bayer='', flam='', con='', why=set(),
                oec_name=(h['bnames'] or h['names'] or [h['file'][len('systems/'):-4]])[0],
                # a proper name the catalogue itself gives, e.g. "Teegarden's Star"
                proper=next((x for x in h['names'] if re.search(r"\S\s+Star$", x)), ''))
            r = named[ref]
            n_oec += 1
        r['why'].add('exoplanet host')
        host_of.setdefault(ref, []).extend(h['planets'])
    report['oec_only_rows'] = n_oec
    report['oec_only_hosts_skipped_distance_error'] = n_bad
    report['host_rows_placed_at_oec_distance'] = n_switched
    why = {}
    for r in named.values():
        for w in r['why']:
            why[w] = why.get(w, 0) + 1
    report['named_reasons'] = dict(sorted(why.items()))
    return named, host_of


def named_rows(named, host_of, iau_names, cat):
    rows = []
    for ref, r in named.items():
        f = r['flags']
        if ref in host_of:
            f |= F_HOST
        if WD_RE.match(r['spect'] or ''):
            f |= F_WD
        f |= {Q_FAIR: F_POE_FAIR, Q_BAD: F_UNPLACED, Q_NONE: F_UNPLACED,
              Q_UNKNOWN: F_ERR_UNKNOWN}.get(r['q'], 0)
        if ref in iau_names:
            name, f = iau_names[ref], f | F_IAU
        else:
            name = r.get('proper') or ''
        if r['kind'] == 'u':
            ident = (f'HIP {r["hip"]}' if r['hip'] else r['gl'] if r['gl'] else
                     f'Gaia DR3 {r["gaia"]}' if r['gaia'] else f'HD {r["hd"]}' if r['hd'] else
                     f'TYC {r["tyc"]}' if r['tyc'] else f'AT-HYG {int(cat.u["id"][r["ui"]])}')
        elif r['kind'] == 'x':
            ident = (f'HIP {r["hip"]}' if r['hip'] else r['gl'] if r['gl'] else
                     f'HD {r["hd"]}' if r['hd'] else f'HR {r["hr"]}' if r['hr'] else
                     f'HYG {r["hid"]}')
        else:
            ident = r['oec_name']
        placed = not (f & F_UNPLACED)
        if placed:
            xyz = round_pos(unit(r['ra'], r['dec']) * r['dist'], r['dist'])
        else:
            xyz = [round(float(c), 5) for c in unit(r['ra'], r['dec'])]
        vm = r['vmag'] if math.isfinite(r['vmag']) else None
        am = vm + 5 - 5 * math.log10(r['dist']) if (vm is not None and placed) else None
        rows.append(dict(ref=ref, id=ident, name=name, desig=desig(r['bayer'], r['flam'], r['con']),
                         con=r['con'], xyz=xyz, vmag=None if vm is None else round(vm, 2),
                         absmag=None if am is None else round(am, 1),
                         colour=int(teff_code([r['teff']])[0]), spect=r['spect'] or '',
                         ds=int(r['ds']), flags=int(f), tsrc=r['tsrc'], why=r['why']))

    # A HYG proper name that the IAU list gives to another row (e.g. HYG's "Alrakis" on
    # GJ 9584A while the IAU name belongs to HIP 83608) is dropped from the non-IAU row.
    iau_set = set(iau_names.values())
    dropped = [r['id'] for r in rows if r['name'] in iau_set and not r['flags'] & F_IAU]
    for r in rows:
        if r['name'] in iau_set and not r['flags'] & F_IAU:
            r['name'] = ''
    report['proper_names_dropped_as_iau_duplicates'] = sorted(dropped)

    seen = {}
    for r in rows:
        seen[r['id']] = seen.get(r['id'], 0) + 1
    report['named_duplicate_ids'] = sorted(k for k, v in seen.items() if v > 1)
    assert not report['named_duplicate_ids'], report['named_duplicate_ids']
    rows.sort(key=lambda r: (r['vmag'] is None, r['vmag'] if r['vmag'] is not None else 0, r['id']))
    return rows


# --------------------------------------------------------------------------------------------
# Stage 6: writers
# --------------------------------------------------------------------------------------------
FLAG_BITS = {'0': 'exoplanet host (confirmed planets in exoplanets.json)',
             '1': 'white dwarf (spectral type ^D[ABCOQZX])',
             '2': "companion placed at its primary's distance",
             '3': 'parallax/error between 5 and 10',
             '4': 'no usable parallax: x,y,z is the unit direction, not a position',
             '5': 'name is from the IAU Catalog of Star Names',
             '6': 'no per-star parallax error available for the shipped distance'}


def write_named(rows):
    out = {'count': len(rows)}
    for c in ('id', 'name', 'desig', 'con', 'vmag', 'absmag', 'colour', 'spect', 'flags'):
        out[c] = [r[c] for r in rows]
    out['x'] = [r['xyz'][0] for r in rows]
    out['y'] = [r['xyz'][1] for r in rows]
    out['z'] = [r['xyz'][2] for r in rows]
    out['dist_src'] = [r['ds'] for r in rows]
    out['dist_src_labels'] = DIST_SRC_LABELS
    out['flag_bits'] = FLAG_BITS
    out['frame'] = 'ICRS, heliocentric, parsecs; J2000.0 positions; no extinction correction'
    write_json('stars/named.json', out, ndigits=6)
    return out


def write_constellations(cons, line_refs, rows):
    row_of = {r['ref']: k for k, r in enumerate(rows)}
    out = {}
    total = unique = sky_n = 0
    for abbr, cname, lines in cons:
        seen, lines3, sky = set(), [], []
        for pl in lines:
            for a, b in zip(pl[:-1], pl[1:], strict=True):
                total += 1
                ia, ib = row_of[line_refs[int(a)]], row_of[line_refs[int(b)]]
                key = (min(ia, ib), max(ia, ib))
                if key in seen or ia == ib:    # polylines retrace some segments
                    continue
                seen.add(key)
                unique += 1
                if (rows[ia]['flags'] | rows[ib]['flags']) & F_UNPLACED:
                    sky.append([ia, ib])
                    sky_n += 1
                else:
                    lines3.append([ia, ib])
        out[abbr] = {'name': cname, 'lines': lines3, 'lines_sky_only': sky}
    write_json('stars/constellations.json', out)
    report['constellations'] = dict(count=len(out), polyline_segments=total,
                                    unique_segments=unique, dropped_from_3d=sky_n)


def write_exoplanets(host_of, rows):
    row_of = {r['ref']: k for k, r in enumerate(rows)}
    methods = sorted({p['method'] for pls in host_of.values() for p in pls if p['method']})
    out = {'fields': ['name', 'period_d', 'a_au', 'mass_mj', 'radius_rj', 'year', 'method',
                      'circumbinary'],
           'methods': methods, 'hosts': {},
           'source': f'Open Exoplanet Catalogue, git commit {OEC_COMMIT}; list = Confirmed planets',
           'units': {'period_d': 'days', 'a_au': 'AU',
                     'mass_mj': 'Jupiter masses, as the catalogue gives it (for radial-velocity '
                                'planets usually the minimum mass)',
                     'radius_rj': 'Jupiter radii', 'year': 'discovery year',
                     'method': 'index into methods', 'circumbinary': '1 if it orbits a binary'},
           'note': 'null = not given by the catalogue; values rounded to 4 significant digits'}
    n = 0
    for ref, pls in host_of.items():
        seen, lst = set(), []
        for p in pls:
            if p['name'] in seen:
                continue
            seen.add(p['name'])
            lst.append([p['name'], p['period_d'], p['a_au'], p['mass_mj'], p['radius_rj'],
                        p['year'], methods.index(p['method']) if p['method'] else None,
                        1 if p['circumbinary'] else 0])
        lst.sort(key=lambda p: p[0])
        out['hosts'][str(row_of[ref])] = lst
        n += len(lst)
    write_json('stars/exoplanets.json', out, ndigits=6)
    report['exoplanets'] = dict(hosts=len(out['hosts']), planets=n)


def write_deep(cat, named):
    u = cat.u
    in_named = np.zeros(cat.n, bool)
    for ref in named:
        if ref[0] == 'u':
            in_named[ref[1]] = True
    base = (u['in_m10'] & np.isin(u['dist_src'], ['G_R3', 'HIP', 'G_R2', 'GJ'])
            & (u['dist'] <= DEEP_MAX_PC))
    good = base & (cat.q == Q_GOOD)
    sel = good & ~in_named
    report['deep_selection'] = {
        'm10_within_500pc_with_distance': int(base.sum()),
        'error_applies_and_poe_gt_10': int(good.sum()),
        'dropped_poe_le_10': int((base & ((cat.q == Q_FAIR) | (cat.q == Q_BAD))).sum()),
        'dropped_no_applicable_error': int((base & (cat.q == Q_UNKNOWN)).sum()),
        'moved_to_named': int((good & in_named).sum()),
        'shipped': int(sel.sum())}
    di = np.where(sel)[0]
    g3 = di[u['dist_src'][di] == 'G_R3']
    report['deep_gaia_parallax_error_mas'] = {
        f'p{p}': round(float(np.percentile(cat.pe[g3], p)), 3) for p in (10, 50, 90, 99)}
    d = u['dist'][di]
    q = np.rint(cat.dir[di] * d[:, None] * POS_SCALE)
    assert np.abs(q).max() <= 32767
    mv = cat.vmag[di] + 5 - 5 * np.log10(d)
    mf = np.rint((mv + 8.0) * 10)
    report['deep_absmag_clamped'] = int(((mf < 0) | (mf > 255)).sum())
    mcode = np.clip(mf, 0, 255).astype(np.uint8)
    ccode = teff_code(cat.teff[di])
    order = np.lexsort((u['id'][di], np.rint(d * 1000), mcode))
    rec = np.zeros(len(di), dtype=[('x', '<i2'), ('y', '<i2'), ('z', '<i2'), ('m', 'u1'), ('c', 'u1')])
    rec['x'], rec['y'], rec['z'] = q[order, 0], q[order, 1], q[order, 2]
    rec['m'], rec['c'] = mcode[order], ccode[order]
    write_bin('stars/deep.bin', rec.tobytes())
    ms = rec['m']
    ts, ds = cat.tsrc[di], u['dist_src'][di]
    write_json('stars/deep.json', {
        'count': int(len(di)), 'record_bytes': 8,
        'fields': [{'name': 'x', 'type': 'int16', 'offset': 0},
                   {'name': 'y', 'type': 'int16', 'offset': 2},
                   {'name': 'z', 'type': 'int16', 'offset': 4},
                   {'name': 'absmag_code', 'type': 'uint8', 'offset': 6},
                   {'name': 'colour_code', 'type': 'uint8', 'offset': 7}],
        'units_per_pc': POS_SCALE, 'quantisation_pc': 1 / POS_SCALE,
        'absmag': {'M_V': 'absmag_code / 10 - 8', 'min': -8.0, 'max': 17.5,
                   'note': 'V + 5 - 5 log10(d / pc); no extinction correction'},
        'colour': 'colour_code indexes stars/colour.json (255 = no colour measurement)',
        'frame': 'ICRS, heliocentric; x -> RA 0 Dec 0, z -> north celestial pole; little-endian',
        'order': ('absmag_code ascending (intrinsically brightest first), then distance, then '
                  'AT-HYG id; the first mv_prefix[k] records are the stars whose absmag_code / '
                  '10 - 8 <= k'),
        'mv_prefix': {str(t): int(np.searchsorted(ms, (t + 8) * 10, side='right'))
                      for t in range(-8, 18)},
        'selection': ('AT-HYG v3.2 m10 subset, distance <= 500 pc, parallax/error > 10 where a '
                      'per-star error applies to the shipped distance; every star in named.json '
                      'removed'),
        'dist_src_counts': {DIST_SRC_LABELS[ATHYG_DS[k]]: int((ds == k).sum())
                            for k in ('G_R3', 'G_R2', 'HIP', 'GJ')},
        'colour_src_counts': {TEFF_SRC_LABELS[k]: int((ts == k).sum()) for k in range(6)},
    }, pretty=True)
    report['deep_colour_src'] = {TEFF_SRC_LABELS[k]: int((ts == k).sum()) for k in range(6)}
    report['deep_count'] = int(len(di))


def write_colour(temps, srgb, lin, M):
    write_json('stars/colour.json', {
        'count': 256, 'unknown_index': UNKNOWN_COLOUR,
        'teff_k': [int(round(t)) for t in temps] + [None],
        'srgb': srgb, 'linear': lin,
        'index_from_teff': (f'round(254 * ln(T / {LUT_TMIN:g}) / ln({LUT_TMAX:g} / {LUT_TMIN:g})), '
                            'clamped to 0..254'),
        'method': ('Planck spectrum at T, integrated at 1 nm over 360-830 nm against the CIE 1931 '
                   '2-degree colour-matching functions -> XYZ -> linear sRGB with the IEC '
                   '61966-2-1 matrix (D65 white) -> negative components set to 0 -> divided by the '
                   'largest component (chromaticity only; brightness comes from the magnitude). '
                   '"srgb" is encoded with the sRGB transfer curve, "linear" is not.'),
        'xyz_to_linear_srgb': [[float(v) for v in row] for row in M],
        'teff_note': ('Display temperatures, not measurements: from B-V by the Ballesteros (2012) '
                      "blackbody model, from BT-VT or spectral type through Mamajek's dwarf "
                      'sequence (v2022.04.16), or from the Open Exoplanet Catalogue. Observed '
                      'colours: interstellar reddening is not removed. Entry 255 is neutral white '
                      'for stars with no colour index, spectral type or catalogue Teff.'),
    }, ndigits=6)


# --------------------------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------------------------
def main():
    log('step 40 — stars')
    u = load_athyg()
    hyg = load_hyg()
    st = load_stellarium()
    oec = oec_systems()
    with open(src_path('iau_index'), encoding='utf-8') as f:
        iau = json.load(f)
    for k in ('athyg_license', 'athyg_ack', 'athyg_v1builds', 'hyg_license', 'hyg_versioninfo',
              'stel_copying', 'iau_description'):
        src_path(k)                            # the pinned licence/provenance texts quoted in credits
    temps, srgb, lin, M = colour_lut()
    tm = TeffModel()

    cat = Catalogue(u, hyg, st, tm)
    report['athyg_gaia_dr3_share'] = round(float((u['dist_src'][u['in_m10']] == 'G_R3').mean()), 4)
    gliese_vs_gaia(cat, hyg)
    extra = hyg_extra_rows(cat, hyg)
    iau_names, cons, line_refs = iau_names_and_figures(iau, cat, hyg, extra)
    hosts = parse_oec(oec)
    join_oec(hosts, cat, extra)
    named, host_of = select_named(cat, extra, tm, iau_names, line_refs, hosts)
    rows = named_rows(named, host_of, iau_names, cat)

    nj = write_named(rows)
    write_constellations(cons, line_refs, rows)
    write_exoplanets(host_of, rows)
    write_deep(cat, named)
    write_colour(temps, srgb, lin, M)

    flags = np.array(nj['flags'])
    dsn = np.array(nj['dist_src'])
    near = np.array(['<=20pc' in r['why'] or (not r['flags'] & F_UNPLACED and
                                              math.dist(r['xyz'], (0, 0, 0)) <= NEAR_PC)
                     for r in rows])
    report['named'] = dict(
        rows=len(rows),
        flag_counts={FLAG_BITS[str(b)]: int(((flags >> b) & 1).sum()) for b in range(7)},
        within_20pc=int(near.sum()),
        within_20pc_dist_src={DIST_SRC_LABELS[k]: int(((dsn == k) & near).sum())
                              for k in range(len(DIST_SRC_LABELS))},
        colour_src={TEFF_SRC_LABELS[k]: int(sum(1 for r in rows if r['tsrc'] == k)) for k in range(6)})
    sizes = {f: os.path.getsize(os.path.join(DATA, 'stars', f))
             for f in ('deep.bin', 'deep.json', 'colour.json', 'named.json', 'constellations.json',
                       'exoplanets.json')}
    report['sizes'] = sizes
    write_credits()
    log(json.dumps(report, indent=1, ensure_ascii=False, sort_keys=True))
    if sizes['deep.bin'] > 1_900_000:
        sys.exit(f'deep.bin is {sizes["deep.bin"]} B, over the 1.9 MB budget')
    small = sizes['named.json'] + sizes['constellations.json'] + sizes['exoplanets.json']
    if small > 900_000:
        sys.exit(f'named + constellations + exoplanets = {small} B, over the 0.9 MB budget')


# --------------------------------------------------------------------------------------------
# Credits fragment
# --------------------------------------------------------------------------------------------
def write_credits():
    r = report
    dq = r['deep_selection']
    qa = r['quality_athyg']
    gv = r['gliese_vs_gaia_within_20pc']
    blocks = [
        dict(id='athyg',
             title='AT-HYG v3.2 (Augmented Tycho-HYG), subsets athyg_32_reduced_m10 and athyg_32_hyg_ids',
             owner='David Nash (astronexus)',
             source=('Compiled from Tycho-2 (Høg et al. 2000) and its first supplement, Hipparcos (ESA '
                     '1997, 2007 reduction via HYG), Gaia DR3 and DR2 parallaxes (ESA/Gaia/DPAC, from '
                     'gaiadr3.gaia_source_lite and SIMBAD look-ups), the Yale Bright Star Catalog, the '
                     'Gliese & Jahreiss 1991 nearby-star catalogue, the Tycho-2 Spectral Type Catalog '
                     '(Wright et al. 2003) and SIMBAD cross-identifications (CDS, Strasbourg).'),
             url=f'https://github.com/astronexus/ATHYG-Database/tree/{ATHYG_COMMIT}',
             licence='CC BY-SA 4.0',
             licence_quote=('"This work is licensed under a [Creative Commons Attribution-ShareAlike 4.0 '
                            'International License][cc-by-sa]." (LICENSE)'),
             retrieved=RETRIEVED,
             adaptations=(f'Positions turned into ICRS Cartesian parsecs from ra, dec and dist; V derived '
                          f'from Tycho VT as V = VT - 0.090 (BT-VT), the formula in AT-HYG\'s own build '
                          f'notes, for {r["vt_to_v_converted"]:,} rows; absolute magnitudes recomputed as '
                          f'V + 5 - 5 log10 d with no extinction correction; colour indices and spectral '
                          f'types turned into display temperatures; {dq["shipped"]:,} stars within 500 pc '
                          f'with parallax/error > 10 packed into deep.bin (pc x 64 in int16, M_V in 0.1 mag '
                          f'steps). The shipped star files are shared under CC BY-SA 4.0.'),
             accuracy=(f'Distances are 1/parallax with no prior; {r["athyg_gaia_dr3_share"]:.1%} of m10 rows '
                       f'use Gaia DR3. Equinox J2000.0; epoch J2000.0 except Tycho-2 stars with pflag X '
                       f'and no Hipparcos match (epoch J1991.5, per the build notes). AT-HYG\'s '
                       f'ACKNOWLEDGMENTS list neither SIMBAD nor Høg et al. 2000 although its build notes '
                       f'use both; both are credited here.')),
        dict(id='gaia-dr3', title='Gaia Data Release 3 (inside AT-HYG distances)',
             owner='European Space Agency (ESA), Gaia Data Processing and Analysis Consortium (DPAC)',
             source='Gaia Collaboration, Vallenari et al. 2023; parallaxes as carried by AT-HYG v3.2',
             url='https://www.cosmos.esa.int/gaia',
             licence=('CC BY-NC 3.0 IGO (non-commercial). ESA\'s Gaia licence page '
                      '(cosmos.esa.int/web/gaia-users/license) could not be read from the build network; a '
                      'web-search summary of it gives CC BY-NC 3.0 IGO, as do the Celestia and '
                      'celestia-gaia-stardb licence files. A third-party PyPI package states CC BY-SA 3.0 IGO '
                      '(ESA\'s licence for images), and the AWS Open Data registry "Attribution required". '
                      'This app uses the Gaia-derived values non-commercially, as that licence requires.'),
             licence_quote=('"This work has made use of data from the European Space Agency (ESA) mission Gaia '
                            '(https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and '
                            'Analysis Consortium (DPAC, https://www.cosmos.esa.int/web/gaia/dpac/consortium). '
                            'Funding for the DPAC has been provided by national institutions, in particular '
                            'the institutions participating in the Gaia Multilateral Agreement." '
                            '(AT-HYG ACKNOWLEDGMENTS.md)'),
             retrieved=RETRIEVED,
             adaptations='Used only as the distances AT-HYG already carries; no Gaia file is read directly.',
             accuracy=(f'Parallax errors of the Gaia DR3 stars in deep.bin, read from Stellarium\'s copy '
                       f'(stored in 0.01 mas steps) at build time: median '
                       f'{r["deep_gaia_parallax_error_mas"]["p50"]} mas, 90th percentile '
                       f'{r["deep_gaia_parallax_error_mas"]["p90"]} mas. No zero-point correction.')),
        dict(id='hyg', title='HYG database v4.1 (hygdata_v41.csv)', owner='David Nash (astronexus)',
             source=('Hipparcos (ESA 1997; 2007 new reduction), Yale Bright Star Catalog 5th ed. '
                     '(Hoffleit 1991), Gliese & Jahreiss 1991 (CNS3 preliminary); IAU WGSN names.'),
             url=f'https://github.com/astronexus/HYG-Database/tree/{HYG_COMMIT}',
             licence='CC BY-SA 4.0',
             licence_quote=('"The licensing for HYG v4.0 is Creative Commons CC BY-SA 4.0, unlike previous '
                            'versions of the HYG catalog." (hyg/version-info.md)'),
             retrieved=RETRIEVED,
             adaptations=(f'Used for the {r["hyg_rows_not_in_athyg"]} HYG rows AT-HYG does not carry: '
                          f'Gliese companions (at their primary\'s AT-HYG distance along their own '
                          f'direction, flag bit 2) and Gliese-only stars (at their Gliese 1991 distance, flag '
                          f'bit 6); spectral types filled in for {r["spect_filled_from_hyg"]} AT-HYG rows that '
                          f'had none; HIP 55203 (xi UMa, deleted in HYG v3.5) mapped to HYG\'s xi UMa A.'),
             accuracy=(f'Gliese 1991 distances are often photometric: of the {gv["stars"]} Gliese-only stars '
                       f'within 20 pc that AT-HYG matched to Gaia DR3, {gv["within_20pct"]:.0%} agree within '
                       f'20% and {gv["off_by_factor_2"]:.0%} are off by more than a factor of two '
                       f'(measured on these files).')),
        dict(id='stellarium-hipgaia3',
             title='Stellarium v26.2 hip_gaia3 star catalogues 0-3 (build-time check only, not shipped)',
             owner='Stellarium team; catalogues built by Henry Leung (henrysky/stellarium_star_catalogs)',
             source='Gaia DR3 (ESA/Gaia/DPAC) and Hipparcos values via SIMBAD',
             url=f'https://github.com/Stellarium/stellarium/tree/{STEL_COMMIT}/stars/hip_gaia3',
             licence='No data licence stated; the files sit in a GPL-2.0-or-later source tree',
             licence_quote='COPYING: "GNU GENERAL PUBLIC LICENSE Version 2, June 1991"; no data-specific notice.',
             retrieved=RETRIEVED,
             adaptations=(f'Nothing shipped. Each AT-HYG star was joined by Gaia DR3 id or HIP number to '
                          f'read a parallax error. The error qualifies AT-HYG\'s distance only when both '
                          f'come from the same Gaia DR3 source ({qa["error_applies_same_gaia_source"]:,} rows) '
                          f'or when the two parallaxes agree within 3 sigma '
                          f'({qa["error_applies_by_3sigma_agreement"]:,} rows); {qa["disagree_or_no_error"]:,} '
                          f'rows with a distance have no applicable error.'),
             accuracy='Parallax stored in 0.02 mas steps; the catalogue author calls the files experimental.'),
        dict(id='stellarium-modern-iau', title='Stellarium v26.2 sky culture "modern_iau"',
             owner="Stellarium's team",
             source=('Constellation figures from the IAU "The Constellations" pages (Sky & Telescope: Roger '
                     'Sinnott, Rick Fienberg, Alan MacRobert); star names from the IAU Catalog of Star '
                     'Names (IAU WGSN).'),
             url=f'https://github.com/Stellarium/stellarium/tree/{STEL_COMMIT}/skycultures/modern_iau',
             licence='CC BY-SA 4.0', licence_quote='description.md, "## License": "CC BY-SA 4.0"',
             retrieved=RETRIEVED,
             adaptations=(f'{r["constellations"]["unique_segments"]} unique figure segments resolved to '
                          f'named rows, {r["constellations"]["dropped_from_3d"]} of them kept for the sky '
                          f'view only because a star has no usable parallax; {r["iau_names_used"]} IAU names '
                          f'attached, {len(r["iau_names_without_catalogue_row"])} have no row in AT-HYG/HYG.'),
             accuracy=('Figures are a drawing convention, not a measurement; IAU constellations are defined '
                       'by their boundaries.')),
        dict(id='oec', title='Open Exoplanet Catalogue', owner='Hanno Rein and contributors',
             source=('Community-curated compilation (Rein 2012, arXiv:1211.7121); most recent entries '
                     'imported from the NASA Exoplanet Archive.'),
             url=f'https://github.com/OpenExoplanetCatalogue/open_exoplanet_catalogue/tree/{OEC_COMMIT}',
             licence='MIT',
             licence_quote=('"The database is licensed under an MIT license (see below), which basically says '
                            'you can do everything with it." (README.md) The licence, verbatim from the '
                            'README: "' + OEC_LICENCE_TEXT[0] + '"'),
             retrieved=RETRIEVED,
             adaptations=(f'Planets listed as "Confirmed planets" only: {r["exoplanets"]["planets"]:,} planets '
                          f'on {r["exoplanets"]["hosts"]} named rows. Hosts joined to AT-HYG/HYG by '
                          f'identifier or by position (<= 30 arcsec, distance within 5%); an identifier '
                          f'that points more than 1 degree from the catalogue\'s own coordinates and more '
                          f'than 50% off its distance is treated as a catalogue slip and not used '
                          f'({len(r["oec_id_joins_rejected"])} hosts: '
                          f'{", ".join(r["oec_id_joins_rejected"])}); '
                          f'{r["oec_only_rows"]} hosts within 100 pc placed from the catalogue\'s own '
                          f'coordinates and distance; values rounded to 4 significant digits.'),
             accuracy=('As of the pinned commit, and not complete: no planet is listed for Barnard\'s Star, '
                       'and eps Eridani b is "Controversial", so it is not shown.')),
        dict(id='mamajek',
             title='A Modern Mean Dwarf Stellar Color and Effective Temperature Sequence, v2022.04.16',
             owner='Eric Mamajek',
             source=('Pecaut & Mamajek 2013, ApJS 208, 9 (Table 5); the copy bundled in the MeanStars '
                     '3.6.1 wheel on PyPI'),
             url='https://pypi.org/project/MeanStars/3.6.1/',
             licence='No licence stated on the table (the MeanStars code is BSD-3-Clause)',
             licence_quote=('"that reference should be cited until an updated version of the table is '
                            'published" (file header)'),
             retrieved=RETRIEVED,
             adaptations=('Bt-Vt and spectral-type columns interpolated to effective temperature for display '
                          'colours; only the derived colour table ships.'),
             accuracy='A dwarf sequence applied to every luminosity class; display use only.'),
        dict(id='ballesteros', title='B-V to effective temperature (Ballesteros 2012, EPL 97, 34008) — a model',
             owner='F. J. Ballesteros; coefficients as coded in PyAstronomy 0.25.0 (MIT)',
             source='PyAstronomy/pyasl/asl/aslExt_1/ballesterosBV_T.py',
             url='https://pypi.org/project/PyAstronomy/0.25.0/', licence='MIT (PyAstronomy)',
             licence_quote='PyAstronomy 0.25.0 METADATA: "License: MIT"', retrieved=RETRIEVED,
             adaptations=('T = T0 (1/(a BV + b) + 1/(a BV + c)) with the coefficients read from the pinned '
                          'source: ' + ', '.join(f'{k} = {v:g}' for k, v in r['ballesteros_coefficients'].items())
                          + f'; used for {r["named"]["colour_src"][TEFF_SRC_LABELS[1]]:,} named and '
                          f'{r["deep_colour_src"][TEFF_SRC_LABELS[1]]:,} deep stars.'),
             accuracy=(f'A blackbody-based model. It underestimates hot stars: B-V = -0.215 gives '
                       f'{r["ballesteros_check"]["bv_-0.215_K"]:,} K where Mamajek\'s B2V row has '
                       f'{r["ballesteros_check"]["mamajek_B2V_K"]:,} K; at the Sun\'s B-V of 0.65 it gives '
                       f'{r["ballesteros_check"]["bv_0.65_K"]:,} K (Mamajek G2V: '
                       f'{r["ballesteros_check"]["mamajek_G2V_K"]:,} K).')),
        dict(id='cie1931', title='CIE 1931 2-degree standard observer colour-matching functions',
             owner='CIE (tabulated by CVRL), via colour-science 0.4.6 (BSD-3-Clause)',
             source='colour/colorimetry/datasets/cmfs.py', url='https://pypi.org/project/colour-science/0.4.6/',
             licence='Standard reference data; colour-science is BSD-3-Clause',
             licence_quote=('colour-science LICENSE: "Redistribution and use in source and binary forms, with or '
                            'without modification, are permitted..."'),
             retrieved=RETRIEVED,
             adaptations=('Planck spectra integrated against the CMFs at 1 nm, converted with the IEC '
                          '61966-2-1 sRGB matrix and normalised to the largest channel.'),
             accuracy='The chromaticity of an ideal blackbody; real stellar spectra differ, most for M stars.'),
    ]
    os.makedirs(os.path.join(TOOLS, 'credits'), exist_ok=True)
    with open(os.path.join(TOOLS, 'credits', 'stars.json'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(blocks, indent=1, ensure_ascii=False, sort_keys=True) + '\n')


if __name__ == '__main__':
    main()
