"""Pinned sources for step 50 (the galaxy) and its checks.

Every file is fetched through common.fetch()/git_file() and verified against the sha256 below (the
values the research step recorded and its verifier reproduced). Archives (PyPI wheels and sdists)
are read in place; each member used is pinned again by its own sha256, so a mistake in the member
path cannot silently read something else.

Shipped (their numbers end up in data/galaxy/):
    LVDB v1.1.1           Local Volume Database, apace7/local_volume_database at the v1.1.1 tag
    galstreams 1.2.1      stellar-stream tracks (PyPI sdist)
    SpiralMap 0.27        Reid+2019 and Drimmel+2024 arm fits, Poggio+2021 / Gaia DR3 overdensity maps
    Agama @ f302756b      McMillan17.ini and example_mw_bar_potential.py (Portail+2017 / Sormani+2022)
Build-time checks only (nothing from them is shipped):
    galkin @ ef9c4eab     Reid+2014 maser parallaxes (no licence) - sign convention of the Reid arms
    galpy 1.12.0          named_objects.json - cross-check of the globular-cluster distances
    UCC @ 20ce90ee        Unified Cluster Catalogue (GPL-3) - orientation of the young-star maps
    Skowron+2019          classical Cepheids ("NOT licenced") - geometry of the Drimmel+2024 fits
"""
import hashlib
import io
import os
import tarfile
import zipfile

import common
from paths import CACHE

SUB = 'galaxy'          # cache sub-folder

# ---------------------------------------------------------------- Local Volume Database v1.1.1
LVDB_REPO = 'https://github.com/apace7/local_volume_database'
LVDB_COMMIT = '72dabf7862bf9e9f1cbf6846e8c1a684fdec904c'      # tag v1.1.1
LVDB_FILES = {
    'gc_harris':    ('data/gc_harris.csv',    '1d9944892a21cece96d1d0528b741aa62536738a7eeeba7824eb75f949ec15de'),
    'gc_mw_new':    ('data/gc_mw_new.csv',    'e13e19219bf4ec4701d49653aa1fced11a77543ae37228cfb9e06aaa3f4f8cc1'),
    'gc_ambiguous': ('data/gc_ambiguous.csv', '84557e9e99e5cbcd9b5ecace7156582e95bee0a2efaf16be8aa6b817155fc3a7'),
    'dwarf_mw':     ('data/dwarf_mw.csv',     '6970dea6a1c29f9eeb42f3f894dccf7cfc0483e44ddb51de9fa0ecc90b18fa5f'),
    'LICENSE':      ('LICENSE',               'a2010f343487d3f7618affe54f789f5487602331c0a8d03f49e9a7c547cf0499'),
    'README':       ('README.md',             'fc26b162f3329246d3dd6f875676507bc9e97b188e169f471634b81a77c8cc31'),
}


def lvdb(key):
    path, sha = LVDB_FILES[key]
    return common.git_file(LVDB_REPO, LVDB_COMMIT, path, f'{SUB}/lvdb/{os.path.basename(path)}', sha)


def lvdb_url(key):
    return f'https://raw.githubusercontent.com/apace7/local_volume_database/{LVDB_COMMIT}/{LVDB_FILES[key][0]}'


# ---------------------------------------------------------------- PyPI archives
SPIRALMAP_URL = ('https://files.pythonhosted.org/packages/87/85/f44a7a3d878f26f6236d622b115cafe6eee2845a5a3d65ec'
                 '5036bd367c48/spiralmap-0.27-py3-none-any.whl')
