"""Pinned sources for the planet maps (30_textures.py), the sky backdrop (31_sky.py) and their check
(verify_textures_sky.py).

Every file below was located and checked by the research pass (research reports planet-imagery and
sky-backdrop) and is pinned by the sha256 of the whole file. Where the host has no versioning:

  * USGS Astrogeology's public bucket s3://asc-pds-services (the backend of planetarymaps.usgs.gov,
    which is itself not reachable) is not versioned. Its mosaics are downloaded whole and pinned by
    sha256 here; each download is also checked against the md5 sidecar USGS publishes next to it
    (MD5 below), so the pin is tied to USGS's own checksum and not only to the day of download.
    None of the mosaics used carries overviews, so no range/overview read is involved.
  * STScI's s3://stpubdata IS versioned: every Gaia key is read at a pinned S3 versionId, which
    cannot change. The point map is downloaded whole (sha256). Of the two HATS partitions that need
    the duplicate-row fix only two columns are read, by HTTP range requests on the versionId URL
    (see RangeFile); the object's size and ETag are checked first, and the extracted columns are
    pinned by the sha256 of their bytes (GAIA_PARTITIONS[...]['columns_sha256']), so a changed
    upstream object still stops the build.
"""
import hashlib
import io
import os
import subprocess
import sys

import common
from paths import CACHE

USGS = 'https://asc-pds-services.s3.amazonaws.com/'
STEL = ('https://github.com/Stellarium/stellarium', '9910a2f05c52d4d9f351ff490c9bc4d99670df1f')
WWD = ('https://github.com/NASAWorldWind/WebWorldWind', '5ffe2dfc54ab4d744fc9e587af9639c9910db228')
MARBLE = ('https://github.com/KDE/marble', '600d542e8de95716864f3278f2a4110cb54cb012')
STARFIELD = ('https://github.com/OrbitalCommons/starfield', '5cbc6620e74bb2139fb992a6886ed8b0414e34dd')
CELESTIA = ('https://github.com/CelestiaProject/CelestiaContent', 'eab93932c85fa315f370477ee8c6b7e15f12c327')
AWS_ODR = ('https://github.com/awslabs/open-data-registry', '00eb38722ad0a2d9ac0bd50d23f3ba0f11b10dfb')
ATHYG = ('https://github.com/astronexus/ATHYG-Database', '650346e2bc57f664eb411bc5f44ffd94b8006af2')
ISIS = ('https://github.com/DOI-USGS/ISIS3', '51b99bd4d3acf5d7c5a86f515444a4f3ab96f137')

