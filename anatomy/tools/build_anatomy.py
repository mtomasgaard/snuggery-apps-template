"""Step 4: skeleton metadata -> data/anatomy.json (names, FDI tooth numbers, Latin terms, groups,
regions and descriptions for the 270 skeletal structures). build_full.py then adds everything else."""
import json, re, os
from paths import DATA, SOURCE
sel = json.load(open(os.path.join(SOURCE,'skeleton_ids.json')))
ORD = ['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth']
ROMAN = ['I','II','III','IV','V']
def cap(s): return s[0].upper()+s[1:]

regions = [
 ("skull","Skull","The 22 bones of the skull: eight cranial bones that enclose the brain and fourteen facial bones. Shown with the mandible, the permanent teeth and the hyoid."),
 ("spine","Vertebral column","Seven cervical, twelve thoracic and five lumbar vertebrae above the sacrum, separated by intervertebral discs. Its S-shaped curves absorb load and keep the head balanced over the pelvis."),
 ("thorax","Thoracic cage","Twelve pairs of ribs, their costal cartilages and the sternum. The cage protects the heart and lungs and moves with every breath."),
 ("girdle","Shoulder girdle","The clavicles and scapulae connect the arms to the trunk. Only the clavicle joins the axial skeleton, which gives the shoulder its wide range of motion."),
 ("arm-l","Left upper limb","Humerus, radius and ulna, eight carpal bones, five metacarpals and fourteen phalanges."),
 ("arm-r","Right upper limb","Humerus, radius and ulna, eight carpal bones, five metacarpals and fourteen phalanges."),
 ("pelvis","Pelvic girdle","The two hip bones. Together with the sacrum they form the bony pelvis, which carries the weight of the upper body to the legs."),
 ("leg-l","Left lower limb","Femur, patella, tibia and fibula, seven tarsal bones, five metatarsals, fourteen phalanges and the sesamoid bones of the big toe."),
 ("leg-r","Right lower limb","Femur, patella, tibia and fibula, seven tarsal bones, five metatarsals, fourteen phalanges and the sesamoid bones of the big toe."),
]
groups = {
 "cranium":("skull","Cranium","Frontal, parietal, occipital, temporal, sphenoid and ethmoid bones, joined by sutures around the brain."),
 "face":("skull","Facial skeleton","The bones that shape the face, the orbits, the nasal cavity and the upper jaw."),
 "mandible":("skull","Mandible","The lower jaw."),
 "teeth-upper":("skull","Upper teeth","Fourteen permanent teeth set in the maxillae. Numbered with the FDI system: 1x upper right, 2x upper left."),
 "teeth-lower":("skull","Lower teeth","Fourteen permanent teeth set in the mandible. Numbered with the FDI system: 3x lower left, 4x lower right."),
 "hyoid":("skull","Hyoid","A floating bone in the front of the neck, held in place only by muscles and ligaments."),
 "cervical":("spine","Cervical spine","C1 to C7, the vertebrae of the neck, with the discs between them."),
 "thoracic":("spine","Thoracic spine","T1 to T12, each articulating with a pair of ribs, with the discs between them."),
 "lumbar":("spine","Lumbar spine","L1 to L5, the largest vertebrae, with the discs between them."),
 "sacral":("spine","Sacrum","The fused sacral vertebrae."),
 "sternum":("thorax","Sternum","The breastbone: manubrium, body and xiphoid process."),
 "ribs-l":("thorax","Left ribs","Ribs 1 to 12 of the left side with their costal cartilages."),
 "ribs-r":("thorax","Right ribs","Ribs 1 to 12 of the right side with their costal cartilages."),
 "girdle-l":("girdle","Left shoulder","Left clavicle and scapula."),
 "girdle-r":("girdle","Right shoulder","Right clavicle and scapula."),
 "hip-l":("pelvis","Left hip bone","Ilium, ischium and pubis, fused into one bone."),
 "hip-r":("pelvis","Right hip bone","Ilium, ischium and pubis, fused into one bone."),
}
for s,S in (('l','Left'),('r','Right')):
    groups.update({
     f"arm-{s}":(f"arm-{s}","Arm","The humerus."),
     f"forearm-{s}":(f"arm-{s}","Forearm","Radius and ulna."),
     f"carpus-{s}":(f"arm-{s}","Carpus","Eight wrist bones in two rows. Proximal: scaphoid, lunate, triquetral, pisiform. Distal: trapezium, trapezoid, capitate, hamate."),
     f"metacarpus-{s}":(f"arm-{s}","Metacarpus","Five metacarpal bones, the skeleton of the palm."),
     f"fingers-{s}":(f"arm-{s}","Phalanges of the hand","Fourteen finger bones: three in each finger, two in the thumb."),
     f"thigh-{s}":(f"leg-{s}","Thigh and knee","Femur and patella."),
     f"leg-{s}":(f"leg-{s}","Leg","Tibia and fibula."),
     f"tarsus-{s}":(f"leg-{s}","Tarsus","Seven ankle and hindfoot bones: talus, calcaneus, navicular, cuboid and three cuneiforms."),
     f"metatarsus-{s}":(f"leg-{s}","Metatarsus","Five metatarsal bones in the middle of the foot."),
     f"toes-{s}":(f"leg-{s}","Phalanges of the foot","Fourteen toe bones and the two sesamoid bones under the big toe."),
    })

