"""Every source the US Quakes pipeline reads: where from, its sha256 and size where the file is
static (measured on the first download, 2026-09-30), its licence or terms, and the attribution
wording. RESEARCH.md §2 has the long form of each entry, with the terms quoted verbatim.

Static files go through common.fetch_pinned(), which refuses anything whose sha256 differs from the
pin, so an upstream change stops the build instead of silently changing the app. The live and the
queried sources (ComCat, the GeoJSON feeds, the volcano API) cannot be pinned by hash; their
contract is pinned instead: API version, columns and fields, checked on every run.
"""
from common import RETRIEVED

PUBLIC_DOMAIN_USGS = 'public domain (US Government work, 17 U.S.C. §105); USGS asks for acknowledgment'
NE_REPO = 'https://github.com/nvkelso/natural-earth-vector'
NE_COMMIT = 'f1890d9f152c896d250a77557a5751a93d494776'       # tag v5.1.2
NE_RAW = f'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{NE_COMMIT}/geojson/'

# ---------------------------------------------------------------------------------------------
# ComCat through the FDSN event web service (queried, cached per closed window by fetch_catalog.py)
# ---------------------------------------------------------------------------------------------
COMCAT = {
    'base': 'https://earthquake.usgs.gov/fdsnws/event/1',
    'api_version': '2.7.0',                     # GET /version, 2026-09-30
    'limit': 20000,                             # "maxAllowed" in every /count answer
    'cutoff': '2026-01-01',                     # history.bin ends here; the snapshot carries M2.5+
                                                # from a year earlier, so the two overlap by a year
    'eras': [('1600-01-01', '1900-01-01', None),   # before 1900: every event, magnitude or not
             ('1900-01-01', '2026-01-01', 2.5)],   # from 1900: M2.5 and up
    'csv_columns': ['time', 'latitude', 'longitude', 'depth', 'mag', 'magType', 'nst', 'gap', 'dmin',
                    'rms', 'net', 'id', 'updated', 'place', 'type', 'horizontalError', 'depthError',
                    'magError', 'magNst', 'status', 'locationSource', 'magSource'],
    # Boxes are the service's own parameters, inclusive. Alaska runs 172°E..129°W as 172..231, which
    # the service accepts (longitudes -360..360), so the Aleutians are one box across the date line.
    # The Lower 48 box reaches 130°W to hold the Juan de Fuca and Gorda plates offshore Cascadia; it
    # also takes in northern Mexico and southern British Columbia, which the map shows as they are.
    'regions': {
        'conus': {'name': 'Lower 48',
                  'box': {'minlatitude': 24, 'maxlatitude': 50, 'minlongitude': -130, 'maxlongitude': -65}},
        'ak':    {'name': 'Alaska',
                  'box': {'minlatitude': 50, 'maxlatitude': 72, 'minlongitude': 172, 'maxlongitude': 231}},
        'hi':    {'name': 'Hawaii',
                  'box': {'minlatitude': 18, 'maxlatitude': 23, 'minlongitude': -161, 'maxlongitude': -154}},
        'pr':    {'name': 'Puerto Rico',
                  'box': {'minlatitude': 17, 'maxlatitude': 20, 'minlongitude': -68, 'maxlongitude': -64}},
    },
    'licence': PUBLIC_DOMAIN_USGS,
    'licence_evidence': 'credits/usgs-copyrights-and-credits.txt, credits/comcat-doi.txt',
    'attribution': 'Earthquakes: U.S. Geological Survey, ANSS Comprehensive Earthquake Catalog '
                   '(ComCat), doi:10.5066/F7MS3QZH; rounded and repacked.',
}