# key -> (url, cache name, sha256, bytes)
USGS_FILES = {
    # Mercury: MESSENGER MDIS global mosaic 250 m, May 2013 edition (the product the FGDC record
    # "mercury_messenger_mdis_global_mosaic_250m" describes, with <accconst>Public domain).
    'mercury_tif': ('mosaic/Mercury_MESSENGER_mosaic_global_250m_2013.tif',
                    '720938d9a403803b016e88d22d58cddbbf4fe8cb99f652c90f19b5a1bc946c76', 1880562441),
    'mercury_lbl': ('mosaic/Mercury_MESSENGER_mosaic_global_250m_2013.lbl',
                    'c966e8dcedee7f7806eddbf0efc50f2730678ebbac676e9b1755e330ffac4c76', 1291),
    'mercury_md5': ('mosaic/Mercury_MESSENGER_mosaic_global_250m_2013.tif.md5',
                    '7759bb1d31465f72a3b5085a6b076048ab832286cf16f62e70d93807831386c6', 80),
    'mercury_fgdc': ('mosaic/FGDC_metadata/mercury_messenger_mdis_global_mosaic_250m.xml',
                     '3eeed00aabb1265ed2e9852a82150d42c0881eaf5fb0ca4c31f766a57462b3b0', 10965),
    # Venus: Magellan C3-MDIR global mosaic 2025 m (radar backscatter).
    'venus_tif': ('mosaic/Venus_Magellan_C3-MDIR_Global_Mosaic_2025m.tif',
                  '833d5368564b626a787b6d0a2b2432a0afaa89f72d4b46e5221a19b3a01ec380', 176335453),
    'venus_lbl': ('mosaic/Venus_Magellan_C3-MDIR_Global_Mosaic_2025m.lbl',
                  '2230c28c4ef52d3c6867c7cea3524f8e3be4845a5f6a1af6ab119f0518950a49', 1512),
    'venus_md5': ('mosaic/Venus_Magellan_C3-MDIR_Global_Mosaic_2025m.tif.md5',
                  '27f95a1f18a020907b6150accb852ed969ffa35e30ea8684e110d0e74acaeb9d', 81),
    'venus_fgdc': ('mosaic/FGDC_metadata/venus_magellan_global_c3_mdir_mosaic_2025m.xml',
                   '2f813e93bb07611fa6dadcc541331748a7089a3c71c4ade27c86898ccc9ba113', 11650),
    # Mars: Viking global colour mosaic 925 m.
    'mars_tif': ('mosaic/Mars_Viking_ClrMosaic_global_925m.tif',
                 '5b3c6bea36cec0ec65b9ce5927db6b1c555c5fae60a227c774f9fcaecdf5bb33', 797888177),
    'mars_lbl': ('mosaic/Mars_Viking_ClrMosaic_global_925m.lbl',
                 '2737ba343ee9298b7f33d65c0b2ecf953ad3d003a961e1c4aaa02aab836a1e49', 1294),
    'mars_md5': ('mosaic/Mars_Viking_ClrMosaic_global_925m.tif.md5',
                 '731921990631d5b5215d0dcf25f28e5d0c431e3ef79dbe63dc7fcf4c2d955520', 72),
    'mars_fgdc': ('mosaic/FGDC_metadata/mars_viking_global_color_mosaic_925m.xml',
                  'e21df0ad93af0ff2b5cac01b6eb8e55a42e25a4763940a2c8c5325775f3dd1eb', 17702),
    # Pluto and Charon: New Horizons LORRI/MVIC global mosaics 300 m, July 2017.
    'pluto_tif': ('mosaic/Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif',
                  '592b7fb0f88cafa0bedf9f33bb71e983952a250ee8577edf2abfe814b473356b', 309806463),
    'pluto_lbl': ('mosaic/Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.lbl',
                  '4a6fb79d54f5e60f5fd36e04fd3bf0c4c66bfafe27e52088c132e515af88d2e2', 4886),
    'pluto_md5': ('mosaic/Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif.md5',
                  'ad926dbb6a0e9504d8312342c6d40a6e99cb3b7b7017f246b4216e4900b54451', 88),
    'pluto_fgdc': ('mosaic/FGDC_metadata/pluto_new_horizons_lorri_mvic_global_mosaic_300m.xml',
                   'dcfa8dfcc0c17ea63b9daa41677ea9646bc4038654f84376f6508812ddf47d92', 12062),
    # Jupiter: Cassini ISS colour map PIA07782 as USGS holds it, plus the annotated original whose
    # axis labels state the longitude convention (the world file of the web copy does not).
    'jupiter_jpg': ('wms_basemaps/Jupiter/Jupiter/originals/jupiter_rgb_cyl_www.jpg',
                    '0c6fa8e972fc01bc44b16d678ce339a95fa7d7e8278e33705b2b58404f1c3c7c', 1806536),
    'jupiter_jgw': ('wms_basemaps/Jupiter/Jupiter/originals/jupiter_rgb_cyl_www.jgw',
                    '8e2c6fd8e058fd5613051e4355d7b473c07f1b6135867241af66450b287c8a8b', 54),
    'jupiter_annotated': ('wms_basemaps/Jupiter/Jupiter/originals/jupiter_from_cassini.tif',
                          'cff70454cfaec5f1a76c017372af7303032ac0ade5297291930b4ed95fef574a', 13097916),
    # Optional moons (grayscale only; FGDC <accconst> "public domain"): Io and Ganymede are
    # PositiveWest in their ISIS labels, Triton is a Voyager 2 colour composite of which only the
    # orange-filter band is used.
    'io_tif': ('mosaic/Io_GalileoSSI-Voyager_Global_Mosaic_1km.tif',
               'cf65a0323aac9c4c9eb582aa7b7ce0d36be8e445316fa6dba49ab5647b63584c', 65546342),
    'io_lbl': ('mosaic/Io_GalileoSSI-Voyager_Global_Mosaic_1km.lbl',
               '3f03c958018a808de1bedde5f6304771cba05b35eddaa570d19af013dbc7b2fb', 1278),
    'io_md5': ('mosaic/Io_GalileoSSI-Voyager_Global_Mosaic_1km.tif.md5',
               'e9ff518ec034bb8b60efdee754d765294ccbf80b4761040f1d6a4da1e689566a', 78),
    'io_fgdc': ('mosaic/FGDC_metadata/io_voyager_galileo_ssi_global_mosaic_1km.xml',
                'c90e12f84f43d94a3460c4ea8f0de5e4ff4737e39716fcbefcaf9e500cb87183', 15834),
    'ganymede_tif': ('mosaic/Ganymede_Voyager_GalileoSSI_global_mosaic_1km.tif',
                     'c2c8d9506b8cf8f7a0a90d823d9052e91c8d9885cf7267fdce8de8216f4df888', 136844537),
    'ganymede_lbl': ('mosaic/Ganymede_Voyager_GalileoSSI_global_mosaic_1km.lbl',
                     '4a9a2acc66ab9e5586ba97e8f8fa828c216333eea8ac910c8bf68b0afb96a599', 1390),
    'ganymede_md5': ('mosaic/Ganymede_Voyager_GalileoSSI_global_mosaic_1km.tif.md5',
                     '40f85ba453d66778acd7247e32e36c54727114175c36702678a7ab7686083418', 84),
    'ganymede_fgdc': ('mosaic/FGDC_metadata/ganymede_voyager_galileo_ssi_global_mosaic_1km.xml',
                      '012e1911179fb787a3d5995b8fb8c5c2304bdef021b132e3ac3f3f3a424db4e8', 17768),
    'triton_tif': ('mosaic/Triton_Voyager2_ClrMosaic_GlobalFill_600m.tif',
                   'f20ed332e85df469725629b81d3a73ad026897fe561ec59d6245d249a09507db', 299994887),
    'triton_lbl': ('mosaic/Triton_Voyager2_ClrMosaic_GlobalFill_600m.lbl',
                   '9e2af81852a87c1e7d09a44dd61c56edaad6305bbbfaf02ca10c411c3fb1a4b8', 1632),
    'triton_md5': ('mosaic/Triton_Voyager2_ClrMosaic_GlobalFill_600m.tif.md5',
                   '08222adc5d173e595345e037932f1b9e873bea32b5c388bed7b99e69a8df53a1', 80),
    'triton_fgdc': ('mosaic/FGDC_metadata/triton_voyager_2_global_color_mosaic_600m.xml',
                    '03e7c6626b52c357a6422d2bb8c7c47dfae5afc3dca55920b541b0eabbfb8dc9', 12855),
    'usgs_mapfiles': ('wms_basemaps/mapfiles_back_Jan24_2023.zip',
                      '716c9355efe19b8a1a1ec309dc0e84a99303fcd338b62acd991d909d17f4b8b7', 1677556),
}

