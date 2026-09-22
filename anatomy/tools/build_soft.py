"""Step 3: soft tissue -> data/geometry-<layer>.bin, plus .work/soft_geo.json and .work/soft_parts.json.
Classifies each non-skeletal mesh into a layer by name, welds it, applies the skeleton's transform,
decimates it to a per-layer triangle budget, assigns a body region from its position, and quantises it."""
import numpy as np, json, os, re, sys, time
import fast_simplification as fsimp
from paths import DATA, WORK, STL, SOURCE
names=json.load(open(os.path.join(SOURCE,'stl_names.json'))); sel=json.load(open(os.path.join(SOURCE,'skeleton_ids.json')))
T=json.load(open(os.path.join(WORK,'skeleton_bounds.json'))); mn,mx=T['mn'],T['mx']
CX=(mn[0]+mx[0])/2; CY=mn[1]; CZ=(mn[2]+mx[2])/2

def classify(n):
    l=n.lower()
    if re.search(r'^skin$|hair|eyebrow', l): return 'skin','hair' if 'hair' in l or 'eyebrow' in l else 'skin'
    if re.search(r'cartilage|meniscus|labrum', l): return 'cartilage','cartilage'
    if re.search(r'\bveins?\b|vena|venous|\bsinus\b', l): return 'vein','vein'
    if re.search(r'arter|aorta|coronary|trunk of', l): return 'artery','artery'
    if re.search(r'pituitar|pineal', l): return 'organ','gland'
    if re.search(r'nerve|gyrus|gyri|lobule|cerebr|cerebell|midbrain|pons\b|medulla|thalam|capsule|stria|choroid|septum pellucidum|spinal cord|ganglion|brain|callosum|fornix|putamen|caudate|nucleus|amygdal|hippocamp|insula|cortex|white matter|plexus|ventricle of brain|lateral ventricle|third ventricle|fourth ventricle|vermis|chiasm|olfactory|optic|claustrum|globus|cingul|operculum|precuneus|cuneus|pole\b|fissure|lobe of (the )?(brain|cerebr)|frontal lobe|temporal lobe|occipital lobe|parietal lobe|limbic|mammillary|colliculus|peduncle|flocculus|tonsil of cerebell|substantia|red nucleus|habenul|epithalam|subthalam|tegment|tectum', l): return 'nerve','nerve'
    if re.search(r'heart|valve|papillary|atri(um|al)|ventricle|lung|bronch|trache|liver|hepat|stomach|esophag|oesophag|duoden|jejun|ileum|colon|caecum|cecum|appendix|rectum|taenia|pancrea|spleen|kidney|renal|ureter|bladder|urethra|prostat|testis|epididym|penis|corpus spongiosum|corpus cavernosum|spermatic|seminal|deferens|thyroid gland|parathyroid|adrenal|suprarenal|gall|bile|biliary|\beye|lens\b|cornea|retina\b|^ear$|\bear\b|tongue|larynx|pharynx|epiglott|vocal|tonsil|mouth|\blip\b|thymus|lymph|mesocol|omental|gingiva|gum\b|glottis|nasal cavity|salivary|parotid|submandibular gland|sublingual gland|lacrimal gland|anal canal|anus|scrot|intestin|pleura|pericard|cardiac|mitral|tricuspid', l): return 'organ','organ'
    if re.search(r'ligament|tendon|aponeuros|fascia|tract\b|retinacul|membrane|raphe|sheath|linea\b|bursa|galea', l): return 'muscle','connective'
    return 'muscle','muscle'

def region(c, size, n):
    x,y,z=c
    if size[1] > 0.9: return 'body'
    side = 'l' if x>0 else 'r'
    if abs(x) > 0.175 and y > 0.6: return 'arm-'+side
    if abs(x) < 0.07 and 0.6 < y <= 0.72: return 'pelvis'
    if y > 1.46: return 'skull'
    if y > 1.36: return 'neck'
    if y > 1.06: return 'thorax'
    if y > 0.9: return 'abdomen'
    if y > 0.72 and abs(x) < 0.17: return 'pelvis'
    return 'leg-'+side

