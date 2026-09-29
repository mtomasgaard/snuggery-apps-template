"""Step 7: add the finer structures of BodyParts3D 4.0 to the male body.

Release 4.0 models about 200 structures that release 3.0 lacks or has only as one lump: the parts of the eye and
the tear glands, the cartilages, ligaments and muscles of the larynx, the pharynx and soft palate, the tongue and
salivary glands, the nerves of the orbit, the heart's walls, chambers and each valve cusp, the bronchial tree
segment by segment, and the bile ducts. This step places them on the 3.0 body with atlaslib.BodyMap (as
build_vessels.py does), removes the 3.0 lumps they subdivide (eyeballs, heart wall, three valves, bronchial
tree, nasal cartilages), and files them into layers, regions and groups. It also moves eleven brain structures
that build_soft.py's name rules put in the muscle layer. It leaves out the 4.0 liver, colon and small intestine:
4.0 reshaped them, so their parts would not fit the 3.0 organs. Runs after build_vessels.py; re-runnable."""
import json, os, re, collections
import numpy as np
from paths import DATA, WORK, SOURCE
from atlaslib import load_atlas, read_part, weld, merge, decimate, side_of, cap, load_bodymap, drop_strays, repack

A = json.load(open(os.path.join(DATA, 'anatomy.json')))
G = json.load(open(os.path.join(DATA, 'geometry.json')))
M, chunks = load_atlas('atlas.json')
BM = load_bodymap(G, A, M, os.path.join(SOURCE, 'bodymap_pairs.json'))

REPLACED = {'FMA12513': 'eyeballs', 'FMA7274': 'heart wall', 'FMA7234': 'tricuspid valve', 'FMA7235': 'mitral valve',
            'FMA7246': 'pulmonary valve', 'FMA7409': 'bronchial tree', 'FMA71704': 'nasal cartilages'}
# re-runnable: forget what an earlier run added or replaced
ours_before = {p['id'] for p in A['parts']}
drop = {pid for pid in ours_before if pid in REPLACED or (pid.startswith('FJ') and next(p for p in A['parts'] if p['id'] == pid)['layer'] not in ('artery', 'vein'))}
A['parts'] = [p for p in A['parts'] if p['id'] not in drop]
G['parts'] = [p for p in G['parts'] if p['id'] not in drop]
ours_ids = {p['id'].replace('nsn', '') for p in A['parts']}
ours_names = {p['name'].lower() for p in A['parts']} | {p.get('source', '').lower() for p in A['parts']}

# ---------- what to take ----------
TAKE = {
 'sensory': lambda l: 'choroid plexus' not in l,
 'nervous': lambda l: re.search(r'nerve|ganglion|tentorium|inferior frontal gyrus', l),
 'connective': lambda l: True,
 'muscular': lambda l: re.search(r'\brectus\b|^(left|right) (inferior|superior) oblique$|levator palpebrae|aryepiglott|arytenoid|vocalis|cricothyroid|genioglossus|hyoglossus|veli palatini|uvular', l),
 'respiratory': lambda l: True,
 'skeletal': lambda l: 'intervertebral' not in l,
 'digestive': lambda l: re.search(r'^tongue$|sublingual gland|submandibular gland|hepatic duct|cystic duct|biliary tree|duct of caudate lobe', l),
 'cardiac': lambda l: True,
}
picked = [p for p in M['parts'] if p['system'] in TAKE and TAKE[p['system']](p['name'].lower())
          and p['conceptId'] not in ours_ids and p['name'].lower() not in ours_names]

