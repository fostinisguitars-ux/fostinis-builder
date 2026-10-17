from pathlib import Path
import json,struct,hashlib,time
import cadquery as cq,numpy as np
from OCP.BRep import BRep_Tool
from OCP.BRepLib import BRepLib_ToolTriangulatedShape
from OCP.TopLoc import TopLoc_Location
from OCP.TopAbs import TopAbs_REVERSED
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
import sys
root=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]).resolve();out.mkdir(exist_ok=True)
construction=json.loads((Path(__file__).parent/'body-construction.json').read_text())
construction_report=json.loads((root/'construction-report.json').read_text()) if (root/'construction-report.json').exists() else None
pickup_report=json.loads((root/'pickup-alignment-report.json').read_text()) if (root/'pickup-alignment-report.json').exists() else None
heel_report=json.loads((root/'heel-cleanup-report.json').read_text()) if (root/'heel-cleanup-report.json').exists() else None
from OCP.BRepTools import BRepTools
from OCP.BRepMesh import BRepMesh_IncrementalMesh
records={}

def split_cap_edge(p,n,ix,low,high):
 """Split crossing triangles at exact physical glue/edge planes, not a decal."""
 pieces={'side':[],'binding':[]}
 def clip(poly,z,above):
  result=[]
  for a,b in zip(poly,poly[1:]+poly[:1]):
   ina=a[2]>=z if above else a[2]<=z
   inb=b[2]>=z if above else b[2]<=z
   if ina:result.append(a)
   if ina!=inb:
    t=(z-a[2])/(b[2]-a[2]);v=a+(b-a)*t;v[2]=z;result.append(v)
  return result
 for triangle in ix:
  poly=[np.concatenate((p[i],n[i])).astype(np.float64) for i in triangle]
  for kind,polygon in [('side',clip(poly,low,False)),('side',clip(poly,high,True)),('binding',clip(clip(poly,low,True),high,False))]:
   for i in range(1,len(polygon)-1):
    tri=np.array([polygon[0],polygon[i],polygon[i+1]])
    if np.linalg.norm(np.cross(tri[1,:3]-tri[0,:3],tri[2,:3]-tri[0,:3]))>1e-9:pieces[kind].append(tri)
 result={}
 for kind,triangles in pieces.items():
  if triangles:
   vertices=np.concatenate(triangles);normals=vertices[:,3:];normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-9)
   result[kind]=(vertices[:,:3].astype(np.float32),normals.astype(np.float32),np.arange(len(vertices),dtype=np.uint32).reshape(-1,3))
 return result

