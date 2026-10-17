import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {Document,NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
const ROOT=process.cwd(),OUT=path.join(ROOT,'public/assets/cad/pickup-layouts');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const normal=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d);};
function topLoops(prim){
 const p=prim.getAttribute('POSITION').getArray(),n=prim.getAttribute('NORMAL').getArray(),ix=prim.getIndices().getArray(),edges=new Map(),points=new Map();
 const key=i=>[0,1,2].map(j=>Math.round(p[i*3+j]*1e7)).join(',');
 for(let k=0;k<ix.length;k+=3)for(let t=0;t<3;t++){const ai=ix[k+t],bi=ix[k+(t+1)%3],a=key(ai),b=key(bi);if(a===b)continue;const e=[a,b].sort().join('|');edges.set(e,(edges.get(e)||0)+1);points.set(a,{p:[...p.slice(ai*3,ai*3+3)].map(v=>v*1000),n:normal([...n.slice(ai*3,ai*3+3)])});}
 const adj=new Map();for(const [e,count]of edges)if(count===1){const[a,b]=e.split('|');if(!adj.has(a))adj.set(a,[]);if(!adj.has(b))adj.set(b,[]);adj.get(a).push(b);adj.get(b).push(a);}
 const visited=new Set(),loops=[];for(const start of adj.keys()){if(visited.has(start))continue;const arr=[];let prev=null,cur=start;while(cur&&!visited.has(cur)){visited.add(cur);arr.push(points.get(cur));const next=adj.get(cur).find(v=>v!==prev&&!visited.has(v));prev=cur;cur=next;}if(arr.length>2)loops.push(arr);}
 return loops;
}
const bounds=p=>[0,1,2].map(j=>[Math.min(...p.map(v=>v.p[j])),Math.max(...p.map(v=>v.p[j]))]);
const area=poly=>Math.abs(poly.reduce((sum,a,i)=>{const b=poly[(i+1)%poly.length];return sum+a.p[0]*b.p[1]-b.p[0]*a.p[1];},0)/2);
function crossings(poly,y){
 const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dy=b.p[1]-a.p[1];if(y<Math.min(a.p[1],b.p[1])-1e-7||y>Math.max(a.p[1],b.p[1])+1e-7)continue;
  if(Math.abs(dy)<1e-10){if(Math.abs(y-a.p[1])<1e-7)out.push(a,b);continue;}
  const t=Math.max(0,Math.min(1,(y-a.p[1])/dy));out.push({p:a.p.map((v,j)=>v+(b.p[j]-v)*t),n:normal(a.n.map((v,j)=>v+(b.n[j]-v)*t))});
 }
 if(!out.length)throw Error('No cross section at '+y);
 out.sort((a,b)=>a.p[0]-b.p[0]);return [out[0],out.at(-1)];
}
function opening(yCenter){const w=78,h=19,r=3,points=[];for(const [cx,cy,angle]of [[w/2-r,h/2-r,0],[-w/2+r,h/2-r,90],[-w/2+r,-h/2+r,180],[w/2-r,-h/2+r,270]])for(let k=0;k<=16;k++){const a=(angle+k*90/16)*Math.PI/180;points.push({p:[cx+r*Math.cos(a),yCenter+cy+r*Math.sin(a),-1],n:[0,0,1]});}return points;}
function createPatch(poly,hole=null){
 const b=bounds(poly),ys=[...poly.map(v=>v.p[1]),...(hole?hole.map(v=>v.p[1]):[])];for(let y=b[1][0]+.5;y<b[1][1];y+=.5)ys.push(y);
 ys.sort((a,b)=>a-b);const rows=ys.filter((y,i)=>!i||y-ys[i-1]>1e-7),hb=hole?bounds(hole):null;
 const positions=[],normals=[],uv=[],indices=[],vertexCache=new Map(),sourcePoints=new Map(poly.map(v=>[v.p[0].toFixed(8)+','+v.p[1].toFixed(8),v]));
 function vertex(x,y){const key=x.toFixed(8)+','+y.toFixed(8);if(vertexCache.has(key))return vertexCache.get(key);const [a,b]=crossings(poly,y),span=b.p[0]-a.p[0],t=span>1e-10?Math.max(0,Math.min(1,(x-a.p[0])/span)):0;let z;
  if(t<1e-8)z=a.p[2];else if(t>1-1e-8)z=b.p[2];else{
   const dzA=-a.n[0]/Math.max(.2,a.n[2]),dzB=-b.n[0]/Math.max(.2,b.n[2]);
   z=(2*t*t*t-3*t*t+1)*a.p[2]+(t*t*t-2*t*t+t)*span*dzA+(-2*t*t*t+3*t*t)*b.p[2]+(t*t*t-t*t)*span*dzB;
   // Do not introduce a hump beyond the neighboring carved surface.
   const low=Math.min(a.p[2],b.p[2])-.3,high=Math.max(a.p[2],b.p[2])+.3;
   if(z<low||z>high)z=a.p[2]+t*(b.p[2]-a.p[2]);
  }
  const exact=sourcePoints.get(key),n=exact?exact.n:normal(a.n.map((v,j)=>v+(b.n[j]-v)*t)),i=positions.length/3;if(exact)z=exact.p[2];positions.push(x/1000,y/1000,z/1000);normals.push(...n);uv.push((y/1000+.26)*2.2,x/1000*2.8+.5);vertexCache.set(key,i);return i;
 }
 function tri(a,b,c){const ap=positions.slice(a*3,a*3+3),bp=positions.slice(b*3,b*3+3),cp=positions.slice(c*3,c*3+3),cross=(bp[0]-ap[0])*(cp[1]-ap[1])-(bp[1]-ap[1])*(cp[0]-ap[0]);if(Math.abs(cross)<1e-16)return;if(cross>0)indices.push(a,b,c);else indices.push(a,c,b);}
 function strip(y0,y1,l0,r0,l1,r1){
  function row(y,l,r){const divisions=Math.max(1,Math.ceil((r-l)/3)),xs=[];for(let i=0;i<=divisions;i++)xs.push(l+(r-l)*i/divisions);for(const v of poly)if(Math.abs(v.p[1]-y)<1e-8&&v.p[0]>=l-1e-8&&v.p[0]<=r+1e-8)xs.push(v.p[0]);xs.sort((a,b)=>a-b);return xs.filter((x,i)=>!i||x-xs[i-1]>1e-8).map(x=>({index:vertex(x,y),t:r-l>1e-9?(x-l)/(r-l):0}));}
  const bottom=row(y0,l0,r0),top=row(y1,l1,r1);let i=0,j=0;
  while(i<bottom.length-1||j<top.length-1){if(j===top.length-1||(i<bottom.length-1&&bottom[i+1].t<=top[j+1].t)){tri(bottom[i].index,bottom[i+1].index,top[j].index);i++;}else{tri(bottom[i].index,top[j+1].index,top[j].index);j++;}}
 }
 for(let k=0;k<rows.length-1;k++){
  const y0=rows[k],y1=rows[k+1];if(y1-y0<1e-7)continue;const [l0,r0]=crossings(poly,y0),[l1,r1]=crossings(poly,y1),mid=(y0+y1)/2;
  if(hole&&mid>hb[1][0]&&mid<hb[1][1]){const[hL0,hR0]=crossings(hole,y0),[hL1,hR1]=crossings(hole,y1);strip(y0,y1,l0.p[0],hL0.p[0],l1.p[0],hL1.p[0]);strip(y0,y1,hR0.p[0],r0.p[0],hR1.p[0],r1.p[0]);}
  else strip(y0,y1,l0.p[0],r0.p[0],l1.p[0],r1.p[0]);
 }
 let actualArea=0;for(let i=0;i<indices.length;i+=3){const[a,b,c]=indices.slice(i,i+3).map(i=>positions.slice(i*3,i*3+3));actualArea+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))*500000;}
 let maxBoundaryDistanceMm=0,maxBoundaryNormalError=0;for(const v of poly){let best=Infinity,bestIndex=0;for(let i=0;i<positions.length;i+=3){const d=Math.hypot(...v.p.map((x,j)=>x-positions[i+j]*1000));if(d<best){best=d;bestIndex=i;}}maxBoundaryDistanceMm=Math.max(maxBoundaryDistanceMm,best);maxBoundaryNormalError=Math.max(maxBoundaryNormalError,Math.hypot(...v.n.map((x,j)=>x-normals[bestIndex+j])));}
 const expectedArea=area(poly)-(hole?area(hole):0),report={vertices:positions.length/3,triangles:indices.length/3,projectedAreaMm2:actualArea,expectedAreaMm2:expectedArea,areaErrorMm2:Math.abs(actualArea-expectedArea),maxBoundaryDistanceMm,maxBoundaryNormalError,negativeSourceNormalCount:poly.filter(v=>v.n[2]<0).length,sourceBoundaryVertices:poly.length,boundsMm:b,holeMm:hole?{width:78,height:19,radius:3}:null};
 if(report.areaErrorMm2>.01||maxBoundaryDistanceMm>.001)throw Error('Patch continuity failure: '+JSON.stringify(report));
 return {positions:new Float32Array(positions),normals:new Float32Array(normals),uv:new Float32Array(uv),indices:new Uint32Array(indices),report};
}
const report={formatVersion:1,sourceUnits:'metres; use scale=1000 inside the existing millimetre guitar group',material:'Reuse the body top material and configureUV(mesh,"top")',neckYmm:86.51256576,bridgeYmm:-10.437434,files:{}};
for(const model of ['sphyx','oryx','matadaur'])for(const bridge of ['standard','tremolo']){
 const name=model+'_'+bridge,file=path.join(ROOT,'public/assets/cad',name+'.glb'),source=await io.read(file),prim=source.getRoot().listMeshes()[0].listPrimitives().find(p=>p.getMaterial().getName()==='top'),loops=topLoops(prim);
 const find=(x,y)=>loops.filter(p=>p.length<500).find(p=>{const b=bounds(p);return x>b[0][0]&&x<b[0][1]&&y>b[1][0]&&y<b[1][1];});
 const bridgeHole=find(0,-10.437434),outline=loops.find(p=>p.length>500),neck=outline.filter(v=>Math.abs(v.p[0])<=44.51&&v.p[1]>=65.5125&&v.p[1]<=107.51258);
 const specs={neck_full:[neck],neck_single:[neck,opening(86.51256576)],bridge_single:[bridgeHole,opening(-10.437434)],control_1:[find(108,-100)],control_3:[find(model==='matadaur'?108:106,-153)],switch:[find(86.63,-79.37)]};
 const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene('Pickup layout fills'),material=doc.createMaterial('top').setBaseColorFactor([.6,.35,.2,1]).setRoughnessFactor(.4),patches={};
 for(const [patch,args]of Object.entries(specs)){
  if(!args[0])throw Error('Missing boundary '+name+' '+patch);const data=createPatch(...args),mesh=doc.createMesh(patch),primitive=doc.createPrimitive();
  primitive.setAttribute('POSITION',doc.createAccessor(patch+' positions').setType('VEC3').setArray(data.positions).setBuffer(buffer));primitive.setAttribute('NORMAL',doc.createAccessor(patch+' normals').setType('VEC3').setArray(data.normals).setBuffer(buffer));primitive.setAttribute('TEXCOORD_0',doc.createAccessor(patch+' UV').setType('VEC2').setArray(data.uv).setBuffer(buffer));primitive.setIndices(doc.createAccessor(patch+' triangles').setType('SCALAR').setArray(data.indices).setBuffer(buffer));primitive.setMaterial(material);mesh.addPrimitive(primitive);scene.addChild(doc.createNode(patch).setMesh(mesh));patches[patch]=data.report;
 }
 const out=path.join(OUT,name+'_pickup_fills.glb');await io.write(out,doc);report.files[name]={sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),output:path.basename(out),bytes:fs.statSync(out).size,patches};console.log(name,fs.statSync(out).size,JSON.stringify(Object.fromEntries(Object.entries(patches).map(([k,v])=>[k,{vertices:v.vertices,areaError:v.areaErrorMm2,boundaryError:v.maxBoundaryDistanceMm,normalError:v.maxBoundaryNormalError,negativeSourceNormals:v.negativeSourceNormalCount}]))));
}
fs.writeFileSync(path.join(ROOT,'scripts/cad/pickup-layouts/verification.json'),JSON.stringify(report,null,2));
