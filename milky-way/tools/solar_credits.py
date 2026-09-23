"""The credits fragment for the solar-system steps (10, 11, 12): tools/credits/solar.json.

Written by 12_physical.py at the end of the three steps, so that the accuracy lines quote what
10_ephemeris.py and 11_moons.py measured (read back from data/ephem.json and data/moons.json).

Licence wording is deliberately careful. NAIF's rules page (naif.jpl.nasa.gov/naif/rules.html)
could not be fetched from the build machine; the research pass could only read it through a web
search summary. JPL is operated by Caltech, so its products are not automatically US-Government
public-domain works, and the USGS ISIS project's public-domain notice covers USGS's software, not
the NAIF kernels mirrored in its data area. Each block says exactly that.
"""
import json
import os

import common
import solar_sources as S
from paths import DATA, TOOLS

NAIF_TERMS = ('NAIF/JPL SPICE data, freely available. NAIF\'s rules page states that SPICE data '
              '"are all freely available ... with no licensing or export restrictions" — read only '
              'through a web-search summary, because naif.jpl.nasa.gov is not reachable from the '
              'build machine. JPL is operated by Caltech; this is not a US-Government '
              'public-domain claim.')
MIRROR = ('USGS Astrogeology ISIS data area (public S3 mirror of NAIF generic_kernels, named in '
          'DOI-USGS/ISIS3 isis/config/rclone.conf at commit 51b99bd4)')