# ---------------------------------------------------------------------------------------------
# Live sources (refresh.py, hourly): not pinned by hash, pinned by contract
# ---------------------------------------------------------------------------------------------
FEEDS = {
    'base': 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/',
    'files': ['all_day.geojson', 'all_week.geojson', 'all_month.geojson'],
    'api_version': '2.7.0',                     # metadata.api, 2026-09-30
    'properties': ['mag', 'place', 'time', 'updated', 'tz', 'url', 'detail', 'felt', 'cdi', 'mmi',
                   'alert', 'status', 'tsunami', 'sig', 'net', 'code', 'ids', 'sources', 'types',
                   'nst', 'dmin', 'rms', 'gap', 'magType', 'type', 'title'],
    'licence': PUBLIC_DOMAIN_USGS,
    'attribution': COMCAT['attribution'],
}

VOLCANOES = {
    # HANS public API (https://volcanoes.usgs.gov/hans-public/api/volcano/). The static list comes from
    # getUSVolcanoes (170 volcanoes on 2026-09-30, with the NVEWS threat class); the live layer from
    # getMonitoredVolcanoes (69, each with its current alert level and aviation colour code and the
    # notice it came from). Saved responses: samples/volcano-*.json.
    'us_list': 'https://volcanoes.usgs.gov/hans-public/api/volcano/getUSVolcanoes',
    'monitored': 'https://volcanoes.usgs.gov/hans-public/api/volcano/getMonitoredVolcanoes',
    'elevated': 'https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes',
    'us_fields': ['obs_abbr', 'obs_fullname', 'obs_email', 'volcano_cd', 'vnum', 'volcano_name', 'region',
                  'latitude', 'longitude', 'elevation_meters', 'boilerplate', 'volcano_url',
                  'volcano_image_url', 'nvews_threat', 'icao_coordinates'],
    'monitored_fields': ['volcano_name', 'vnum', 'sent_utc', 'sent_unixtime', 'alert_level', 'color_code',
                         'volcano_cd', 'obs_fullname', 'obs_abbr', 'notice_type_cd', 'notice_identifier',
                         'notice_url', 'notice_data'],
    'alert_levels': ['NORMAL', 'ADVISORY', 'WATCH', 'WARNING'],
    'color_codes': ['GREEN', 'YELLOW', 'ORANGE', 'RED'],
    'threat_classes': ['Very Low Threat', 'Low Threat', 'Moderate Threat', 'High Threat', 'Very High Threat'],
    'licence': PUBLIC_DOMAIN_USGS + '; the API itself: "These items are freely available but are designed '
               'to support USGS applications. No guarantee of continuing support should be assumed."',
    'attribution': 'Volcano status: USGS Volcano Hazards Program.',
}

# ---------------------------------------------------------------------------------------------
# Static downloads, pinned (common.fetch_pinned)
# ---------------------------------------------------------------------------------------------
NE_ATTRIBUTION = 'Basemap: Made with Natural Earth (public domain).'


def _ne(name, sha, size):
    return {'url': NE_RAW + name + '.geojson', 'name': f'ne/{name}.geojson', 'sha256': sha, 'bytes': size,
            'licence': 'public domain', 'licence_evidence': 'credits/natural-earth-LICENSE.md',
            'attribution': NE_ATTRIBUTION, 'retrieved': RETRIEVED}