types = {
 "frontal":("Os frontale","Forms the forehead, the roofs of the orbits and the front of the cranial floor. The frontal sinuses sit behind the brow ridges."),
 "parietal":("Os parietale","Paired bones forming the sides and roof of the cranium. They meet each other at the sagittal suture and the frontal bone at the coronal suture."),
 "occipital":("Os occipitale","Forms the back and base of the cranium. The spinal cord passes through the foramen magnum, and the occipital condyles rest on the atlas."),
 "temporal":("Os temporale","Houses the organs of hearing and balance in its petrous part. Carries the ear canal, the mastoid process and the socket of the jaw joint."),
 "sphenoid":("Os sphenoidale","The butterfly-shaped keystone of the cranial base, in contact with every other cranial bone. The sella turcica on its upper surface cradles the pituitary gland."),
 "ethmoid":("Os ethmoidale","A light, spongy bone between the orbits that forms parts of the nasal cavity and septum. The olfactory nerves pass through its cribriform plate."),
 "nasal":("Os nasale","Small paired bones forming the bridge of the nose."),
 "lacrimal":("Os lacrimale","The smallest and most fragile facial bones, in the inner wall of each orbit. A groove in each holds the lacrimal sac of the tear drainage system."),
 "zygomatic":("Os zygomaticum","The cheekbone. Forms the prominence of the cheek and parts of the side wall and floor of the orbit."),
 "maxilla":("Maxilla","The paired upper jaw bones. They carry the upper teeth, form most of the hard palate and the floor of each orbit, and contain the maxillary sinuses."),
 "palatine":("Os palatinum","L-shaped bones forming the back of the hard palate and part of the side wall of the nasal cavity."),
 "concha":("Concha nasalis inferior","A scroll-shaped bone on the side wall of the nasal cavity. Its mucous lining warms and moistens inhaled air."),
 "vomer":("Vomer","A thin, ploughshare-shaped bone forming the lower back part of the nasal septum."),
 "mandible":("Mandibula","The lower jaw and the only freely movable bone of the skull. It carries the lower teeth and meets the temporal bones at the jaw joints."),
 "hyoid":("Os hyoideum","A U-shaped bone that articulates with no other bone. It anchors the tongue and the muscles used for swallowing and speech."),
 "incisor":("Dens incisivus","Chisel-shaped front teeth for cutting food."),
 "canine":("Dens caninus","The teeth with the longest roots, for gripping and tearing."),
 "premolar":("Dens premolaris","Teeth with two cusps, for crushing and grinding."),
 "molar":("Dens molaris","Broad teeth with several cusps, for grinding. This model has first and second molars; the third molars (wisdom teeth) are not included."),
 "atlas":("Atlas","The first cervical vertebra (C1), a ring of bone without a body that carries the skull. Nodding happens at its joints with the occipital bone."),
 "axis":("Axis","The second cervical vertebra (C2). Its tooth-like dens projects up into the ring of the atlas and forms the pivot for turning the head."),
 "cervical":("Vertebra cervicalis","Cervical vertebrae have small bodies, forked spinous processes and a hole in each transverse process for the vertebral artery."),
 "thoracic":("Vertebra thoracica","Thoracic vertebrae carry joint facets for the heads of the ribs, have heart-shaped bodies and long spinous processes that slope downwards."),
 "lumbar":("Vertebra lumbalis","The largest vertebrae, with massive kidney-shaped bodies that carry the weight of the upper body."),
 "sacrum":("Os sacrum","Five fused vertebrae forming a wedge between the hip bones. It passes the weight of the body to the pelvis through the sacroiliac joints. The coccyx below it is not part of this model."),
 "disc":("Discus intervertebralis","A fibrocartilage pad between two vertebral bodies: a tough outer ring (annulus fibrosus) around a gel-like core (nucleus pulposus). The discs absorb load and let the spine bend."),
 "manubrium":("Manubrium sterni","The top of the sternum. It joins the clavicles and the first ribs; the jugular notch is the dip along its upper edge."),
 "sternum-body":("Corpus sterni","The long middle part of the sternum, where the costal cartilages of ribs 2 to 7 attach. It meets the manubrium at the sternal angle."),
 "xiphoid":("Processus xiphoideus","The small lowest part of the sternum, cartilage in youth that gradually turns to bone in adulthood."),
 "rib-true":("Costa vera","True ribs (1 to 7) reach the sternum through their own costal cartilage."),
 "rib-false":("Costa spuria","False ribs (8 to 10) reach the sternum indirectly, through the cartilage of the rib above."),
 "rib-floating":("Costa fluctuans","Floating ribs (11 and 12) end freely in the muscles of the flank without reaching the sternum."),
 "costal-cartilage":("Cartilago costalis","Hyaline cartilage that joins a rib to the sternum and gives the chest wall the flexibility it needs for breathing."),
 "costal-margin":("Cartilagines costales","The cartilages of ribs 8 to 10 join each other and the seventh cartilage, forming the lower edge of the rib cage (the costal margin)."),
 "clavicle":("Clavicula","The collarbone, an S-shaped strut between the sternum and the scapula. It is the only bony connection between the arm and the trunk."),
 "scapula":("Scapula","The shoulder blade, a flat triangular bone on the back of the chest. Its shallow glenoid cavity is the socket of the shoulder joint."),
 "humerus":("Humerus","The bone of the upper arm. Its head fits the glenoid cavity of the scapula; its lower end forms the elbow with the radius and ulna."),
 "radius":("Radius","The forearm bone on the thumb side. It rolls around the ulna to turn the palm up and down (supination and pronation)."),
 "ulna":("Ulna","The forearm bone on the little-finger side. Its olecranon is the point of the elbow."),
 "scaphoid":("Os scaphoideum","A boat-shaped bone in the proximal row of the wrist on the thumb side. It is the most commonly fractured carpal bone."),
 "lunate":("Os lunatum","A crescent-shaped bone in the middle of the proximal carpal row."),
 "triquetral":("Os triquetrum","A pyramid-shaped bone in the proximal carpal row on the little-finger side."),
 "pisiform":("Os pisiforme","A pea-shaped sesamoid bone on the palm side of the triquetral, embedded in the tendon of the flexor carpi ulnaris."),
 "trapezium":("Os trapezium","Distal-row carpal bone at the base of the thumb. Its saddle joint with the first metacarpal lets the thumb reach across the palm."),
 "trapezoid":("Os trapezoideum","The smallest bone of the distal carpal row, wedged between the trapezium and the capitate."),
 "capitate":("Os capitatum","The largest carpal bone, at the centre of the wrist."),
 "hamate":("Os hamatum","A wedge-shaped distal-row bone on the little-finger side, recognised by its hook."),
 "metacarpal":("Os metacarpi","The five metacarpals form the palm, numbered I (thumb) to V (little finger). Their heads are the knuckles."),
 "phalanx-hand":("Phalanx","Finger bones. Each finger has a proximal, a middle and a distal phalanx; the thumb has no middle phalanx."),
 "hip":("Os coxae","Three bones, the ilium, ischium and pubis, that fuse at the acetabulum, the socket of the hip joint."),
 "femur":("Femur","The thigh bone, the longest and strongest bone in the body. Its head sits in the acetabulum; its lower end forms the knee with the tibia and patella."),
 "patella":("Patella","The kneecap, the largest sesamoid bone in the body. It sits in the tendon of the quadriceps and improves the muscle's leverage."),
 "tibia":("Tibia","The shinbone, the main weight-bearing bone of the leg. Its lower end forms the inner ankle bone (medial malleolus)."),
 "fibula":("Fibula","The slender outer bone of the leg. It carries little weight but anchors muscles and forms the outer ankle bone (lateral malleolus)."),
 "talus":("Talus","Passes the weight of the body from the tibia to the foot. No muscles attach to it."),
 "calcaneus":("Calcaneus","The heel bone, the largest tarsal bone. The Achilles tendon attaches to its back."),
 "navicular":("Os naviculare","A boat-shaped tarsal bone on the inner side of the foot, between the talus and the cuneiforms."),
 "cuboid":("Os cuboideum","A cube-shaped tarsal bone on the outer side of the foot, in front of the calcaneus."),
 "cuneiform":("Os cuneiforme","One of three wedge-shaped tarsal bones that build the transverse arch of the foot."),
 "metatarsal":("Os metatarsi","The five metatarsals form the middle of the foot, numbered I (big toe) to V (little toe)."),
 "phalanx-foot":("Phalanx","Toe bones. The big toe (hallux) has two phalanges; the other toes have three."),
 "sesamoid-foot":("Ossa sesamoidea","Two small bones in the tendons under the head of the first metatarsal. They protect the tendons and take load when the foot pushes off."),
}

