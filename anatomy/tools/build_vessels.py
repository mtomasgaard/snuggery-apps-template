"""Step 6: replace the artery and vein layers with the full vascular tree of BodyParts3D 4.0.

BodyParts3D 3.0 (steps 1-5) has 55 vessels, all in the trunk and neck. Release 4.0 models about a thousand
arterial and venous segments in the same body and the same coordinate frame, down to the vessels of the hands,
feet and brain. This step reads them from the Human-Atlas package (fetch_atlas.py), aligns them to the 3.0
skeleton with an offset measured from bones present in both releases, merges the segments of each named
vessel into one structure, decimates, and rewrites data/geometry-artery.bin, data/geometry-vein.bin,
data/geometry.json and data/anatomy.json. Runs after build_full.py; re-runnable."""
import json, os, re, collections
import numpy as np
from paths import DATA
from atlaslib import load_atlas, read_part, weld, merge, decimate, write_layer, side_of, cap

A = json.load(open(os.path.join(DATA, 'anatomy.json')))
G = json.load(open(os.path.join(DATA, 'geometry.json')))
M, chunks = load_atlas('atlas.json')

# ---------- alignment: 4.0 -> 3.0 frame, measured from bones that did not change between releases ----------
ours = {p['id']: p for p in G['parts']}
byfma = collections.defaultdict(list)
for p in M['parts']: byfma[p['conceptId']].append(p)
deltas = []
for fid, op in ours.items():
    tp = byfma.get(fid)
    if not tp or len(tp) != 1: continue
    tp = tp[0]
    osz = np.array(op['max']) - np.array(op['min']); tsz = np.array(tp['bounds'][1]) - np.array(tp['bounds'][0])
    if np.abs(osz - tsz).max() > 0.0008: continue           # only meshes identical in extent
    deltas.append((np.array(op['min']) + np.array(op['max'])) / 2 - (np.array(tp['bounds'][0]) + np.array(tp['bounds'][1])) / 2)
D = np.array(deltas); OFF = np.median(D, 0)
agree = (np.abs(D - OFF).max(1) < 0.003).mean()      # the rest were remodelled between releases
print(f'{len(D)} same-extent structures give offset {np.round(OFF * 1000, 1)} mm ({agree:.0%} of them within 3 mm)')
assert len(D) > 50 and agree > 0.5, 'the two releases do not line up'

# ---------- regions (same rules as build_soft.py, plus names that position gets wrong) ----------
def region(c, size):
    x, y, z = c
    if size[1] > 0.9: return 'body'
    side = 'l' if x > 0 else 'r'
    if abs(x) > 0.175 and y > 0.6: return 'arm-' + side
    if abs(x) < 0.07 and 0.6 < y <= 0.72: return 'pelvis'
    if y > 1.46: return 'skull'
    if y > 1.36: return 'neck'
    if y > 1.06: return 'thorax'
    if y > 0.9: return 'abdomen'
    if y > 0.72 and abs(x) < 0.17: return 'pelvis'
    return 'leg-' + side
LIMB = [(r'femoral|saphenous|popliteal|genicular|tibial|fibular|plantar|dorsalis pedis|calcaneal|\bperforating', 'leg'),
        (r'axillary|\bbrachial|cephalic|basilic|cubital|radial|ulnar|interosseous|palmar|metacarpal|pollicis|indicis|carpal', 'arm')]
def region_for(name, c, size, side):
    l = name.lower()
    if 'brachiocephalic' not in l:
        for pat, limb in LIMB:
            if re.search(pat, l) and side in ('left', 'right'): return f"{limb}-{side[0]}"
    return region(c, size)

# ---------- names ----------
RENAME = {'arteria princeps pollicis': 'princeps pollicis artery', 'arteria radialis indicis': 'radialis indicis artery',
          'hepatic artery proper': 'proper hepatic artery', 'pre-hepatic portal vein': 'prehepatic portal vein'}
def nice(n, reg):
    l = n.lower().strip()
    for a, b in RENAME.items(): l = l.replace(a, b)
    l = re.sub(r'^set of ', '', l)
    if reg.startswith('leg') and 'metacarpal' in l: l = l.replace('metacarpal', 'metatarsal')   # a naming slip in the source
    l = re.sub(r'\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)$', lambda m: m.group(1).upper(), l)
    return cap(l)