# ---------- classification ----------
def classify(l):
    """-> (layer, type, group, region, tissue) for a 4.0 name."""
    if re.search(r'cavity of', l): return 'organ', 'heart-cavity', 'heart', 'thorax', None
    if re.search(r'wall of', l): return 'organ', 'heart', 'heart', 'thorax', None
    if re.search(r'cusp|leaflet', l): return 'organ', 'valve', 'heart', 'thorax', None
    if re.search(r'bronch', l): return 'organ', 'bronchus', 'airways', 'thorax', None
    if re.search(r'hepatic duct|cystic duct|biliary tree|duct of caudate', l): return 'organ', 'bile-duct', 'organ-abdomen', 'abdomen', None
    if l == 'tongue': return 'organ', 'tongue', 'mouth', 'skull', None
    if re.search(r'sublingual|submandibular', l): return 'organ', 'salivary', 'mouth', 'skull', None
    if re.search(r'genioglossus|hyoglossus', l): return 'muscle', 'tongue-muscle', 'mouth', 'skull', None
    if re.search(r'veli palatini|uvular|palatopharyngeus|salpingopharyngeus|stylopharyngeus|pharyngeal constrictor', l): return 'muscle', 'pharynx-muscle', 'pharynx', 'neck', None
    if re.search(r'pharyngeal raphe|pterygomandibular raphe', l): return 'muscle', 'connective', 'pharynx', 'neck', 'connective'
    if re.search(r'alar cartilage|nasal cartilage', l): return 'cartilage', 'nasal-cartilage', 'cartilage-skull', 'skull', None
    if l == 'epiglottis': return 'cartilage', 'epiglottis', 'larynx', 'neck', None
    if re.search(r'cricoid|arytenoid cartilage|corniculate|cuneiform', l): return 'cartilage', 'laryngeal-cartilage', 'larynx', 'neck', None
    if re.search(r'arytenoid|aryepiglott|vocalis|cricothyroid', l): return 'muscle', 'larynx-muscle', 'larynx', 'neck', None
    if re.search(r'conus elasticus|vocal ligament|thyrohyoid|cricothyroid ligament|epiglottic ligament|stylohyoid ligament', l): return 'muscle', 'connective', 'larynx', 'neck', 'connective'
    if re.search(r'nerve|ganglion', l): return 'nerve', 'ganglion' if 'ganglion' in l else 'cranial-nerve', 'orbit-nerves', 'skull', None
    if re.search(r'check ligament|\btrochlea\b|tendinous ring|tendon of|tarsal plate', l): return 'muscle', 'connective', 'orbit-muscles', 'skull', 'connective'
    if re.search(r'rectus|oblique|levator palpebrae', l): return 'muscle', 'eye-muscle', 'orbit-muscles', 'skull', None
    if 'tentorium' in l: return 'nerve', 'dura', 'nerve-skull', 'skull', None
    if 'gyrus' in l: return 'nerve', 'cortex', 'nerve-skull', 'skull', None
    if re.search(r'lacrimal|nasolacrimal', l): return 'organ', 'lacrimal', 'eye', 'skull', None
    t = next((k for k, pat in [('cornea', r'cornea'), ('lens', r'\blens'), ('iris', r'\biris'), ('sclera', r'sclera'), ('eye-choroid', r'\bchoroid'),
                               ('ciliary', r'corona ciliaris'), ('vitreous', r'vitreous|anterior chamber'), ('retina', r'retina')] if re.search(pat, l)), 'eye-part')
    return 'organ', t, 'eye', 'skull', None

GROUPS = {
 'eye': ('skull', 'Eyes and tear glands', 'The two eyes, from the cornea and lens to the retina, with the glands and ducts that make and drain tears.'),
 'orbit-muscles': ('skull', 'Muscles of the eye', 'The six muscles that turn each eye and the one that lifts the upper eyelid, with the ring, pulley and check ligaments they work through and the eyelid plates.'),
 'orbit-nerves': ('skull', 'Nerves of the orbit', 'The ophthalmic nerve and its branches, which carry feeling from the eye, forehead and nose, and the oculomotor and trochlear nerves, which move the eye.'),
 'mouth': ('skull', 'Tongue and salivary glands', 'The tongue with the muscles that move it, and the submandibular and sublingual salivary glands.'),
 'larynx': ('neck', 'Larynx', 'The voice box: its cartilages, the ligaments and membranes that join them, and the small muscles that open, close and tense the vocal cords.'),
 'pharynx': ('neck', 'Pharynx and soft palate', 'The constrictor muscles that squeeze food down the throat, the muscles that lift the pharynx, and the muscles of the soft palate and uvula.'),
 'heart': ('thorax', 'Heart', 'The walls and chambers of the heart, its four valves cusp by cusp, and the papillary muscles that hold the valves shut.'),
 'airways': ('thorax', 'Bronchial tree', 'The main bronchi and the airway tree of each bronchopulmonary segment of the lungs.'),
}
T = A['types']
def ty(k, lat, desc, color=None):
    T[k] = {'latin': lat, 'description': desc}
    if color: T[k]['color'] = color
