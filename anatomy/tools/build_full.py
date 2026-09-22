"""Step 5: full-body metadata and manifest. Adds soft tissue to data/anatomy.json (layers, regions,
groups, types with Latin names, descriptions and colours) and merges all geometry into data/geometry.json."""
import json, re, os
from paths import DATA, WORK
A=json.load(open(os.path.join(DATA,'anatomy.json')))
soft=json.load(open(os.path.join(WORK,'soft_parts.json')))
# ---------- regions ----------
R={r['id']:r for r in A['regions']}
R['skull'].update(name='Head', description='The 22 bones of the skull with the mandible, teeth and hyoid, the brain, the eyes and ears, and the muscles of the face, jaw and scalp.')
R['thorax'].update(name='Chest', description='The ribs, costal cartilages and sternum, the heart and lungs, the great vessels, and the muscles of the chest wall and upper back.')
R['pelvis'].update(name='Pelvis', description='The two hip bones, the bladder and reproductive organs, and the muscles of the hip, buttock and pelvic floor. With the sacrum the hip bones form the bony pelvis.')
for s,S in (('l','Left'),('r','Right')):
    R[f'arm-{s}']['description']='Humerus, radius and ulna, the 27 bones of the hand, and the muscles that move the shoulder, elbow, wrist and fingers.'
    R[f'leg-{s}']['description']='Femur, patella, tibia and fibula, the 26 bones of the foot with the sesamoids of the big toe, and the muscles that move the hip, knee, ankle and toes.'
new=[('neck','Neck','The muscles of the neck and throat, the larynx and thyroid cartilage, and the great vessels between the head and the chest.'),
     ('abdomen','Abdomen','The stomach, intestines, liver, pancreas, spleen and kidneys, the abdominal vessels, and the muscles of the abdominal wall and lower back.'),
     ('body','Whole body','Structures that cover or span the whole body, such as the skin.')]
order=['skull','neck','spine','thorax','girdle','abdomen','arm-l','arm-r','pelvis','leg-l','leg-r','body']
for i,n,d in new: R[i]={'id':i,'name':n,'description':d}
A['regions']=[R[i] for i in order]
PH={'skull':'the head','neck':'the neck','thorax':'the chest','abdomen':'the abdomen','pelvis':'the pelvis','arm-l':'the left upper limb','arm-r':'the right upper limb','leg-l':'the left lower limb','leg-r':'the right lower limb','body':'the whole body','spine':'the back','girdle':'the shoulders'}
# ---------- layers ----------
A['layers']=[
 {'id':'skin','name':'Skin and hair','short':'Skin','color':'#d7a58b','fade':0.16,'description':'The skin is the largest organ of the body, a waterproof, self-repairing barrier that also senses touch and heat and helps control body temperature.'},
 {'id':'muscle','name':'Muscles and tendons','short':'Muscles','color':'#b0524a','connectiveColor':'#ddd3c3','fade':0.14,'description':'Skeletal muscles pull on bones through tendons to move joints and hold posture. Tendons, ligaments and fasciae are shown in a paler colour.'},
 {'id':'organ','name':'Organs','short':'Organs','color':'#c98a78','fade':0.18,'description':'The internal organs of the chest, abdomen and pelvis, with the eyes, ears, lips and gums.'},
 {'id':'artery','name':'Arteries','short':'Arteries','color':'#c4383b','fade':0.2,'description':'Arteries carry blood away from the heart. This model has the aorta, its main branches in the trunk and neck, the coronary arteries and the pulmonary artery, but not the vessels of the limbs or head.'},
 {'id':'vein','name':'Veins','short':'Veins','color':'#3e62b6','fade':0.2,'description':'Veins return blood to the heart. This model has the venae cavae, the main veins of the trunk and neck, the cardiac veins and the pulmonary veins, but not the veins of the limbs or head.'},
 {'id':'nerve','name':'Brain','short':'Brain','color':'#e3bdb3','fade':0.18,'description':'The brain with its gyri, deep nuclei and fluid-filled ventricles, and the optic nerves. The spinal cord and peripheral nerves are not part of this dataset.'},
 {'id':'cartilage','name':'Cartilage','short':'Cartilage','color':'#b2cbd3','fade':0.2,'description':'Intervertebral discs, costal cartilages and the cartilages of the larynx and nose.'},
 {'id':'bone','name':'Bone','short':'Bone','color':'#e6d9bf','fade':0.2,'description':'The bones of the skeleton.'},
 {'id':'tooth','name':'Teeth','short':'Teeth','color':'#f3efe3','fade':0.2,'description':'The 28 permanent teeth.'},
]
A['colors']={'selected':'#3552d6','selectedDark':'#8ea2ff'}
# ---------- types ----------
T=A['types']
def ty(k,lat,desc,color=None):
    T[k]={'latin':lat,'description':desc}
    if color: T[k]['color']=color
