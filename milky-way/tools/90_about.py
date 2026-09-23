"""Assembles the About panel (data/about.json) and CREDITS.txt from the credits fragments every step
writes to tools/credits/<step>.json, plus the app-level notes kept here: how to read the app, what it
deliberately does not show, and the software and fonts it ships.

The fragments are the single source: a dataset's owner, licence and adaptations are written once,
by the step that uses it, and appear identically in the app, in CREDITS.txt and in NOTES.md's tables.
"""
import json
import os
import textwrap

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
                 'are not data; surface colours on the globes are.'),
    },
]

NOT_SHOWN = {
    'id': 'not-shown', 'title': 'What this app does not show, and why',
    'text': ' '.join([
        'There is no picture of the Milky Way from outside: no such photograph exists, and every',
        'face-on image of our galaxy is an artist\'s impression. The galaxy view is built from the',
        'tracers that have been measured and the models fitted to them, each labelled. The far side',
        'of the disc is shown only where a fit extends there.',
        'Venus has no colour: no measured Venus colour or cloud map could be sourced, so it is a',
        'plain disc, with Magellan\'s radar map of the surface as an option. Saturn, Uranus and',
        'Neptune are uniform colours computed from measured spectra, because the only global maps',
        'of them are paintings or have no clear licence. Saturn\'s ring edges and gaps are JPL',
        'data; their brightness is drawn uniform, because no ring brightness profile with a clean',
        'licence was reachable. Pluto is placed at the Pluto–Charon barycentre and Charon is not',
        'shown: no long-term ephemeris for either centre could be sourced.',
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


def main():
    frags = load_fragments()
    # Counts quoted in the text come from the shipped data, not from this file.
    sb = os.path.join(DATA, 'smallbodies.json')
    n_ast = '—'
    if os.path.exists(sb):
        with open(sb, encoding='utf-8') as f:
            m = json.load(f)
        kinds = m.get('kinds', {})
        n_ast = f"{sum(1 for k in m.get('kind_list', []) if kinds.get(str(k)) not in ('comet', 'interstellar')):,}" if m.get('kind_list') else f"{m.get('asteroid_count', m.get('count', 0)):,}"
    NOT_SHOWN['text'] = NOT_SHOWN['text'].replace('{n_ast}', n_ast)
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
    with open(os.path.join(APP, 'CREDITS.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines).rstrip() + '\n')
    print(f'about.json: {len(about["blocks"])} blocks; CREDITS.txt: {len(frags)} dataset blocks')


if __name__ == '__main__':
    main()
