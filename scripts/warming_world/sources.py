"""Every source the Warming World pipeline reads: where from, its sha256 and size where the file is
static (measured on the first download, 2026-09-30), its licence or terms, and the attribution
wording. tools/RESEARCH.md §2 (in Template/warming-world/) has the long form of each entry, with
the terms quoted verbatim; credits/ holds the evidence.

GISTEMP cannot be pinned by hash: GISS rewrites the grid every month, and earlier months change
with it (late reports, corrections, homogenisation; credits/gistemp-page-and-faq.txt §3). Its
*contract* is pinned instead: format, variable, type, scale, fill, grid and time axis, checked by
the refresh on every run, which refuses to publish a file that breaks it. The research copy the
measurements in RESEARCH.md were made on is pinned by hash in GISTEMP_RESEARCH, so they can be
reproduced.
"""
from common import RETRIEVED

PUBLIC_DOMAIN_US = 'Public domain in the United States (US Government work, 17 U.S.C. §105)'

# ---------------------------------------------------------------------------------------------
# NASA GISTEMP v4: the live grid (refresh, monthly) and GISS's own global means (validation)
# ---------------------------------------------------------------------------------------------
GISTEMP = {
    'page': 'https://data.giss.nasa.gov/gistemp/',
    'downloads_page': 'https://data.giss.nasa.gov/gistemp/data_v4.html',
    # "Land-Ocean Temperature Index, ERSSTv5, 1200km smoothing" (the page says "23 MB"; the file
    # was 25,853,076 B on 2026-09-08 and 25,836,095 B on 2026-08-10).
    'url': 'https://data.giss.nasa.gov/pub/gistemp/gistemp1200_GHCNv4_ERSSTv5.nc.gz',
    'table_url': 'https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv',
    'update': 'about the 10th of every month (the page); 2026-09-08 06:31 UTC for the September release',
    # The contract, read with netcdf3.py and scipy.io.netcdf_file (identical) on 2026-09-30:
    'contract': {
        'magic': b'CDF\x01',                   # classic NetCDF, 32-bit offsets; not NetCDF-4/HDF5
        'dims': {'lat': 90, 'lon': 180, 'nv': 2},   # plus 'time', which grows by one a month
        'unlimited': None,                     # time is a fixed dimension; numrecs is 0
        'variable': 'tempanomaly',
        'dims_of_variable': ('time', 'lat', 'lon'),
        'type': 'h',                           # int16, big-endian
        'scale_factor': 0.01,                  # stored as float32 0.009999999776482582: decode as int/100
        'fill': 32767,
        'units': 'K',                          # an anomaly in kelvin is the same number in °C
        'lat': (-89.0, 2.0),                   # first value, step: rows run SOUTH to north
        'lon': (-179.0, 2.0),                  # cell centres, -179 .. 179
        'time_units': 'days since 1800-01-01 00:00:00',
        'first_month': '1880-01',              # time[0] = 1880-01-15, bounds 1880-01-01 .. 1880-02-01
        'history_has': ('ILAND=1200', 'IOCEAN=NCDC/ER5', 'Base: 1951-1980'),
    },
    'licence': PUBLIC_DOMAIN_US + '; GISS asks for a citation of the page (with the access date) '
               'and of its most recent paper',
    'licence_evidence': 'credits/gistemp-page-and-faq.txt §1, credits/nasa-media-guidelines.txt',
    # SI spacing at the source (DESIGN §2): U+202F between the number and its unit, so CREDITS.txt, the
    # snapshot and About carry the bytes the screen shows. verify_static.py pins this sentence verbatim.
    'attribution': 'Temperature: NASA GISS Surface Temperature Analysis (GISTEMP v4); annual means '
                   'and 0.1\u202f°C rounding by this app.',
    'citation': [
        'GISTEMP Team, {year}: GISS Surface Temperature Analysis (GISTEMP), version 4. NASA Goddard '
        'Institute for Space Studies. Dataset accessed {accessed} at https://data.giss.nasa.gov/gistemp/.',
        'Lenssen, N., G.A. Schmidt, M. Hendrickson, P. Jacobs, M. Menne, and R. Ruedy, 2024: A GISTEMPv4 '
        'observational uncertainty ensemble. J. Geophys. Res. Atmos., 129, no. 17, e2023JD040179, '
        'doi:10.1029/2023JD040179.',
    ],
    'endorsement': 'NASA content "used in a factual manner that does not imply endorsement may be used '
                   'without needing explicit permission"; commercial use "must not explicitly or implicitly '
                   'convey NASA\'s endorsement"; the NASA insignia and logotype are not public domain '
                   '(credits/nasa-media-guidelines.txt). So: no NASA logo, no "NASA app", no "official".',
}