# md5 sidecars published by USGS next to each mosaic: (tif key, md5 key).
MD5 = [('mercury_tif', 'mercury_md5'), ('venus_tif', 'venus_md5'), ('mars_tif', 'mars_md5'),
       ('pluto_tif', 'pluto_md5'), ('io_tif', 'io_md5'),
       ('ganymede_tif', 'ganymede_md5'), ('triton_tif', 'triton_md5')]

# key -> (repo, commit, path, sha256)
GIT_FILES = {
    'sun_webp': (STEL, 'textures/sun.webp', 'a1fc496b733a3a0d8ee95a9b163753cba2fead1ede3034f2d1167fd64a502e2a'),
    'moon_jpg': (STEL, 'textures/moon_4k.jpg', 'ad4435c755d41844e935d4b619ce57c1718856e2959f3769786a5cdd0779d345'),
    'stel_credits': (STEL, 'CREDITS.md', 'ad87a846c28e6cd445d63b32f4e66199825844d99d780d721345471d6a7f976a'),
    'earth_jpg': (WWD, 'images/BMNG_world.topo.bathy.200405.3.2048x1024.jpg',
                  '7405c39a220bc37519474eba54625a0d1a02b6ad954895147c103a1bc8dd61fb'),
    'earth_layer': (WWD, 'src/layer/BMNGOneImageLayer.js',
                    'ff467672ad7758a912cbe22cd3410cb6972b7e2476aea26743185866c443a2a8'),
    'wwd_sector': (WWD, 'src/geom/Sector.js', '037f555a920e1225e8e949d6372871f705cf4e8ada8a91e708ba60874acda493'),
    'night_jpg': (MARBLE, 'data/maps/earth/citylights/citylights.jpg',
                  'c79ca569cd514d8bcd48f103723eafe0655ad4d8003f00ec30b75d0790cc8d9a'),
    'night_dgml': (MARBLE, 'data/maps/earth/citylights/citylights.dgml',
                   '2ce9efce3a61c54a4fe7bf4f5bf55ec5b073ca1e59dbd6a8a492dfc0ce353c93'),
    'bluemarble_dgml': (MARBLE, 'data/maps/earth/bluemarble/bluemarble.dgml',
                        'ae73f459b4e86139247a2fd121a25b4a1d28b21b40ca02142cda8103b3eeaaf2'),
    'karkoschka_tab': (STARFIELD, 'crates/surfaces/data/planet-spectra/1995low.tab',
                       'd8071e071c2c0a60052ec6c164e151bd42847acf5d9bfbe1e9b2f76bf49a788b'),
    'karkoschka_lbl': (STARFIELD, 'crates/surfaces/data/planet-spectra/1995low.lbl',
                       '6fa49ffa124c4e7f30ca1906b739986b0bdfd5e7de60d1581826446a6bd27bc8'),
    'tsis_csv': (STARFIELD, 'crates/surfaces/data/solar-spectrum/tsis1_hsrs_v2_1nm.csv',
                 'c27ca6147c8cc9a484c87336d035868d91b9e49bad67a03bda55384f73431f93'),
    'starfield_license': (STARFIELD, 'LICENSE', 'd4dd285ef7143e052fe90ffb0cf6b1b7cc4c114ec4337774eeef0f2d82d73f66'),
    'jpl_image_policy': (CELESTIA, 'LICENSES/JPL-image.txt',
                         '3a0c8eb612b77118be08dbff72000b058d14809157674d047e4b06e4626a77ba'),
    'celestia_gaia_license': (CELESTIA, 'data/stars.dat.license',
                              '5831138c0da9ddc5517d8bf9412e88dfe9fbf4b0a9866468d23ed1939a28df5d'),
    'aws_gaia_yaml': (AWS_ODR, 'datasets/mast-gaia-dr3.yaml',
                      '0b13c4494b6b98251ccbbd005ddd50d2ddbea3765900ee1c84c71526874107d2'),
    # ISIS's own projection code: how a label's LongitudeDirection turns into image x (x grows
    # eastward in both conventions; the centre longitude and the longitude are both negated for
    # PositiveWest before x = R (lon - centre) is formed).
    'isis_simplecyl': (ISIS, 'isis/src/base/objs/SimpleCylindrical/SimpleCylindrical.cpp',
                       '3d4d2e304428b316637244218e4eaa1e724d815f0ec1a7ac9aedd7ee0f5c0a3e'),
    'isis_equirect': (ISIS, 'isis/src/base/objs/Equirectangular/Equirectangular.cpp',
                      'ae7f42ab565ff42cabd925050a9ceacfa83f7655e45fa20e16c558e8abe30be0'),
    'athyg_ack': (ATHYG, 'ACKNOWLEDGMENTS.md', '595d3f36dec582247b237448035e8aa4c9c8ab7b022912831338990846e84abb'),
}

