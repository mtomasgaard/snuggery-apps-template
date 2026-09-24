"""Assembles the About panel (data/about.json) and CREDITS.txt from the credits fragments every step
writes to tools/credits/<step>.json, plus the app-level notes kept here: how to read the app, what it
deliberately does not show, and the software and fonts it ships.

The fragments are the single source: a dataset's owner, licence and adaptations are written once,
by the step that uses it, and appear identically in the app, in CREDITS.txt and in NOTES.md's tables.
"""
import json
import math
import os
import textwrap

import galaxy_sources as GS
from common import RETRIEVED, write_json
from paths import APP, DATA, TOOLS

ORDER = ['solar', 'smallbodies', 'textures-sky', 'stars', 'galaxy']

INTRO = ('Everything in this app is measured data or a published fit to measured data, and each '
         'fit is labelled as one. Nothing is painted and nothing is fetched: the files ship inside '
         'the app. The sources, their licences and how accurate each layer is are below.')

READING = [
    {
        'id': 'reading-sizes', 'title': 'Sizes and distances',
        'text': ('Nothing is enlarged. Planets and moons are drawn at their true size and true '
                 'distance, which is why most of them are a dot and a label until you come close; '
                 'the dot is a marker, the globe appears when it is a few pixels across. The ruler '
                 'at the bottom left is true at the distance of the object in the middle of the '
                 'screen.'),
    },
    {
        'id': 'reading-brightness', 'title': 'Star brightness',
        'text': ('Each star is drawn from its absolute magnitude and its distance from the camera, so '
                 'from the Sun the sky has the real magnitudes and a star brightens as you fly to '
                 'it. Farther from the Sun the exposure is raised so the neighbourhood stays '
                 'readable. Interstellar dust is not modelled: distant stars look brighter than '
                 'they would.'),
    },
    {
        'id': 'reading-glow', 'title': 'Display effects',
        'text': ('The glow around the Sun and the halo of points are display effects so small things '
                 'stay visible on a phone. Marker and label colours are chosen for legibility and '
                 'are not data, and neither are the colours of the galaxy model\'s glow, the young-star '
                 'maps and the Gaia sky: those layers hold a density or a star count, drawn in a '
                 'display tint. On a phone the Gaia sky is also given more contrast than its '
                 'credited stretch: its faintest eighth of levels is drawn black and its mid-tones are '
                 'darkened. A globe\'s surface colour is data where a map or a measured colour '
                 'exists; where neither could be sourced it is a neutral grey (see "What this app '
                 'does not show").'),
    },
]

NOT_SHOWN = {
    'id': 'not-shown', 'title': 'What this app does not show, and why',
    'text': ' '.join([
        'There is no picture of the Milky Way from outside: no such photograph exists, and every',
        'face-on image of our galaxy is an artist\'s impression. The galaxy view is built from the',
        'tracers that have been measured and the models fitted to them, each labelled. The far side',
        'of the disc is shown only where a fit extends there. The deep star catalogue stops at',
        '500 pc, where Gaia\'s parallaxes are still good enough to place single stars; the named',
        'naked-eye stars are placed at their catalogue distances, some as far as {far_kpc} kpc.',
        '{n_sky} named stars have no usable parallax ({sky_eg} among them), so they are not placed in',
        '3D: they are drawn only on the sky as seen from near the Sun, with the {n_sky_lines} figure lines',
        'that join them.',
        'Venus has no colour: no measured Venus colour or cloud map could be sourced, so it is a',
        'plain disc, with Magellan\'s radar map of the surface as an option. Saturn, Uranus and',
        'Neptune are uniform colours computed from measured spectra, because the only global maps',
        'of them are paintings or have no clear licence. {n_grey} moons have neither a sourced map',
        'nor a measured colour and are drawn a neutral grey: {grey}. {shapeless}',
        'Saturn\'s ring edges and gaps are JPL data; their brightness is drawn uniform and their',
        'colour a neutral grey, because no ring brightness or colour profile with a clean licence',
        'was reachable. Uranus\'s rings are thin lines at their measured radii: about {ur_lo} to',
        '{ur_hi} km wide, they are far too narrow to draw to scale. Neptune\'s rings are not shown.',
        'Pluto is placed at the Pluto–Charon barycentre and Charon is not',
        'shown: no long-term ephemeris for either centre could be sourced.',
        'The {n_moons} moons of Mars and the giant planets are shown only from {m0} to {m1}, the span',
        'of their fitted JPL ephemerides; outside it they are hidden, not extrapolated, and a view',
        'that follows one moves to its planet. The planets',
        'and the Moon cover {e0} to {e1}. Bodies cast no shadows on each other, so eclipses and the',
        'shadows of moons on their planets are not drawn; only Saturn and its rings shadow each other.',
        'Only asteroids brighter than absolute magnitude 12 are included — {n_ast} of them, a small',
        'fraction of those known — so the main belt is sparse and near-Earth asteroids are almost',
        'absent apart from a few named ones.',
    ]),
}