CAR = {'scaphoid':'Os scaphoideum','lunate':'Os lunatum','triquetral':'Os triquetrum','pisiform':'Os pisiforme','trapezium':'Os trapezium','trapezoid':'Os trapezoideum','capitate':'Os capitatum','hamate':'Os hamatum'}
CUN = {'medial':'Os cuneiforme mediale','intermediate':'Os cuneiforme intermedium','lateral':'Os cuneiforme laterale'}
FINGER = {'thumb':'I','index finger':'II','middle finger':'III','ring finger':'IV','little finger':'V'}
TOE = {'big toe':'I','second toe':'II','third toe':'III','fourth toe':'IV','little toe':'V'}
FDI_POS = {'central incisor':1,'lateral incisor':2,'canine':3,'first premolar':4,'second premolar':5,'first molar':6,'second molar':7}

def vlabel(n):
    m = re.match(r"(\w+) (cervical|thoracic|lumbar) vertebra", n)
    if not m and n not in ("atlas","axis"): raise Exception("vlabel "+n)
    if n=='atlas': return 'C1'
    if n=='axis': return 'C2'
    k = ORD.index(m.group(1))+1
    return {'cervical':'C','thoracic':'T','lumbar':'L'}[m.group(2)]+str(k)
def nextv(l):
    seg, k = l[0], int(l[1:])
    lim = {'C':7,'T':12,'L':5}[seg]
    if k<lim: return seg+str(k+1)
    return {'C':'T1','T':'L1','L':'S1'}[seg]

