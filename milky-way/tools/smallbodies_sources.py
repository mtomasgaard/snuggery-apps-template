"""Pinned sources and shared readers for the small-bodies step (20_smallbodies.py) and its checks
(verify_smallbodies.py).

None of the primary hosts (JPL SSD, the Minor Planet Center, ESA NEOCC) is reachable from the build
machine. Every file below is a verbatim copy of their output committed to a public git repository,
read through raw.githubusercontent.com at a pinned commit and checked against its sha256:

  KDE KStars @ 182b27ab   kstars/data/asteroids.dat     JPL SBDB Query API response, H < 12
                          kstars/data/cometels.json.gz  the MPC's CometEls.json
                          kstars/data/comets.dat        JPL SBDB Query API response, comets (2021)
  B612 adam_core @ 8fb48119   JPL SBDB lookup-API responses, one recorded JPL Horizons response,
                              ESA NEOCC orbit files (test fixtures; MIT-licensed repository)
  Stellarium @ 450dbc0f   data/asteroid_elements.json   JPL Horizons yearly osculating elements of
                                                        Ceres, Pallas, Juno, Vesta (checks only)
                          data/ssystem_minor.ini        which objects Stellarium types "dwarf
                                                        planet"; the name of 162173 Ryugu
  CelestiaContent @ eab93932  data/asteroids.ssc        the name of 65803 Didymos
  Smithsonian/mpc-public @ af7756cf   the MPC's own statements on data use (quoted in credits)

The constants come from the same pinned files the solar-system steps use (solar_sources.py):
GM of the Sun from gm_de440.tpc (read by CSPICE's kernel-pool parser), the astronomical unit from
astropy 7.1.0's IAU 2012 constants, and the obliquity of the J2000 ecliptic from ERFA's obl80.c in
the pyerfa 2.0.1.5 sdist — the IAU 1976/1980 value, 84381.448", which is the obliquity JPL states
for the ecliptic frame of its osculating elements ("IAU76/J2000 helio. ecliptic osc. elements";
"Note: IAU76 obliquity of 84381.448 arcseconds wrt ICRF X-Y plane", in the recorded Horizons
response pinned below). ERFA's obl06.c (IAU 2006, 84381.406", the value physical.json ships) would
tilt every orbit by 0.042" relative to the frame its elements were computed in.
"""
import math
import os
import re
import tarfile

import common
import solar_sources as S

KSTARS = ('https://github.com/KDE/kstars', '182b27aba4726a79f75fd1ffcd3e5d52d09f2450')
ADAM = ('https://github.com/B612-Asteroid-Institute/adam_core', '8fb48119f2c3e99d4bfe7165387c9affe0f829f4')
STELLARIUM = ('https://github.com/Stellarium/stellarium', '450dbc0fcb81593f930371a165013f2a1b255f4f')
CELESTIA = ('https://github.com/CelestiaProject/CelestiaContent', 'eab93932c85fa315f370477ee8c6b7e15f12c327')
MPC_PUBLIC = ('https://github.com/Smithsonian/mpc-public', 'af7756cf072339846be18516eae8f03488132b8e')

_T = 'src/adam_core/orbits/query/tests/'

