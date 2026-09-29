"""Step 7: the female body -> data/female/ (anatomy.json, geometry.json, geometry-<layer>.bin).

Source: the HuBMAP Human Reference Atlas, 3D Reference Organ Set for Female v1.10 (with the ischium and
pubis of v1.5), as packaged by Human-Atlas (fetch_atlas.py): a whole-body surface with the organs, brain,
eyes, spine, pelvis and knees of one woman, 76 hip and leg muscles of a second woman (Andreassen et al.
2023, the Visible Human Female), and 180 bones of the skull, chest, arms and feet borrowed from the
BodyParts3D male model and fitted to this body. The two borrowed sets are marked as such in the app.

Every source mesh is classified into this app's layers, regions and groups by system and name, enumerated
pieces (renal pyramid a-k, sigmoid artery a-c) are merged into one structure, and each layer is decimated
to a triangle budget. Runs after build_vessels.py; needs data/anatomy.json for the shared bone types."""
import json, os, re, collections
import numpy as np
from paths import DATA
from atlaslib import load_atlas, read_part, weld, merge, decimate, write_layer, side_of, cap

OUT = os.path.join(DATA, 'female'); os.makedirs(OUT, exist_ok=True)
MALE = json.load(open(os.path.join(DATA, 'anatomy.json')))
M, chunks = load_atlas('atlas-female.json')
skin = next(p for p in M['parts'] if p['name'] == 'Skin')
b0, b1 = np.array(skin['bounds'][0]), np.array(skin['bounds'][1])
OFF = np.array([-(b0[0] + b1[0]) / 2, -b0[1], -(b0[2] + b1[2]) / 2])   # feet on the floor, skin centred
HEIGHT = b1[1] - b0[1]
print(f'female body {HEIGHT:.3f} m tall; {len(M["parts"])} source meshes')