# ---------- types and descriptions ----------
T = A['types']
def ty(k, lat, desc, color=None):
    T[k] = {'latin': lat, 'description': desc}
    if color: T[k]['color'] = color
ty('cerebral-artery', 'Arteriae encephali', 'One of the arteries that supply the brain. They arise from the internal carotid and vertebral arteries, which meet beneath the brain in the circle of Willis.')
ty('carotid', 'Arteria carotis', 'The carotid arteries supply the head and neck. Each common carotid divides into an internal branch for the brain and eye and an external branch for the face and scalp.')
ty('vertebral-artery', 'Arteria vertebralis', 'Runs up through the transverse foramina of the cervical vertebrae to supply the back of the brain. The two vertebral arteries join to form the basilar artery.')
ty('jugular', 'Vena jugularis', 'The jugular veins drain the head and neck into the subclavian veins.')
ty('portal-vein', 'Vena portae hepatis', 'The portal system carries nutrient-rich blood from the stomach, intestines, pancreas and spleen to the liver before it returns to the heart.')
ty('hepatic-vein', 'Venae hepaticae', 'The hepatic veins drain blood from the liver into the inferior vena cava.')
ty('limb-artery', None, 'An artery of the limb. Arteries carry blood away from the heart under high pressure; in the limbs they run deep, alongside the bones and between the muscles.')
ty('limb-vein', None, 'A vein of the limb. The deep veins accompany the arteries; the superficial veins run just under the skin and are the ones seen through it.')
T['pulmonary-artery']['description'] = 'The pulmonary arteries carry oxygen-poor blood from the right ventricle to the lungs, branching to each lobe and then to each bronchopulmonary segment.'
T['pulmonary-vein']['description'] = 'The pulmonary veins carry oxygen-rich blood from the lungs to the left atrium, gathering it from each bronchopulmonary segment.'
def typeof(n, layer, reg):
    l = n.lower()
    if layer == 'artery':
        if re.search(r'aorta', l): return 'aorta'
        if re.search(r'coronary|interventricular branch|interventricular artery|conus|septal branch|marginal branch of right|diagonal branch|ventricular branch|circumflex branch', l): return 'coronary'
        if re.search(r'pulmonary|lingular artery|lobar artery|segmental artery|apical segmental|basal segmental', l) and not re.search(r'hepatic|renal', l): return 'pulmonary-artery'
        if re.search(r'carotid', l): return 'carotid'
        if re.search(r'vertebral artery', l): return 'vertebral-artery'
        if reg == 'skull': return 'cerebral-artery'
        if reg.startswith(('arm', 'leg')): return 'limb-artery'
        return 'artery'
    if re.search(r'vena cava', l): return 'vena-cava'
    if re.search(r'pulmonary|lingular vein|segmental vein|apical segmental|basal segmental', l) and not re.search(r'hepatic|renal|portal', l): return 'pulmonary-vein'
    if re.search(r'cardiac vein|coronary sinus|interventricular vein|marginal vein|vein of left ventricle', l) and reg == 'thorax': return 'cardiac-vein'
    if re.search(r'portal', l): return 'portal-vein'
    if re.search(r'hepatic vein|hepatovenous', l): return 'hepatic-vein'
    if re.search(r'jugular', l): return 'jugular'
    if reg.startswith(('arm', 'leg')): return 'limb-vein'
    return 'vein'
