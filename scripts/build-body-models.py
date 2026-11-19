"""Generate smooth segmented GLBs from CC0 MakeHuman geometry and adult morphs.
Usage: python3 scripts/build-body-models.py /path/to/source-folder
Source files listed in assets/models/README.md; no runtime network dependency.
"""
import pathlib,sys,math,json,struct,collections
root=pathlib.Path(sys.argv[1]);out=pathlib.Path(__file__).resolve().parents[1]/'assets/models';out.mkdir(parents=True,exist_ok=True)
vertices=[];polygons=[];group=''
for line in (root/'base.obj').read_text().splitlines():
 if line.startswith('v '):vertices.append(list(map(float,line.split()[1:4])))
 elif line.startswith('g '):group=line[2:]
 elif line.startswith('f ') and group=='body':polygons.append([int(p.split('/')[0])-1 for p in line.split()[1:]])
triangles=[(f[0],f[i],f[i+1]) for f in polygons for i in range(1,len(f)-1)]
def target(name):
 result=[]
 for line in (root/name).read_text().splitlines():
  if not line or line.startswith('#'):continue
  p=line.split()
  if len(p)==4:result.append((int(p[0]),list(map(float,p[1:]))))
 return result
used={i for t in triangles for i in t}
for model in ['male','female','neutral']:
 v=[p[:] for p in vertices];sexes=[model] if model!='neutral' else ['male','female']
 for sex in sexes:
  for eth in ['african','asian','caucasian']:
   for i,d in target(f'{eth}-{sex}-young.target'):
    for a in range(3):v[i][a]+=d[a]/(3*len(sexes))
  for muscle,weight in [('averagemuscle',.5),('maxmuscle',.5)]:
   for i,d in target(f'universal-{sex}-young-{muscle}-averageweight.target'):
    for a in range(3):v[i][a]+=d[a]*weight/len(sexes)
 low=min(v[i][1] for i in used);high=max(v[i][1] for i in used);height=high-low
 # Model spans two world units high, centered at the origin.
 points=[(p[0]/height*2,(p[1]-low)/height*2-1,p[2]/height*2) for p in v]
 # Bring the source A-pose closer to a relaxed athletic stance.
 posed=[]
 for x,y,z in points:
  sign=1 if x>=0 else -1;blend=max(0,min(1,(abs(x)-.18)/.12)) if y>-.25 and (y>.35 or abs(x)>.3) else 0;angle=-sign*.35*blend;dx=x-sign*.18;dy=y-.54
  posed.append((sign*.18+dx*math.cos(angle)-dy*math.sin(angle),.54+dx*math.sin(angle)+dy*math.cos(angle),z))
 points=posed
 def zone(t):
  x,y,z=[sum(points[i][a] for i in t)/3 for a in range(3)];h=(y+1)/2;w=abs(x)/2
  if .39<h<.56 and w<.145:return 'shorts'
  if model=='female' and w<.12 and (.705<h<.755 or .755<=h<.805 and .055<w<.085):return 'top'
  if h>.84 or h<.055:return 'neutral'
  if h<.43 and w<.17:return 'legs'
  if w>.12:
   if .73<h<.83 and w<.19:return 'shoulders'
   if .59<h<.76:return 'biceps' if z>0 else 'triceps'
   return 'neutral'
  if .735<h<.82:return 'chest' if z>0 else 'back'
  if .56<h<.735:return 'abs' if z>0 else 'back'
  return 'neutral'
 normals=[[0.,0.,0.] for _ in points]
 for t in triangles:
  a,b,c=[points[i] for i in t];u=[b[k]-a[k] for k in range(3)];w=[c[k]-a[k] for k in range(3)];n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]]
  for i in t:
   for k in range(3):normals[i][k]+=n[k]
 normals=[tuple(n[k]/(math.sqrt(sum(a*a for a in n)) or 1) for k in range(3)) for n in normals]
 # Slice clothing boundaries at precise horizontal planes, avoiding jagged
 # edges caused by assigning an entire source triangle to one side of a hem.
 modelTriangles=[]
 planes=[2*h-1 for h in [.39,.56,.705,.755,.805]]
 for tri in triangles:
  pieces=[[(*points[i],*normals[i]) for i in tri]]
  for plane in planes:
   split=[]
   for poly in pieces:
    for upper in [True,False]:
     clipped=[]
     for a,b in zip(poly,poly[1:]+poly[:1]):
      ain=a[1]>=plane if upper else a[1]<=plane;bin=b[1]>=plane if upper else b[1]<=plane
      if ain:clipped.append(a)
      if ain!=bin:
       ratio=(plane-a[1])/(b[1]-a[1]);clipped.append(tuple(a[k]+ratio*(b[k]-a[k]) for k in range(6)))
     if len(clipped)>=3:split.append(clipped)
   pieces=split
  for poly in pieces:
   ids=[]
   for value in poly:
    ids.append(len(points));points.append(value[:3]);normals.append(value[3:])
   modelTriangles.extend((ids[0],ids[i],ids[i+1]) for i in range(1,len(ids)-1))
 groups=collections.defaultdict(list)
 for t in modelTriangles:groups[zone(t)].append(t)
 binary=bytearray();views=[];accessors=[];meshes=[];nodes=[];materials=[]
 def append(data,component,type,count,minv=None,maxv=None):
  while len(binary)%4:binary.append(0)
  offset=len(binary);binary.extend(data);vi=len(views);views.append({'buffer':0,'byteOffset':offset,'byteLength':len(data)})
  a={'bufferView':vi,'componentType':component,'count':count,'type':type}
  if minv is not None:a.update(min=minv,max=maxv)
  accessors.append(a);return len(accessors)-1
 for name,faces in groups.items():
  indices=sorted({i for t in faces for i in t});mapping={old:i for i,old in enumerate(indices)};pos=[points[i] for i in indices];norm=[normals[i] for i in indices];idx=[mapping[i] for t in faces for i in t]
  pa=append(struct.pack('<'+'f'*len(pos)*3,*[x for p in pos for x in p]),5126,'VEC3',len(pos),[min(p[a] for p in pos) for a in range(3)],[max(p[a] for p in pos) for a in range(3)])
  na=append(struct.pack('<'+'f'*len(norm)*3,*[x for p in norm for x in p]),5126,'VEC3',len(norm));ia=append(struct.pack('<'+'I'*len(idx),*idx),5125,'SCALAR',len(idx))
  mat=len(materials);color=[.13,.14,.13,1] if name in ['shorts','top'] else [.56,.57,.53,1]
  materials.append({'name':name,'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':0,'roughnessFactor':.72},'doubleSided':True})
  meshes.append({'name':name,'primitives':[{'attributes':{'POSITION':pa,'NORMAL':na},'indices':ia,'material':mat}]});nodes.append({'name':name,'mesh':len(meshes)-1})
 gltf={'asset':{'version':'2.0','generator':'GRITTT MakeHuman CC0 asset preparation'},'scene':0,'scenes':[{'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':meshes,'materials':materials,'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':accessors}
 js=json.dumps(gltf,separators=(',',':')).encode();js+=b' '*((-len(js))%4);binary+=b'\0'*((-len(binary))%4);blob=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(binary))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(binary),0x004E4942)+binary
 (out/(model+'.glb')).write_bytes(blob)
 # Source-neutral silhouette for the Food infographic uses real projected model surface.
 projection={'vertices':[[round(x,5),round(y,5),round(z,5)] for x,y,z in points],'triangles':[list(t) for t in modelTriangles]}
 (root/(model+'-preview.json')).write_text(json.dumps(projection))
 print(model,len(blob),'bytes',len(triangles),'triangles',dict((k,len(val)) for k,val in groups.items()))