ty('skin','Cutis','The skin covers the whole body. Its outer epidermis renews itself every few weeks; the dermis below holds blood vessels, nerve endings, hair follicles and sweat glands.')
ty('hair','Pili','Hair grows from follicles in the dermis. It protects the scalp from sunlight and heat loss and helps sense touch.','#3b2e27')
ty('muscle',None,'A skeletal muscle. Skeletal muscles pull on bones through tendons to move the joints they cross, and are controlled voluntarily.')
ty('connective',None,'Dense connective tissue: tendons join muscle to bone, ligaments join bone to bone, and aponeuroses and fasciae spread the pull of muscles over a wide area.')
ty('heart','Cor','A four-chambered muscular pump about the size of a fist. The right side sends blood to the lungs; the left side sends it to the rest of the body.','#a8413c')
ty('valve','Valva cordis','A heart valve. Its thin cusps open to let blood through and snap shut to stop it flowing backwards.','#e2c3b4')
ty('papillary','Musculus papillaris','A finger-like muscle on the inner wall of a ventricle. Through tendinous cords it holds the cusps of the valve closed while the heart contracts.','#b85a50')
ty('lung','Pulmo','A lobe of the lungs, where oxygen passes into the blood and carbon dioxide leaves it. The right lung has three lobes, the left lung two, leaving room for the heart.','#e0a5a1')
ty('bronchus','Arbor bronchialis','The bronchi branch from the trachea into each lung, dividing again and again down to the tiny airways that end in air sacs.','#e7cfc2')
ty('trachea','Trachea','The windpipe, held open by C-shaped rings of cartilage. It runs from the larynx to where it splits into the two main bronchi.','#e7cfc2')
ty('esophagus','Oesophagus','A muscular tube about 25 cm long that pushes swallowed food from the throat to the stomach in waves.','#d49a86')
ty('stomach','Gaster','A muscular sac that stores food and churns it with acid and enzymes before passing it on to the duodenum.','#d8917d')
ty('duodenum','Duodenum','The first part of the small intestine, a C-shaped loop around the head of the pancreas. Bile and pancreatic juice enter it here.','#dca489')
ty('small-intestine','Intestinum tenue','The jejunum and ileum, about six metres of coiled tube in which most nutrients are absorbed.','#dca489')
ty('colon','Colon','The large intestine absorbs water and salts from what remains of digested food and forms faeces.','#c99479')
ty('taenia','Taenia coli','Three bands of longitudinal muscle along the colon. They are shorter than the colon itself, which gathers it into pouches.','#b98068')
ty('appendix','Appendix vermiformis','A narrow, finger-like pouch from the start of the large intestine, rich in lymphoid tissue.','#c99479')
ty('rectum','Rectum','The last part of the large intestine, which stores faeces before they leave the body.','#c99479')
ty('liver','Hepar','The largest internal organ. It processes nutrients from the gut, makes bile and many blood proteins, stores energy and breaks down toxins.','#7c3a2e')
ty('gallbladder','Vesica biliaris','A small pear-shaped sac under the liver that stores and concentrates bile.','#6f8a4a')
ty('pancreas','Pancreas','A gland behind the stomach. It releases digestive enzymes into the duodenum and the hormones insulin and glucagon into the blood.','#e0b48c')
ty('spleen','Splen','Filters the blood, removes worn-out red blood cells and stores immune cells.','#6e3040')
ty('kidney','Ren','Each kidney filters about 180 litres of blood plasma a day, keeping what the body needs and passing the rest to the bladder as urine.','#8c3c33')
ty('adrenal','Glandula suprarenalis','A gland on top of each kidney that makes adrenaline, cortisol and aldosterone.','#d6a157')
ty('ureter','Ureter','A muscular tube that carries urine from a kidney to the bladder.','#d6b2a0')
ty('bladder','Vesica urinaria','A stretchy muscular sac that stores urine.','#d6b2a0')
ty('urethra','Urethra','The tube that carries urine from the bladder out of the body; in men it also carries semen.','#d6b2a0')
ty('prostate','Prostata','A gland below the bladder that surrounds the urethra and adds fluid to semen.','#c89080')
ty('seminal','Glandula vesiculosa','A gland behind the bladder that produces most of the fluid in semen.','#c89080')
ty('testis','Testis','Produces sperm and the hormone testosterone.','#d8b8a6')
ty('epididymis','Epididymis','A coiled tube behind each testis where sperm mature and are stored.','#c89080')
ty('penis','Penis','Made of three columns of erectile tissue: two corpora cavernosa and the corpus spongiosum around the urethra, which ends in the glans.','#c98a78')
ty('thymus','Thymus','A gland behind the sternum where T cells of the immune system mature. It is largest in childhood.','#dcb3a0')
ty('eye','Bulbus oculi','The eyeball focuses light onto the retina, which turns it into nerve signals carried by the optic nerve.','#f2f0ea')
ty('ear','Auricula','The visible outer ear, a frame of elastic cartilage covered by skin, which funnels sound into the ear canal.','#d7a58b')
ty('gingiva','Gingiva','The gums, a firm lining of the jaws that seals around the necks of the teeth.','#d98c8c')
ty('lips','Labia oris','The lips surround the mouth. They are used in speech, eating and facial expression.','#c57a74')
ty('pituitary','Hypophysis','A pea-sized gland under the brain that controls many other glands through the hormones it releases.','#d6a157')
ty('pineal','Glandula pinealis','A small gland in the middle of the brain that releases melatonin, which helps set the daily sleep–wake rhythm.','#d6a157')
ty('pancreatic-duct','Ductus pancreaticus','Carries digestive juice from the pancreas to the duodenum.','#e6c9a4')
ty('cortex','Gyrus cerebri','A fold of the cerebral cortex. The folds greatly increase its surface area; different gyri specialise in movement, sensation, language, vision and planning.')
ty('brain-lobe','Lobus cerebri','A lobe of the cerebral hemisphere.')
ty('cerebellum','Cerebellum','Coordinates movement, balance and posture, and fine-tunes motor learning.','#d9aea4')
ty('brainstem','Truncus encephali','The brainstem connects the brain to the spinal cord and controls breathing, heart rate and many reflexes.','#dcb9a6')
ty('diencephalon','Diencephalon','Deep structures around the third ventricle. The thalamus relays sensory information to the cortex; the hypothalamus controls hunger, thirst, temperature and hormones.','#d9a9a0')
ty('basal','Nuclei basales','Deep grey matter involved in starting and controlling movement and in habits and reward.','#c99790')
ty('limbic','Systema limbicum','Part of the limbic system, involved in memory and emotion.','#d19c95')
ty('white-matter','Substantia alba','Bundles of nerve fibres connecting different parts of the brain.','#efe4d8')
ty('ventricle','Ventriculus','A space inside the brain filled with cerebrospinal fluid, which cushions the brain and carries nutrients and waste.','#8fb7d6')
ty('choroid','Plexus choroideus','Tufts of blood vessels in the ventricles that produce cerebrospinal fluid.','#c56c6c')
ty('optic','Nervus opticus','Carries visual signals from the eye. The two optic nerves meet at the optic chiasm, where half of the fibres cross, and continue as the optic tracts.','#e8d27a')
ty('colliculus','Colliculus','A small mound on the back of the midbrain. The superior colliculi help steer the eyes; the inferior colliculi relay hearing.','#dcb9a6')
ty('artery',None,'An artery. Its thick muscular wall carries blood away from the heart under high pressure.')
ty('aorta','Aorta','The largest artery. It leaves the left ventricle, arches over the heart and runs down through the chest and abdomen, giving branches to the whole body.')
ty('coronary','Arteria coronaria','The coronary arteries supply the heart muscle itself with blood.')
ty('pulmonary-artery','Truncus pulmonalis','Carries oxygen-poor blood from the right ventricle to the lungs.','#4a6fbe')
ty('vein',None,'A vein. Its thin wall carries blood back to the heart under low pressure.')
ty('vena-cava','Vena cava','The superior and inferior venae cavae return blood from the whole body to the right atrium.')
ty('pulmonary-vein','Venae pulmonales','Carry oxygen-rich blood from the lungs to the left atrium.','#c4383b')
ty('cardiac-vein','Venae cordis','Drain blood from the heart muscle, mostly into the coronary sinus.')
ty('larynx-cartilage','Cartilago thyroidea','The largest cartilage of the larynx. Its front edge forms the Adam\'s apple.')
ty('nasal-cartilage','Cartilagines nasi','The cartilages that shape the lower part of the nose.')
def typeof(n,layer,tissue):
    l=n.lower()
    if layer=='skin': return 'hair' if tissue=='hair' else 'skin'
    if layer=='muscle': return 'connective' if tissue=='connective' else 'muscle'
    if layer=='cartilage': return 'larynx-cartilage' if 'thyroid' in l else 'nasal-cartilage'
    if layer=='artery':
        if 'aorta' in l: return 'aorta'
        if 'coronary' in l: return 'coronary'
        if 'pulmonary' in l: return 'pulmonary-artery'
        return 'artery'
    if layer=='vein':
        if 'vena' in l: return 'vena-cava'
        if 'pulmonary' in l: return 'pulmonary-vein'
        if 'cardiac' in l or 'coronary' in l or 'ventricle' in l: return 'cardiac-vein'
        return 'vein'
    if layer=='nerve':
        for k,p in [('optic','optic|chiasm'),('ventricle','ventricle|aqueduct|central canal'),('choroid','choroid'),('cerebellum','cerebell'),('brainstem','midbrain|pons|medulla|peduncle'),('colliculus','collicul'),('diencephalon','thalam|habenul|mammillary|stria medullaris'),('basal','caudate|putamen|pallidus'),('limbic','hippocamp|amygdal|fornix|cingulate|parahippocampal|stria terminalis'),('white-matter','white matter|callosum|capsule|septum pellucidum|commissure'),('brain-lobe','lobe'),('cortex','gyr|lobule|insula')]:
            if re.search(p,l): return k
        return 'cortex'
    for k,p in [('valve','valve'),('papillary','papillary'),('heart','heart'),('lung','lobe of (right |left )?lung|lung'),('bronchus','bronch'),('trachea','trachea'),('esophagus','esophag'),('stomach','stomach'),('duodenum','duoden'),('small-intestine','jejun|ileum'),('taenia','taenia'),('appendix','appendix'),('rectum','rectum'),('colon','colon'),('liver','liver'),('gallbladder','gallbladder'),('pancreatic-duct','pancreatic duct'),('pancreas','pancrea'),('spleen','spleen'),('kidney','kidney'),('adrenal','adrenal'),('ureter','ureter'),('bladder','bladder'),('urethra','urethra'),('prostate','prostat'),('seminal','seminal'),('testis','testis'),('epididymis','epididym'),('penis','penis'),('thymus','thymus'),('eye','eye'),('ear','ear'),('gingiva','gingiva'),('lips','mouth'),('pituitary','pituitar'),('pineal','pineal')]:
        if re.search(p,l): return k
    return None