# ---- Gaia DR3 as HATS (STScI/MAST, AWS Open Data), every key at a pinned S3 versionId
GAIA = 'https://stpubdata.s3.amazonaws.com/gaia/gaia_dr3/public/hats/gaia/'
GAIA_FILES = {
    'point_map': ('point_map.fits', 'ap2bO438Iyoss8CsAujiN7K4GnPVyjVV',
                  '3bec7fbb3140c3bbfb5437aa1e1d56a923c1cc89b97f7f42ea03ad3e938c4629', 6298560),
    'properties': ('hats.properties', 'KcsxFUJ1IJBDrV7h9l92o2Vz0FjvXiM2',
                   '92a491b38c58dfae495e5d0dfc25de4726f17e3980ecaa9476df391ccf14cd92', 414),
}
# The two partitions whose rows are duplicated (research sky-backdrop; verified independently):
# (order, pixel) -> versionId, object size, ETag, and the sha256 of the two extracted int64 columns
# (source_id then _healpix_29, little-endian, in file order).
GAIA_PARTITIONS = {
    (4, 115): {'version': 'L0_wu7pZqGRQJdOV4A5QTiGz2h166kh_', 'bytes': 261450045,
               'etag': '"dc30c1a433952034cd93428a26ffe8b6-32"', 'rows': 1368113, 'unique': 543481,
               'columns_sha256': '8bf3d388a5db027db2e36cefb3c59364fbf6b84ddf4d9bcf482c67fd87436985'},
    (3, 29): {'version': '9Bk2iLxZNbMZtoQJ5YctSN7y1L5I_W8U', 'bytes': 649547479,
              'etag': '"76609e20838e2280bce0a78707801399-78"', 'rows': 1616125, 'unique': 1418703,
              'columns_sha256': '665d323b373d7d8c678548afd8b1f1421f14969aa051c31526343713c8754687'},
}