STATIC = {
    'qfaults': {
        'url': 'https://earthquake.usgs.gov/static/lfs/nshm/qfaults/Qfaults_GIS.zip',
        'name': 'faults/Qfaults_GIS.zip',
        'sha256': '447eadc5926256710d988c30e5996ba540604caa0154f9746c48bad637926893',
        'bytes': 32371696,             # the USGS page says "16 MB"; Last-Modified Mon, 23 Feb 2026
        'licence': PUBLIC_DOMAIN_USGS + '; FGDC metadata: useconst "none", accconst "none"',
        'licence_evidence': 'credits/usgs-terms.txt §5, credits/qfaults-Qfaults_US_Database.shp.xml, '
                            'credits/qfaults-doi-10.5066-P9BCVRCK.datacite.json',
        'attribution': 'Faults: USGS and state geological surveys, Quaternary Fault and Fold Database of '
                       'the United States (U.S. Geological Survey, 2020, doi:10.5066/P9BCVRCK).',
        'retrieved': RETRIEVED,
        'read': 'GDB/Qfaults_2020_WGS84.gdb layer Qfaults_2020 (112,944 lines, 2025 edits) with pyogrio; '
                'the SHP/ copy (112,809) predates those edits (RESEARCH.md §2.4)',
    },
    # The basemap (build_geo.BASEMAP) is 1:10m: at the map's deepest zoom a CSS pixel is 0.11 km at 60° N,
    # and 1:50m cut across the fjords and arms the relief shows (docs/plans/0011-coastlines-research.md §4).
    'ne_coastline_10m': _ne('ne_10m_coastline', '6f75ae0e0de157b14946e2255eb1f5486d9a13819032e26d4610852d296788f6', 10110735),
    # 1:10m land: the basemap's land, and build_relief.py's registration gate measures the relief against
    # it, because 1:50m is too coarse for 326 m and 190 m pixels (its Ka Lae is 5.8 km north of the DEM's).
    'ne_land_10m': _ne('ne_10m_land', '1ac90796408bc6ad6911d69448485d3c4dbf2190370080368a09976e1c9f7416', 10157965),
    'ne_lakes_10m': _ne('ne_10m_lakes', '2d036f53dedec578001c5c30c2959ee7d4eebc1306900fa4367c49929ec8f2d9', 5043554),
    'ne_borders_10m': _ne('ne_10m_admin_0_boundary_lines_land', '74d9c16229c095fde65943a9919e337682f044bcebccb120764f38edf3b70f4a', 2284669),
    'ne_states_10m': _ne('ne_10m_admin_1_states_provinces_lines', '1a1f30ccaaf4cc9c4bde34266f0b8cbb955d3a4cf254b756912255f2ec7c75b6', 21092537),
    # 1:50m, not shipped: the relief's lake mask (build_relief.py; the JPEGs are committed and stay as built),
    # the lakes the map draws at 1:10m (build_geo.lakes_keep) and the nine countries whose state lines it
    # draws (build_geo.basemap_keep reads them from it).
    'ne_lakes': _ne('ne_50m_lakes', 'd350b75978b26fe839b797c2c529b2fb8f47fb3983c03f4964e36d5df9378a52', 876018),
    'ne_states': _ne('ne_50m_admin_1_states_provinces_lines', '72cca93c850d412628a5da4bc5ebfe21ba4d376eb34611bde6b623ee73f0fdcf', 882513),
    'ne_places': _ne('ne_50m_populated_places_simple', '8e70756b39fae9bcdc1e332bfc510c024c5edd3a13203ffd20092ee37b61d978', 850767),
    # Natural Earth has depth bands only at 1:10m; the plan's "1:50m depth bands" do not exist.
    'ne_bathy_200': _ne('ne_10m_bathymetry_K_200', '5c6c182da8608153ea2dce22dfb32c987e5390e0bd4a122266143ba181a7b636', 4229885),
    'ne_bathy_1000': _ne('ne_10m_bathymetry_J_1000', 'fa30219901dd4de34b9f5b20f41bc7c055f9fc9d58cf157ad2679c95239cd366', 2509878),
    'ne_bathy_2000': _ne('ne_10m_bathymetry_I_2000', 'cdedc746ce06e1a051cb8905e8f07855225ccbd3560ce3a66607651fc6953ce2', 4280462),
    'ne_bathy_3000': _ne('ne_10m_bathymetry_H_3000', '28fda8b34dfb8615f9644bff3e56c184501e21dccb807d428432e56d8dac0cf5', 8479402),
    'ne_bathy_4000': _ne('ne_10m_bathymetry_G_4000', 'ad876e6b6b686494a0e89f0096880a6755aee77af3d738794bbbc92216afcf3d', 12182812),
    'ne_bathy_5000': _ne('ne_10m_bathymetry_F_5000', 'e7b663f3f6144c1d23b8205618fd1eeb5256c4b03785a8ed009178209d68ba72', 9759029),
    'ne_bathy_6000': _ne('ne_10m_bathymetry_E_6000', '75fc34afdd5bc54a3ebe093fc0a680af70cf255f1b3e7e80ad75e795f5cc4c8d', 1006550),
    'ne_bathy_7000': _ne('ne_10m_bathymetry_D_7000', '19eb5dd59d37d6c6da9b0d04252769c62708aad6a1578f16d6a7b8b30fd05c56', 100076),
}

