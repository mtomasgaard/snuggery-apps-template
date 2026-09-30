"""Every file the Earth's History pipeline downloads: where from, its sha256 and size (measured on the
first download, 2026-09-30), its licence and the attribution that licence asks for.

fetch() in common.py refuses any file whose sha256 differs from the pin here, so an upstream change
stops the build instead of silently changing the app. RESEARCH.md §2 has the long form of each entry:
what the file contains, its quirks, and the licence text quoted from the source.
"""
from common import RETRIEVED

CC_BY_4 = 'CC BY 4.0'

ZENODO_PALEOMAP = 'https://zenodo.org/api/records/5460860/files/'
ZENODO_PHANDA = 'https://zenodo.org/api/records/8237751/files/'
ICS_REPO = 'https://github.com/i-c-stratigraphy/chart'
ICS_COMMIT = '81618a865cdb04998355a302f3e859908a080c0e'      # main, 2026-07-27, last commit to chart.ttl
NE_REPO = 'https://github.com/nvkelso/natural-earth-vector'
NE_COMMIT = 'f1890d9f152c896d250a77557a5751a93d494776'       # tag v5.1.2
ELSEVIER_ESM = 'https://ars.els-cdn.com/content/image/1-s2.0-S1342937X22002192-'
SPRINGER_ESM = ('https://media.springernature.com/original/springer-static/esm/'
                'art%3A10.1038%2Fncomms14845/MediaObjects/41467_2017_BFncomms14845_')

PHANDA_ATTRIBUTION = ('Judd, E.J., Tierney, J.E., Lunt, D.J., Montanez, I.P., Huber, B.T., Wing, S.L. & '
                      'Valdes, P.J., 2023. PhanDA HadCM3L Model Priors (suite scotese_07). Zenodo, '
                      'doi:10.5281/zenodo.8237751. CC BY 4.0. Simulations by the BRIDGE group, '
                      'University of Bristol.')