DESC = {
 'femoral artery': 'The main artery of the thigh, continuing from the external iliac artery under the inguinal ligament. Its pulse can be felt in the groin.',
 'deep femoral vein': 'The deep vein of the thigh, draining the thigh muscles into the femoral vein.',
 'lateral circumflex femoral artery': 'Winds round the front of the femur to supply the thigh muscles and the hip joint.',
 'popliteal artery': 'The continuation of the femoral artery behind the knee, where it divides into the anterior and posterior tibial arteries.',
 'popliteal vein': 'Runs behind the knee with the popliteal artery and becomes the femoral vein in the thigh.',
 'anterior tibial artery': 'Runs down the front of the leg between the tibia and fibula and continues onto the foot as the dorsalis pedis artery.',
 'posterior tibial artery': 'Runs down the back of the leg and passes behind the medial malleolus, where its pulse can be felt, before dividing into the plantar arteries of the sole.',
 'dorsalis pedis artery': 'The artery on the top of the foot. Its pulse, felt between the first and second metatarsals, is checked to assess the circulation of the leg.',
 'great saphenous vein': 'The longest vein in the body. It runs up the inside of the leg and thigh from the foot to the groin, where it joins the femoral vein, and is often used as a graft in bypass surgery.',
 'small saphenous vein': 'Runs up the back of the calf from the outer side of the foot and drains into the popliteal vein behind the knee.',
 'femoral vein': 'The main deep vein of the thigh, accompanying the femoral artery. It becomes the external iliac vein above the inguinal ligament.',
 'plantar arch': 'An arterial arch deep in the sole, formed by the lateral plantar artery, from which the plantar metatarsal and digital arteries arise.',
 'axillary artery': 'The continuation of the subclavian artery through the armpit, becoming the brachial artery at the lower border of teres major.',
 'axillary vein': 'Formed by the basilic and brachial veins; it drains the arm through the armpit into the subclavian vein.',
 'brachial artery': 'The main artery of the upper arm. It runs along the inside of the biceps and divides at the elbow into the radial and ulnar arteries. Blood pressure is measured over it.',
 'deep brachial artery': 'Spirals round the back of the humerus with the radial nerve to supply the triceps.',
 'radial artery': 'Runs down the thumb side of the forearm. Its pulse is felt at the wrist, and it is often used for blood samples and catheters.',
 'ulnar artery': 'The larger of the two forearm arteries, running down the little-finger side to form the superficial palmar arch.',
 'superficial palmar arterial arch': 'An arterial arch across the palm, mainly from the ulnar artery, giving off the common palmar digital arteries to the fingers.',
 'deep palmar arch': 'An arterial arch deep in the palm, mainly from the radial artery, giving off the palmar metacarpal arteries.',
 'cephalic vein': 'A superficial vein running up the outer side of the arm from the thumb side of the wrist to the shoulder, where it dips in to join the axillary vein.',
 'basilic vein': 'A superficial vein running up the inner side of the forearm and arm, joining the brachial veins to form the axillary vein.',
 'median cubital vein': 'Joins the cephalic and basilic veins across the front of the elbow. It is the usual site for taking blood.',
 'median antebrachial vein': 'A superficial vein up the middle of the front of the forearm.',
 'internal carotid artery': 'Enters the skull through the carotid canal to supply the front of the brain and the eye.',
 'basilar artery': 'Formed by the two vertebral arteries at the base of the brainstem. It supplies the pons, cerebellum and inner ear before dividing into the posterior cerebral arteries.',
 'anterior cerebral artery': 'Supplies the inner surface of the frontal and parietal lobes, including the areas that move and feel the leg.',
 'posterior communicating artery': 'Links the internal carotid artery to the posterior cerebral artery, completing the circle of Willis on each side.',
 'anterior communicating artery': 'A short vessel joining the two anterior cerebral arteries, closing the front of the circle of Willis.',
 'ophthalmic artery': 'Leaves the internal carotid artery to supply the eye, the orbit and the forehead.',
 'anterior inferior cerebellar artery': 'Supplies the front and underside of the cerebellum and the inner ear.',
 'superior cerebellar artery': 'Supplies the upper surface of the cerebellum, arising from the basilar artery just before it divides.',
 'posterior inferior cerebellar artery': 'The largest branch of the vertebral artery, supplying the underside of the cerebellum and the side of the medulla.',
 'thyrocervical trunk': 'A short trunk from the subclavian artery that supplies the thyroid gland, the neck and the shoulder.',
 'costocervical trunk': 'A short trunk from the subclavian artery for the deep neck muscles and the first two intercostal spaces.',
 'abdominal aorta': 'The aorta below the diaphragm. It gives off the celiac, mesenteric and renal arteries and divides at the level of L4 into the common iliac arteries.',
 'hepatic portal vein': 'Formed behind the pancreas by the superior mesenteric and splenic veins, it carries blood from the gut to the liver.',
 'azygos vein': 'Runs up the right side of the thoracic vertebrae, draining the chest wall into the superior vena cava.',
 'hemiazygos vein': 'Runs up the left side of the lower thoracic vertebrae and crosses to join the azygos vein.',
 'internal thoracic artery': 'Runs down the inside of the front chest wall beside the sternum. It is the vessel most often used for coronary bypass grafts.',
 'obturator vein': 'Drains the inner thigh through the obturator foramen into the internal iliac vein.',
 'superior gluteal vein': 'Drains the buttock through the greater sciatic foramen into the internal iliac vein.',
 'inferior gluteal vein': 'Drains the lower buttock and the back of the thigh into the internal iliac vein.',
 'dorsal venous network of hand': 'The web of superficial veins on the back of the hand, from which the cephalic and basilic veins begin.',
 'dorsal venous arch of foot': 'The superficial arch of veins on the top of the foot, from which the great and small saphenous veins begin.',
}
def canon(l):
    l = re.sub(r'\b(left|right)\b\s*', '', l).replace('(left)', '').replace('(right)', '')
    return re.sub(r'\s+', ' ', l).strip()