RENAME={'wall of heart':'Heart wall (myocardium)','bronchus':'Bronchial tree','middle lobe of lung':'Middle lobe of right lung','ear':'External ear','eyeball':'Eyeballs','labial part of mouth':'Lips','white matter structure of cerebral hemisphere':'Cerebral white matter','colon':'Colon','pancreas':'Pancreas','skin':'Skin','external intercostal muscle':'External intercostal muscles','internal intercostal muscle':'Internal intercostal muscles','innermost intercostal muscle':'Innermost intercostal muscles','pulmonary vein':'Pulmonary veins','bronchus':'Bronchial tree'}
def nice(n):
    n=re.sub(r', nsn$','',n)
    if n in RENAME: return RENAME[n]
    n=re.sub(r'^set of ','',n)
    n={'head hairs':'head hair','pubic hairs':'pubic hair'}.get(n,n)
    return n[0].upper()+n[1:]
G={g['id']:g for g in A['groups']}
LS={L['id']:L for L in A['layers']}
for d in soft:
    reg=d['region']; lay=d['layer']
    if re.search(r'liver|gallbladder|stomach|spleen|splenic|pancrea|kidney|renal|adrenal|duoden|jejun|ileum|colon|taenia|appendix|hepatic|gastric|mesenteric|celiac|inferior vena cava', d['source']) and reg in ('thorax','pelvis'): reg='abdomen'
    gid=f"{lay}-{reg}"
    if gid not in G:
        short=A_short=next(r['name'] for r in A['regions'] if r['id']==reg)
        if lay=='nerve': nm='Brain' if reg=='skull' else f"Nerves of {PH[reg]}"
        elif lay=='skin': nm='Skin' if reg=='body' else f"Hair of {PH[reg]}"
        elif lay=='cartilage': nm=f"Cartilages of {PH[reg]}"
        else: nm=f"{LS[lay]['short']} of {PH[reg]}"
        G[gid]={'id':gid,'region':reg,'name':nm,'short':short,'description':f"{LS[lay]['name']} of {PH[reg]}."}
    side='left' if re.search(r'\bleft\b',d['source']) else ('right' if re.search(r'\bright\b',d['source']) else None)
    p={'id':d['id'],'source':d['source'],'name':nice(d['source']),'layer':lay,'region':reg,'group':gid}
    t=typeof(d['source'],lay,d['tissue'])
    if t: p['type']=t
    if d['tissue']=='connective': p['tissue']='connective'
    if side: p['side']=side
    A['parts'].append(p)