ty('eye-part', None, 'A part of the eye.', '#f2f0ea')
ty('cornea', 'Cornea', 'The clear front window of the eye. It does most of the focusing; the lens behind it does the fine adjustment.', '#dfe9ee')
ty('lens', 'Lens', 'A clear, flexible disc behind the pupil. The ciliary muscle changes its shape to focus on near or far objects; it stiffens with age, which is why reading glasses become necessary.', '#e8eef0')
ty('iris', 'Iris', 'The coloured ring of muscle around the pupil, which it widens in dim light and narrows in bright light.', '#6b7f8c')
ty('sclera', 'Sclera', 'The tough white outer coat of the eyeball, to which the eye muscles attach.', '#f2f0ea')
ty('eye-choroid', 'Choroidea', 'A layer rich in blood vessels between the sclera and the retina that feeds the outer retina.', '#a15b4a')
ty('ciliary', 'Corpus ciliare', 'A ring of muscle and folds behind the iris. It focuses the lens through the suspensory ligament and makes the fluid that fills the front of the eye.', '#b48273')
ty('vitreous', 'Corpus vitreum', 'The clear gel and fluid that fill the eyeball: the aqueous humour in front of the lens and the vitreous body behind it.', '#e4ecef')
ty('retina', 'Retina', 'The light-sensitive lining of the back of the eye, which turns light into nerve signals carried by the optic nerve.', '#c9855f')
ty('lacrimal', 'Apparatus lacrimalis', 'The tear apparatus: the lacrimal gland above the outer corner of the eye makes tears, which drain from the inner corner through the canaliculi and lacrimal sac into the nasolacrimal duct and the nose.', '#d9b3a6')
ty('eye-muscle', 'Musculi bulbi', 'One of the small muscles that move the eye or lift the eyelid. Four recti and two obliques turn the eyeball; they are the fastest muscles in the body.')
ty('cranial-nerve', 'Nervus cranialis', 'A branch of the cranial nerves in the orbit. The ophthalmic nerve and its branches carry feeling from the eye, forehead and nose; the oculomotor and trochlear nerves drive the eye muscles.', '#e8d27a')
ty('ganglion', 'Ganglion ciliare', 'A small cluster of nerve cells behind the eye. Its fibres, through the short ciliary nerves, narrow the pupil and focus the lens.', '#e8d27a')
ty('dura', 'Dura mater', 'The tough outer membrane around the brain. The tentorium cerebelli is a fold of it that forms a tent over the cerebellum and holds up the back of the cerebrum.', '#d9c7bd')
ty('tongue', 'Lingua', 'A muscular organ for tasting, chewing, swallowing and speaking. Its surface carries the papillae with the taste buds.', '#c57a74')
ty('salivary', 'Glandula salivaria', 'A salivary gland. With the parotid glands, the submandibular and sublingual glands make the saliva that moistens food and begins digesting starch.', '#dcb3a0')
ty('tongue-muscle', 'Musculi linguae', 'An extrinsic muscle of the tongue. Genioglossus pushes the tongue forward and out; hyoglossus pulls it down.')
ty('pharynx-muscle', 'Musculi pharyngis', 'A muscle of the pharynx or soft palate. The constrictors squeeze swallowed food downwards; the palate muscles seal off the nose and open the auditory tube when swallowing.')
ty('larynx-muscle', 'Musculi laryngis', 'One of the small muscles of the larynx that move its cartilages to open, close and tense the vocal cords, for breathing, swallowing and speech.')
ty('laryngeal-cartilage', 'Cartilagines laryngis', 'A cartilage of the larynx. The ring-shaped cricoid sits below the thyroid cartilage, and the small arytenoids on top of it pivot to open and close the vocal cords.', '#b2cbd3')
ty('epiglottis', 'Epiglottis', 'A leaf of elastic cartilage behind the tongue that tips back over the entrance of the larynx when swallowing, so food goes down the oesophagus and not into the airway.', '#b2cbd3')
ty('heart-cavity', 'Cavitas cordis', 'The space inside a chamber of the heart, shown as the volume of blood it holds. Hidden by default so the valves stay visible; show it from the list.', '#8e2a33')
ty('bile-duct', 'Ductus biliferi', 'The bile ducts gather bile inside the liver and carry it to the gallbladder, where it is stored, and to the duodenum, where it helps digest fat.', '#6f8a4a')
ty('larynx-cartilage', 'Cartilago thyroidea', T['larynx-cartilage']['description'])
DESC = {
 'epiglottis': None,
 'vocal ligament': 'The core of each vocal cord: a band of elastic tissue from the thyroid cartilage to the arytenoid, which vibrates to make the voice.',
 'conus elasticus': 'A membrane of elastic tissue from the cricoid cartilage up to the vocal ligament, which is its free upper edge.',
 'posterior crico-arytenoid': 'The only muscle that opens the vocal cords. It rotates the arytenoid cartilage outwards, and is essential for breathing.',
 'oblique part of cricothyroid': 'Part of the cricothyroid, which tilts the thyroid cartilage forward on the cricoid, stretching the vocal cords to raise the pitch of the voice.',
 'straight part of cricothyroid': 'Tilts the thyroid cartilage forward on the cricoid, stretching the vocal cords to raise the pitch of the voice.',
 'thyrohyoid membrane': 'A broad membrane joining the thyroid cartilage to the hyoid bone, pierced by the nerve and vessels of the upper larynx.',
 'lens': None,
 'optic part of retina': None,
 'lacrimal gland': 'Makes tears. It sits in a hollow of the frontal bone above the outer corner of the eye.',
 'nasolacrimal duct': 'Drains tears from the lacrimal sac into the nose, which is why crying makes the nose run.',
 'ciliary ganglion': None,
 'trochlear nerve': 'The thinnest cranial nerve and the only one to leave the back of the brainstem. It drives the superior oblique muscle of the eye.',
 'oculomotor nerve': 'Drives four of the six eye muscles and the muscle that lifts the eyelid, and carries the fibres that narrow the pupil.',
 'ophthalmic nerve': 'The first division of the trigeminal nerve, carrying feeling from the eye, the forehead, the scalp and the nose.',
 'superior oblique': 'Runs forward through a cartilage pulley, the trochlea, and turns back to the eyeball, so it rotates the eye down and inwards.',
 'levator palpebrae superioris': 'Lifts the upper eyelid.',
 'wall of ventricle': 'The muscular wall of the two ventricles and the septum between them. The left ventricle’s wall is about three times thicker than the right’s, because it pumps blood round the whole body.',
 'cavity of left ventricle': 'Holds about 120 ml of blood at the end of filling and pushes out about 70 ml with each beat, into the aorta.',
 'cavity of right atrium': 'Receives blood from the whole body through the venae cavae and from the heart itself through the coronary sinus.',
 'main bronchus proper': 'The first branch of the trachea on the right. It is shorter, wider and steeper than the left, so inhaled objects more often lodge on the right.',
 'main bronchus': 'The first branch of the trachea. The right main bronchus is shorter, wider and steeper than the left, so inhaled objects more often lodge on the right.',
 'genioglossus': 'The main muscle of the tongue’s bulk, fanning from the inside of the chin. It pushes the tongue forward and out and keeps it from falling back in sleep.',
 'tentorium cerebelli': None,
}
def describe(l):
    """Exact names only, with or without the side: 'left vocal ligament' -> 'vocal ligament'."""
    k = re.sub(r'\s+', ' ', re.sub(r'\b(left|right)\b', '', l)).strip()
    return DESC.get(l) or DESC.get(k)