# The copies RESEARCH.md's numbers were measured on. data.giss.nasa.gov refused every connection
# from about 00:00 UTC on 2026-10-01 (from this machine and from an independent fetcher) after
# delivering 10,678,272 B of the September grid, so the research grid is the Internet Archive's
# capture of the August release, the same URL one month earlier. The table is the capture of
# 2026-09-14, the September release (its 12,887 B equal the Content-Length GISS answered for the
# live file at 23:57 UTC). Replace both pins with the live files when GISS answers again.
GISTEMP_RESEARCH = {
    'grid': {
        'url': 'https://web.archive.org/web/20260906203026id_/'
               'https://data.giss.nasa.gov/pub/gistemp/gistemp1200_GHCNv4_ERSSTv5.nc.gz',
        'name': 'wayback/gistemp1200_GHCNv4_ERSSTv5.20260906.nc.gz',
        'sha256': '93f73f648a5e43b2870880865406ae98d35b03146612717e538d48a3bec02425',
        'bytes': 25836095,
        'release': 'created 2026-08-10 06:37:42 (history attribute); 1,759 months, 1880-01 .. 2026-07',
        # When the research stage finished reading it: the cached file's mtime, 2026-09-30 17:06:51
        # PDT. A research-mode snapshot prints this as its readAt, so it never claims a read it did
        # not make (build_snapshot.py).
        'read_at': '2026-10-01T00:06:51Z',
        'via': 'Internet Archive capture 20260906203026 of the URL above',
    },
    'table': {
        'url': 'https://web.archive.org/web/20260914070505id_/'
               'https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv',
        'name': 'wayback/GLB.Ts+dSST.20260914.csv',
        'sha256': 'c9ce0750ca93a8241c42fe86cd5bf54d07b28b21ae650b0ae49a206907018cd9',
        'bytes': 12887,
        'release': 'September 2026 release (Last-Modified Tue, 08 Sep 2026 06:29:13 GMT on the live file); '
                   '1880 .. 2026-08',
        'read_at': '2026-10-01T00:09:54Z',     # the cached file's mtime, 2026-09-30 17:09:54 PDT
        'via': 'Internet Archive capture 20260914070505 of the URL above',
    },
    'live_seen': {                              # HEAD answers at 23:57 UTC 2026-09-30, for the record
        'grid': {'bytes': 25853076, 'last_modified': 'Tue, 08 Sep 2026 06:31:20 GMT',
                 'gzip_mtime': '2026-09-08 06:31:20 UTC', 'sha256': None},   # not complete: see above
        'table': {'bytes': 12887, 'last_modified': 'Tue, 08 Sep 2026 06:29:13 GMT'},
    },
    'retrieved': RETRIEVED,
}

# ---------------------------------------------------------------------------------------------
# GISTEMP's inputs, cited for the honesty notes (nothing downloaded)
# ---------------------------------------------------------------------------------------------
CITED = {
    'ghcnm_v4': {
        'url': 'https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-monthly',
        'citation': 'Menne, M. J., C. N. Williams, B.E. Gleason, J. J Rennie, and J. H. Lawrimore, 2018: The '
                    'Global Historical Climatology Network Monthly Temperature Dataset, Version 4. J. Climate, 31, '
                    '9835-9854, doi:10.1175/JCLI-D-18-0094.1.',   # volume and pages from Crossref; NCEI's page still says "in press"
        'licence': PUBLIC_DOMAIN_US + ' (NOAA NCEI)',
        'evidence': 'credits/ncei-ersst-ghcn.txt',
    },
    'ersst_v5': {
        'url': 'https://www.ncei.noaa.gov/products/extended-reconstructed-sst',
        'citation': 'Boyin Huang, Peter W. Thorne, Viva F. Banzon, Tim Boyer, Gennady Chepurin, Jay H. Lawrimore, '
                    'Matthew J. Menne, Thomas M. Smith, Russell S. Vose, and Huai-Min Zhang (2017): NOAA Extended '
                    'Reconstructed Sea Surface Temperature (ERSST), Version 5. NOAA National Centers for '
                    'Environmental Information. doi:10.7289/V5T72FNM.',
        'paper': 'Huang, B., Peter W. Thorne, et al., 2017: Extended Reconstructed Sea Surface Temperature '
                 'version 5 (ERSSTv5), Upgrades, validations, and intercomparisons. J. Climate, '
                 'doi:10.1175/JCLI-D-16-0836.1.',
        'licence': PUBLIC_DOMAIN_US + ' (NOAA NCEI)',
        'evidence': 'credits/ncei-ersst-ghcn.txt',
        'note': 'NCEI released ERSSTv6 (news item dated December 11, 2025); GISTEMP still names ERSSTv5 '
                '(file name, IOCEAN=NCDC/ER5, the page). Watch for a switch: RESEARCH.md §4.',
    },
    'hansen2010': {
        'citation': 'Hansen, J., R. Ruedy, M. Sato, and K. Lo, 2010: Global surface temperature change. '
                    'Rev. Geophys., 48, RG4004, doi:10.1029/2010RG000345.',
        'why': 'the method, including the 1200 km smoothing; named on the GISTEMP page',
        'verified': 'Crossref api.crossref.org/works/10.1029/2010RG000345, 2026-09-30',
    },
}