SOFTWARE = {
    'id': 'software', 'title': 'Software and fonts',
    'owner': 'three.js authors; Braille Institute of America; The Newsreader Project Authors',
    'licence': 'three.js r186: MIT. Atkinson Hyperlegible and Newsreader: SIL Open Font License 1.1',
    'source': ('three.js r186 renders the scene; the copy in vendor/ is byte for byte the one '
               'vendored in the Anatomy and Besseggen apps in this repository. The fonts are the '
               'same files those apps ship, with the licence text in fonts/OFL.txt.'),
}


def load_fragments():
    blocks = []
    cdir = os.path.join(TOOLS, 'credits')
    names = sorted(os.listdir(cdir)) if os.path.isdir(cdir) else []
    names.sort(key=lambda n: (ORDER.index(n[:-5]) if n[:-5] in ORDER else 99, n))
    for n in names:
        if not n.endswith('.json'):
            continue
        with open(os.path.join(cdir, n), encoding='utf-8') as f:
            frag = json.load(f)
        items = frag if isinstance(frag, list) else frag.get('blocks', [])
        for b in items:
            b = dict(b)
            b.setdefault('step', n[:-5])
            blocks.append(b)
    return blocks


def about_block(b):
    out = {k: b[k] for k in ('id', 'title', 'owner', 'licence', 'retrieved', 'accuracy') if b.get(k)}
    src = b.get('source') or ''
    adapt = b.get('adaptations') or ''
    out['source'] = src
    if adapt:
        out['text'] = adapt if isinstance(adapt, str) else ' '.join(adapt)
    if b.get('url'):
        out['url'] = b['url']
    return out


# The licences that ask for their full text to travel with the work (BSD clause 2, MIT), for content
# that ships in data/galaxy/. Read verbatim from the pinned files the credit blocks quote; each read
# checks the file's sha256 again. CREDITS.txt only: in the About panel they would bury the rest.
LICENCE_TEXTS = [
    ('galstreams 1.2.1, for the stellar-stream tracks in galaxy/galaxy.json (galstreams-1.2.1/LICENSE)',
     lambda: GS.galstreams_members(['LICENSE'])['LICENSE']),
    ('SpiralMap 0.27, the package the spiral-arm fits in galaxy/galaxy.json and the young-star maps '
     'galaxy/young-*.png were taken from; the maps also carry the Gaia terms quoted above '
     '(spiralmap-0.27.dist-info/licenses/LICENSE.md)', lambda: GS.spiralmap('licence')),
    (f'Agama @ {GS.AGAMA_COMMIT[:8]}, for the disc and bar model in galaxy/model.png (LICENSE)',
     lambda: read_bytes(GS.agama('LICENSE'))),
]


def read_bytes(path):
    with open(path, 'rb') as f:
        return f.read()


def load_data(name):
    path = os.path.join(DATA, name)
    if not os.path.exists(path):
        return None
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def year(jd):
    return round(2000 + (jd - 2451544.5) / 365.2425)