for file in sorted(root.glob('*')):
 if file.suffix.lower()!='.step': continue
 isneck='neck' in file.name
 model=file.stem.split('_')[0]
 rim=construction['rimZMm'].get(model,0)
 cap_base=rim-construction['exposedMapleCapMm']
 back=cap_base-construction['bodyWoodThicknessMm'] if construction_report and not isneck else -59
 start=time.time();shape=cq.importers.importStep(str(file)).val();BRepTools.Clean_s(shape.wrapped);BRepMesh_IncrementalMesh(shape.wrapped,.07,False,.12,True).Perform()
 parts={};allPos=[];allIdx=[];offset=0;faceinfo=[]
 faces=shape.Faces();bodyFaceCount=len(faces)
 if 'neck' not in file.name:
  lips=[f for f in faces if f.geomType()=='PLANE' and abs(f.Center().z-(back+3))<.01 and 4700<f.Area()<5000]
  if lips:
   cover=cq.Solid.extrudeLinear(lips[0].outerWire(),[],cq.Vector(0,0,-2.8)).translate((0,0,-.1));BRepMesh_IncrementalMesh(cover.wrapped,.07,False,.12,True).Perform();faces+=cover.Faces()
  if 'tremolo' in file.name:
   rear=[f for f in shape.Faces() if f.geomType()=='PLANE' and abs(f.Center().z-back)<.01 and f.Area()>50000]
   for rf in rear:
    for wire in rf.innerWires():
     bb=wire.BoundingBox()
     if (bb.xmin+bb.xmax)/2<20:
      candidates=wire.offset2D(3.5)+wire.offset2D(-3.5)
      outline=max(candidates,key=lambda w:cq.Face.makeFromWires(w).Area())
      cover=cq.Solid.extrudeLinear(outline,[],cq.Vector(0,0,-1.7)).translate((0,0,-.05));BRepMesh_IncrementalMesh(cover.wrapped,.07,False,.12,True).Perform();faces+=cover.Faces()
 for faceId,f in enumerate(faces):
  loc=TopLoc_Location();poly=BRep_Tool.Triangulation_s(f.wrapped,loc)
  if poly is None:continue
  BRepLib_ToolTriangulatedShape.ComputeNormals_s(f.wrapped,poly)
  trans=loc.Transformation();reverse=f.wrapped.Orientation()==TopAbs_REVERSED
  p=np.array([[v.X(),v.Y(),v.Z()] for v in (poly.Node(i).Transformed(trans) for i in range(1,poly.NbNodes()+1))],dtype=np.float32)
  n=np.array([[v.X(),v.Y(),v.Z()] for v in (poly.Normal(i).Transformed(trans) for i in range(1,poly.NbNodes()+1))],dtype=np.float32)*(-1 if reverse else 1)
  ix=np.array([[t.Value(1)-1,t.Value(3 if reverse else 2)-1,t.Value(2 if reverse else 3)-1] for t in poly.Triangles()],dtype=np.uint32)
  b=f.BoundingBox();c=f.Center();normal=f.normalAt()
  isneck='neck' in file.name
  if isneck:
   kind='headstock_front' if f.geomType()=='PLANE' and normal.z>.9 and c.y>620 and f.Area()>8000 else 'neck'
  else:
   kind='top' if p[:,2].min()>=rim-.055 else 'back' if b.zmax<back+3.1 else 'side'
   if f.geomType()=='PLANE' and abs(normal.z)>.95 and back+4<b.zmax<rim-.15:kind='cavity'
  if faceId>=bodyFaceCount:kind='cover'
  if kind=='side' and p[:,2].min()<rim-1e-4 and p[:,2].max()>cap_base+1e-4:
   for split_kind,geometry in split_cap_edge(p,n,ix,cap_base,rim).items():parts.setdefault(split_kind,[]).append(geometry)
  else:parts.setdefault(kind,[]).append((p,n,ix))
  allPos.append(p);allIdx.append(ix+offset);offset+=len(p)
  faceinfo.append({'face':faceId,'kind':kind,'type':f.geomType(),'area':round(f.Area(),3),'center':list(c.toTuple()),'normal':list(normal.toTuple()),'box':[b.xmin,b.ymin,b.zmin,b.xmax,b.ymax,b.zmax]})
 buffers=[];views=[];access=[];primitives=[]
 def acc(arr,typ,component,target):
  blob=arr.tobytes();off=sum(map(len,buffers));buffers.append(blob+b'\x00'*((-len(blob))%4));views.append({'buffer':0,'byteOffset':off,'byteLength':len(blob),'target':target});a={'bufferView':len(views)-1,'componentType':component,'count':len(arr),'type':typ}
  if typ=='VEC3':a.update(min=arr.min(axis=0).tolist(),max=arr.max(axis=0).tolist())
  access.append(a);return len(access)-1
 names=list(parts)
 for mat,items in parts.items():
  p=np.concatenate([a for a,b,c in items]);n=np.concatenate([b for a,b,c in items]);ixs=[];off=0
  for a,b,c in items:ixs.append(c+off);off+=len(a)
  ix=np.concatenate(ixs).reshape(-1)
  uv=p[:,:2]/np.array([325.,500.],dtype=np.float32)
  primitives.append({'attributes':{'POSITION':acc(p*.001,'VEC3',5126,34962),'NORMAL':acc(n,'VEC3',5126,34962),'TEXCOORD_0':acc(uv,'VEC2',5126,34962)},'indices':acc(ix,'SCALAR',5125,34963),'material':names.index(mat)})
 p=np.concatenate(allPos);ix=np.concatenate(allIdx)
 name=file.stem.lower();doc={'asset':{'version':'2.0','generator':'Fostinis CAD conversion / OpenCascade','extras':{'sourceSha256':hashlib.sha256(file.read_bytes()).hexdigest(),'sourceUnits':'millimeters','linearDeflectionMm':.07,'angularDeflectionRadians':.12}},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':name,'mesh':0}],'meshes':[{'name':name,'primitives':primitives}],'materials':[{'name':n,'pbrMetallicRoughness':{'baseColorFactor':[.58,.35,.16,1],'metallicFactor':0,'roughnessFactor':.36}} for n in names],'buffers':[{'byteLength':sum(map(len,buffers))}],'bufferViews':views,'accessors':access}
 j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4);binary=b''.join(buffers);glb=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary
 (out/(name+'.glb')).write_bytes(glb)
 np.savez_compressed(root/(name+'.npz'),positions=p,triangles=ix)
 (root/(name+'-faces.json')).write_text(json.dumps(faceinfo))
 records[name]={'source':file.name,'dimensionsMm':(p.max(axis=0)-p.min(axis=0)).tolist(),'boundsMm':[p.min(axis=0).tolist(),p.max(axis=0).tolist()],'vertices':sum(len(a) for items in parts.values() for a,b,c in items),'triangles':sum(len(c) for items in parts.values() for a,b,c in items),'bytes':len(glb),'materials':names,'sourceSha256':doc['asset']['extras']['sourceSha256']}
 if not isneck and construction_report:records[name]['construction']=construction_report['bodies'][name]
 if not isneck and pickup_report:records[name]['pickupAlignment']=pickup_report['bodies'][name]
 if heel_report and name in heel_report['bodies']:records[name]['heelCleanup']=heel_report['bodies'][name]
 print(name,records[name],round(time.time()-start,1),flush=True)
 # Orthographic review of exact tessellation: front XY and side XZ or YZ.
 fig,axes=plt.subplots(1,2,figsize=(12,7),facecolor='#17191c')
 for ax,coords,title,depth in [(axes[0],[0,1],'Front',2),(axes[1],[0,2] if isneck else [1,2],'Side',1 if isneck else 0)]:
  tri=p[ix];order=np.argsort(tri[:,:,depth].mean(axis=1));norm=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);norm/=np.maximum(np.linalg.norm(norm,axis=1,keepdims=True),1e-9)
  light=np.clip(np.abs(norm@np.array([.22,.37,.9]))*.65+.25,0,1)
  color=np.stack([light*.92,light*.72,light*.43,np.ones(len(light))],axis=1)
  ax.add_collection(PolyCollection(tri[order][:,:,coords],facecolors=color[order],edgecolors='none',rasterized=True));ax.autoscale();ax.set_aspect('equal');ax.set_facecolor('#17191c');ax.set_title(title,color='white');ax.tick_params(colors='#999');ax.grid(False)
 fig.suptitle(name,color='white');fig.tight_layout();fig.savefig(root/(name+'.png'),dpi=140);plt.close(fig)
(out/'manifest.json').write_text(json.dumps(records,indent=2))