# ---------------------------------------------------------------------------------------------
# Fallbacks named by the plan, for the record only (nothing downloaded)
# ---------------------------------------------------------------------------------------------
FALLBACKS = {
    'hadcrut5': {
        'url': 'https://www.metoffice.gov.uk/hadobs/hadcrut5/',
        'release': 'HadCRUT.5.2.0.0 (5° grid, from 1850)',
        'licence': 'Open Government Licence v3 (Crown copyright); a required acknowledgement sentence',
        'evidence': 'credits/hadcrut5-terms.txt',
    },
    'era5': {
        'url': 'https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels',
        'licence': 'CC BY 4.0 (catalogue record); access after accepting the licence on a CDS account',
        'evidence': 'credits/era5-licence.txt',
    },
}

# ---------------------------------------------------------------------------------------------
# Natural Earth v5.1.2, the commit the other apps pin (common.fetch_pinned)
# ---------------------------------------------------------------------------------------------
NE_REPO = 'https://github.com/nvkelso/natural-earth-vector'
NE_COMMIT = 'f1890d9f152c896d250a77557a5751a93d494776'       # tag v5.1.2
NE_RAW = f'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{NE_COMMIT}/geojson/'
NE_ATTRIBUTION = 'Coastlines, borders and city names: Made with Natural Earth (public domain).'


def _ne(name, sha, size):
    return {'url': NE_RAW + name + '.geojson', 'name': f'ne/{name}.geojson', 'sha256': sha, 'bytes': size,
            'licence': 'Public domain (Natural Earth\'s own dedication; not US Government work)',
            'licence_evidence': 'credits/natural-earth-LICENSE.md', 'attribution': NE_ATTRIBUTION,
            'retrieved': RETRIEVED}


STATIC = {
    'ne_land': _ne('ne_50m_land', 'e874b27a51d146452be360cafb3cc50c86001074a67d534113e6534682f9826b', 1636166),
    'ne_coastline': _ne('ne_50m_coastline', '271f1c4c1908312bac6b29d158ea1356544beafc129f260005300913aa5ea283', 1640858),
    'ne_lakes': _ne('ne_50m_lakes', 'd350b75978b26fe839b797c2c529b2fb8f47fb3983c03f4964e36d5df9378a52', 876018),
    'ne_borders': _ne('ne_50m_admin_0_boundary_lines_land', '2faac4f6b34386f3d21b6e018cf151f241f00e5c936d44dd17d7d9bfb147fa48', 760189),
    # City labels: Natural Earth (public domain), not the weather apps' GeoNames file (CC BY 4.0), the
    # Earth's History precedent (plan D8): one attribution condition fewer. 1,251 places.
    'ne_places': _ne('ne_50m_populated_places_simple', '8e70756b39fae9bcdc1e332bfc510c024c5edd3a13203ffd20092ee37b61d978', 850767),
    'ne_licence': {'url': f'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{NE_COMMIT}/LICENSE.md',
                   'name': '../credits/natural-earth-LICENSE.md',
                   'sha256': '2631b5b39b6d1acc56de75235109b5af2dbb4b0ac5a127b6f06185977247fd4b', 'bytes': 4636,
                   'licence': 'the licence itself', 'retrieved': RETRIEVED},
}

# ---------------------------------------------------------------------------------------------
# The one vendored font (ART.md "Libraries and vendored files", change list 15). Built by
# warming-world/tools/art/font_subset.py from google/fonts at a pinned commit; build_static.py
# checks the shipped bytes against these pins and credits it in CREDITS.txt and About.
# ---------------------------------------------------------------------------------------------
ARCHIVO = {
    'name': 'Archivo',
    'owner': 'Héctor Gatti and the Omnibus-Type team (The Archivo Project Authors)',
    'credit': 'Type: Archivo by Héctor Gatti and Omnibus-Type, SIL Open Font License 1.1.',
    'licence': 'SIL Open Font License 1.1, no Reserved Font Name',
    'url': 'https://github.com/Omnibus-Type/Archivo',
    'upstream': 'google/fonts commit 95f4904fc8bcf26d3420fe315560c96417c6dec7, ofl/archivo/Archivo[wdth,wght].ttf '
                '(658\u202f596\u202fB, sha256 0e094a7d3c7c4c25cf1310c4b30014f1dae9332220b1c2c88f4fa996f0b05053)',
    'adaptation': 'subset to weight 400-700, width 87.5-100 and Latin characters by tools/art/font_subset.py',
    'files': {   # the shipped bytes, measured 2026-09-30 (shasum -a 256)
        'fonts/archivo-ww.woff2': (62536, 'd5a9fa7bb7ad45bd69d8075fd101fbc7dddf65f3cb1acf33388ae9b530b7069f'),
        'fonts/OFL.txt': (4666, '8b23f87ce5825634fcc566fbfc62d91924d7cc69b24ff2cbbce93845264b025f'),
    },
}

# The credit lines the app's sources block and CREDITS.txt carry.
CREDIT = {
    'temperature': GISTEMP['attribution'],
    'basemap': NE_ATTRIBUTION,
    'endorsement': 'NASA does not endorse this app.',
    'type': ARCHIVO['credit'],
}