parts=[]
for fid, n in sel.items():
    side = 'left' if ' left ' in f' {n} ' else ('right' if ' right ' in f' {n} ' else None)
    s = side[0] if side else None
    d = dict(id=fid, source=n)
    name = cap(n); latin=None; note=None; layer='bone'
    if n in ('frontal bone','occipital bone','sphenoid bone','ethmoid') or re.search(r'(parietal|temporal) bone',n):
        t = n.split()[-2] if n!='ethmoid' else 'ethmoid'
        if n=='ethmoid': name='Ethmoid bone'
        d.update(type=t, group='cranium')
    elif re.search(r'(nasal|lacrimal|zygomatic|palatine) bone|maxilla|inferior nasal concha|vomer', n):
        t = 'concha' if 'concha' in n else ('maxilla' if 'maxilla' in n else ('vomer' if n=='vomer' else n.split()[-2]))
        d.update(type=t, group='face')
    elif n=='mandible': d.update(type='mandible', group='mandible')
    elif n=='hyoid bone': d.update(type='hyoid', group='hyoid')
    elif 'tooth' in n:
        m = re.match(r'(left|right) (upper|lower) (.*?) ?(secondary )?(central incisor|lateral incisor|canine|first premolar|second premolar|first molar|second molar)', n.replace(' secondary',''))
        if not m:
            m = re.match(r'(left|right) (upper|lower) (secondary )?(.*) tooth', n)
        sd, jaw = n.split()[0], n.split()[1]
        pos = next(k for k in FDI_POS if k in n.replace(' secondary',''))
        q = {('right','upper'):1,('left','upper'):2,('left','lower'):3,('right','lower'):4}[(sd,jaw)]
        fdi = f"{q}{FDI_POS[pos]}"
        name = f"{cap(jaw)} {sd} {pos} (tooth {fdi})"
        t = 'molar' if 'molar' in pos and 'pre' not in pos else ('premolar' if 'premolar' in pos else ('canine' if pos=='canine' else 'incisor'))
        d.update(type=t, group=f'teeth-{jaw}', fdi=fdi); layer='tooth'
    elif not n.startswith('intervertebral') and (n in ('atlas','axis') or re.search(r'(cervical|thoracic|lumbar) vertebra$', n)):
        l = vlabel(n)
        t = n if n in ('atlas','axis') else n.split()[1]
        name = f"{cap(n)} ({l})" if n not in ('atlas','axis') else f"{cap(n)} ({l})"
        seg = {'C':'cervical','T':'thoracic','L':'lumbar'}[l[0]]
        d.update(type=t, group=seg, label=l)
        note = {'C7':'Called the vertebra prominens: its long spinous process is the bump you can feel at the base of the neck.',
                'T1':'Carries a full facet for the head of the first rib.',
                'T12':'A transitional vertebra: thoracic above, lumbar-like below.',
                'L5':'The largest vertebra. Its wedge shape creates the angle between the lumbar spine and the sacrum.'}.get(l)
    elif n=='sacrum': d.update(type='sacrum', group='sacral', label='S1–S5')
    elif n.startswith('intervertebral disk'):
        v = n.replace('intervertebral disk of ','')
        l = vlabel(v)
        name = f"Intervertebral disc {l}–{nextv(l)}"
        seg = {'C':'cervical','T':'thoracic','L':'lumbar'}[l[0]]
        d.update(type='disc', group=seg, label=f"{l}–{nextv(l)}"); layer='cartilage'
    elif n=='manubrium': name='Manubrium of sternum'; d.update(type='manubrium', group='sternum')
    elif n=='body of sternum': name='Body of sternum'; d.update(type='sternum-body', group='sternum')
    elif n=='xiphoid process': name='Xiphoid process'; d.update(type='xiphoid', group='sternum')
    elif re.search(r' rib$', n):
        k = ORD.index(n.split()[1])+1
        t = 'rib-true' if k<=7 else ('rib-false' if k<=10 else 'rib-floating')
        name = f"{cap(side)} {ORD[k-1]} rib"
        d.update(type=t, group=f'ribs-{s}', label=f"Rib {k}")
        note = {1:'The shortest, broadest and most curved rib. The subclavian artery and vein cross its upper surface.',
                2:'About twice as long as the first rib, with a rough area for the serratus anterior muscle.'}.get(k)
    elif 'costal cartilage' in n:
        if n in ('left costal cartilage','right costal cartilage'):
            name = f"{cap(side)} costal cartilages 8–10"; d.update(type='costal-margin', group=f'ribs-{s}')
        else:
            name = cap(n); d.update(type='costal-cartilage', group=f'ribs-{s}')
        layer='cartilage'
    elif n.endswith('clavicle'): d.update(type='clavicle', group=f'girdle-{s}')
    elif n.endswith('scapula'): d.update(type='scapula', group=f'girdle-{s}')
    elif n.endswith('humerus'): d.update(type='humerus', group=f'arm-{s}')
    elif n.endswith('radius'): d.update(type='radius', group=f'forearm-{s}')
    elif n.endswith('ulna'): d.update(type='ulna', group=f'forearm-{s}')
    elif n.split()[-1] in CAR:
        t=n.split()[-1]; d.update(type=t, group=f'carpus-{s}')
    elif 'metacarpal' in n:
        k = ORD.index(n.split()[1])
        name = f"{cap(side)} {ORD[k]} metacarpal ({ROMAN[k]})"; d.update(type='metacarpal', group=f'metacarpus-{s}')
    elif 'phalanx' in n and any(f in n for f in FINGER):
        f = next(f for f in FINGER if n.endswith(f))
        lv = n.split()[0]
        latin = f"Phalanx {'proximalis' if lv=='proximal' else 'media' if lv=='middle' else 'distalis'} digiti {FINGER[f]} manus"
        d.update(type='phalanx-hand', group=f'fingers-{s}')
    elif n.endswith('hip bone'): d.update(type='hip', group=f'hip-{s}')
    elif n.endswith('femur'): d.update(type='femur', group=f'thigh-{s}')
    elif n.endswith('patella'): d.update(type='patella', group=f'thigh-{s}')
    elif n.endswith('tibia'): d.update(type='tibia', group=f'leg-{s}')
    elif n.endswith('fibula'): d.update(type='fibula', group=f'leg-{s}')
    elif n.endswith('talus'): d.update(type='talus', group=f'tarsus-{s}')
    elif n.endswith('calcaneus'): d.update(type='calcaneus', group=f'tarsus-{s}')
    elif 'navicular' in n: name=f"{cap(side)} navicular"; d.update(type='navicular', group=f'tarsus-{s}')
    elif 'cuboid' in n: name=f"{cap(side)} cuboid"; d.update(type='cuboid', group=f'tarsus-{s}')
    elif 'cuneiform' in n:
        w = n.split()[1]; latin = CUN[w]; name=f"{cap(side)} {w} cuneiform"; d.update(type='cuneiform', group=f'tarsus-{s}')
    elif 'metatarsal' in n:
        k = ORD.index(n.split()[1]); name=f"{cap(side)} {ORD[k]} metatarsal ({ROMAN[k]})"; d.update(type='metatarsal', group=f'metatarsus-{s}')
    elif 'phalanx' in n and any(t in n for t in TOE):
        tt = next(t for t in TOE if n.endswith(t)); lv=n.split()[0]
        latin = f"Phalanx {'proximalis' if lv=='proximal' else 'media' if lv=='middle' else 'distalis'} digiti {TOE[tt]} pedis"
        d.update(type='phalanx-foot', group=f'toes-{s}')
    elif 'sesamoid' in n:
        name = f"Sesamoid bones of {side} big toe"; d.update(type='sesamoid-foot', group=f'toes-{s}')
    else:
        raise Exception('unclassified '+n)
    d['name']=name; d['layer']=layer
    if side: d['side']=side
    if latin: d['latin']=latin
    if note: d['note']=note
    d['region']=groups[d['group']][0]
    parts.append(d)