SPIRALMAP_SHA = '1688e0b0ab51a5dbe771c5fcdf94a5ad9dbea2437535661117ee54640e3b2e0e'
SPIRALMAP_MEMBERS = {
    'models': ('SpiralMap/models_.py', '3936d1d17555fcae3cce9f7f0eb7220d9a02fa27a741b8936f1aac2a565b07ad'),
    'bib': ('SpiralMap/datafiles/spiral.bib', '9dfb1a0132ba34a61181848804e813b5307f932f15f92284819ddac26f1f3197'),
    'licence': ('spiralmap-0.27.dist-info/licenses/LICENSE.md',
                'e70d4bf40ede54ca94d30348b014d3640f0ad890482b428a6ea312690d73f66d'),
    'drimmel2024': ('SpiralMap/datafiles/Drimmel2024_cepheids/ArmAttributes_dyoungW1_bw025.pkl',
                    '178a547d448483bfc1042f63a4c8c57ae5851e3e1d60ab33ae932df30296d1db'),
    'poggio_grid': ('SpiralMap/datafiles/Poggio_cont_2021/overdens_grid_locscale03.npy',
                    'a5e3388f22d0b04f17e1b3130827beed40f71daca2daa99170e4330ae7417c73'),
    'poggio_x': ('SpiralMap/datafiles/Poggio_cont_2021/xvalues.npy',
                 'ba16374934df0614deafca5634090b7b3caee28f7856635981fb744593c57139'),
    'poggio_y': ('SpiralMap/datafiles/Poggio_cont_2021/yvalues.npy',
                 'ba16374934df0614deafca5634090b7b3caee28f7856635981fb744593c57139'),
    'gaiadr3_grid': ('SpiralMap/datafiles/GaiaPVP_cont_2022/over_dens_grid_threshold_0_003_dens.npy',
                     '65a9b05d54d95dd39422daa829c5eaa9d637a8f59930d6d23d1896ee009426d7'),
    'gaiadr3_x': ('SpiralMap/datafiles/GaiaPVP_cont_2022/xvalues_dens.npy',
                  'ba16374934df0614deafca5634090b7b3caee28f7856635981fb744593c57139'),
    'gaiadr3_y': ('SpiralMap/datafiles/GaiaPVP_cont_2022/yvalues_dens.npy',
                  'ba16374934df0614deafca5634090b7b3caee28f7856635981fb744593c57139'),
}
# SpiralMap's documentation at the repository commit that carries it (the wheel has no docs): the
# "included in the package with their permission" statements for the Gaia maps and Cepheid fits.
SPIRALMAP_REPO = 'https://github.com/Abhaypru/SpiralMap'
SPIRALMAP_DOCS_COMMIT = '3f0c3aa05bb9023cbeca1fb56f42a8a857bf4e66'
SPIRALMAP_DOCS = ('docs/html/_sources/models_available.rst.txt',
                  '0ec0dd7b21c9a4aa484bf5b8007b1a7aa2ae2b118883c10cb166be1c988b759a')

GALSTREAMS_URL = ('https://files.pythonhosted.org/packages/b8/0b/5c897212bb8d075fd86cb395f69684aab06ad1a6761eab'
                  '66bc4ecee5a7ca/galstreams-1.2.1.tar.gz')
GALSTREAMS_SHA = 'bb98b85fe346e317b2a8e97868d0a2f4398b117227195819ffcbe5a3826483e2'
GALSTREAMS_ROOT = 'galstreams-1.2.1/'
GALSTREAMS_PINNED = {
    'galstreams/lib/master_log.txt': '42fec25b66b012014b7be18574c091a74c303a50dbd9b49702be101b8ae4204a',
    'LICENSE': 'f1a988fff0a2ca903e268c99bad99fd0088056d64e0fbc81e5de4d44b1875f0f',
    'galstreams/tracks/docs/gsrefs.bib': 'cbebf207b36938af103c29568b0b37524a7f0ee632ea0de0287f3b6dd21ddf49',
    'galstreams/core.py': '0d7db35ddbf6fe735f4006ca1f9dada7553a4b71b4cec1926cec3f9d32364502',
}

GALPY_URL = ('https://files.pythonhosted.org/packages/1e/dc/424e5ee8999af057d804471f6f598df8cd757370ce087a07ad'
             '3215a14c34/galpy-1.12.0.tar.gz')