# key -> (repo, path in the repo, cache name, sha256)
FILES = {
    # KStars snapshots of JPL and MPC output
    'asteroids': (KSTARS, 'kstars/data/asteroids.dat', 'smallbodies/kstars-asteroids.dat',
                  'dc39954ecc89f1062f07665ac3b6d10eb5a43a4a4b578947f60c2f161fdc45c2'),
    'cometels': (KSTARS, 'kstars/data/cometels.json.gz', 'smallbodies/kstars-cometels.json.gz',
                 'cbebd1097b244455c7ff8dcd702ff73ffeb45f9f2cdfb0eb218886385f8fab11'),
    'comets': (KSTARS, 'kstars/data/comets.dat', 'smallbodies/kstars-comets.dat',
               'e856704306967d9c8f8dcaed7cbf4039f8209f3d07bc15a263fd4217cd937e4c'),
    'kstars_readme_eph': (KSTARS, 'README.ephemerides', 'smallbodies/kstars-README.ephemerides',
                          '07dd67d04c3117478dda9e239f5bfcda7a9a20c5e7c9e861655ae910b4a62491'),
    'kstars_readme': (KSTARS, 'README.md', 'smallbodies/kstars-README.md',
                      '6428b44115bb2da9291917e9e81397b511fb56e8304440ba3b6f6f424a776f97'),
    # adam_core fixtures: JPL SBDB lookup API (sbdb.api) responses
    'sbdb_99942': (ADAM, _T + 'testdata/sbdb/99942_phys.json', 'smallbodies/sbdb-99942_phys.json',
                   'a686afe50ca3f749da33edc6d61bd90e6c59875718093de2973a568accc17b4f'),
    'sbdb_2024YR4': (ADAM, _T + 'testdata/sbdb/2024YR4_phys.json', 'smallbodies/sbdb-2024YR4_phys.json',
                     '25d385e30fafb44f71b2ed5cede519e888df0aa8edf444734f5b1ab1ac029f05'),
    'sbdb_2022AP7': (ADAM, _T + 'testdata/sbdb/2022AP7_phys.json', 'smallbodies/sbdb-2022AP7_phys.json',
                     'e30d58592cb248b01d0309f8892d6e3f6a1c674410cb7de17bf7705f7fc366dc'),
    'sbdb_25143': (ADAM, _T + 'testdata/sbdb/25143_phys.json', 'smallbodies/sbdb-25143_phys.json',
                   '2f637f340566685b8ffc01c85fdff5cbe4badc909bbc024e01d0b35f83a6dad7'),
    'sbdb_54509': (ADAM, _T + 'testdata/sbdb/54509.json', 'smallbodies/sbdb-54509.json',
                   'ee60f48e635d938711011ac9c380ed8f2ea2dd7fe6846116d1b7eae128a87eeb'),
    'sbdb_101955': (ADAM, _T + 'testdata/sbdb/101955_phys.json', 'smallbodies/sbdb-101955_phys.json',
                    '19c0771a7be54f8308df7b392c7e377d2aae22b5a094d2e7a53db9e42852b74d'),
    'sbdb_1': (ADAM, _T + 'testdata/sbdb/1_phys.json', 'smallbodies/sbdb-1_phys.json',
               'cd5dc3161c6a20429c88e148916df4a907d60cfd25cefd6c838aba8311956857'),
    'sbdb_2': (ADAM, _T + 'testdata/sbdb/2_phys.json', 'smallbodies/sbdb-2_phys.json',
               'adcebf75edbfc28d9432b9ccf54bbe18cd74651e3f9d3ec5738c27100526f3cf'),
    'sbdb_3': (ADAM, _T + 'testdata/sbdb/3_phys.json', 'smallbodies/sbdb-3_phys.json',
               '8f3e9bbab92afb8ad1815fcb7b86918da09f930191f6e0fc43e3730aae8473e4'),
    'sbdb_4': (ADAM, _T + 'testdata/sbdb/4_phys.json', 'smallbodies/sbdb-4_phys.json',
               '9fd4648840b1c951591b33257b7b5d135c0316f906b2a6b3f4f50d1b094c5141'),
    'sbdb_433': (ADAM, _T + 'testdata/sbdb/433_phys.json', 'smallbodies/sbdb-433_phys.json',
                 '772ce4499ff24ad5b60944979cc2da390621145e602503373dff5990ec67982b'),
    'sbdb_readme': (ADAM, _T + 'testdata/sbdb/README.md', 'smallbodies/adam-sbdb-README.md',
                    '00d919a5dcb348afeb5ee0115502e0257c2ea7ed269e50fac758d6df3ba695e3'),
    # adam_core fixtures: one recorded JPL Horizons response (Bennu, osculating at 2024-01-01 TDB)
    'horizons_bennu': (ADAM, _T + 'data/horizons/elements_bennu_20240101.txt',
                       'smallbodies/horizons-elements_bennu_20240101.txt',
                       '46de73ce09f2a8ec0e7c625d40a537339d185dce92db85bca39ebd33f9ecd870'),
    'horizons_readme': (ADAM, _T + 'data/horizons/README.md', 'smallbodies/adam-horizons-README.md',
                        '12957f8477c7d3e01bf0b6ac4abdf99554c4af319d46ff5acc0591dca8a52dfc'),
    # adam_core fixtures: ESA NEOCC orbit files (OEF 2.0, "present-day" epoch)
    'neocc_162173': (ADAM, _T + 'testdata/neocc/162173.ke1', 'smallbodies/neocc-162173.ke1',
                     'c0cc7f55425a9a9ce90ef2048f717ff031d2275b54660bc1f54968413332331d'),
    'neocc_65803': (ADAM, _T + 'testdata/neocc/65803.ke1', 'smallbodies/neocc-65803.ke1',
                    '8b835a025f475a0367ea258bbf2755e199b14d42597b0919ccda66e4787165cd'),
    'neocc_readme': (ADAM, _T + 'testdata/neocc/README.md', 'smallbodies/adam-neocc-README.md',
                     'c0777e0cef9dde008aa2a739bf40e2eb5cefe6397ab19b7debd1e556a5e5b335'),
    'adam_license': (ADAM, 'LICENSE.md', 'smallbodies/adam-LICENSE.md',
                     'e573cfdcc6b1701a77a816830a35af36651ec729677bb2e19bc34ab5cdab6f1e'),
    # Stellarium
    'horizons_big4': (STELLARIUM, 'data/asteroid_elements.json', 'smallbodies/stellarium-asteroid_elements.json',
                      'f508cd330e79d686bf7d41efafa1fcd1febef6225413cdff927a2cc47db4ecae'),
    'stellarium_minor': (STELLARIUM, 'data/ssystem_minor.ini', 'smallbodies/stellarium-ssystem_minor.ini',
                         '542cb04829d8d728674d65a325eb761f9cac7bc00a25b6e2bbd95674f18e5846'),
    'stellarium_copying': (STELLARIUM, 'COPYING', 'smallbodies/stellarium-COPYING',
                           '3aeeb5bb98bf7041ab82cffe15efa28ac58ee2bdf162b71301f5c192be631259'),
    # Celestia
    'celestia_asteroids': (CELESTIA, 'data/asteroids.ssc', 'smallbodies/celestia-asteroids.ssc',
                           '2de46624c6fb91a011bf9f2826717f4dff2f0206045d241d721711d8f206d69e'),
    # the MPC's statements on data use
    'mpc_faqs': (MPC_PUBLIC, 'docs-public/docs/mpc-ops-docs/faqs.md', 'smallbodies/mpc-faqs.md',
                 '3ab51cb9e03c96a1574dbf3f748ea8f52c614a0e6c4efc86deaf5cebbcce4c12'),
    'mpc_lists': (MPC_PUBLIC, 'docs-public/docs/mpc-ops-docs/data-and-services/lists.md',
                  'smallbodies/mpc-lists.md',
                  '990dae886289b6627f3c8fb6226bb27842e7ca11c4d7ed4de65425a7c85639cd'),
}


