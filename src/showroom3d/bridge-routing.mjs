import * as T from 'three';

// These are display-model routings, in mm relative to the unchanged saddle line.
// A two-point tremolo needs a block slot, not the exposed Floyd fine-tuner recess.
// Manufacturer references and modelling limits: docs/bridge-correction-v46.md.
export function bridgeBodyType(s){return ['hipshot-fixed','toneomatic'].includes(s.bridgeModel)?'standard':'tremolo';}
export function bridgeRoutingKey(s){return ['gotoh-510','hipshot-contour','evertune'].includes(s.bridgeModel)?s.bridgeModel:'original';}
export function bridgeOpening(s,saddleY){
 const spec={
  'gotoh-510':{left:-33,right:33,front:-7.5,back:-27.5,radius:3},
  'hipshot-contour':{left:-34.925,right:44.45,front:-6.8834,back:-28.9814,radius:6.35},
  'evertune':{left:-39,right:39,front:7,back:-64,radius:3}
 }[s.bridgeModel];
 if(!spec)return null;
 const {left,right,front,back,radius:r}=spec,points=[];
 for(const [x,y,a]of [[right-r,front-r,0],[left+r,front-r,90],[left+r,back+r,180],[right-r,back+r,270]])
  for(let i=0;i<=8;i++){const angle=(a+i*90/8)*Math.PI/180;points.push([(x+r*Math.cos(angle))/1000,(saddleY+y+r*Math.sin(angle))/1000]);}
 return points;
}

// Subtract a convex opening from the supplied, original carved top. Clipping
// interpolates the CAD positions/normals, so the carve and grain never become a
// flat cover or an approximate patch. All unrelated triangles are retained.
export function routeCarvedTop(source,opening){
 const p=source.attributes.position,n=source.attributes.normal,ix=source.index;
 const positions=Array.from(p.array),normals=Array.from(n.array),indices=[],wallPositions=[],wallNormals=[];
 const bounds=[0,1].map(j=>[Math.min(...opening.map(v=>v[j])),Math.max(...opening.map(v=>v[j]))]);
 const edges=opening.map((a,i)=>[a,opening[(i+1)%opening.length]]),seen=new Set();
 const side=(v,a,b)=>(b[0]-a[0])*(v.p[1]-a[1])-(b[1]-a[1])*(v.p[0]-a[0]);
 const vertex=i=>({p:[p.getX(i),p.getY(i),p.getZ(i)],n:[n.getX(i),n.getY(i),n.getZ(i)],index:i});
 const lerp=(a,b,t)=>({p:a.p.map((v,j)=>v+(b.p[j]-v)*t),n:a.n.map((v,j)=>v+(b.n[j]-v)*t)});
 function split(poly,a,b){const inside=[],outside=[];for(let i=0;i<poly.length;i++){
  const v=poly[i],next=poly[(i+1)%poly.length],d=side(v,a,b),dn=side(next,a,b),isIn=d>=-1e-14,nextIn=dn>=-1e-14;
  (isIn?inside:outside).push(v);if(isIn!==nextIn){const cross=lerp(v,next,d/(d-dn));inside.push(cross);outside.push(cross);}
 }return {inside,outside};}
 function emit(poly){if(poly.length<3)return;const ids=poly.map(v=>{if(v.index!==undefined)return v.index;v.index=positions.length/3;positions.push(...v.p);const length=Math.hypot(...v.n)||1;normals.push(...v.n.map(x=>x/length));return v.index;});for(let i=1;i<ids.length-1;i++)indices.push(ids[0],ids[i],ids[i+1]);}
 function wall(a,b){if(Math.hypot(b.p[0]-a.p[0],b.p[1]-a.p[1])<1e-9)return;
  const key=[a,b].map(v=>v.p.map(x=>x.toFixed(9)).join(',')).sort().join('|');if(seen.has(key))return;seen.add(key);
  const dx=b.p[0]-a.p[0],dy=b.p[1]-a.p[1],len=Math.hypot(dx,dy),normal=[-dy/len,dx/len,0],bottomA=[a.p[0],a.p[1],-.035],bottomB=[b.p[0],b.p[1],-.035];
  for(const point of [a.p,b.p,bottomB,a.p,bottomB,bottomA]){wallPositions.push(...point);wallNormals.push(...normal);}
 }
 for(let k=0;k<(ix?ix.count:p.count);k+=3){const ids=[0,1,2].map(j=>ix?ix.getX(k+j):k+j),poly=ids.map(vertex);
  if([0,1].some(j=>Math.max(...poly.map(v=>v.p[j]))<bounds[j][0]||Math.min(...poly.map(v=>v.p[j]))>bounds[j][1])){indices.push(...ids);continue;}
  let remainder=poly;
  for(const [a,b]of edges){if(!remainder.length)break;const parts=split(remainder,a,b);emit(parts.outside);remainder=parts.inside;}
  // Only cut-boundary edges receive walls; internal triangle edges do not.
  for(let i=0;i<remainder.length;i++){const a=remainder[i],b=remainder[(i+1)%remainder.length];if(edges.some(([u,v])=>Math.abs(side(a,u,v))<1e-12&&Math.abs(side(b,u,v))<1e-12))wall(a,b);}
 }
 const top=new T.BufferGeometry();top.setAttribute('position',new T.Float32BufferAttribute(positions,3));top.setAttribute('normal',new T.Float32BufferAttribute(normals,3));top.setIndex(indices);top.computeBoundingBox();top.computeBoundingSphere();
 const walls=new T.BufferGeometry();walls.setAttribute('position',new T.Float32BufferAttribute(wallPositions,3));walls.setAttribute('normal',new T.Float32BufferAttribute(wallNormals,3));
 return {top,walls};
}

export function configureBridgeBody(body,standard,s,saddleY){
 const opening=bridgeOpening(s,saddleY);if(!opening)return;
 let originalTop,target;standard.traverse(m=>{if(m.isMesh&&m.material.name==='top')originalTop=m.geometry;});body.traverse(m=>{if(m.isMesh&&m.material.name==='top')target=m;});
 if(!originalTop||!target)throw Error('Original carved top is unavailable');
 const routed=routeCarvedTop(originalTop,opening);target.geometry.dispose();target.geometry=routed.top;
 const walls=new T.Mesh(routed.walls,new T.MeshStandardMaterial({name:'cavity',color:'#3a2517',roughness:.88}));walls.name='Dedicated '+s.bridgeModel+' block routing';target.parent.add(walls);
 body.userData.bridgeRouting=s.bridgeModel;
}
