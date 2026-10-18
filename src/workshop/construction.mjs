import * as T from 'three';
import {makeBridge,makePickups,makeControls,makeTuners,makeStrings,makeRearCovers,makeFretboard,mergeParts,materials} from '../showroom3d/geometry.mjs';
import {clamp,span} from './sequence.mjs';

// Keep the exact catalog geometry, but retain separate installation groups.
export function makeAppointments(model,state,catalog){
 const group=new T.Group(),boardParts=makeFretboard(state),board=boardParts.children[0],frets=[],inlays=[],nut=new T.Group(),items=[];
 for(const child of [...boardParts.children]){
  if(child===board)continue;
  if(child.geometry?.type==='TubeGeometry')frets.push(child);
  else if(child.material===materials().pearl)inlays.push(child);
  else nut.add(child);
 }
 group.add(board,...frets,...inlays);
 function add(object,start,end,offset){const merged=mergeParts(object);group.add(merged);items.push({object:merged,start,end,offset});return merged;}
 add(makeBridge(state),.02,.15,[140,-40,125]);
 const pickups=makePickups(state,catalog);
 for(const [i,pickup] of [...pickups.children].entries())add(pickup,.16+i*.045,.25+i*.045,[-110,0,130]);
 add(makeControls(model,state),.35,.44,[120,0,100]);
 for(const [i,tuner] of [...makeTuners(state).children].entries())add(tuner,.45+i*.018,.52+i*.018,[(i%2?1:-1)*90,30,95]);
 add(nut,.55,.63,[0,45,80]);
 add(makeRearCovers(model,state),.64,.71,[0,0,-80]);
 const strings=makeStrings(state);
 for(let i=0;i<6;i++){const pair=new T.Group();pair.add(strings.children[0],strings.children[1]);add(pair,.72+i*.027,.80+i*.027,[0,0,40]);}
 const rest=new Map();group.traverse(object=>rest.set(object,object.position.clone()));
 function place(object,p,offset=[0,0,90]){object.visible=p>0;object.position.copy(rest.get(object));object.position.addScaledVector(new T.Vector3(...offset),1-p);}
 function update(stage,p){
  const installed=stage>3,building=stage===3;
  place(board,installed?1:building?span(p,0,.24):0);
  for(const [i,inlay] of inlays.entries())place(inlay,installed?1:building?span(p,.25+i*.022,.39+i*.022):0,[0,0,65]);
  for(const [i,fret] of frets.entries())place(fret,installed?1:building?span(p,.62+i*.009,.70+i*.009):0,[0,0,45]);
  for(const item of items)place(item.object,stage===5?span(p,item.start,item.end):0,item.offset);
 }
 return {group,board,frets,inlays,items,update};
}