def not_shown_values():
    """The counts and ranges the not-shown text quotes, read from the shipped data."""
    v = dict.fromkeys(('n_ast', 'far_kpc', 'n_sky', 'sky_eg', 'n_sky_lines', 'n_grey', 'grey', 'ur_lo',
                       'ur_hi', 'n_moons', 'm0', 'm1', 'e0', 'e1'), '—')
    v['shapeless'] = ''
    m = load_data('smallbodies.json')
    if m:
        kinds = m.get('kinds', {})
        v['n_ast'] = f"{sum(1 for k in m.get('kind_list', []) if kinds.get(str(k)) not in ('comet', 'interstellar')):,}" if m.get('kind_list') else f"{m.get('asteroid_count', m.get('count', 0)):,}"
    n = load_data('stars/named.json')
    if n:
        far = max(math.hypot(n['x'][i], n['y'][i], n['z'][i]) for i in range(n['count'])
                  if not n['flags'][i] & 16 and n['absmag'][i] is not None)    # bit 4: not placed
        v['far_kpc'] = f'{far / 1000:.1f}'
        sky = [i for i in range(n['count']) if n['flags'][i] & 16]
        v['n_sky'] = len(sky)
        eg = sorted((n['vmag'][i], n['name'][i]) for i in sky if n['name'][i] and n['vmag'][i] is not None)
        if eg:
            v['sky_eg'] = eg[0][1]                                      # the brightest of them
    con = load_data('stars/constellations.json')
    if con:
        v['n_sky_lines'] = sum(len(c.get('lines_sky_only', [])) for c in con.values())
    moons, tex, phys, eph = (load_data(f) for f in ('moons.json', 'tex/textures.json', 'physical.json', 'ephem.json'))
    if moons and tex:
        grey = [o['name'] for o in moons['moons']
                if o['name'].lower() not in tex['bodies'] and o['name'].lower() not in tex['colours']]
        if grey:
            v['n_grey'], v['grey'] = len(grey), ' and '.join([', '.join(grey[:-1]), grey[-1]] if grey[:-1] else grey)
    if moons:
        v['n_moons'], v['m0'], v['m1'] = len(moons['moons']), year(moons['jd_start']), year(moons['jd_end'])
    if eph:
        v['e0'], v['e1'] = year(eph['jd_start']), year(eph['jd_end'])
    if phys:
        w = [r['width_km'] for r in phys['rings']['uranus']]
        v['ur_lo'], v['ur_hi'] = f'{min(w):.0f}', f'{max(w):.0f}'
        for b in phys['bodies'].values():
            r = b.get('radii_km')
            if b.get('pole') is None and r and len(set(r)) > 1:
                v['shapeless'] += (f"{b['name']} has no rotation model in pck00011, so its orientation is not "
                                   f"modelled: its {' × '.join(f'{x:.0f}' for x in r)} km shape is drawn as a "
                                   f"sphere of its mean radius, {math.prod(r) ** (1 / 3):.0f} km. ")
    return v


def main():
    frags = load_fragments()
    # Counts quoted in the text come from the shipped data, not from this file.
    NOT_SHOWN['text'] = NOT_SHOWN['text'].format(**not_shown_values()).replace('  ', ' ')
    blocks = [about_block(b) for b in frags]
    about = {'intro': INTRO, 'blocks': READING + blocks + [NOT_SHOWN, SOFTWARE]}
    write_json('about.json', about, pretty=True)

    # CREDITS.txt: the same content as plain text, with URLs and licence quotes.
    w = lambda s, ind='': textwrap.fill(s, 98, initial_indent=ind, subsequent_indent=ind)
    lines = ['Milky Way — credits and licences', '',
             w('Every dataset below was downloaded by the pipeline in tools/ from a pinned source and '
               f'checked against its sha256; the retrieval date is {RETRIEVED} unless a block says '
               'otherwise. Licences are quoted from the files and pages named; where a term could only '
               'be read through a search summary, the block says so.'), '']
    for b in frags:
        lines += ['', b.get('title', b.get('id', '')).upper()]
        for key, label in (('owner', 'Owner'), ('source', 'Source'), ('url', 'URL'), ('licence', 'Licence'),
                           ('licence_quote', 'Licence text'), ('retrieved', 'Retrieved'),
                           ('adaptations', 'Adaptations'), ('accuracy', 'Accuracy')):
            v = b.get(key)
            if not v:
                continue
            if isinstance(v, list):
                v = ' '.join(v)
            lines.append(w(f'{label}: {v}'))
    lines += ['', '', 'NOT SHOWN', w(NOT_SHOWN['text']), '', '', 'SOFTWARE AND FONTS',
              w(SOFTWARE['source']), w(SOFTWARE['licence']),
              w('The fonts carry their copyright in their own metadata: "Copyright 2020 Braille '
                'Institute of America, Inc." (Atkinson Hyperlegible) and "Copyright 2020 The '
                'Newsreader Project Authors (http://github.com/productiontype/Newsreader)" '
                '(Newsreader).'), '']
    lines += ['', 'FULL LICENCE TEXTS',
              w('The licences below ask that their full text accompany copies of the work. Each is '
                'reproduced verbatim from the sha256-pinned file the credit block above quotes.')]
    for what, read in LICENCE_TEXTS:
        lines += ['', w(f'--- {what}'), '', read().decode('utf-8').replace('\r\n', '\n').rstrip(), '']
    with open(os.path.join(APP, 'CREDITS.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines).rstrip() + '\n')
    print(f'about.json: {len(about["blocks"])} blocks; CREDITS.txt: {len(frags)} dataset blocks')


if __name__ == '__main__':
    main()