GALPY_SHA = '368c3b6a8ca7d93e44df40887ac6b9d9a00fa3a0f2ce532d9b6dac1a43ac7612'
GALPY_MEMBERS = {
    'named_objects': ('galpy-1.12.0/galpy/orbit/named_objects.json',
                      '1c66dad1054dbd2243d538f55a2dba471212a155a3ffd1e62fe32ee4932ed522'),
    'licence': ('galpy-1.12.0/LICENSE', '8a98be73e23233d8cde50e016c1d20364d8b9911e35f2a33c18083054210ed5c'),
}

# ---------------------------------------------------------------- Agama (models)
AGAMA_REPO = 'https://github.com/GalacticDynamics-Oxford/Agama'
AGAMA_COMMIT = 'f302756b8af2b763db58e278e30478517dc8eea3'
AGAMA_FILES = {
    'mcmillan17': ('data/McMillan17.ini', '2fa000f9675a7ecc2e2012c9fe1cd468948fb91e4dd5d56aca3a54014e044ea0'),
    'bar': ('py/example_mw_bar_potential.py', 'a1c3f49ec12f1aa701c074b52c02a2239ff9f286251fe3fbde12f8f070ebbbf3'),
    'LICENSE': ('LICENSE', '5157d40f6950d1a7e5bd09c72a47bf0262150d517cf1abc01c143a0ed68f5888'),
}

# ---------------------------------------------------------------- build-time checks only
GALKIN_REPO = 'https://github.com/galkintool/galkin'
GALKIN_COMMIT = 'ef9c4eab254cf28a1ef269c6a8b07fa494578479'
GALKIN_REID14 = ('galkin/data/data_Reid14.dat', '53ccc768ea22c481948479d4fc428ea54a564da833c67c6469745e4233167f9f')
GALKIN_PKGINFO = ('PKG-INFO', 'fe3e52064b7c2703eacbda3fc3f9b2cbe4e13f1f5a4701a11cc219d40f803264')   # "License: UNKNOWN"

UCC_REPO = 'https://github.com/ucc23/ucc'
UCC_COMMIT = '20ce90ee94799012718d602493f5c3270f0ae0c3'
UCC_FILES = {
    'clusters': ('assets/clusters_26061511.csv.gz', 'b20f5927091442ec094b337bffed147b05826dddecd99760381606000cd65c27'),
    'LICENSE': ('LICENSE', '3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986'),
}

SKOWRON_REPO = 'https://github.com/jskowron/galactic_cepheids'
SKOWRON_COMMIT = 'e72dc56adf9eea38aa4038bc35142e144a68cf25'
SKOWRON_FILES = {
    'table': ('data/Data_Table_1.dat', '01b57bb6439c90a3a4655d2c2b99c26677d01f130cdb98f50bb1b142954298cb'),
    'LICENSE': ('data/LICENSE', 'c82b675b6e159bfb40fedc40bf4381910801b0a4217263bcaba2c2f01645e285'),
}

# The Galactocentric frame is read from the installed, pinned astropy (requirements.txt: 7.1.0). The
# module file is pinned too (its sha256 equals the one in astropy's own RECORD), so a different
# astropy stops the build instead of quietly changing the frame.
ASTROPY_VERSION = '7.1.0'
ASTROPY_GALCEN_SHA = 'dfc1b53dc4273721423d1e7abfc252a532d31a555402ed65d2c48e43306b84f9'


def _sha(b):
    return hashlib.sha256(b).hexdigest()


def _checked(name, data, sha):
    got = _sha(data)
    if got != sha:
        raise SystemExit(f'{name}: sha256 {got} does not match the pin {sha}')
    return data


def spiralmap_wheel():
    return common.fetch(SPIRALMAP_URL, f'{SUB}/spiralmap-0.27-py3-none-any.whl', SPIRALMAP_SHA, 1123120)


def spiralmap(key):
    """Bytes of one pinned member of the SpiralMap 0.27 wheel."""
    member, sha = SPIRALMAP_MEMBERS[key]
    with zipfile.ZipFile(spiralmap_wheel()) as z:
        return _checked(member, z.read(member), sha)