def read(fid):
    b=open(os.path.join(STL,fid+'.stl'),'rb').read()
    n=int.from_bytes(b[80:84],'little')
    rec=np.frombuffer(b,dtype=np.dtype([('n','<f4',3),('v','<f4',(3,3)),('a','<u2')]),count=n,offset=84)
    v=rec['v'].reshape(-1,3).astype(np.float64)
    q=np.round(v*1e3).astype(np.int64)
    uq,inv=np.unique(q,axis=0,return_inverse=True)
    f=inv.reshape(-1,3).astype(np.int64)
    keep=(f[:,0]!=f[:,1])&(f[:,1]!=f[:,2])&(f[:,0]!=f[:,2]); f=f[keep]
    p=uq/1e3
    P=np.stack([p[:,0]*1e-3-CX, p[:,2]*1e-3-CY, -p[:,1]*1e-3-CZ],1)
    return P,f,n

BUDGET={'skin':160000,'muscle':950000,'nerve':220000,'organ':300000,'artery':45000,'vein':45000,'cartilage':30000}
rest=[k for k in names if k not in sel]
info=[]
for k in rest:
    n=names[k]; layer,tissue=classify(n)
    b=open(os.path.join(STL,k+'.stl'),'rb').read(84); tris=int.from_bytes(b[80:84],'little')
    info.append(dict(id=k,source=n,layer=layer,tissue=tissue,src=tris))
src={}
for d in info: src[d['layer']]=src.get(d['layer'],0)+d['src']
ratio={L:min(1.0,BUDGET[L]/src[L]) for L in src}
print('source',src); print('keep ratio',{k:round(v,3) for k,v in ratio.items()})
out={}; t0=time.time()
for i,d in enumerate(info):
    P,f,n=read(d['id'])
    r=ratio[d['layer']]
    target=max(min(len(f),160), int(len(f)*r))
    if target < len(f)*0.98 and len(f)>200:
        P2,f2=fsimp.simplify(P.astype(np.float32), f.astype(np.int32), target_count=target, agg=6)
    else: P2,f2=P.astype(np.float32),f.astype(np.int32)
    bmin=P2.min(0); bmax=P2.max(0)
    d.update(tris=int(len(f2)), verts=int(len(P2)), bmin=bmin.tolist(), bmax=bmax.tolist())
    c=(bmin+bmax)/2; size=bmax-bmin
    d['region']=region(c,size,d['source'])
    out[d['id']]=(P2,f2)
    if i%100==0: print(i, round(time.time()-t0,1),'s', flush=True)
# emit per-layer files
files=[]; parts=[]
for L in ['skin','muscle','nerve','artery','vein','organ','cartilage']:
    blobs=[]; off=0
    def push(a):
        global off
        pad=(-off)%4
        if pad: blobs.append(b'\0'*pad); off+=pad
        o=off; bb=a.tobytes(); blobs.append(bb); off+=len(bb); return o
    fi=len(files)+1
    for d in info:
        if d['layer']!=L: continue
        P,f=out[d['id']]
        b0=P.min(0).astype(np.float64); b1=P.max(0).astype(np.float64); rng=np.where(b1-b0>0,b1-b0,1)
        q=np.round((P-b0)/rng*65535).astype(np.uint16)
        po=push(q.reshape(-1))
        nv=len(P); I=f.astype(np.uint16 if nv<65536 else np.uint32).reshape(-1)
        io=push(I)
        parts.append(dict(id=d['id'],f=fi,v=nv,i=int(I.size),p=po,x=io,t=16 if nv<65536 else 32,min=[round(float(v),6) for v in b0],max=[round(float(v),6) for v in b1]))
    name=f'geometry-{L}.bin'
    open(os.path.join(DATA,name),'wb').write(b''.join(blobs))
    files.append(dict(url='data/'+name,bytes=off,layer=L))
json.dump(dict(files=files,parts=parts),open(os.path.join(WORK,'soft_geo.json'),'w'))
json.dump(info,open(os.path.join(WORK,'soft_parts.json'),'w'))
tot={}
for d in info: tot[d['layer']]=tot.get(d['layer'],0)+d['tris']
print('out tris',tot,sum(tot.values())); print('files',[(f['url'],round(f['bytes']/1e6,2)) for f in files])
from collections import Counter
print(Counter((d['layer'],d['region']) for d in info))
