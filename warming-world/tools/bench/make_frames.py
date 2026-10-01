# Renderer bench (DESIGN.md §5.1), not the pipeline: build the annual and 24 monthly frames from the research grid, in the contract's encoding,
# to size the snapshot and feed the renderer bench. Not the pipeline.
import gzip, io, json, zlib, base64, math, time, numpy as np
from scipy.io import netcdf_file
import os
HERE=os.path.dirname(os.path.abspath(__file__))
SRC=os.path.join(HERE,'../../../scripts/warming_world/cache/wayback/gistemp1200_GHCNv4_ERSSTv5.20260906.nc.gz')
OUT=os.path.join(HERE,'../.work/bench'); os.makedirs(OUT,exist_ok=True)
t0=time.time()
raw=gzip.decompress(open(SRC,'rb').read())
f=netcdf_file(io.BytesIO(raw),'r',mmap=False,maskandscale=False)
a=np.array(f.variables['tempanomaly'][:]).astype(np.int32)   # (T,90,180) south-first
T=a.shape[0]; print('months',T, 'read', round(time.time()-t0,2),'s')
a=a[:, ::-1, :]                       # north first
valid=a!=32767
lat=np.arange(89,-90,-2.0); w=np.cos(np.radians(lat))[:,None]*np.ones((1,180))
def enc(mean_c):                      # mean in °C (float) -> byte, half away from zero at 0.1
    tenth=np.sign(mean_c)*np.floor(np.abs(mean_c)*10+0.5)
    b=(tenth+127).astype(np.int64)
    assert b.min()>=0 and b.max()<=254, (b.min(), b.max())
    return b.astype(np.uint8)
years=[]; frames=[]
nfull=T//12; rem=T%12
for y in range(nfull+(1 if rem>=6 else 0)):
    m0=y*12; m1=min(m0+12,T); n=m1-m0
    need=12 if n==12 else n
    need=9 if n==12 else math.ceil(0.75*n)
    v=valid[m0:m1]; s=np.where(v,a[m0:m1],0).sum(0); c=v.sum(0)
    ok=c>=need
    mean=np.where(ok, s/np.maximum(c,1)/100.0, 0)
    b=enc(mean); b[~ok]=255
    frames.append(b.tobytes()); years.append((1880+y,n,float((w*ok).sum()/w.sum()),float(ok.mean())))
mframes=[]
for t in range(T-24,T):
    v=valid[t]; mean=np.where(v,a[t]/100.0,0); b=enc(mean); b[~v]=255; mframes.append(b.tobytes())
print('annual frames',len(frames),'monthly',len(mframes))
for y in (0,20,70,100,120,145,146): print(years[y])
def pack(fr): return [base64.b64encode(zlib.compress(x,9)).decode() for x in fr]
pa=pack(frames); pm=pack(mframes)
print('annual b64',sum(map(len,pa)),'deflated',sum(len(zlib.compress(x,9)) for x in frames))
print('monthly b64',sum(map(len,pm)))
json.dump({'nx':180,'ny':90,'annual':pa,'months':pm,'years':years},open(os.path.join(OUT,'bench.json'),'w'),separators=(',',':'))
open(os.path.join(OUT,'annual.bin'),'wb').write(b''.join(frames)); open(os.path.join(OUT,'months.bin'),'wb').write(b''.join(mframes))
print('bench.json',os.path.getsize(os.path.join(OUT,'bench.json')))