# ---------- select, merge and measure ----------
vessels = [p for p in M['parts'] if p['system'] in ('arterial', 'venous')]
byname = collections.OrderedDict()
for p in vessels:
    p['cx'] = (p['bounds'][0][0] + p['bounds'][1][0]) / 2 + OFF[0]
    byname.setdefault((p['system'], p['name'].lower().strip()), []).append(p)
groups = collections.OrderedDict()    # (system, name, side) -> segments; side is 'left', 'right' or None
positional = set()
for (system, lname), pieces in byname.items():
    side = side_of(lname)
    xs = [p['cx'] for p in pieces]
    if side or min(xs) > -0.03 or max(xs) < 0.03:      # named, or all on one side of the midline
        groups[(system, lname, side)] = pieces
    else:                                              # a bilateral vessel the source did not name by side
        positional.add((system, lname))
        for p in pieces: groups.setdefault((system, lname, 'left' if p['cx'] > 0 else 'right'), []).append(p)
print(len(vessels), 'source segments ->', len(groups), 'vessels')

PH = {'skull': 'the head', 'neck': 'the neck', 'thorax': 'the chest', 'abdomen': 'the abdomen', 'pelvis': 'the pelvis', 'arm-l': 'the left upper limb', 'arm-r': 'the right upper limb', 'leg-l': 'the left lower limb', 'leg-r': 'the right lower limb', 'body': 'the whole body'}
RN = {r['id']: r['name'] for r in A['regions']}
LS = {L['id']: L for L in A['layers']}
out = {'artery': [], 'vein': []}
meta = []
src_tris = new_tris = 0
for (system, lname, side), pieces in groups.items():
    layer = 'artery' if system == 'arterial' else 'vein'
    P, F = merge([weld(*read_part(chunks, p)) for p in pieces])
    P = P + OFF
    b0, b1 = P.min(0), P.max(0)
    reg = region_for(lname, (b0 + b1) / 2, b1 - b0, side or ('left' if (b0[0] + b1[0]) > 0 else 'right'))
    src_tris += len(F)
    P, F = decimate(P, F, len(F) * 0.7 if len(F) > 300 else len(F), floor=200)
    new_tris += len(F)
    pid = pieces[0]['id']
    name = nice(lname, reg)
    if (system, lname) in positional: name += f' ({side})'
    gid = f'{layer}-{reg}'
    p = {'id': pid, 'source': pieces[0]['name'], 'name': name, 'layer': layer, 'region': reg, 'group': gid, 'type': typeof(lname, layer, reg)}
    fmas = sorted(set(x['conceptId'] for x in pieces))
    if len(fmas) == 1: p['fma'] = fmas[0]
    if side in ('left', 'right'): p['side'] = side
    d = DESC.get(canon(lname))
    if d: p['description'] = d
    if len(pieces) > 1: p['segments'] = len(pieces)
    meta.append(p)
    out[layer].append((pid, P, F))
print(f'triangles {src_tris} -> {new_tris}')