def nice(l):
    l = re.sub(r'^set of ', '', l)
    l = re.sub(r'^optic part of (left|right) retina$', r'\1 retina', l)
    l = {'wall of ventricle': 'wall of the ventricles', 'right main bronchus proper': 'right main bronchus'}.get(l, l)
    return cap(l)

# ---------- group segments by name and side, place, clean ----------
byname = collections.OrderedDict()
for p in picked:
    p['cx'] = (p['bounds'][0][0] + p['bounds'][1][0]) / 2
    byname.setdefault(p['name'].lower().strip(), []).append(p)
groups, positional = collections.OrderedDict(), set()
for lname, pieces in byname.items():
    side = side_of(lname); xs = [p['cx'] for p in pieces]
    if side or min(xs) > -0.02 or max(xs) < 0.02: groups[(lname, side)] = pieces
    else:
        positional.add(lname)
        for p in pieces: groups.setdefault((lname, 'left' if p['cx'] > 0 else 'right'), []).append(p)

adds = collections.defaultdict(list); meta = []; strays = 0; src_t = out_t = 0
for (lname, side), pieces in groups.items():
    meshes = []
    for q in pieces:
        P, F = weld(*read_part(chunks, q)); P, F, n = drop_strays(P, F); strays += n; meshes.append((P, F))
    P, F = merge(meshes); P = BM.place(P)
    layer, typ, gid, reg, tissue = classify(lname)
    src_t += len(F)
    P, F = decimate(P, F, len(F) * 0.6 if len(F) > 1500 else len(F), floor=200)
    out_t += len(F)
    pid = pieces[0]['id']
    name = nice(lname) + (f' ({side})' if lname in positional else '')
    e = {'id': pid, 'source': pieces[0]['name'], 'name': name, 'layer': layer, 'region': reg, 'group': gid, 'type': typ}
    fmas = sorted({q['conceptId'] for q in pieces})
    if len(fmas) == 1: e['fma'] = fmas[0]
    if tissue: e['tissue'] = tissue
    if side: e['side'] = side
    if len(pieces) > 1: e['segments'] = len(pieces)
    d = describe(lname)
    if d: e['description'] = d
    if typ == 'heart-cavity': e['defaultHidden'] = True
    meta.append(e); adds[layer].append((pid, P, F))