SOURCES = {
    # --- Scotese PALEOMAP (Zenodo record 5460860, DOI 10.5281/zenodo.5460860) --------------------
    'paleoatlas': {
        'url': ZENODO_PALEOMAP + 'Scotese_PaleoAtlas_v3.zip/content',
        'name': 'Scotese_PaleoAtlas_v3.zip',
        'sha256': '7bf15709970645465df17542e20f9e2e9ed01d20797f38513ed83621e4ace2a0',
        'bytes': 58089990,
        'md5_zenodo': '9a8d16ab2d7f070ae3e89da7835ce4d4',
        'licence': CC_BY_4,
        'licence_evidence': 'credits/PaleoAtlas_v3_License.txt (the zip\'s own License.txt); '
                            'credits/zenodo-5460860.json (license: cc-by-4.0)',
        'attribution': 'Scotese, C.R., 2016. PALEOMAP PaleoAtlas for GPlates and the PaleoData '
                       'Plotter Program, PALEOMAP Project. Via Scotese, C.R. & Wright, N.M., 2018, '
                       'Zenodo, doi:10.5281/zenodo.5460860. CC BY 4.0.',
        'retrieved': RETRIEVED,
    },
    'paleodem_1deg': {
        'url': ZENODO_PALEOMAP + 'Scotese_Wright_2018_Maps_1-88_1degX1deg_PaleoDEMS_nc.zip/content',
        'name': 'Scotese_Wright_2018_Maps_1-88_1degX1deg_PaleoDEMS_nc.zip',
        'sha256': '7014767a168c28d3762f55117ebafcd0f6b6b90029a495e2d14fd23f94abc16d',
        'bytes': 9302291,
        'md5_zenodo': '77147998623ab039d86ff3e0b5e40344',
        'licence': CC_BY_4,
        'licence_evidence': 'credits/zenodo-5460860.json (license: cc-by-4.0)',
        'attribution': 'Scotese, C.R. & Wright, N.M., 2018. PALEOMAP Paleodigital Elevation Models '
                       '(PaleoDEMS) for the Phanerozoic. Zenodo, doi:10.5281/zenodo.5460860. CC BY 4.0.',
        'retrieved': RETRIEVED,
    },
    'paleodem_report': {
        'url': ZENODO_PALEOMAP + 'Scotese_Wright2018_PALEOMAP_PaleoDEMs.pdf/content',
        'name': 'Scotese_Wright2018_PALEOMAP_PaleoDEMs.pdf',
        'sha256': '8a5fca14f9860d148427a56cec241b4fc5b4108ff91bb867e8b68bde1392edac',
        'bytes': 6840972,
        'md5_zenodo': '3147576853269cbf3bb4481124fc2f35',
        'licence': CC_BY_4,
        'licence_evidence': 'credits/zenodo-5460860.json (license: cc-by-4.0)',
        'attribution': 'Scotese, C.R. & Wright, N.M., 2018 (report). Zenodo, doi:10.5281/zenodo.5460860.',
        'retrieved': RETRIEVED,
        'note': 'read for provenance only (map list, method, caveats); nothing of it ships',
    },

    # --- PhanDA HadCM3L model priors (Zenodo record 8237751, DOI 10.5281/zenodo.8237751) ---------
    # Suite scotese_07: CO2 from Foster et al. (2017) and Rae et al. (2021), HadCM3L "Update B".
    # 109 slices x 5 twenty-year means per variable, one NetCDF4 (HDF5) file each, deflated in the zip.
    'phanda_info': {
        'url': ZENODO_PHANDA + 'ExperimentInfo.xlsx/content',
        'name': 'ExperimentInfo.xlsx',
        'sha256': '21866d6c30f930796cc3ee5ab25891847436859548d05865c037f521c8dd0f51',
        'bytes': 25443,
        'md5_zenodo': '0c61461d58ce3614a604d8dbe3636ad8',
        'licence': CC_BY_4,
        'licence_evidence': 'credits/zenodo-8237751.json (license: cc-by-4.0)',
        'attribution': PHANDA_ATTRIBUTION,
        'retrieved': RETRIEVED,
    },
    'phanda_07_tas': {
        'url': ZENODO_PHANDA + 'scotese_07_tas.zip/content',
        'name': 'scotese_07_tas.zip',
        'sha256': 'f28c137c47dac9bdff4315947453c89c96bd2df709c2607f806a2524e0a15983',
        'bytes': 300384517,
        'md5_zenodo': '575721a5f52eb1705b10e147a9e7fa51',
        'licence': CC_BY_4,
        'licence_evidence': 'credits/zenodo-8237751.json (license: cc-by-4.0)',
        'attribution': PHANDA_ATTRIBUTION,
        'retrieved': RETRIEVED,
    },
    'phanda_07_pr': {
        'url': ZENODO_PHANDA + 'scotese_07_pr.zip/content',
        'name': 'scotese_07_pr.zip',
        'sha256': '63fe79de34814b0a73697be6ab2d861560182e9b936d0d04ac274c6ae163980f',
        'bytes': 513591309,
        'md5_zenodo': '7094ba86559f2c696ec6fe1fecdc8931',
        'licence': CC_BY_4,
        'licence_evidence': 'credits/zenodo-8237751.json (license: cc-by-4.0)',
        'attribution': PHANDA_ATTRIBUTION,
        'retrieved': RETRIEVED,
    },

    # --- Foster, Royer & Lunt 2017, Nature Communications 8:14845 -------------------------------
    'foster2017_sd2': {
        'url': SPRINGER_ESM + 'MOESM2875_ESM.xlsx',
        'name': 'foster2017_supplementary_data_2.xlsx',
        'sha256': '84df255974cb77c95d298d324fb281fe2ac40a0696ea92598985816e7095c74c',
        'bytes': 79529,
        'licence': CC_BY_4,
        'licence_evidence': 'credits/foster2017-licence.txt',
        'attribution': 'Foster, G.L., Royer, D.L. & Lunt, D.J., 2017. Future climate forcing potentially '
                       'without precedent in the last 420 million years. Nature Communications 8, 14845, '
                       'doi:10.1038/ncomms14845. Supplementary Data 2 (LOESS fit). CC BY 4.0.',
        'retrieved': RETRIEVED,
        'note': 'byte-identical to ncomms14845-s3.xlsx in Europe PMC\'s supplementary-files zip for '
                'PMC5382278; that zip is rebuilt per request (its own sha256 changes), so the pin is on '
                'the publisher\'s stable file',
    },

    # --- van der Meer et al. 2022, Gondwana Research 111:103-121 --------------------------------
    'vdm2022_table': {
        'url': ELSEVIER_ESM + 'mmc1.xlsx',
        'name': 'vandermeer2022_mmc1.xlsx',
        'sha256': '800b34928378ae902426fc16ef002debfc064465f8ac663cbeeb7bd0c77c074f',
        'bytes': 263101,
        'licence': CC_BY_4,
        'licence_evidence': 'credits/vandermeer2022-licence.txt',
        'attribution': 'van der Meer, D.G., Scotese, C.R., Mills, B.J.W., Sluijs, A., van den Berg van '
                       'Saparoea, A.-P. & van de Weg, R.M.B., 2022. Long-term Phanerozoic global mean sea '
                       'level: Insights from strontium isotope variations and estimates of continental '
                       'glaciation. Gondwana Research 111, 103-121, doi:10.1016/j.gr.2022.07.014. '
                       'Supplementary table (mmc1). CC BY 4.0.',
        'retrieved': RETRIEVED,
    },

    # --- ICS International Chronostratigraphic Chart, RDF -------------------------------------
    'ics_chart': {
        'git': (ICS_REPO, ICS_COMMIT, 'chart.ttl'),
        'url': f'https://raw.githubusercontent.com/i-c-stratigraphy/chart/{ICS_COMMIT}/chart.ttl',
        'name': 'ics_chart.ttl',
        'sha256': '8548707d66c383460b3bddc20afb7070cb5f3ea187ea1262418dc3a6f2d6e9f7',
        'bytes': 642198,
        'licence': CC_BY_4,
        'licence_evidence': 'credits/ics-chart-LICENSE.txt, credits/ics-chart-README.adoc '
                            '("(c) International Commission on Stratigraphy, 2026", CC BY 4.0)',
        'attribution': 'International Chronostratigraphic Chart data, (c) International Commission on '
                       'Stratigraphy, 2026, CC BY 4.0 (github.com/i-c-stratigraphy/chart at '
                       + ICS_COMMIT[:12] + '). Cite: Cohen K, Harper D, Gibbard P, Car N. The ICS '
                       'international chronostratigraphic chart this decade. Episodes 2025;48:105-115. '
                       'doi:10.18814/epiiugs/2025/025001.',
        'retrieved': RETRIEVED,
    },

    # --- Natural Earth 1:50m, public domain (v5.1.2) ------------------------------------------
    'ne_land': {
        'git': (NE_REPO, NE_COMMIT, 'geojson/ne_50m_land.geojson'),
        'url': f'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{NE_COMMIT}/geojson/ne_50m_land.geojson',
        'name': 'ne_50m_land.geojson',
        'sha256': 'e874b27a51d146452be360cafb3cc50c86001074a67d534113e6534682f9826b',
        'bytes': 1636166,
        'licence': 'public domain',
        'licence_evidence': 'credits/natural-earth-LICENSE.md',
        'attribution': 'Made with Natural Earth (public domain).',
        'retrieved': RETRIEVED,
    },
    'ne_coastline': {
        'git': (NE_REPO, NE_COMMIT, 'geojson/ne_50m_coastline.geojson'),
        'url': f'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{NE_COMMIT}/geojson/ne_50m_coastline.geojson',
        'name': 'ne_50m_coastline.geojson',
        'sha256': '271f1c4c1908312bac6b29d158ea1356544beafc129f260005300913aa5ea283',
        'bytes': 1640858,
        'licence': 'public domain',
        'licence_evidence': 'credits/natural-earth-LICENSE.md',
        'attribution': 'Made with Natural Earth (public domain).',
        'retrieved': RETRIEVED,
    },
    'ne_places': {
        'git': (NE_REPO, NE_COMMIT, 'geojson/ne_50m_populated_places_simple.geojson'),
        'url': f'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{NE_COMMIT}/geojson/ne_50m_populated_places_simple.geojson',
        'name': 'ne_50m_populated_places_simple.geojson',
        'sha256': '8e70756b39fae9bcdc1e332bfc510c024c5edd3a13203ffd20092ee37b61d978',
        'bytes': 850767,
        'licence': 'public domain',
        'licence_evidence': 'credits/natural-earth-LICENSE.md',
        'attribution': 'Made with Natural Earth (public domain).',
        'retrieved': RETRIEVED,
    },
}

# Cited, not downloaded by the pipeline: a published formula the app evaluates.
CITED = {
    'gough1981': {
        'citation': 'Gough, D.O., 1981. Solar interior structure and luminosity variations. Solar Physics '
                    '74, 21-34, doi:10.1007/BF00151270.',
        'used': 'Equation (1), p. 28: L(t) = [1 + 2/5 (1 - t/t_sun)]^-1 L_sun for t <= t_sun, with the '
                'Main-Sequence age t_sun "about 4.7 x 10^9 yr" (p. 23). Read from the NASA ADS scan '
                'https://articles.adsabs.harvard.edu/pdf/1981SoPh...74...21G (publisher copyright; '
                'the formula is used, no text or figure is copied).',
    },
}