# The honesty notes' sources (quoted in credits/usgs-statements.txt), cited on the About page.
CITED = {
    'more_instruments': 'https://www.usgs.gov/faqs/why-are-we-having-so-many-or-so-few-earthquakes-has-naturally-occurring-earthquake-activity',
    'completeness_us': 'https://earthquake.usgs.gov/data/mineblast/goals.php',
    'completeness_catalogs': 'https://www.usgs.gov/faqs/where-can-i-search-earthquake-catalog-past-events',
    'oklahoma': 'https://www.usgs.gov/faqs/oklahoma-has-had-a-surge-earthquakes-2009-are-they-due-fracking',
}

# ---------------------------------------------------------------------------------------------
# 3DEP relief: one exportImage per region from the 3DEP Bare Earth DEM dynamic service, rendered
# server-side with its "Hillshade Multidirectional" raster function, delivered in Web Mercator
# (imageSR 3857) so a pixel row is a map row. Alaska is two requests either side of 180°, stitched
# by the build (widths 555 + 3541 = 4096 over 59° of longitude, the same height).
# The service is dynamic ("reflects all 3DEP DEM data published as of August 24, 2026"): the pins
# below stop a rebuild when USGS republishes, and the shipped JPEGs are committed so the yearly
# history build never needs to refetch relief (RESEARCH.md §1).
# ---------------------------------------------------------------------------------------------
TDEP_EXPORT = 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage'
TDEP_RULE = '{"rasterFunction":"Hillshade Multidirectional"}'


def tdep_params(bbox, size):
    return {'bbox': ','.join(str(v) for v in bbox), 'bboxSR': 4326, 'imageSR': 3857,
            'size': f'{size[0]},{size[1]}', 'format': 'png', 'pixelType': 'U8',
            'interpolation': 'RSP_BilinearInterpolation', 'renderingRule': TDEP_RULE, 'f': 'image'}


RELIEF = {
    #  key        bbox (W, S, E, N, degrees)       size (px, Web Mercator)
    'conus':   ((-128, 23.5, -65, 50),            (4096, 2192)),
    'ak-west': ((172, 50, 180, 72),               (555, 3309)),
    'ak-east': ((-180, 50, -129, 72),             (3541, 3309)),
    'hi':      ((-160.5, 18.5, -154.5, 22.5),     (2048, 1458)),
    'pr':      ((-68, 17.5, -64.5, 18.8),         (2048, 801)),
}
def tdep_dem_params(bbox, size):
    """The same box and size as the hillshade, as raw elevation: whole metres (Int16), LZW TIFF,
    NoData -32768. The hillshade paints sea inside a 3DEP tile as flat land (grey 242, the same
    grey as the Great Plains) and NoData as 253, so the build masks the relief where this raster is
    0 or NoData. Pillow reads it (mode I, compression tiff_lzw)."""
    return {'bbox': ','.join(str(v) for v in bbox), 'bboxSR': 4326, 'imageSR': 3857,
            'size': f'{size[0]},{size[1]}', 'format': 'tiff', 'pixelType': 'S16', 'compression': 'LZ77',
            'noData': -32768, 'interpolation': 'RSP_BilinearInterpolation', 'f': 'image'}