# ---------- naming ----------
ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth']
ROMAN = {'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10}
PLURAL = {'renal papilla': 'renal papillae', 'renal pyramid': 'renal pyramids', 'minor calyx': 'minor calyces', 'major calyx': 'major calyces',
          'sigmoid artery': 'sigmoid arteries', 'sigmoid vein': 'sigmoid veins', 'descending aorta': 'descending aorta', 'inferior vena cava': 'inferior vena cava',
          'left common carotid artery': 'left common carotid artery', 'left subclavian artery': 'left subclavian artery', 'brachiocephalic artery': 'brachiocephalic artery',
          'uncinate process': 'uncinate process', 'left superomedial segment': 'left superomedial segment'}
def strip_enum(n):
    """'Renal papilla a (left)' -> ('renal papilla', 'a', 'left'); enumerated pieces are merged."""
    l = n.lower().strip()
    side = side_of(l)
    l = re.sub(r'\s*\((left|right)\)', '', l)
    m = re.match(r'^(.*?)\s+([a-k])$', l)               # letter enumerators only: 'renal papilla a'
    base, e = (m.group(1), m.group(2)) if m else (l, None)
    base = re.sub(r'^(uncinate process|left superomedial segment) 1$', r'\1', base)
    return base, e, side

def display(base, side, pieces):
    n = PLURAL.get(base, base) if pieces > 1 else base
    n = re.sub(r'^set of ', '', n)
    n = n.replace('ginviva', 'gingiva').replace('epiglotic', 'epiglottic').replace('fallopian tube', 'uterine tube')
    n = n.replace(' extraocular muscle', '')
    for a, b in {'of hth': 'of the hypothalamus', 'drummond': 'Drummond', 'ruq area': 'right upper quadrant', 'luq area': 'left upper quadrant', 'umbilicus area': 'around the umbilicus',
                 'dura mater right': 'right dura mater', 'dura mater left': 'left dura mater', 'ethmoid': 'ethmoid bone', 'ethmoid bone bone': 'ethmoid bone'}.items(): n = n.replace(a, b)
    if n == 'fat': n = 'breast fat'
    n = {'sternum': 'body of sternum', 'manubrium': 'manubrium of sternum'}.get(n, n)
    m = re.match(r'^(cervical|thoracic|lumbar) vertebra (\d+)$', n)
    if m:
        k = int(m.group(2)); L = m.group(1)[0].upper()
        if L == 'C' and k == 1: return 'Atlas (C1)'
        if L == 'C' and k == 2: return 'Axis (C2)'
        return f'{cap(ORD[k - 1])} {m.group(1)} vertebra ({L}{k})'
    m = re.match(r'^c (\d) segment of cervical spinal cord$', n)
    if m: return f'Spinal cord segment C{m.group(1)}'
    m = re.match(r'^(\w+) (thoracic|lumbar|sacral) spinal cord segment$', n)
    if m: return f'Spinal cord segment {m.group(2)[0].upper()}{ORD.index(m.group(1)) + 1}'
    m = re.match(r'^(nucleus pulposus of )?intervertebral disk of (.*)$', n)
    if m:
        v = m.group(2)
        lab = 'C2' if v == 'axis' else next((f'{w[0].upper() if w != "lumbar" else "L"}{i + 1}' for i, o in enumerate(ORD) for w in ['cervical', 'thoracic', 'lumbar'] if v == f'{o} {w} vertebra'), v)
        return f'{"Nucleus pulposus of the " if m.group(1) else ""}intervertebral disc above {lab}' if False else (f'Nucleus pulposus, disc below {lab}' if m.group(1) else f'Intervertebral disc below {lab}')
    if n.startswith('gastrocnemius'): n = n.replace('gastrocnemius medial', 'medial head of gastrocnemius').replace('gastrocnemius lateral', 'lateral head of gastrocnemius')
    n = n.replace('biceps femoris long head', 'long head of biceps femoris').replace('biceps femoris short head', 'short head of biceps femoris').replace('biceps femoris long', 'long head of biceps femoris').replace('biceps femoris short', 'short head of biceps femoris')
    n = n.replace('peroneus', 'fibularis')
    if re.match(r'^hepatovenous', n): pass
    if side and 'left' not in n and 'right' not in n:
        n = f'{side} {n}'
    return cap(n)

# ---------- layers, regions, groups ----------
LAYERS = [
 {'id': 'skin', 'name': 'Skin and fat', 'short': 'Skin', 'color': '#d7a58b', 'fade': 0.16, 'description': 'The skin, with the subcutaneous fat of the abdomen and the fat of the breasts.'},
 {'id': 'muscle', 'name': 'Muscles and ligaments', 'short': 'Muscles', 'color': '#b0524a', 'connectiveColor': '#ddd3c3', 'fade': 0.14, 'description': 'The muscles of the hip and leg from a second woman (the Visible Human Female), the eye muscles, and the ligaments of the knee. This body has no other muscle modelled.'},
 {'id': 'organ', 'name': 'Organs', 'short': 'Organs', 'color': '#c98a78', 'fade': 0.18, 'description': 'The heart, lungs, liver, pancreas, intestines, kidneys and bladder, the uterus, ovaries and vagina, the breasts, the eyes, and the mouth. The stomach, oesophagus, thyroid and adrenal glands are not part of this dataset.'},
 {'id': 'artery', 'name': 'Arteries', 'short': 'Arteries', 'color': '#c4383b', 'fade': 0.2, 'description': 'The aorta and the arteries of the heart, lungs, abdomen and pelvis, with the uterine and ophthalmic arteries. The limbs, neck and brain have no vessels in this dataset.'},
 {'id': 'vein', 'name': 'Veins', 'short': 'Veins', 'color': '#3e62b6', 'fade': 0.2, 'description': 'The venae cavae, the veins of the heart and lungs, the portal system, and the veins of the pelvis and eyes. The limbs, neck and brain have no vessels in this dataset.'},
 {'id': 'nerve', 'name': 'Brain and spinal cord', 'short': 'Brain', 'color': '#e3bdb3', 'fade': 0.18, 'description': 'The brain divided into 283 regions after the Allen Human Brain Atlas, the spinal cord segment by segment, the optic nerves and the dura. Peripheral nerves are not modelled.'},
 {'id': 'cartilage', 'name': 'Cartilage', 'short': 'Cartilage', 'color': '#b2cbd3', 'fade': 0.2, 'description': 'Intervertebral discs, the cartilages and menisci of the knee, the cartilages of the larynx and airways, and the costal cartilages borrowed with the ribs.'},
 {'id': 'bone', 'name': 'Bone', 'short': 'Bone', 'color': '#e6d9bf', 'fade': 0.2, 'description': 'This body\'s own spine, sternum, pelvis and leg bones, shown with the skull, ribs, arms and feet borrowed from the male model, in a greyer tone, because the source models none of its own.'},
 {'id': 'tooth', 'name': 'Teeth', 'short': 'Teeth', 'color': '#f3efe3', 'fade': 0.2, 'description': 'The upper and lower teeth, each jaw as one piece.'},
]
LS = {L['id']: L for L in LAYERS}
REGIONS = [
 ('skull', 'Head', 'The borrowed skull, the brain, the eyes and the mouth.'),
 ('neck', 'Neck', 'The larynx, the trachea and the cervical spinal cord.'),
 ('spine', 'Vertebral column', 'Seven cervical, twelve thoracic and six lumbar vertebrae above the sacrum and coccyx, with the discs between them and the spinal cord inside.'),
 ('thorax', 'Chest', 'The heart and lungs, the great vessels, the breasts, and the borrowed ribs and sternum.'),
 ('girdle', 'Shoulder girdle', 'The borrowed clavicles and scapulae.'),
 ('abdomen', 'Abdomen', 'The liver, pancreas, spleen, intestines and kidneys with their vessels.'),
 ('arm-l', 'Left upper limb', 'Borrowed bone only: humerus, radius and ulna and the 27 bones of the hand. No open female source models the arm\'s muscles or vessels.'),
 ('arm-r', 'Right upper limb', 'Borrowed bone only: humerus, radius and ulna and the 27 bones of the hand. No open female source models the arm\'s muscles or vessels.'),
 ('pelvis', 'Pelvis', 'The hip bones, sacrum and coccyx, the bladder, the uterus, ovaries and vagina, and the muscles of the hip.'),
 ('leg-l', 'Left lower limb', 'Femur, patella, tibia and fibula with the knee joint, the borrowed foot, and the muscles of the thigh and calf from the Visible Human Female.'),
 ('leg-r', 'Right lower limb', 'Femur, patella, tibia and fibula with the knee joint, the borrowed foot, and the muscles of the thigh and calf from the Visible Human Female.'),
 ('body', 'Whole body', 'Structures that cover the whole body, such as the skin.'),
]
RN = {r[0]: r[1] for r in REGIONS}
PH = {'skull': 'the head', 'neck': 'the neck', 'thorax': 'the chest', 'abdomen': 'the abdomen', 'pelvis': 'the pelvis', 'arm-l': 'the left upper limb', 'arm-r': 'the right upper limb', 'leg-l': 'the left lower limb', 'leg-r': 'the right lower limb', 'body': 'the whole body', 'spine': 'the back', 'girdle': 'the shoulders'}
GROUPS = collections.OrderedDict()
def grp(gid, region, name, desc, short=None):
    if gid not in GROUPS:
        GROUPS[gid] = {'id': gid, 'region': region, 'name': name, 'description': desc}
        if short: GROUPS[gid]['short'] = short
    return gid
MALE_GROUPS = {g['id']: g for g in MALE['groups']}
def mgrp(gid):
    g = MALE_GROUPS[gid]; return grp(gid, g['region'], g['name'], g['description'], g.get('short'))

def region_at(c, size):
    x, y, z = c
    if size[1] > 0.9 * HEIGHT / 1.65: return 'body'
    side = 'l' if x > 0 else 'r'
    if abs(x) > 0.175 and y > 0.6: return 'arm-' + side
    if abs(x) < 0.07 and 0.6 < y <= 0.72: return 'pelvis'
    if y > 1.46: return 'skull'
    if y > 1.36: return 'neck'
    if y > 1.06: return 'thorax'
    if y > 0.9: return 'abdomen'
    if y > 0.72 and abs(x) < 0.17: return 'pelvis'
    return 'leg-' + side

# ---------- types ----------
T = dict(MALE['types'])
def ty(k, lat, desc, color=None):
    T[k] = {'latin': lat, 'description': desc}
    if color: T[k]['color'] = color
ty('fat', 'Tela subcutanea', 'Subcutaneous fat, the layer under the skin that stores energy, insulates and cushions.', '#e9cfa3')
ty('breast-fat', 'Corpus adiposum mammae', 'The fat of the breast, which surrounds the glandular tissue and gives the breast most of its size and shape.', '#e9cfa3')
ty('mammary', 'Glandula mammaria', 'The milk-producing lobes of the breast. Each drains through a lactiferous duct, which widens into a sinus behind the areola before opening at the nipple.', '#d9a08e')
ty('nipple', 'Papilla mammaria', 'The nipple, where the lactiferous ducts open, and the pigmented areola around it with its small areolar glands.', '#b9776d')
ty('suspensory', 'Ligamenta suspensoria mammaria', 'Cooper\'s ligaments: bands of connective tissue that run from the chest wall to the skin and support the breast.', '#ddd3c3')
ty('eye-part', None, 'A part of the eye.', '#f2f0ea')
ty('retina', 'Retina', 'The light-sensitive lining of the back of the eye. The macula at its centre gives sharp vision, and the fovea in the macula the sharpest of all.', '#c9855f')
ty('cornea', 'Cornea', 'The clear front window of the eye. It does most of the focusing; the lens behind it does the fine adjustment.', '#dfe9ee')
ty('lens', 'Lens', 'A clear, flexible disc behind the pupil. The ciliary muscle changes its shape to focus on near or far objects.', '#e8eef0')
ty('iris', 'Iris', 'The coloured ring of muscle around the pupil, which it widens in dim light and narrows in bright light.', '#6b7f8c')
ty('sclera', 'Sclera', 'The tough white outer coat of the eyeball, to which the eye muscles attach.', '#f2f0ea')
ty('choroid', 'Choroidea', 'A layer rich in blood vessels between the sclera and the retina that feeds the outer retina.', '#a15b4a')
ty('ciliary', 'Corpus ciliare', 'A ring of muscle and folds behind the iris. It focuses the lens and makes the fluid that fills the front of the eye.', '#b48273')
ty('vitreous', 'Corpus vitreum', 'The clear gel that fills the eyeball behind the lens and holds the retina in place.', '#e4ecef')
ty('conjunctiva', 'Tunica conjunctiva', 'The thin membrane lining the eyelids and the front of the eyeball.', '#e8c9c3')
ty('eye-muscle', 'Musculi externi bulbi oculi', 'One of the six small muscles that turn the eye: four recti and two obliques.')
ty('dura', 'Dura mater', 'The tough outer membrane around the brain and spinal cord.', '#d9c7bd')
ty('spinal-cord', 'Medulla spinalis', 'A segment of the spinal cord. Each gives off one pair of spinal nerves; the cord itself ends at about the first lumbar vertebra.', '#e6d0c6')
ty('nucleus', 'Nucleus', 'A cluster of nerve cell bodies deep in the brain.', '#d9a9a0')
ty('amygdala', 'Corpus amygdaloideum', 'An almond-shaped group of nuclei in the temporal lobe, central to fear, emotion and emotional memory.', '#d19c95')
ty('hippocampus', 'Hippocampus', 'A curved structure in the temporal lobe that forms new memories and helps with navigation.', '#d19c95')
ty('hypothalamus', 'Hypothalamus', 'A small region below the thalamus that controls hunger, thirst, temperature, sleep and the pituitary gland.', '#d9a9a0')
ty('thalamus', 'Thalamus', 'The relay station of the brain. Almost every sensory signal passes through one of its nuclei on the way to the cortex.', '#d9a9a0')
ty('disc-nucleus', 'Nucleus pulposus', 'The soft, gel-like centre of an intervertebral disc, which spreads load across the vertebra below.', '#9fb9c4')
ty('knee-ligament', 'Ligamenta genus', 'A ligament of the knee. The cruciate ligaments cross inside the joint and stop the tibia sliding forwards or backwards; the collateral ligaments on either side stop it bending sideways.', '#ddd3c3')
ty('enthesis', 'Enthesis', 'The point where a ligament or tendon attaches to bone.', '#e6dccb')
ty('meniscus', 'Meniscus', 'A crescent of fibrocartilage between the femur and tibia that deepens the joint and spreads the load.', '#b2cbd3')
ty('articular-cartilage', 'Cartilago articularis', 'The smooth cartilage covering the ends of the bones in a joint, letting them glide with almost no friction.', '#c4dbe3')
ty('tongue', 'Lingua', 'A muscular organ for tasting, chewing, swallowing and speaking. Its papillae carry the taste buds.', '#c57a74')
ty('salivary', 'Glandula salivaria', 'A salivary gland. The parotid, submandibular and sublingual glands make the saliva that moistens food and begins digesting starch.', '#dcb3a0')
ty('tonsil', 'Tonsilla palatina', 'A mass of lymphoid tissue on either side of the throat that traps microbes entering through the mouth.', '#d98c8c')
ty('palate', 'Palatum', 'The roof of the mouth: the bony hard palate in front and the muscular soft palate behind, which closes off the nose when swallowing.', '#d98c8c')
ty('mouth-lining', 'Tunica mucosa oris', 'The moist lining of the mouth.', '#d98c8c')
ty('liver-segment', 'Segmentum hepatis', 'A segment of the liver. The eight Couinaud segments each have their own blood supply and bile drainage, which is why surgeons can remove one without harming the rest.', '#7c3a2e')
ty('liver-surface', 'Facies hepatis', 'A surface of the liver, named for the organ that presses against it.', '#7c3a2e')
ty('liver-ligament', 'Ligamentum hepatis', 'A fold of peritoneum that holds the liver in place.', '#ddd3c3')
ty('bile-duct', 'Ductus biliaris', 'The bile ducts carry bile from the liver and gallbladder to the duodenum.', '#6f8a4a')
ty('omentum', 'Omentum majus', 'The greater omentum, an apron of fat-laden peritoneum that hangs from the stomach over the intestines and helps wall off infection.', '#e9cfa3')
ty('caecum', 'Caecum', 'The pouch at the start of the large intestine, where the small intestine enters through the ileocaecal valve.', '#c99479')
ty('kidney-part', None, 'A part of the kidney. Urine forms in the outer cortex, drains through the pyramids to their papillae, and collects in the calyces and renal pelvis before entering the ureter.', '#8c3c33')
ty('calyx', 'Calix renalis', 'A cup that receives urine from a renal papilla. The minor calyces join into major calyces and then the renal pelvis.', '#d6b2a0')
ty('renal-pelvis', 'Pelvis renalis', 'The funnel that collects urine from the calyces and narrows into the ureter.', '#d6b2a0')
ty('lung-segment', 'Segmentum bronchopulmonale', 'A bronchopulmonary segment: a wedge of lung with its own bronchus and artery. There are ten in the right lung and eight or nine in the left.', '#e0a5a1')
ty('hilum', 'Hilum pulmonis', 'The root of the lung, where the bronchus and the pulmonary vessels enter.', '#d49a86')
ty('airway-cartilage', 'Cartilagines tracheales', 'The C-shaped rings of cartilage that hold the trachea and bronchi open.')
ty('lymph-node', 'Nodus lymphoideus', 'A reference model of a lymph node. Lymph enters through afferent vessels, is filtered past immune cells in the follicles, paracortex and medulla, and leaves through the efferent vessel at the hilum.', '#dcb3a0')
ty('uterus', 'Uterus', 'The womb: a thick-walled muscular organ in which a fertilised egg implants and a pregnancy develops. Its body narrows into the cervix, which opens into the vagina.', '#c47a6e')
ty('cervix', 'Cervix uteri', 'The neck of the uterus, which projects into the top of the vagina. Its canal opens at the internal and external os.', '#c47a6e')
ty('ovary', 'Ovarium', 'Produces eggs and the hormones oestrogen and progesterone. One egg is usually released each month.', '#d8b8a6')
ty('uterine-tube', 'Tuba uterina', 'The fallopian tube carries the egg from the ovary to the uterus. Its fringed infundibulum catches the egg; fertilisation usually happens in the ampulla.', '#d8a08e')
ty('vagina', 'Vagina', 'A muscular canal from the cervix to the outside of the body.', '#c98a78')
ty('uterine-ligament', 'Ligamenta uteri', 'A ligament or fold of peritoneum that supports the uterus, ovaries and tubes in the pelvis.', '#ddd3c3')
ty('pregnancy', None, 'A structure of pregnancy, shown for reference: the placenta, through which the fetus exchanges oxygen and nutrients with the mother, and the umbilical cord that connects it. Hidden by default.', '#b8656a')
ty('bladder-part', 'Vesica urinaria', 'A part of the urinary bladder. Urine enters through the two ureteral orifices and leaves through the neck; the smooth triangle between them is the trigone.', '#d6b2a0')
ty('borrowed-bone', None, 'A bone borrowed from the BodyParts3D male model, scaled and placed to fit this body. The female source models no bone here.', '#dcd3c4')
ty('donor-muscle', None, 'A muscle of the hip or leg from the Visible Human Female (Andreassen et al. 2023), a second woman, fitted to the hip, femur, tibia and fibula this body models.', '#a95e58')
ty('coccyx', 'Os coccygis', 'The tailbone: three to five small fused vertebrae at the bottom of the spine.')
ty('pubis', 'Os pubis', 'The front part of the hip bone. The two pubic bones meet at the pubic symphysis.')
ty('ilium', 'Os ilium', 'The broad upper part of the hip bone, whose crest can be felt at the waist.')
ty('ischium', 'Os ischii', 'The lower back part of the hip bone, which carries the weight when sitting.')
ty('knee-landmark', None, 'A landmark surface on the lower end of the femur used to describe the knee joint.')
MALE_BY_NAME = {p['name'].lower(): p for p in MALE['parts'] if p['layer'] in ('bone', 'cartilage')}

# ---------- classify every source mesh ----------
BONE = r'frontal|parietal|temporal|occipital|sphenoid|ethmoid|vomer|maxilla|palatine|nasal bone|zygomatic|mandible|hyoid|rib\b|sternum|manubrium|clavicle|scapula|humerus|radius|ulna|scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate|metacarpal|phalanx|femur|patella|tibia|fibula|talus|calcaneus|navicular|cuboid|cuneiform|metatarsal|sesamoid|vertebra|sacrum|coccyx|ilium|ischium|pubis'
def classify(p):
    """-> dict(layer, region, group, type, tissue, note, color, defaultHidden) for one source mesh."""
    n = p['name']; l = n.lower(); sysm = p['system']; side = side_of(l)
    c = (np.array(p['bounds'][0]) + np.array(p['bounds'][1])) / 2 + OFF; size = np.array(p['bounds'][1]) - np.array(p['bounds'][0])
    s = side[0] if side else ('l' if c[0] > 0 else 'r')
    reg = region_at(c, size)
    d = {}
    if sysm == 'borrowed' or sysm == 'skeletal':
        if 'alar cartilage' in l: return dict(layer='cartilage', region='skull', group=grp('cartilage-skull', 'skull', 'Cartilages of the head', 'The cartilages of the nose.'), type='nasal-cartilage', **BORROW)
        d = dict(layer='bone')
        if re.search(r'vertebra', l): d.update(region='spine', group=mgrp({'c': 'cervical', 't': 'thoracic', 'l': 'lumbar'}[l[0]]))
        elif re.search(r'sacrum|coccyx', l): d.update(region='spine', group=mgrp('sacral'))
        elif re.search(r'ilium|ischium|pubis', l): d.update(region='pelvis', group=mgrp(f'hip-{s}'))
        elif re.search(r'femur|patella|condyle|trochlear|intercondylar', l): d.update(region=f'leg-{s}', group=mgrp(f'thigh-{s}'))
        elif re.search(r'tibia|fibula', l): d.update(region=f'leg-{s}', group=mgrp(f'leg-{s}'))
        elif re.search(r'talus|calcaneus|navicular|cuboid|cuneiform|sesamoid', l): d.update(region=f'leg-{s}', group=mgrp(f'tarsus-{s}'))
        elif 'metatarsal' in l: d.update(region=f'leg-{s}', group=mgrp(f'metatarsus-{s}'))
        elif 'toe' in l: d.update(region=f'leg-{s}', group=mgrp(f'toes-{s}'))
        elif re.search(r'sternum|manubrium', l): d.update(region='thorax', group=mgrp('sternum'))
        elif 'costal cartilage' in l: d.update(layer='cartilage', region='thorax', group=mgrp(f'ribs-{s}'))
        elif 'rib' in l: d.update(region='thorax', group=mgrp(f'ribs-{s}'))
        elif re.search(r'clavicle|scapula', l): d.update(region='girdle', group=mgrp(f'girdle-{s}'))
        elif 'humerus' in l: d.update(region=f'arm-{s}', group=mgrp(f'arm-{s}'))
        elif re.search(r'radius|ulna', l): d.update(region=f'arm-{s}', group=mgrp(f'forearm-{s}'))
        elif re.search(r'scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate', l): d.update(region=f'arm-{s}', group=mgrp(f'carpus-{s}'))
        elif 'metacarpal' in l: d.update(region=f'arm-{s}', group=mgrp(f'metacarpus-{s}'))
        elif re.search(r'finger|thumb', l): d.update(region=f'arm-{s}', group=mgrp(f'fingers-{s}'))
        elif re.search(r'frontal|parietal|temporal|occipital|sphenoid|ethmoid', l): d.update(region='skull', group=mgrp('cranium'))
        elif 'mandible' in l: d.update(region='skull', group=mgrp('mandible'))
        elif 'hyoid' in l: d.update(region='skull', group=mgrp('hyoid'))
        else: d.update(region='skull', group=mgrp('face'))
        if sysm == 'borrowed': d.update(BORROW)
        if re.search(r'condyle|trochlear|intercondylar', l): d['type'] = 'knee-landmark'
        elif 'coccyx' in l: d['type'] = 'coccyx'
        elif 'ilium' in l: d['type'] = 'ilium'
        elif 'ischium' in l: d['type'] = 'ischium'
        elif 'pubis' in l: d['type'] = 'pubis'
        elif 'lumbar vertebra' in l: d['type'] = 'lumbar'
        return d
    if sysm == 'connective':
        if re.search(r'nucleus pulposus|intervertebral disk', l):
            sec = 'cervical' if 'cervical' in l or 'axis' in l else ('thoracic' if 'thoracic' in l else 'lumbar')
            return dict(layer='cartilage', region='spine', group=mgrp(sec), type='disc-nucleus' if 'nucleus' in l else 'disc')
        g = grp(f'knee-{s}', f'leg-{s}', 'Knee joint', 'The ligaments, menisci and articular cartilage of the knee.')
        if re.search(r'meniscus', l): return dict(layer='cartilage', region=f'leg-{s}', group=g, type='meniscus')
        if re.search(r'cartilage|perichondular', l): return dict(layer='cartilage', region=f'leg-{s}', group=g, type='articular-cartilage')
        if 'enthesis' in l: return dict(layer='muscle', region=f'leg-{s}', group=g, type='enthesis', tissue='connective')
        return dict(layer='muscle', region=f'leg-{s}', group=g, type='knee-ligament', tissue='connective')
    if sysm == 'muscular':
        if 'extraocular' in l: return dict(layer='muscle', region='skull', group=grp('muscle-eye', 'skull', 'Muscles of the eye', 'The six extraocular muscles that turn each eye.'), type='eye-muscle')
        g = grp(f'muscle-leg-{s}', f'leg-{s}', 'Muscles of the thigh and leg', 'The muscles of the thigh and calf.', RN[f'leg-{s}'])
        return dict(layer='muscle', region=f'leg-{s}', group=g, type='connective' if 'tendon' in l else 'muscle', **({'tissue': 'connective'} if 'tendon' in l else {}))
    if sysm == 'donor-muscle':
        hip = re.search(r'gluteus|iliacus|psoas|piriformis|gemellus|obturator|quadratus femoris|tensor fasciae|pectineus', l)
        if hip: g = grp(f'muscle-hip-{s}', 'pelvis', 'Muscles of the hip', 'The gluteal muscles, the deep rotators of the hip and the hip flexors.', RN['pelvis'])
        else: g = grp(f'muscle-leg-{s}', f'leg-{s}', 'Muscles of the thigh and leg', 'The muscles of the thigh and calf.', RN[f'leg-{s}'])
        return dict(layer='muscle', region='pelvis' if hip else f'leg-{s}', group=g, type='donor-muscle', **DONOR)
    if sysm in ('arterial', 'venous'):
        lay = 'artery' if sysm == 'arterial' else 'vein'
        if re.search(r'uterine|rectal|pudendal|sacral|iliac', l): reg = 'pelvis'
        elif re.search(r'ophthalmic|retinal|ciliary', l): reg = 'skull'
        elif re.search(r'coronary|cardiac|pulmonary|aort|carotid|subclavian|brachiocephalic|vena cava|marginal vein|posterior vein|oblique vein', l): reg = 'thorax'
        elif re.search(r'renal|colic|mesenteric|hepatic|splenic|celiac|cystic|sigmoid|portal|pancreatic|ileocolic|drummond', l): reg = 'abdomen'
        g = grp(f'{lay}-{reg}', reg, f"{LS[lay]['short']} of {PH[reg]}", f"{LS[lay]['name']} of {PH[reg]}.", RN[reg])
        t = 'artery' if lay == 'artery' else 'vein'
        if 'aort' in l: t = 'aorta'
        elif re.search(r'coronary|anterior descending|circumflex|marginal|diagonal|posterior descending|posterior left ventricular', l) and lay == 'artery': t = 'coronary'
        elif 'pulmonary' in l: t = 'pulmonary-artery' if lay == 'artery' else 'pulmonary-vein'
        elif 'vena cava' in l: t = 'vena-cava'
        elif 'portal' in l: t = 'portal-vein'
        elif 'hepatic vein' in l: t = 'hepatic-vein'
        elif re.search(r'cardiac vein|coronary sinus|marginal vein|posterior vein of left ventricle|oblique vein', l): t = 'cardiac-vein'
        elif 'carotid' in l: t = 'carotid'
        return dict(layer=lay, region=reg, group=g, type=t)
    if sysm == 'brain':
        reg = 'skull'
        if re.search(r'cerebell|vermis|flocc|dentate|fastigial|interpos|emboliform|globose', l): g, t = ('brain-cerebellum', 'Cerebellum', 'The cerebellum and its deep nuclei.'), 'cerebellum'
        elif re.search(r'ventricle|aqueduct|choroid', l): g, t = ('brain-ventricles', 'Ventricles', 'The fluid-filled spaces inside the brain.'), 'ventricle'
        elif re.search(r'pons|medulla|midbrain|tegment|tectum|colliculus|substantia nigra|red nucleus|raphe|reticular|olive|pyramid|locus|periaqueductal|cerebral peduncle|crus cerebri|nucleus of solitary|trigeminal|facial nucleus|hypoglossal|vagus|abducens|oculomotor|trochlear|cochlear|vestibular|gracile|cuneate|inferior olive|pontine', l): g, t = ('brain-stem', 'Brainstem', 'The midbrain, pons and medulla.'), 'brainstem'
        elif re.search(r'thalam|geniculate|pulvinar|reuniens|parafascicular|centromedian|habenul|pineal|zona incerta|subthalam|ventral posterior', l): g, t = ('brain-thalamus', 'Thalamus and epithalamus', 'The thalamic nuclei that relay signals to the cortex, with the habenula and pineal body.'), 'thalamus'
        elif re.search(r'hth\b|hypothalam|mammillary|preoptic|supraoptic|tuberal|infundib', l): g, t = ('brain-hypothalamus', 'Hypothalamus', 'The nuclei that control hunger, thirst, temperature, sleep and the pituitary.'), 'hypothalamus'
        elif re.search(r'amygdal|hippocamp|dentate gyrus|subiculum|entorhinal|cingulate|parahippocampal|fornix|septal|bed nucleus|basal forebrain|nucleus accumbens|olfactory|piriform|stria terminalis|mammillothalamic|nuclear group|lateral nucleus|basolateral|basomedial|cortical nucleus|medial nucleus', l): g, t = ('brain-limbic', 'Limbic system', 'The amygdala, hippocampus and their connections, involved in memory and emotion.'), 'limbic'
        elif re.search(r'caudate|putamen|pallid|claustrum|striatum|lentiform', l): g, t = ('brain-basal', 'Basal ganglia', 'Deep grey matter involved in starting and controlling movement.'), 'basal'
        elif re.search(r'white matter|commissure|callosum|capsule|corona radiata|optic tract|optic chiasm|optic radiation|tract\b|fasciculus|lemniscus|peduncle|forceps', l): g, t = ('brain-white', 'White matter and tracts', 'The bundles of nerve fibres that connect the parts of the brain.'), 'white-matter'
        else: g, t = ('brain-cortex', 'Cerebral cortex', 'The folded outer layer of the cerebral hemispheres, area by area.'), 'cortex'
        return dict(layer='nerve', region=reg, group=grp(g[0], reg, g[1], g[2], 'Brain'), type=t)
    if sysm == 'nervous':
        if 'spinal cord' in l:
            return dict(layer='nerve', region='spine', group=grp('spinal-cord', 'spine', 'Spinal cord', 'The spinal cord, segment by segment from C1 to S4.', RN['spine']), type='spinal-cord')
        g = grp('nerve-eye', 'skull', 'Optic nerves and dura', 'The optic nerves and the dura mater.')
        return dict(layer='nerve', region='skull', group=g, type='dura' if 'dura' in l else 'optic')
    if sysm == 'sensory':
        g = grp('organ-eye', 'skull', 'Eyes', 'The two eyeballs and their parts.')
        t = next((k for k, pat in [('retina', r'retina|fovea|macula|optic disc|ora serrata'), ('cornea', r'cornea|corneo'), ('lens', r'\blens|suspensory'), ('iris', r'iris|pupil'), ('sclera', r'sclera'), ('choroid', r'choroid'), ('ciliary', r'ciliary'), ('vitreous', r'vitreous|aqueous'), ('conjunctiva', r'conjunctiva')] if re.search(pat, l)), 'eye-part')
        return dict(layer='organ', region='skull', group=g, type=t)
    if sysm == 'integumentary':
        if l == 'skin': return dict(layer='skin', region='body', group=grp('skin-body', 'body', 'Skin', 'The skin.'), type='skin')
        if 'subcutaneous' in l: return dict(layer='skin', region='abdomen', group=grp('fat-abdomen', 'abdomen', 'Subcutaneous fat', 'Reference patches of the fat under the skin of the abdomen.', RN['abdomen']), type='fat')
        g = grp('breast', 'thorax', 'Breasts', 'The breasts: fat, the milk-producing lobes and their ducts, the nipple and areola, and the suspensory ligaments.', RN['thorax'])
        t = 'breast-fat' if l.startswith('fat') else ('nipple' if re.search(r'nipple|areola', l) else ('suspensory' if 'suspensory' in l else 'mammary'))
        return dict(layer='organ', region='thorax', group=g, type=t)
    if sysm == 'pregnancy':
        return dict(layer='organ', region='pelvis', group=grp('pregnancy', 'pelvis', 'Pregnancy (reference)', 'The placenta, umbilical cord and membranes of a pregnancy, shown for reference and hidden by default.', RN['pelvis']), type='pregnancy', defaultHidden=True)
    if sysm == 'reproductive':
        g = grp('reproductive', 'pelvis', 'Reproductive organs', 'The uterus, the uterine tubes, the ovaries and the vagina, with the ligaments that hold them.', RN['pelvis'])
        t = next((k for k, pat in [('ovary', r'\bovary'), ('uterine-tube', r'uterine tube|fallopian|fimbria|ampulla|isthmus|infundibulum|ostium'), ('cervix', r'cervix|cervical os'), ('vagina', r'vagina'), ('uterine-ligament', r'ligament|mesosalpinx|mesovarium|pouch')] if re.search(pat, l)), 'uterus')
        return dict(layer='organ', region='pelvis', group=g, type=t)
    if sysm == 'cardiac':
        t = 'valve' if 'valve' in l else ('papillary' if 'papillary' in l else 'heart')
        return dict(layer='organ', region='thorax', group=grp('heart', 'thorax', 'Heart', 'The four chambers of the heart, the septum between the ventricles, the papillary muscles and the four valves.', RN['thorax']), type=t)
    if sysm == 'respiratory':
        if re.search(r'cartilage|arytenoid|epiglot|cricoid|thyroid|corniculate', l):
            g = grp('cartilage-neck', 'neck', 'Cartilages of the larynx and airways', 'The cartilages of the larynx, the rings of the trachea and the cartilages of the bronchi.', RN['neck'])
            return dict(layer='cartilage', region='neck' if not re.search(r'bronch', l) else 'thorax', group=g, type='larynx-cartilage' if re.search(r'arytenoid|epiglot|cricoid|thyroid|corniculate', l) else 'airway-cartilage')
        if re.search(r'segment', l): return dict(layer='organ', region='thorax', group=grp('lungs', 'thorax', 'Lungs', 'The two lungs, segment by segment.', RN['thorax']), type='lung-segment')
        if 'hilum' in l: return dict(layer='organ', region='thorax', group=grp('lungs', 'thorax', 'Lungs', 'The two lungs, segment by segment.', RN['thorax']), type='hilum')
        return dict(layer='organ', region='neck' if 'trachea' in l else 'thorax', group=grp('airways', 'thorax', 'Trachea and bronchi', 'The windpipe and the bronchial tree down to the segmental bronchi.', RN['thorax']), type='trachea' if 'trachea' in l else 'bronchus')
    if sysm == 'urinary':
        if re.search(r'bladder|trigone|ureteral orifice', l): return dict(layer='organ', region='pelvis', group=grp('bladder', 'pelvis', 'Bladder', 'The urinary bladder.', RN['pelvis']), type='bladder-part')
        g = grp('kidneys', 'abdomen', 'Kidneys and ureters', 'The two kidneys, from the outer cortex through the pyramids and calyces to the renal pelvis, and the ureters.', RN['abdomen'])
        t = 'ureter' if 'ureter' in l else ('renal-pelvis' if 'renal pelvis' in l else ('calyx' if 'calyx' in l else 'kidney-part'))
        return dict(layer='organ', region='abdomen', group=g, type=t)
    if sysm == 'lymphatic':
        if 'spleen' in l: return dict(layer='organ', region='abdomen', group=grp('spleen', 'abdomen', 'Spleen', 'The spleen, by its surfaces.', RN['abdomen']), type='spleen')
        if 'thymus' in l: return dict(layer='organ', region='thorax', group=grp('thymus', 'thorax', 'Thymus', 'The two lobes of the thymus.', RN['thorax']), type='thymus')
        return dict(layer='organ', region=reg, group=grp('lymph-node', reg, 'Lymph node (reference)', 'A reference model of one lymph node and its parts.', RN[reg]), type='lymph-node')
    if sysm == 'digestive':
        if re.search(r'teeth', l): return dict(layer='tooth', region='skull', group=mgrp('teeth-upper' if 'upper' in l else 'teeth-lower'), type='molar' if False else None)
        if re.search(r'gland|tongue|papilla|palate|gingiva|ginviva|frenulum|mouth|buccal|tonsil', l):
            g = grp('mouth', 'skull', 'Mouth, tongue and salivary glands', 'The tongue, palate, gums, lining of the mouth, the palatine tonsils and the three pairs of salivary glands.', RN['skull'])
            t = next((k for k, pat in [('salivary', r'gland'), ('tongue', r'tongue|papilla'), ('tonsil', r'tonsil'), ('palate', r'palate'), ('gingiva', r'gingiva|ginviva'), ('lips', r'frenulum')] if re.search(pat, l)), 'mouth-lining')
            return dict(layer='organ', region='skull', group=g, type=t)
        if re.search(r'liver|hepat|segment|lobe|porta|ligamentum|falciform|round ligament|coronary ligament|triangular', l) and not re.search(r'pancrea|duct', l):
            g = grp('liver', 'abdomen', 'Liver', 'The liver by its segments, surfaces and ligaments.', RN['abdomen'])
            t = 'liver-ligament' if 'ligament' in l else ('liver-surface' if re.search(r'impression|surface|bare area|porta|capsule', l) else 'liver-segment')
            return dict(layer='organ', region='abdomen', group=g, type=t)
        if re.search(r'gallbladder|duct|ampulla|sphincter', l):
            return dict(layer='organ', region='abdomen', group=grp('biliary', 'abdomen', 'Gallbladder and ducts', 'The gallbladder, the bile ducts and the pancreatic ducts.', RN['abdomen']), type='gallbladder' if 'gallbladder' in l else ('pancreatic-duct' if 'pancrea' in l else 'bile-duct'))
        if re.search(r'pancrea|uncinate', l): return dict(layer='organ', region='abdomen', group=grp('pancreas', 'abdomen', 'Pancreas', 'The pancreas: head, uncinate process, neck, body and tail.', RN['abdomen']), type='pancreas')
        if 'omentum' in l or 'epiploic' in l: return dict(layer='organ', region='abdomen', group=grp('intestines', 'abdomen', 'Intestines', 'The small and large intestine and the greater omentum that hangs over them.', RN['abdomen']), type='omentum')
        g = grp('intestines', 'abdomen', 'Intestines', 'The small and large intestine and the greater omentum that hangs over them.', RN['abdomen'])
        t = next((k for k, pat in [('duodenum', r'duoden'), ('small-intestine', r'jejun|ileum|ileal'), ('caecum', r'caecum|cecum|ileocecal'), ('appendix', r'appendix'), ('rectum', r'rectum'), ('colon', r'colon|flexure')] if re.search(pat, l)), 'colon')
        return dict(layer='organ', region='abdomen', group=g, type=t)
    raise ValueError(f'unclassified: {sysm} {n}')
BORROW = dict(color='#dcd3c4', note='Borrowed from the BodyParts3D male model and fitted to this body: the female source models no skull, ribs, shoulder, arm or foot bones.')
DONOR = dict(note='From a second woman, the Visible Human Female (Andreassen et al. 2023), fitted to the hip and leg bones of this body.')

# ---------- merge enumerated pieces, then build ----------
merged = collections.OrderedDict()     # (system, base, side) -> [pieces]
for p in M['parts']:
    base, e, side = strip_enum(p['name'])
    if p['system'] == 'lymphatic' and 'spleen' in base: base, side = 'spleen', None
    if p['system'] == 'lymphatic' and 'lymph node' in base: base, side = 'lymph node (reference model)', None
    if p['system'] == 'donor-muscle' and base.startswith('rectus femoris'): continue     # this body has its own
    merged.setdefault((p['system'], base, side), []).append(p)
BUDGET = {'skin': 150000, 'muscle': 240000, 'organ': 430000, 'artery': 50000, 'vein': 45000, 'nerve': 250000, 'cartilage': 80000, 'bone': 260000, 'tooth': 12000}
info = []
for (sysm, base, side), pieces in merged.items():
    d = classify(pieces[0]) if len(pieces) == 1 else classify(dict(pieces[0], name=display(base, side, 1)))
    P, F = merge([weld(*read_part(chunks, q)) for q in pieces]); P = P + OFF
    name = display(base, side, len(pieces))
    pm = MALE_BY_NAME.get(name.lower())
    entry = {'id': pieces[0]['id'], 'source': pieces[0]['name'] if len(pieces) == 1 else f'{len(pieces)} pieces: {base}', 'name': name, 'layer': d['layer'], 'region': d['region'], 'group': d['group']}
    if pm:                                   # the same structure in the male model: share its type, Latin and text
        for k in ('type', 'latin', 'label', 'note', 'description', 'fdi'):
            if k in pm: entry[k] = pm[k]
        if 'type' in d and d['type'] in ('knee-landmark', 'coccyx', 'ilium', 'ischium', 'pubis'): entry['type'] = d['type']
    if not entry.get('type') and d.get('type'): entry['type'] = d['type']
    for k in ('tissue', 'color', 'note', 'defaultHidden'):
        if k in d: entry[k] = d[k]
    if sysm == 'borrowed': entry['type'] = entry.get('type') or 'borrowed-bone'
    if sysm == 'borrowed' and entry.get('note') and entry['note'] != BORROW['note']: entry['note'] = BORROW['note']
    if side: entry['side'] = side
    elif side_of(name): entry['side'] = side_of(name)
    if len(pieces) > 1: entry['segments'] = len(pieces)
    entry['region'] = GROUPS[entry['group']]['region']
    if entry['layer'] == 'tooth': entry['type'] = 'teeth-set'
    info.append((entry, P, F))
ty('teeth-set', 'Dentes', 'The teeth of one jaw, modelled as a single piece.')
src = collections.Counter(); 
for e, P, F in info: src[e['layer']] += len(F)
ratio = {L: min(1.0, BUDGET[L] / src[L]) for L in src}
print('source tris', dict(src)); print('keep ratio', {k: round(v, 2) for k, v in ratio.items()})
files, gparts, aparts = [], [], []
for i, L in enumerate(['skin', 'muscle', 'nerve', 'artery', 'vein', 'organ', 'cartilage', 'bone', 'tooth']):
    items = []
    for e, P, F in info:
        if e['layer'] != L: continue
        P2, F2 = decimate(P, F, len(F) * ratio[L], floor=160)
        items.append((e['id'], P2, F2)); aparts.append(e)
    entry, entries = write_layer(os.path.join(OUT, f'geometry-{L}.bin'), f'data/female/geometry-{L}.bin', L, items, i)
    files.append(entry); gparts += entries
tri = sum(p['i'] // 3 for p in gparts)
json.dump({'format': 'uint16-quantized positions per part bbox; uint16/uint32 indices; metres, Y-up, +Z anterior, +X = body left',
           'source': 'Human Reference Atlas female v1.10 (HuBMAP) with Visible Human Female leg muscles (Andreassen et al. 2023) and BodyParts3D 4.0 bones, via Human-Atlas; simplified',
           'triangles': tri, 'files': files, 'parts': gparts}, open(os.path.join(OUT, 'geometry.json'), 'w'))
print('triangles', tri, 'bytes', sum(f['bytes'] for f in files))

# group order: by region order, then first appearance
rorder = {r[0]: i for i, r in enumerate(REGIONS)}
groups = sorted(GROUPS.values(), key=lambda g: (rorder[g['region']], list(GROUPS).index(g['id'])))
A = {
 '_about': MALE['_about'],
 'body': {'id': 'female', 'name': 'Female'},
 'colors': MALE['colors'],
 'about': {
  'intro': 'An adult female body from the Human Reference Atlas: the skin, the organs of the chest, abdomen and pelvis including the uterus, ovaries and breasts, the brain in 283 regions, the spinal cord, the eyes, and the spine, pelvis and knees. Where the source models nothing, the gaps are filled and labelled: the skull, ribs, arms and feet are bones borrowed from the male model, and the hip and leg muscles come from a second woman.',
  'gaps': ['Muscle: only the hip and leg muscles (from the Visible Human Female), the eye muscles and the quadriceps tendon. The trunk, arms, neck and face have none.',
           'Bone: the skull, ribs, shoulders, arms, hands and feet are the male model\'s bones, scaled and fitted to this body and shown in a greyer tone. Only the spine, sternum, pelvis and leg bones are this body\'s own.',
           'Vessels: the aorta, the vessels of the heart, lungs, abdomen, pelvis and eyes. The limbs, neck and brain have none.',
           'Nerves: the brain, the spinal cord and the optic nerves, but no peripheral nerves.',
           'Organs: no stomach, oesophagus, thyroid or adrenal glands, no ears, no lymphatic system beyond the spleen, thymus and one reference lymph node. Eight structures of pregnancy are included for reference and hidden by default.',
           'Bones are outer surfaces only. The two reference bodies come from separate projects and are not directly comparable in coverage or detail.'],
  'sources': ['Female body: Kristen Browne and Heidi Schlehlein, Human Reference Atlas / HuBMAP, 3D Reference Organ Set for Female v1.10 (2026), with the ischium and pubis of v1.5. CC BY 4.0. Built on the Visible Human Project of the U.S. National Library of Medicine.',
              'Hip and leg muscles: Andreassen T.E. et al., Three Dimensional Lower Extremity Musculoskeletal Geometry of the Visible Human Female and Male, Scientific Data 10, 34 (2023), doi:10.1038/s41597-022-01905-2. CC BY 4.0.',
              'Borrowed bones: BodyParts3D 4.0, © The Database Center for Life Science (DBCLS), CC BY 4.0. Mitsuhashi N. et al., Nucleic Acids Research 37 (2009), doi:10.1093/nar/gkn613.',
              'All three were assembled, fitted and simplified in the Human-Atlas package by slorksmo (github.com/slorksmo/Human-Atlas, MIT code, CC BY 4.0 data), then adapted here: enumerated pieces merged into one structure, quadric decimation to a per-layer budget, positions quantised to 16 bits.',
              'Rendering: three.js (MIT licence). Type: Atkinson Hyperlegible and Newsreader (SIL Open Font Licence).'],
 },
 'layers': LAYERS,
 'regions': [{'id': i, 'name': n, 'description': d, **({'explodeBias': [0, 0.1, 0.03]} if i == 'skull' else {'explodeBias': [0, 0, -0.05]} if i == 'spine' else {'explodeBias': [0, 0.02, 0.1]} if i == 'thorax' else {})} for i, n, d in REGIONS],
 'groups': groups,
 'types': T,
 'parts': aparts,
}
json.dump(A, open(os.path.join(OUT, 'anatomy.json'), 'w'), indent=1, ensure_ascii=False)
print(len(aparts), 'parts;', collections.Counter(p['layer'] for p in aparts))
print('groups', len(groups), collections.Counter(p['group'] for p in aparts).most_common(12))
print('untyped', [p['name'] for p in aparts if not p.get('type')][:20])
print('files', [(f['url'], round(f['bytes'] / 1e6, 2)) for f in files])