# order parts: by region order, then group order as defined, keep source order stable-ish, sort by a key
rorder={r[0]:i for i,r in enumerate(regions)}
gorder={g:i for i,g in enumerate(groups)}
def key(p):
    lab=p.get('label','')
    v=0
    if re.match(r'[CTL]\d',lab):
        v={'C':0,'T':10,'L':30}[lab[0]]+int(re.match(r'[CTL](\d+)',lab).group(1))+ (0.5 if p['type']=='disc' else 0)
    elif lab.startswith('Rib'): v=int(lab.split()[1])
    return (rorder[p['region']], gorder[p['group']], v, p['name'])
parts.sort(key=key)
from collections import Counter
print(Counter(p['layer'] for p in parts), len(parts))
print(Counter(p['group'] for p in parts))
BIAS={"skull":[0,0.1,0.03],"thorax":[0,0.02,0.1],"spine":[0,0,-0.05]}
out = {
 "_about":"Names, descriptions and colours used by the skeleton viewer. Edit freely; the app reloads this file when it regains focus. Geometry lives in geometry.bin and is matched by id.",
 "colors":{"bone":"#e6d9bf","cartilage":"#b2cbd3","tooth":"#f3efe3","selected":"#3552d6","selectedDark":"#8ea2ff"},
 "regions":[dict({"id":r,"name":n,"description":ds}, **({"explodeBias":BIAS[r]} if r in BIAS else {})) for r,n,ds in regions],
 "groups":[{"id":g,"region":v[0],"name":v[1],"description":v[2]} for g,v in groups.items()],
 "types":{k:{"latin":v[0],"description":v[1]} for k,v in types.items()},
 "parts":parts,
}
json.dump(out, open(os.path.join(DATA,'anatomy.json'),'w'), indent=1, ensure_ascii=False)