export function makeConstructionEffects(scene,{geometry,material}){
 const brass=material(new T.MeshStandardMaterial({color:'#d9bd86',metalness:.75,roughness:.28}));
 const steel=material(new T.MeshStandardMaterial({color:'#b2b7b5',metalness:.8,roughness:.32}));
 const charcoal=material(new T.MeshStandardMaterial({color:'#272f2c',metalness:.4,roughness:.5}));
 const white=material(new T.MeshStandardMaterial({color:'#a9b4ac',roughness:.5,metalness:.2}));
 const light=material(new T.MeshStandardMaterial({color:'#e6f0e9',emissive:'#e6f0e9',emissiveIntensity:2.6}));
 function box(group,w,h,d,mat,x=0,y=0,z=0){const m=new T.Mesh(geometry(new T.BoxGeometry(w,h,d)),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
 function cylinder(group,r,length,mat,x=0,y=0,z=0){const m=new T.Mesh(geometry(new T.CylinderGeometry(r,r,length,20)),mat);m.rotation.x=Math.PI/2;m.position.set(x,y,z);group.add(m);return m;}
 const routing=new T.Group();routing.name='Automatic routing';scene.add(routing);
 const cutter=new T.Group();routing.add(cutter);
 cylinder(cutter,.023,.105,charcoal,0,0,.073);cylinder(cutter,.025,.012,steel,0,0,.13);cylinder(cutter,.008,.024,brass,0,0,.015);cylinder(cutter,.003,.018,steel,0,0,-.003);
 const routeGeometry=geometry(new T.BufferGeometry()),routeMaterial=material(new T.LineBasicMaterial({color:'#edcd87',transparent:true,opacity:.7})),route=new T.Line(routeGeometry,routeMaterial);routing.add(route);
 let routePoints=[],outlineCount=0;
 function configureRouting(body,instrument,pickupY){
  instrument.updateWorldMatrix(true,true);
  const bounds=new T.Box3().setFromObject(body),center=bounds.getCenter(new T.Vector3()),count=128,radii=Array(count).fill(0),sample=new T.Vector3();
  // Radial samples come from the configured CAD, including its handedness.
  body.traverse(mesh=>{if(!mesh.isMesh||['cover','cavity'].includes(mesh.userData.region))return;const position=mesh.geometry.attributes.position;for(let i=0;i<position.count;i++){sample.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);const x=sample.x-center.x,y=sample.y-center.y,a=(Math.atan2(y,x)+Math.PI*2)%(Math.PI*2),bin=Math.floor(a/Math.PI/2*count)%count;radii[bin]=Math.max(radii[bin],Math.hypot(x,y));}});
  for(let i=0;i<count;i++)if(!radii[i]){for(let d=1;d<count;d++){const v=radii[(i+d)%count]||radii[(i-d+count)%count];if(v){radii[i]=v;break;}}}
  routePoints=[];
  for(let i=0;i<=count;i++){const n=i%count,a=(n+.5)/count*Math.PI*2,r=(radii[n]*2+radii[(n+count-1)%count]+radii[(n+1)%count])/4;routePoints.push(new T.Vector3(center.x+Math.cos(a)*r,center.y+Math.sin(a)*r,bounds.max.z+.006));}
  outlineCount=routePoints.length;
  for(const {y,kind} of pickupY){const target=instrument.localToWorld(new T.Vector3(0,y,12));for(let i=0;i<=40;i++){const a=i/40*Math.PI*2;routePoints.push(new T.Vector3(target.x+Math.cos(a)*.038,target.y+Math.sin(a)*(kind==='S'?.008:.017),target.z));}}
  routeGeometry.setAttribute('position',new T.Float32BufferAttribute(routePoints.flatMap(p=>p.toArray()),3));routeGeometry.computeBoundingSphere();
 }
 const chipsGeometry=geometry(new T.BufferGeometry());chipsGeometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(96*3),3));
 const chips=new T.Points(chipsGeometry,material(new T.PointsMaterial({color:'#e3bc7f',size:.003,transparent:true,opacity:.65,depthWrite:false})));chips.frustumCulled=false;routing.add(chips);

 // A separate upright finishing scene: extraction wall, light bars and hanger.
 const booth=new T.Group();booth.name='Spray booth';scene.add(booth);
 box(booth,1.14,.035,1.56,white,0,.24,.78);box(booth,1.14,.61,.026,charcoal,0,0,.013);
 for(const x of [-.57,.57])box(booth,.025,.60,1.56,white,x,0,.78);
 box(booth,1.14,.60,.025,charcoal,0,0,1.55);
 box(booth,.84,.025,.99,charcoal,0,.214,.68);
 for(let i=0;i<19;i++)box(booth,.81,.022,.012,steel,0,.192,.23+i*.05);
 for(const x of [-.48,.48]){box(booth,.035,.045,1.22,charcoal,x,-.04,.79);box(booth,.012,.013,1.18,light,x,-.068,.79);}
 const cable=cylinder(booth,.002,.25,steel,0,0,1.425);
 const hook=new T.Mesh(geometry(new T.TorusGeometry(.019,.002,6,24,Math.PI*1.45)),steel);hook.rotation.x=Math.PI/2;hook.position.set(0,0,1.295);booth.add(hook);
 const spray=new T.Group();booth.add(spray);
 cylinder(spray,.012,.055,steel,0,0,0).rotation.x=0;
 box(spray,.021,.018,.04,charcoal,0,-.012,-.027);
 cylinder(spray,.017,.04,white,0,0,.037);
 const nozzle=cylinder(spray,.005,.02,brass,0,.035,0);nozzle.rotation.x=0;
 const mistGeometry=geometry(new T.BufferGeometry());mistGeometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(160*3),3));
 const mist=new T.Points(mistGeometry,material(new T.PointsMaterial({color:'#e1ece4',size:.012,transparent:true,opacity:.24,depthWrite:false})));mist.frustumCulled=false;booth.add(mist);
 function update(stage,p,time){
  routing.visible=stage===1;booth.visible=stage===4;
  if(routing.visible&&routePoints.length){
   const index=p<.65?clamp(p/.65)*(outlineCount-1):(outlineCount-1)+clamp((p-.65)/.35)*(routePoints.length-outlineCount);
   const a=Math.min(routePoints.length-1,Math.floor(index)),b=Math.min(routePoints.length-1,a+1);cutter.position.copy(routePoints[a]).lerp(routePoints[b],index-a);routeGeometry.setDrawRange(0,a+1);
   const pos=chipsGeometry.attributes.position;
   for(let i=0;i<pos.count;i++){const age=(time*2.7+i*.618)%1,angle=i*2.399;pos.setXYZ(i,cutter.position.x+Math.cos(angle)*age*.065,cutter.position.y+Math.sin(angle)*age*.065,cutter.position.z+Math.sin(age*Math.PI)*.03-age*.025);}
   pos.needsUpdate=true;
  }
  const finish=span(p,.05,.90),boundary=.09+finish*1.13;
  if(booth.visible){
   spray.visible=mist.visible=p>.04&&p<.91;spray.position.set(Math.sin(p*Math.PI*16)*.24,-.26,boundary);
   const pos=mistGeometry.attributes.position;
   for(let i=0;i<pos.count;i++){const age=(time*2.9+i*.618)%1,angle=i*2.399,r=age*.065*Math.sqrt((i%17+1)/17);pos.setXYZ(i,spray.position.x+Math.cos(angle)*r,spray.position.y+.035+age*.24,spray.position.z+Math.sin(angle)*r);}
   pos.needsUpdate=true;
  }
  return boundary;
 }
 return {routing,booth,routeGeometry,mistGeometry,chipsGeometry,configureRouting,update,
  setHangerTop(height){hook.position.z=height+.015;const end=hook.position.z+.019;cable.position.z=(1.55+end)/2;cable.scale.y=(1.55-end)/.25;}
 };
}