print(f'{len(picked)} source meshes -> {len(meta)} structures; {src_t} -> {out_t} triangles; {strays} stray triangles removed')

# ---------- existing parts: brain structures filed as muscle, heart parts into the heart group ----------
BRAIN = {'anterior commissure': 'white-matter', 'posterior commissure': 'white-matter', 'lamina terminalis': 'white-matter',
         'tuber cinereum': 'diencephalon', 'interventricular foramen': 'ventricle', 'interpeduncular fossa': 'brainstem',
         'lateral geniculate body': 'diencephalon', 'medial geniculate body': 'diencephalon'}
moved = 0
for p in A['parts']:
    k = re.sub(r'^(left|right) ', '', p['name'].lower())
    if p['layer'] == 'muscle' and k in BRAIN:
        p.update(layer='nerve', group='nerve-skull', type=BRAIN[k]); p.pop('tissue', None); moved += 1
    if p['layer'] == 'organ' and p.get('type') in ('heart', 'valve', 'papillary'): p['group'] = 'heart'
print('brain structures moved out of the muscle layer:', moved)
A['parts'] += meta

GR = collections.OrderedDict((g['id'], g) for g in A['groups'])
RN = {r['id']: r['name'] for r in A['regions']}
for gid, (reg, nm, desc) in GROUPS.items():
    GR[gid] = {'id': gid, 'region': reg, 'name': nm, 'short': RN[reg], 'description': desc}