def usgs(key):
    path, sha, size = USGS_FILES[key]
    return common.fetch(USGS + path, 'tex/' + os.path.basename(path), sha, size)


def git(key):
    (repo, commit), path, sha = GIT_FILES[key]
    name = 'tex/' + repo.rsplit('/', 1)[1] + '-' + commit[:8] + '-' + path.replace('/', '_')
    return common.git_file(repo, commit, path, name, sha)


def gaia(key):
    path, version, sha, size = GAIA_FILES[key]
    return common.fetch(f'{GAIA}{path}?versionId={version}', 'sky/' + path, sha, size)


def md5_check(tif_key, md5_key):
    """The md5 USGS publishes next to a mosaic must match the pinned download."""
    tif, side = usgs(tif_key), usgs(md5_key)
    want = open(side, encoding='ascii').read().split()[0].lower()
    h = hashlib.md5()
    with open(tif, 'rb') as f:
        for b in iter(lambda: f.read(1 << 22), b''):
            h.update(b)
    got = h.hexdigest()
    if got != want:
        sys.exit(f'{tif}: md5 {got} does not match the USGS sidecar {want}')
    return got


def isis_mapping(lbl_path):
    """The Mapping group of an ISIS cube label (the .lbl USGS ships next to each GeoTIFF), plus the
    cube's Samples and Lines, as a dict of strings/floats (units stripped)."""
    out, group = {}, None
    for raw in open(lbl_path, encoding='latin-1'):
        line = raw.strip()
        if line.startswith('Group = '):
            group = line.split('=', 1)[1].strip()
            continue
        if line.startswith('End_Group'):
            group = None
            continue
        if '=' not in line or group not in ('Mapping', 'Dimensions'):
            continue
        k, v = (s.strip() for s in line.split('=', 1))
        v = v.split('<')[0].strip()
        try:
            out[k] = float(v)
        except ValueError:
            out[k] = v
    return out


def fgdc(key):
    """accconst / useconst / title / edition / origin of a USGS FGDC record."""
    import xml.etree.ElementTree as ET
    root = ET.parse(usgs(key)).getroot()
    g = lambda tag: [(e.text or '').strip() for e in root.iter(tag) if (e.text or '').strip()]
    return {k: g(k) for k in ('title', 'edition', 'origin', 'accconst', 'useconst', 'pubdate')}