def write():
    with open(os.path.join(DATA, 'ephem.json'), encoding='utf-8') as fh:
        eph = json.load(fh)
    with open(os.path.join(DATA, 'moons.json'), encoding='utf-8') as fh:
        mo = json.load(fh)
    e = eph['max_error_km']
    planets_acc = ', '.join(f'{k} {e[k]:.0f} km' if e[k] >= 10 else f'{k} {e[k]:.1f} km'
                            for k in ['mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter',
                                      'saturn', 'uranus', 'neptune', 'pluto'])
    by_file = {}
    for m in mo['moons']:
        by_file.setdefault(m['parent'], []).append(m)

    def moons_acc(parent):
        return '; '.join(f'{m["name"]} max {m["max_error_km"]:.0f} km ({100 * m["max_error_frac"]:.3f} % '
                         f'of a), {m["windows"]} windows of {m["window_days"]:g} d'
                         for m in by_file[parent])

    moon_adapt = ('Positions relative to the planet\'s centre, fitted per window with a precessing '
                  'Keplerian ellipse (9 float32 per window, scipy least_squares), 1950-01-01 to '
                  '2050-01-01 TDB; the app adds back the planet centre\'s motion about the system '
                  'barycentre from the fitted moons and gm_de440 mass ratios. A fitted model of the '
                  'JPL ephemeris, labelled as such.')
    sat = {
        'mar097': ('mars', 'JPL Martian satellite ephemeris MAR097 (Phobos, Deimos)',
                   'MAR097.3, R. A. Jacobson, JPL SSD; release form "Release to: Horizons/NAIF", '
                   '"Preparer: R. A. Jacobson"'),
        'jup310': ('jupiter', 'JPL Jovian satellite ephemeris JUP310 (Io, Europa, Ganymede, Callisto)',
                   'JUP310.2, R. A. Jacobson, JPL SSD; release form "Release to: Horizons/NAIF/Juno", '
                   '"Preparer: R. A. Jacobson"'),
        'sat425': ('saturn', 'JPL Saturnian satellite ephemeris SAT425 (Mimas to Iapetus) and its '
                   'ring radii', 'SAT425, R. A. Jacobson, JPL SSD (Saturn global fit); bsp by '
                   'C. Acton, NAIF: "sat425.bsp was created on 28 August 2019 by C. Acton. It was '
                   'created from Bob Jacobson\'s sat425l.nio file."'),
        'ura111': ('uranus', 'JPL Uranian satellite ephemeris URA111 (Miranda, Ariel, Umbriel, '
                   'Titania, Oberon)', 'URA111, R. A. Jacobson, JPL SSD; release form "Fit of the '
                   'major Uranian satellites and Puck to Voyager and ..." (Puck is not in the SPK)'),
        'nep081': ('neptune', 'JPL Neptunian satellite ephemeris NEP081 (Triton, Nereid)',
                   'NEP081, R. A. Jacobson (Astron. J. 137, 4322, 2009), JPL SSD'),
    }
    blocks = [{
        'id': 'jpl-de430',
        'title': 'JPL DE430 planetary and lunar ephemeris (de430.bsp)',
        'owner': 'NASA Jet Propulsion Laboratory, Solar System Dynamics (W. M. Folkner et al., '
                 'IPN Progress Report 42-196, 2014); the SPK\'s comment block is by C. Acton '
                 '(NAIF), 2013-09-03',
        'source': 'de430.bsp, ' + MIRROR + '; sha256 ' + S.SPK['de430'][2],
        'url': S.SPK['de430'][0],
        'licence': NAIF_TERMS,
        'licence_quote': 'From the file\'s own comment block: "DE430 is now considered the official '
                         'export lunar/planetary ephemeris, suitable for all users/uses."',
        'retrieved': common.RETRIEVED,
        'adaptations': ('Refitted to a float32 Chebyshev table for 1900-01-01 to 2100-01-01 TDB: '
                        'heliocentric Mercury, Venus, Earth-Moon barycentre, Mars and the Jupiter-'
                        'Pluto system barycentres, and the geocentric Moon (interval/degree per body '
                        'in data/ephem.json). The Earth/Moon mass ratio (EMRAT '
                        f'{eph["emrat"]:.8f}) was measured from the file\'s own Earth and Moon '
                        'segments. Pluto is the Pluto-system barycentre (about 2,135 km from the '
                        'centre of Pluto); Charon is not shown — no long-term Pluto-satellite '
                        'ephemeris was reachable.'),
        'accuracy': f'Max error against DE430 at {eph["error_epochs"]} random epochs: {planets_acc}.',
    }]
    for f, (parent, title, owner) in sat.items():
        url = S.SPK[f][0]
        blk = {
            'id': f'jpl-{f}', 'title': title, 'owner': owner,
            'source': f'{f}.bsp, ' + MIRROR + '; sha256 ' + S.SPK[f][2], 'url': url,
            'licence': NAIF_TERMS,
            'licence_quote': 'No licence text in the file; its release form reads "Release to: '
                             'Horizons/NAIF" (NAIF terms as above).',
            'retrieved': common.RETRIEVED,
            'adaptations': moon_adapt,
            'accuracy': ('Max error of the position relative to the system barycentre against the '
                         f'SPK at {mo["error_epochs"]} random epochs per moon: ' + moons_acc(parent) + '.'),
        }
        if f == 'sat425':
            blk['adaptations'] += (' Also the Saturn C, B and A ring radii from the header\'s '
                                   '"Additional Constants" (C_ring_RI ... A_ring_RO), copied as '
                                   'they are.')
        blocks.append(blk)
    blocks += [{
        'id': 'naif-pck00011',
        'title': 'NAIF generic text PCK pck00011.tpc (IAU WGCCRE 2015 rotation and shape constants)',
        'owner': 'NASA JPL NAIF (N. Bachman, 2022-12-27), from Archinal et al. 2018, Celest. Mech. '
                 'Dyn. Astr. 130:22 (IAU WGCCRE 2015 report) and the other sources listed in the file',
        'source': 'pck00011.tpc from the nyx-space/anise repository at commit ' + S.ANISE[1]
                  + ' (a byte-identical copy is in a second, unrelated repository; NAIF\'s own site '
                  'is not reachable from the build machine, so there is no NAIF checksum to compare); '
                  'sha256 ' + S.PCK[2],
        'url': f'https://raw.githubusercontent.com/nyx-space/anise/{S.ANISE[1]}/{S.PCK[0]}',
        'licence': NAIF_TERMS + ' The anise repository\'s MPL-2.0 covers its code, not this file.',
        'licence_quote': 'From the file: "Note that this file may be readily modified by you to '
                         'change values or add/delete parameters. NAIF requests that you update the '
                         '"by line," date, version description section, and file name if you modify '
                         'this file." (It is not modified; values are copied into physical.json.)',
        'retrieved': common.RETRIEVED,
        'adaptations': ('Radii, pole and prime-meridian polynomials and nutation/precession series '
                        'for the Sun, planets, Moon, Pluto and the shipped moons, read through CSPICE '
                        'N0067 (spiceypy 8.2.0). Derived: obliquity against the osculating J2000 '
                        'orbit and the sidereal period from the prime-meridian rate. Also used for '
                        'the moons\' fit frames (planet spin axes at J2000).'),
        'accuracy': 'Constants copied exactly (compared with the CSPICE kernel pool by '
                    'verify_solar.py). The body-fixed frames built from physical.json by '
                    'js/rotation.js are checked against CSPICE pxform(\'J2000\', \'IAU_<BODY>\') for '
                    '30 bodies at 7 epochs 1950-2100 (tools/test_rotation.mjs, limit 0.001 arcsec).',
    }, {
        'id': 'naif-gm-de440',
        'title': 'gm_de440.tpc (GM of the Sun, planets and satellites)',
        'owner': 'JPL SSD (J. Giorgini; DE440 values from Park et al. 2021, AJ 161:105; satellite '
                 'release forms), edited by NAIF (BVS, 2022-12-14)',
        'source': 'gm_de440.tpc from the nyx-space/anise repository at commit ' + S.ANISE[1]
                  + '; sha256 ' + S.GM[2],
        'url': f'https://raw.githubusercontent.com/nyx-space/anise/{S.ANISE[1]}/{S.GM[0]}',
        'licence': NAIF_TERMS,
        'licence_quote': 'No licence text in the file. Its header: "Sources: 1. DE-440 NAVIO file '
                         '"ASTRO-VALUES" ... 2. Natural satellite file release forms".',
        'retrieved': common.RETRIEVED,
        'adaptations': 'GM values copied into physical.json; moon/system mass ratios in moons.json.',
        'accuracy': 'Copied exactly.',
    }, {
        'id': 'erfa',
        'title': 'ERFA (Essential Routines for Fundamental Astronomy), from the pyerfa 2.0.1.5 sdist',
        'owner': 'NumFOCUS Foundation (ERFA, derived with permission from the IAU SOFA library)',
        'source': 'pyerfa-2.0.1.5.tar.gz from PyPI, sha256 ' + S.PYERFA_SDIST[2]
                  + ': liberfa/erfa/src/dat.c (leap seconds), src/obl06.c (IAU 2006 mean '
                  'obliquity at J2000), src/erfam.h (TT - TAI)',
        'url': S.PYERFA_SDIST[0],
        'licence': 'BSD 3-clause (liberfa/erfa/LICENSE)',
        'licence_quote': '"Redistribution and use in source and binary forms, with or without '
                         'modification, are permitted provided that the following conditions are met"',
        'retrieved': common.RETRIEVED,
        'adaptations': 'TAI-UTC steps from 1972 on as [JD UTC, seconds]; eps0 = 84381.406 arcsec; '
                       'TT - TAI = 32.184 s. The 1960-1971 drift rows are not used (the app takes '
                       '10 s before 1972).',
        'accuracy': 'Copied exactly. dat.c release year 2023; last step 2017-01-01 (37 s).',
    }, {
        'id': 'astropy-iau2012',
        'title': 'Astronomical unit, IAU 2012 Resolution B2 (astropy constants)',
        'owner': 'The Astropy Project (value: IAU 2012 Resolution B2)',
        'source': 'astropy/constants/iau2012.py at tag v7.1.0 (commit ' + S.ASTROPY[1] + '), sha256 '
                  + S.ASTROPY_IAU2012[2],
        'url': f'https://raw.githubusercontent.com/astropy/astropy/{S.ASTROPY[1]}/{S.ASTROPY_IAU2012[0]}',
        'licence': 'BSD 3-clause (astropy)',
        'licence_quote': 'File header: "# Licensed under a 3-clause BSD style license - see LICENSE.rst"',
        'retrieved': common.RETRIEVED,
        'adaptations': 'au = 1.49597870700e11 m, written as 149597870.7 km.',
        'accuracy': 'Exact (a defined constant).',
    }, {
        'id': 'pds-rms-uranus-rings',
        'title': 'Uranian ring elements (PDS Ring-Moon Systems Node constants, French et al. 1991)',
        'owner': 'PDS Ring-Moon Systems Node, SETI Institute (rms-oops); values adapted, per the '
                 'source, from the tabulated elements of French et al. 1991',
        'source': 'SETI/rms-oops src/oops/body.py at commit ' + S.RMS_OOPS[1] + ', sha256 '
                  + S.RMS_OOPS_BODY[2],
        'url': f'https://raw.githubusercontent.com/SETI/rms-oops/{S.RMS_OOPS[1]}/{S.RMS_OOPS_BODY[0]}',
        'licence': 'Apache License 2.0 (the repository\'s LICENSE.md; the numbers themselves are '
                   'published measurements)',
        'licence_quote': 'LICENSE.md: "Apache License ... Version 2.0, January 2004"; body.py: '
                         '"# Local function to adapt the tabulated elements from French et al. 1991."',
        'retrieved': common.RETRIEVED,
        'adaptations': ('Semi-major axis, eccentricity and radial width of the ten rings; drawn as '
                        'circles a -/+ width/2 in Uranus\'s equatorial plane. Pericentre and node '
                        'longitudes (epoch 1977-03-10T20:00 UTC, B1950-based ring frame in rms-oops) '
                        'are not shipped.'),
        'accuracy': 'Copied exactly; the circular drawing ignores e (up to 406 km for the epsilon ring).',
    }]
    path = os.path.join(TOOLS, 'credits', 'solar.json')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(json.dumps(blocks, ensure_ascii=False, indent=1) + '\n')
    print(f'credits: {path} ({len(blocks)} blocks)')