used = {p['group'] for p in A['parts']}
A['groups'] = [g for g in GR.values() if g['id'] in used]
missing = {p['group'] for p in meta} - set(GR)
assert not missing, missing

LS = {L['id']: L for L in A['layers']}
LS['nerve'].update(name='Brain and nerves', description='The brain with its gyri, deep nuclei and fluid-filled ventricles, the tentorium, the optic nerves and the nerves of the orbit. The spinal cord and the peripheral nerves of the body are not part of this dataset.')
LS['organ']['description'] = 'The internal organs of the chest, abdomen and pelvis, the heart chamber by chamber and valve by valve, the bronchial tree, the eyes with their lens, iris and retina, the tear glands, the tongue and salivary glands, the ears, lips and gums.'
LS['cartilage']['description'] = 'Intervertebral discs, costal cartilages, the cartilages of the larynx with the epiglottis, and the cartilages of the nose.'
LS['muscle']['description'] = 'Skeletal muscles pull on bones through tendons to move joints and hold posture, down to the muscles that move the eyes, the tongue, the soft palate and the vocal cords. Tendons, ligaments and fasciae are shown in a paler colour.'

A['about'] = {
 'intro': 'A complete adult male body built from real anatomical surface models: skin, muscles, organs, the brain, the arteries and veins and every bone, down to the parts of the eye, the cartilages of the larynx and each cusp of the heart valves. Each structure is a separate object you can select, fade, hide, isolate and pull apart.',
 'gaps': ['Nerves: the brain, the optic nerves and the nerves of the orbit are modelled, but not the spinal cord or the peripheral nerves of the body.',
          'Vessels: the arteries and veins stop at the fingers and toes. In the head the arteries of the brain are modelled, but not its veins or the vessels of the face and scalp.',
          'Organs: the liver, the colon and the small intestine are single structures without their segments.',
          'Bones: the coccyx, the six ear ossicles and the third molars are missing from the dataset.',
          'The lymphatic system is not part of this model. Bones are outer surfaces only, without marrow.'],
 'sources': ['Geometry: BodyParts3D, © The Database Center for Life Science (DBCLS). The skin, muscles, organs, brain, cartilage and bones are release 3.0 (CC BY-SA 2.1 Japan). The arteries and veins, and the finer structures of the eyes, larynx, pharynx, tongue, heart, airways, bile ducts and orbital nerves, are release 4.0 (CC BY 4.0), by way of the Human-Atlas package by slorksmo, fitted onto the release 3.0 body. Mitsuhashi N. et al., BodyParts3D: 3D structure database for anatomical concepts, Nucleic Acids Research 37 (2009), doi:10.1093/nar/gkn613.',
             'Adapted: converted from millimetres Z-up to metres Y-up, vertices welded, simplified (bones with meshoptimizer at about 0.1% maximum error, soft tissue with quadric decimation to a per-layer budget), release 4.0 structures moved onto release 3.0 by a correction measured from the 591 structures both releases share, segments of each named structure merged into one, positions quantised to 16 bits.',
             'Rendering: three.js (MIT licence). Type: Atkinson Hyperlegible and Newsreader (SIL Open Font Licence).'],
}
G = repack(os.path.join(DATA, ''), G, adds)
G['source'] = 'BodyParts3D 3.0 (DBCLS), simplified; arteries, veins and finer structures from BodyParts3D 4.0'
json.dump(G, open(os.path.join(DATA, 'geometry.json'), 'w'))
json.dump(A, open(os.path.join(DATA, 'anatomy.json'), 'w'), indent=1, ensure_ascii=False)
assert {p['id'] for p in A['parts']} == {p['id'] for p in G['parts']}, 'anatomy and geometry disagree'
print(len(A['parts']), 'parts;', collections.Counter(p['layer'] for p in A['parts']))
print('added by group:', collections.Counter(p['group'] for p in meta))
print('files:', [(f['url'], round(f['bytes'] / 1e6, 2)) for f in G['files']], 'triangles', G['triangles'])