# ---------- write geometry ----------
files = G['files']
fidx = {f['layer']: i for i, f in enumerate(files) if f['layer'] in ('artery', 'vein')}
keep = [p for p in G['parts'] if p['f'] not in fidx.values()]
newparts = []
for layer in ('artery', 'vein'):
    i = fidx[layer]
    entry, entries = write_layer(os.path.join(DATA, f'geometry-{layer}.bin'), f'data/geometry-{layer}.bin', layer, out[layer], i)
    files[i] = entry; newparts += entries
    print(layer, len(entries), 'structures,', round(entry['bytes'] / 1e6, 2), 'MB')
G['parts'] = keep + newparts
G['triangles'] = sum(p['i'] // 3 for p in G['parts'])
G['source'] = 'BodyParts3D 3.0 (DBCLS), simplified; arteries and veins from BodyParts3D 4.0'
json.dump(G, open(os.path.join(DATA, 'geometry.json'), 'w'))

# ---------- write anatomy ----------
A['parts'] = [p for p in A['parts'] if p['layer'] not in ('artery', 'vein')] + meta
GR = collections.OrderedDict((g['id'], g) for g in A['groups'] if not g['id'].startswith(('artery-', 'vein-')))
for p in meta:
    gid = p['group']
    if gid not in GR:
        L = LS[p['layer']]
        GR[gid] = {'id': gid, 'region': p['region'], 'name': f"{L['short']} of {PH[p['region']]}", 'short': RN[p['region']], 'description': f"{L['name']} of {PH[p['region']]}."}
GR['artery-skull']['description'] = 'The internal carotid and vertebral arteries and the circle of Willis they form beneath the brain, with the cerebral and cerebellar arteries that branch from it.'
GR['vein-thorax']['description'] = 'The venae cavae and their tributaries, the veins of the heart, the pulmonary veins and their segmental branches, and the hepatic and portal veins that reach up under the diaphragm.'
A['groups'] = list(GR.values())
LS['artery']['description'] = 'Arteries carry blood away from the heart. The aorta and its branches to the trunk, the limbs and the head, down to the arteries of the fingers, toes and brain, with the coronary arteries and the pulmonary arteries to each segment of the lungs.'
LS['vein']['description'] = 'Veins return blood to the heart. The venae cavae and the deep and superficial veins of the limbs, the veins of the heart and lungs, and the portal system that carries blood from the gut to the liver.'
A['about'] = {
 'intro': 'A complete adult male body built from real anatomical surface models: skin, muscles, organs, the brain, the arteries and veins and every bone. Each structure is a separate object you can select, fade, hide, isolate and pull apart.',
 'gaps': ['Nerves: the brain and optic nerves are modelled, but not the spinal cord or the peripheral nerves.',
          'Vessels: the arteries and veins are those of BodyParts3D 4.0, which stop at the fingers and toes and, in the head, model the arteries of the brain but not the veins or the vessels of the face and scalp.',
          'Bones: the coccyx, the six ear ossicles and the third molars are missing from the dataset.',
          'The lymphatic system is not part of this model. Bones are outer surfaces only, without marrow.'],
 'sources': ['Geometry: BodyParts3D, © The Database Center for Life Science (DBCLS). Skin, muscles, organs, brain, cartilage and bones from release 3.0 (CC BY-SA 2.1 Japan); arteries and veins from release 4.0 (CC BY 4.0), by way of the Human-Atlas package by slorksmo. Mitsuhashi N. et al., BodyParts3D: 3D structure database for anatomical concepts, Nucleic Acids Research 37 (2009), doi:10.1093/nar/gkn613.',
             'Adapted: converted from millimetres Z-up to metres Y-up, vertices welded, simplified (bones with meshoptimizer at about 0.1% maximum error, soft tissue with quadric decimation to a per-layer budget), segments of each vessel merged into one structure, positions quantised to 16 bits.',
             'Rendering: three.js (MIT licence). Type: Atkinson Hyperlegible and Newsreader (SIL Open Font Licence).'],
}
json.dump(A, open(os.path.join(DATA, 'anatomy.json'), 'w'), indent=1, ensure_ascii=False)
print(len(A['parts']), 'parts;', collections.Counter(p['layer'] for p in A['parts']))
print('vessel groups:', {g['id']: sum(1 for p in meta if p['group'] == g['id']) for g in A['groups'] if g['id'].startswith(('artery-', 'vein-'))})
print('described:', sum(1 for p in meta if 'description' in p), '; types:', collections.Counter(p['type'] for p in meta))