A['groups']=list(G.values())
A['_about']="Names, descriptions, layers and colours used by the anatomy viewer. Edit freely; the app reloads this file when it regains focus. Geometry lives in the geometry-*.bin files and is matched by id. A part can override its colour with \"color\" and its text with \"description\"."
json.dump(A,open(os.path.join(DATA,'anatomy.json'),'w'),indent=1,ensure_ascii=False)
from collections import Counter
print(len(A['parts']),'parts;',Counter(p['layer'] for p in A['parts']))
print('untyped:',[p['name'] for p in A['parts'] if not p.get('type')][:20])
# ---------- geometry manifest ----------
sk=json.load(open(os.path.join(DATA,'geometry.json'))); so=json.load(open(os.path.join(WORK,'soft_geo.json')))
if 'files' not in sk:
    for p in sk['parts']: p['f']=0
    files=[{'url':'data/geometry.bin','bytes':sk['bytes'],'layer':'skeleton'}]+so['files']
    parts=sk['parts']+so['parts']
else:
    files=sk['files'][:1]+so['files']; parts=[p for p in sk['parts'] if p['f']==0]+so['parts']
tri=sum(p['i']//3 for p in parts)
json.dump({'format':'uint16-quantized positions per part bbox; uint16/uint32 indices; metres, Y-up, +Z anterior, +X = body left','source':'BodyParts3D 3.0 (DBCLS), simplified','triangles':tri,'files':files,'parts':parts},open(os.path.join(DATA,'geometry.json'),'w'))
print('triangles',tri,'bytes',sum(f['bytes'] for f in files))