RELIEF_PINS = {    # key -> (sha256, bytes), measured 2026-09-30 by fetch_relief.py; two identical
                   # requests for a test tile returned byte-identical PNGs, so the export is stable
    'conus': ('7bd89e4ba17a975fb181d2dd6c0372108b8333596cfab4527f9cf21199fac00c', 2596191),
    'ak-west': ('873fe93764892ff5ef11a8bc7e1aaa9cd4502b0dd3c863a70f2b17153d28229c', 12707),
    'ak-east': ('5fe0f4efdf179ff90c9d0d2f9bfaa45f7724440fa1f201268f067f28b0d508f8', 2580580),
    'hi': ('f02345a1c44726c5a6c1a0e95e6ccd4eb4a910c2eb8e679618302ee14e88af4f', 118202),
    'pr': ('1c9b972863910ba2b84dc2f738828fbf5d4b65d2310248da0e00ff375b3b742c', 194894),
}
RELIEF_DEM_PINS = {   # key -> (sha256, bytes), the land-mask rasters, measured 2026-09-30
    'conus': ('5322416e6b2935afb32bdaf46ed2cddbfc0cac951ecee52488d2c4062ab11513', 8673794),
    'ak-west': ('74845b8aaa24257af779bfec83a7aa54f7e29ce85ed42d7c520d126a06e28d24', 71144),
    'ak-east': ('e2dffa06c76a1512c14e44e17117904a74f30b165957dfc8ebbe51f743e15fe3', 7355538),
    'hi': ('e71928299333619456cfa75f9a3b7a78b26b7f12ae358418a74aef2cbfb6d9df', 434646),
    'pr': ('49f461600022d1a61e4ba0a5fc6f7159ad2e542f44c745573ae871fc16edf2d7', 433781),
}
RELIEF_LICENCE = PUBLIC_DOMAIN_USGS
# The National Map's own requested wording is "Map services and data available from U.S. Geological
# Survey, National Geospatial Program." (credits/usgs-terms.txt §3); the plan's shorter line is
# brought into agreement with it here.
RELIEF_ATTRIBUTION = ('Relief: USGS 3D Elevation Program. Map services and data available from U.S. '
                      'Geological Survey, National Geospatial Program.')

# ---------------------------------------------------------------------------------------------
# The static volcano list: a committed response of getUSVolcanoes (samples/), pinned so geo.json
# never changes behind anyone's back. Refreshing it is a deliberate act:
#     .venv/bin/python fetch_layers.py --refresh-volcanoes     (re-saves the sample, prints the pin)
# ---------------------------------------------------------------------------------------------
VOLCANO_LIST_SAMPLE = {
    'path': 'samples/volcano-getUSVolcanoes.json',
    'sha256': 'a5bd45dd128b273dd554cac7ec5c7fc26c070e8df2d683a75084333ba9b92c4f',
    'bytes': 170146,
    'retrieved': RETRIEVED,
}

# ---------------------------------------------------------------------------------------------
# Credits: one record per source, the fixed half of what CREDITS.txt and about.json print. Each
# pipeline step writes a fragment (cache/work/credits/<step>.json) naming the files it read and what
# it changed; build_about.py joins the fragments with these records. Licence quotes are verbatim
# from credits/usgs-terms.txt and credits/natural-earth-LICENSE.md.
# ---------------------------------------------------------------------------------------------
_USGS_PD_QUOTE = ('"USGS-authored or produced data and information are considered to be in the U.S. '
                  'Public Domain." "Most U.S. Geological Survey (USGS) information resides in the Public '
                  'Domain and may be used without restriction. When using information from USGS '
                  'information products, publications, or websites, we ask that proper credit be given." '
                  '(usgs.gov, Copyrights and Credits; Acknowledging or Crediting USGS)')