# ---- HTTP range reads for the two Gaia partitions
class RangeFile(io.RawIOBase):
    """A read-only, seekable file over one immutable S3 object version, fetched in 4 MiB blocks with
    curl range requests (the same client and proxy settings as common.fetch)."""

    def __init__(self, url, size, block=4 << 20):
        super().__init__()
        self.url, self.size, self.block, self.pos, self.blocks, self.fetched = url, size, block, 0, {}, 0

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos

    def _block(self, i):
        if i not in self.blocks:
            a = i * self.block
            b = min(self.size, a + self.block) - 1
            r = subprocess.run(['curl', '-sSf', '--retry', '4', '--retry-delay', '2', '-r', f'{a}-{b}', self.url],
                               check=True, capture_output=True)
            if len(r.stdout) != b - a + 1:
                raise IOError(f'short range read {a}-{b} of {self.url}')
            self.blocks[i] = r.stdout
            self.fetched += len(r.stdout)
        return self.blocks[i]

    def readinto(self, buf):
        n = min(len(buf), self.size - self.pos)
        if n <= 0:
            return 0
        out, p = bytearray(), self.pos
        while len(out) < n:
            i = p // self.block
            chunk = self._block(i)[p - i * self.block:p - i * self.block + n - len(out)]
            out += chunk
            p += len(chunk)
        buf[:n] = out
        self.pos += n
        return n


def s3_head(url):
    r = subprocess.run(['curl', '-sSfI', url], check=True, capture_output=True, text=True)
    h = {}
    for line in r.stdout.splitlines():
        if ':' in line:
            k, v = line.split(':', 1)
            h[k.strip().lower()] = v.strip()
    return h


def gaia_partition_columns(order, pix):
    """(source_id, _healpix_29) int64 arrays of one HATS partition, in file order. Read once by range
    requests at the pinned versionId, then cached under CACHE/sky/; always checked against the pin."""
    import numpy as np
    meta = GAIA_PARTITIONS[(order, pix)]
    cache = os.path.join(CACHE, 'sky', f'gaia_Norder{order}_Npix{pix}_source_id_healpix29.npy')

    def digest(a):
        return hashlib.sha256(np.ascontiguousarray(a[0], '<i8').tobytes() +
                              np.ascontiguousarray(a[1], '<i8').tobytes()).hexdigest()

    if os.path.exists(cache):
        a = np.load(cache)
    else:
        import pyarrow.parquet as pq
        url = f'{GAIA}dataset/Norder={order}/Dir={pix // 10000 * 10000}/Npix={pix}.parquet?versionId={meta["version"]}'
        h = s3_head(url)
        if int(h['content-length']) != meta['bytes'] or h.get('etag') != meta['etag'] \
                or h.get('x-amz-version-id') != meta['version']:
            sys.exit(f'{url}: size/ETag/version {h.get("content-length")} {h.get("etag")} '
                     f'{h.get("x-amz-version-id")} do not match the pin')
        print(f'  reading 2 columns of Norder={order}/Npix={pix} by range requests')
        f = RangeFile(url, meta['bytes'])
        t = pq.ParquetFile(io.BufferedReader(f, buffer_size=1 << 20)).read(columns=['source_id', '_healpix_29'])
        a = np.stack([np.asarray(t['source_id'].combine_chunks(), '<i8'),
                      np.asarray(t['_healpix_29'].combine_chunks(), '<i8')])
        print(f'  {f.fetched:,} bytes read of {meta["bytes"]:,}')
        os.makedirs(os.path.dirname(cache), exist_ok=True)
        np.save(cache + '.part.npy', a)
        os.replace(cache + '.part.npy', cache)
    got = digest(a)
    if got != meta['columns_sha256']:
        sys.exit(f'Norder={order}/Npix={pix}: extracted columns sha256 {got} do not match the pin '
                 f'{meta["columns_sha256"]} (delete {cache} and rerun; if it persists, upstream changed)')
    return a[0], a[1], got