def spiralmap_npy(key):
    import numpy as np
    return np.load(io.BytesIO(spiralmap(key)), allow_pickle=False)


def spiralmap_docs():
    path, sha = SPIRALMAP_DOCS
    return common.git_file(SPIRALMAP_REPO, SPIRALMAP_DOCS_COMMIT, path, f'{SUB}/spiralmap_models_available.rst.txt', sha)


def galstreams_sdist():
    return common.fetch(GALSTREAMS_URL, f'{SUB}/galstreams-1.2.1.tar.gz', GALSTREAMS_SHA, 35248665)


def galstreams_members(wanted, optional=False):
    """Read the members named in `wanted` (paths below galstreams-1.2.1/) in one pass over the
    sdist; returns {path: bytes}. Pinned members are checked against their sha256. With
    optional=True, members the sdist lacks are simply absent from the result."""
    wanted = set(wanted)
    out = {}
    with tarfile.open(galstreams_sdist(), 'r:gz') as t:
        for m in t:
            if not m.isfile() or not m.name.startswith(GALSTREAMS_ROOT):
                continue
            rel = m.name[len(GALSTREAMS_ROOT):]
            if rel in wanted:
                out[rel] = t.extractfile(m).read()
    missing = wanted - set(out)
    if missing and not optional:
        raise SystemExit(f'galstreams sdist lacks {sorted(missing)[:5]}')
    for rel, sha in GALSTREAMS_PINNED.items():
        if rel in out:
            _checked(rel, out[rel], sha)
    return out


def galpy(key):
    member, sha = GALPY_MEMBERS[key]
    path = common.fetch(GALPY_URL, f'{SUB}/galpy-1.12.0.tar.gz', GALPY_SHA, 1249059)
    with tarfile.open(path, 'r:gz') as t:
        return _checked(member, t.extractfile(member).read(), sha)


def agama(key):
    path, sha = AGAMA_FILES[key]
    return common.git_file(AGAMA_REPO, AGAMA_COMMIT, path, f'{SUB}/agama/{os.path.basename(path)}', sha)


def agama_url(key):
    return f'https://raw.githubusercontent.com/GalacticDynamics-Oxford/Agama/{AGAMA_COMMIT}/{AGAMA_FILES[key][0]}'


def galkin_reid14():
    path, sha = GALKIN_REID14
    return common.git_file(GALKIN_REPO, GALKIN_COMMIT, path, f'{SUB}/galkin_data_Reid14.dat', sha)


def galkin_pkginfo():
    path, sha = GALKIN_PKGINFO
    return common.git_file(GALKIN_REPO, GALKIN_COMMIT, path, f'{SUB}/galkin_PKG-INFO', sha)


def ucc(key):
    path, sha = UCC_FILES[key]
    return common.git_file(UCC_REPO, UCC_COMMIT, path, f'{SUB}/ucc/{os.path.basename(path)}', sha)


def skowron(key):
    path, sha = SKOWRON_FILES[key]
    return common.git_file(SKOWRON_REPO, SKOWRON_COMMIT, path, f'{SUB}/skowron/{os.path.basename(path)}', sha)


def check_astropy():
    """The installed astropy is the pinned one, and its Galactocentric module is byte-identical."""
    import astropy
    import astropy.coordinates.builtin_frames.galactocentric as gmod
    if astropy.__version__ != ASTROPY_VERSION:
        raise SystemExit(f'astropy {astropy.__version__} is installed; the pipeline pins {ASTROPY_VERSION}')
    got = common.sha256_of(gmod.__file__)
    if got != ASTROPY_GALCEN_SHA:
        raise SystemExit(f'{gmod.__file__}: sha256 {got} is not the pinned {ASTROPY_GALCEN_SHA}')
    return gmod.__file__


def cache_dir():
    d = os.path.join(CACHE, SUB)
    os.makedirs(d, exist_ok=True)
    return d