def path(key):
    repo, p, name, sha = FILES[key]
    return common.git_file(repo[0], repo[1], p, name, sha)


def url(key):
    repo, p, _name, _sha = FILES[key]
    slug = repo[0][len('https://github.com/'):]
    return f'https://raw.githubusercontent.com/{slug}/{repo[1]}/{p}'


def text(key):
    with open(path(key), encoding='utf-8') as f:
        return f.read()


def quote(key, needle):
    """Return `needle` after checking it occurs verbatim (whitespace-normalised) in the pinned file."""
    hay = ' '.join(text(key).split())
    if ' '.join(needle.split()) not in hay:
        raise SystemExit(f'{key}: expected text not found: {needle!r}')
    return needle


def constants():
    """au (km), GM_sun (km^3/s^2), k (au^1.5/day), and the J2000 ecliptic obliquity (arcsec) with
    where each came from. k = sqrt(GM_sun) * 86400 / au^1.5, as in physical.json."""
    txt = open(S.astropy_iau2012_path(), encoding='utf-8').read()
    m = re.search(r'au\s*=\s*IAU2012\(\s*"au",\s*"Astronomical Unit",\s*([0-9.eE+]+),\s*"m"', txt)
    au_km = float(m.group(1)) / 1000.0
    sp = S.load_kernel_pool()
    gm_sun = S.pool(sp, 'BODY10_GM')[0]
    k = math.sqrt(gm_sun) * 86400.0 / au_km ** 1.5
    with tarfile.open(S.pyerfa_path()) as tf:
        obl80 = tf.extractfile('pyerfa-2.0.1.5/liberfa/erfa/src/obl80.c').read().decode()
    eps_arcsec = float(re.search(r'eps0\s*=\s*ERFA_DAS2R\s*\*\s*\(\s*([\d.]+)', obl80).group(1))
    # The frame JPL states for its osculating elements, from the pinned Horizons response.
    hz = text('horizons_bennu')
    stated = float(re.search(r'IAU76 obliquity of ([\d.]+) arcseconds wrt ICRF X-Y plane', hz).group(1))
    if stated != eps_arcsec:
        raise SystemExit(f'ERFA obl80 J2000 obliquity {eps_arcsec} != JPL-stated {stated}')
    return {
        'au_km': au_km, 'gm_sun_km3_s2': gm_sun, 'k_gauss_au15_day': k,
        'obliquity_arcsec': eps_arcsec,
        'mu_au3_d2': gm_sun * 86400.0 ** 2 / au_km ** 3,
    }


def ecl_to_icrf(eps_arcsec):
    """3x3 matrix taking J2000-ecliptic vectors to ICRF equatorial ones (rotation about x by +eps)."""
    e = math.radians(eps_arcsec / 3600.0)
    c, s = math.cos(e), math.sin(e)
    return [[1.0, 0.0, 0.0], [0.0, c, -s], [0.0, s, c]]


def jd_from_calendar(y, m, d):
    """Julian Date of a Gregorian calendar date with a fractional day (Meeus, Astronomical
    Algorithms, ch. 7). Used for the MPC's perihelion times and epochs (TT)."""
    y, m = int(y), int(m)
    if m <= 2:
        y -= 1
        m += 12
    a = y // 100
    b = 2 - a + a // 4
    return math.floor(365.25 * (y + 4716)) + math.floor(30.6001 * (m + 1)) + float(d) + b - 1524.5


def field(row, name):
    """A field of an SBDB Query API row, whichever naming style the file uses: the asteroid file
    has epoch_mjd / per_y, the older comet export epoch.mjd / per.y."""
    if name in row:
        return row[name]
    alt = name.replace('_', '.') if '_' in name else name.replace('.', '_')
    return row.get(alt)


def num(v):
    """SBDB numbers are JSON strings, some written like '.0795' or '0.'; None stays None."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    v = v.strip()
    return float(v) if v else None


def rel(p):
    return os.path.relpath(p, os.path.dirname(os.path.abspath(__file__)))