CREDIT = {
    'comcat': {
        'title': 'ANSS Comprehensive Earthquake Catalog (ComCat), and its GeoJSON summary feeds',
        'owner': 'U.S. Geological Survey, Earthquake Hazards Program (with the ANSS regional networks)',
        'url': 'https://earthquake.usgs.gov/fdsnws/event/1',
        'licence': 'Public domain (US Government work, 17 U.S.C. §105); USGS asks for credit',
        'licence_quote': _USGS_PD_QUOTE,
        'cite': 'U.S. Geological Survey, 2017, Advanced National Seismic System (ANSS) Comprehensive '
                'Catalog, doi:10.5066/F7MS3QZH.',
        'attribution': COMCAT['attribution'],
    },
    'relief': {
        'title': '3D Elevation Program (3DEP) Bare Earth DEM, multidirectional hillshade',
        'owner': 'U.S. Geological Survey, National Geospatial Program (The National Map)',
        'url': 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer',
        'licence': 'Public domain (US Government work); The National Map asks for an acknowledgment',
        'licence_quote': '"Map services and data downloaded from The National Map are free and in the '
                         'public domain. There are no restrictions; however, we request that the '
                         'following acknowledgment statement of the originating agency be included in '
                         'products and data derived from our map services when citing, copying, or '
                         'reprinting: "Map services and data available from U.S. Geological Survey, '
                         'National Geospatial Program."" (usgs.gov FAQ, terms of use for The National Map)',
        'cite': 'U.S. Geological Survey, USGS 3D Elevation Program Digital Elevation Model, accessed '
                'September 30, 2026, at '
                'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer.',
        'attribution': RELIEF_ATTRIBUTION,
    },
    'qfaults': {
        'title': 'Quaternary Fault and Fold Database of the United States',
        'owner': 'U.S. Geological Survey, with state geological surveys',
        'url': STATIC['qfaults']['url'],
        'licence': 'Public domain; the metadata sets no use or access constraint',
        'licence_quote': 'FGDC metadata in the ZIP: <useconst>none</useconst>, <accconst>none</accconst>. '
                         'USGS faults page: "Sources/Usage: Public Domain." and "When you use this '
                         'data, please provide proper acknowledgment."',
        'cite': 'U.S. Geological Survey, 2020, Quaternary Fault and Fold Database for the Nation, '
                'accessed September 30, 2026, at https://doi.org/10.5066/P9BCVRCK.',
        'attribution': STATIC['qfaults']['attribution'],
    },
    'volcano-list': {
        'title': 'USGS Volcano Hazards Program, HANS public API (US volcano list and monitored status)',
        'owner': 'U.S. Geological Survey, Volcano Hazards Program',
        'url': 'https://volcanoes.usgs.gov/hans-public/api/volcano/',
        'licence': 'Public domain (US Government work); the API carries no guarantee of support',
        'licence_quote': _USGS_PD_QUOTE + ' The API: "These items are freely available but are designed '
                         'to support USGS applications. No guarantee of continuing support should be '
                         'assumed."',
        'cite': 'U.S. Geological Survey, Volcano Hazards Program, HANS public API, getUSVolcanoes, '
                'accessed September 30, 2026.',
        'attribution': VOLCANOES['attribution'],
    },
    'naturalearth': {
        'title': 'Natural Earth v5.1.2 (1:10m coastline, land, lakes, boundaries and bathymetry; 1:50m '
                 'populated places)',
        'owner': 'Natural Earth (naturalearthdata.com), free vector and raster map data',
        'url': NE_REPO + '/tree/' + NE_COMMIT,
        'licence': 'Public domain by its authors\' dedication',
        'licence_quote': '"All versions of Natural Earth raster + vector map data found on this website are '
                         'in the public domain. You may use the maps in any manner, including modifying '
                         'the content and design, electronic dissemination, and offset printing." '
                         '"No permission is needed to use Natural Earth. Crediting the authors is '
                         'unnecessary." (LICENSE.md at the pinned commit)',
        'cite': 'Natural Earth, v5.1.2, commit ' + NE_COMMIT + '.',
        'attribution': NE_ATTRIBUTION,
    },
}
CREDIT_ORDER = ['comcat', 'relief', 'qfaults', 'volcano-list', 'naturalearth']
