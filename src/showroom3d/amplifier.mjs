import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// An original Fostinis cabinet. All dimensions are metres; it is showroom
// furniture, so it is excluded from completed guitar images and shared builds.
export function createShowroomAmp(parent,signature){
 const group=new T.Group();group.name='Fostinis signature amplifier';group.userData.playroom=true;group.position.set(.97,0,.06);group.rotation.y=-.15;parent.add(group);
 const black=new T.MeshStandardMaterial({color:'#171719',roughness:.9}),chrome=new T.MeshStandardMaterial({color:'#bdb7a9',metalness:.8,roughness:.28}),panel=new T.MeshStandardMaterial({color:'#242324',metalness:.6,roughness:.45}),ivory=new T.MeshStandardMaterial({color:'#e9d4ac',roughness:.45});
 function mesh(geometry,material,pos,name){const m=new T.Mesh(geometry,material);m.position.set(...pos);m.name=name;m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
 function box(size,pos,mat,name,r=.004){return mesh(new RoundedBoxGeometry(...size,2,r),mat,pos,name);}
 box([.46,.46,.255],[0,.26,0],black,'Textured combo cabinet',.015);
 const size=64,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,v=((x+y)%3===0?110:48);data[i]=v;data[i+1]=v-5;data[i+2]=v-9;data[i+3]=255;}
 const weave=new T.DataTexture(data,size,size);weave.wrapS=weave.wrapT=T.RepeatWrapping;weave.repeat.set(5,4);weave.needsUpdate=true;
 const cloth=new T.MeshStandardMaterial({map:weave,color:'#a39b89',roughness:1});
 box([.418,.299,.01],[0,.202,.132],cloth,'Woven speaker grille');
 box([.42,.072,.012],[0,.407,.136],panel,'Brushed control panel');
 for(const x of [-.225,.225])for(const y of [.055,.465])box([.024,.033,.04],[x,y,.12],chrome,'Metal corner',.003);
 for(const x of [-.17,.17])box([.04,.026,.16],[x,.019,0],black,'Rubber foot');
 box([.16,.018,.032],[0,.517,0],black,'Carry handle');for(const x of [-.09,.09])box([.025,.04,.032],[x,.499,0],chrome,'Handle mount');
 for(let i=0;i<5;i++){
  const knob=mesh(new T.CylinderGeometry(.014,.014,.014,20),ivory,[-.14+i*.05,.407,.155],'Control knob');knob.rotation.x=Math.PI/2;
  box([.002,.008,.002],[-.14+i*.05,.412,.164],black,'Knob marker',.0005);
 }
 for(let i=0;i<5;i++){
  const x=.12+i*.015;box([.003,.043,.002],[x,.407,.145],black,'EQ track',.001);
  box([.012,.007,.006],[x,.407+Math.abs(i-2)*.007,.151],ivory,'EQ slider',.001);
 }
 const ledMaterial=new T.MeshStandardMaterial({color:'#692d21',emissive:'#ff8b48',emissiveIntensity:0});
 mesh(new T.SphereGeometry(.004,10,8),ledMaterial,[-.191,.423,.15],'Power light');
 const jack=mesh(new T.CylinderGeometry(.008,.008,.008,18),chrome,[-.191,.398,.15],'Input jack');jack.rotation.x=Math.PI/2;
 const logo=new T.Mesh(new T.PlaneGeometry(.21,.167),new T.MeshStandardMaterial({map:signature,transparent:true,alphaTest:.1,depthWrite:false,metalness:.25,roughness:.5,side:T.FrontSide}));logo.position.set(0,.25,.143);logo.name='Fostinis signature badge';group.add(logo);
 const cableMaterial=new T.MeshStandardMaterial({color:'#111213',roughness:.8});let cable;
 function setConnected(connected,rec){
  ledMaterial.emissiveIntensity=connected?2.3:0;
  if(cable){parent.remove(cable);cable.geometry.dispose();cable=null;}
  if(!connected||!rec)return;
  group.updateWorldMatrix(true,false);rec.group.updateWorldMatrix(true,false);
  const start=group.localToWorld(new T.Vector3(-.191,.398,.168)),end=rec.group.localToWorld(new T.Vector3(125,-163,12));
  // Furniture is rooted at the scene origin, matching the room's coordinates.
  const curve=new T.CatmullRomCurve3([start,new T.Vector3(start.x-.04,.17,.28),new T.Vector3(.67,.025,.39),new T.Vector3(.23,.025,.5),new T.Vector3(end.x+.12,.025,.28),new T.Vector3(end.x+.045,end.y-.09,end.z+.075),end]);
  cable=new T.Mesh(new T.TubeGeometry(curve,48,.004,7,false),cableMaterial);cable.name='Connected guitar cable';cable.castShadow=true;parent.add(cable);
 }
 return {group,setConnected};
}

function cabinetCloth(speakers){
 const size=256,data=new Uint8Array(size*size*4),rows=speakers===4?2:1;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size;
  let cone=0;
  for(const cx of [.25,.75])for(let row=0;row<rows;row++){
   const radius=Math.hypot((u-cx)*2,(v-(row+.5)/rows)*rows);
   cone=Math.max(cone,radius<.43?(radius<.12?.28:radius>.36?.65:.4):0);
  }
  const weave=(x+y)%3===0?91:47,value=Math.round(weave*(1-cone)),i=(y*size+x)*4;
  data[i]=value;data[i+1]=value-3;data[i+2]=value-7;data[i+3]=255;
 }
 const texture=new T.DataTexture(data,size,size);texture.colorSpace=T.SRGBColorSpace;texture.needsUpdate=true;
 return new T.MeshStandardMaterial({map:texture,color:'#b9ad95',roughness:.94});
}

// Match the compact signature combo: black covering, woven grille, ivory
// controls, chrome corners, and the owner's existing Fostinis signature.
export function createShowroomBackline(parent,signature){
 const group=new T.Group();group.name='Fostinis lounge and wall cabinets';group.userData.playroom=true;parent.add(group);
 const M={black:new T.MeshStandardMaterial({color:'#171719',roughness:.87}),panel:new T.MeshStandardMaterial({color:'#27272a',metalness:.55,roughness:.4}),chrome:new T.MeshStandardMaterial({color:'#bdb7a9',metalness:.8,roughness:.28}),ivory:new T.MeshStandardMaterial({color:'#e9d4ac',roughness:.45}),piping:new T.MeshStandardMaterial({color:'#9c8663',metalness:.55,roughness:.42}),dark:new T.MeshStandardMaterial({color:'#08090a',roughness:.86}),cloth4:cabinetCloth(4),cloth2:cabinetCloth(2),glow:new T.MeshStandardMaterial({color:'#eeb775',emissive:'#ffae5d',emissiveIntensity:1.8}),logo:new T.MeshStandardMaterial({map:signature,transparent:true,alphaTest:.1,depthWrite:false,metalness:.25,roughness:.5,side:T.FrontSide})};
 function mesh(g,geometry,mat,pos,name){const m=new T.Mesh(geometry,mat);m.position.set(...pos);m.name=name;m.receiveShadow=true;g.add(m);return m;}
 const box=(g,size,pos,mat,name,r=.007)=>mesh(g,new RoundedBoxGeometry(...size,2,Math.min(r,...size.map(n=>n*.4))),mat,pos,name);
 function logo(g,y,z,width=.30){return mesh(g,new T.PlaneGeometry(width,width*188/240),M.logo,[0,y,z],'Fostinis signature badge');}
 function handle(g,width,y,depth){
  box(g,[width,.019,.045],[0,y+.045,0],M.black,'Carry handle');
  for(const x of [-width/2,width/2])box(g,[.026,.045,.05],[x,y+.027,0],M.chrome,'Handle mount');
 }
 function cabinet(g,{width=.76,height=.78,depth=.35,y=0,speakers=4}={}){
  const center=y+height/2+.035,front=depth/2;
  box(g,[width,height,depth],[0,center,0],M.black,speakers+' speaker cabinet',.022);
  box(g,[width-.045,height-.045,.012],[0,center,front+.004],M.piping,'Champagne grille piping');
  box(g,[width-.06,height-.06,.014],[0,center,front+.014],speakers===4?M.cloth4:M.cloth2,'Woven speaker grille');
  for(const x of [-width/2+.012,width/2-.012])for(const cy of [y+.063,y+height+.008])box(g,[.035,.045,.05],[x,cy,front-.008],M.chrome,'Cabinet corner',.006);
  for(const x of [-width*.34,width*.34])for(const z of [-depth*.32,depth*.32])box(g,[.055,.035,.055],[x,y+.018,z],M.black,'Rubber cabinet foot');
  for(const x of [-width/2-.003,width/2+.003]){
   box(g,[.008,.17,.10],[x,center,0],M.panel,'Recessed side handle');
   box(g,[.017,.10,.016],[x,center,0],M.chrome,'Side grip');
  }
  logo(g,center+height*.17,front+.025,Math.min(.32,width*.44));
  return y+height+.035;
 }
 function head(g,width,y){
  box(g,[width,.22,.285],[0,y+.13,0],M.black,'Fostinis signature amplifier head',.017);
  box(g,[width-.045,.105,.015],[0,y+.173,.148],M.cloth2,'Head grille');
  box(g,[width-.04,.07,.015],[0,y+.074,.149],M.panel,'Brushed amplifier control panel');
  logo(g,y+.171,.162,.15);
  for(let i=0;i<6;i++){
   const x=-width*.34+i*width*.087,knob=mesh(g,new T.CylinderGeometry(.013,.013,.015,16),M.ivory,[x,y+.074,.168],'Ivory amplifier control');knob.rotation.x=Math.PI/2;
   box(g,[.002,.007,.002],[x,y+.079,.177],M.dark,'Control marker',.0005);
  }
  for(let i=0;i<5;i++){
   const x=width*.23+i*.018;box(g,[.003,.046,.003],[x,y+.075,.160],M.dark,'Graphic EQ track',.001);
   box(g,[.012,.007,.006],[x,y+.068+Math.abs(i-2)*.008,.166],M.ivory,'Graphic EQ slider',.001);
  }
  mesh(g,new T.SphereGeometry(.005,10,8),M.glow,[-width*.435,y+.087,.164],'Warm power indicator');
  const jack=mesh(g,new T.CylinderGeometry(.008,.008,.01,12),M.chrome,[-width*.435,y+.06,.164],'Input jack');jack.rotation.x=Math.PI/2;
  for(const x of [-width/2+.012,width/2-.012])for(const cy of [y+.045,y+.215])box(g,[.03,.035,.04],[x,cy,.13],M.chrome,'Head corner',.004);
  handle(g,.18,y+.24);
 }
 function fixture(name,position,rotation,kind){
  const rig=new T.Group();rig.name=name;rig.userData.playroom=true;rig.position.set(...position);rig.rotation.y=rotation;group.add(rig);
  box(rig,[.96,.035,.60],[0,.018,0],M.dark,'Cabinet display plinth',.012);
  box(rig,[.82,.007,.008],[0,.036,.296],M.glow,'Warm plinth accent',.002);
  if(kind==='double'){
   const top=cabinet(rig,{y:.035,height:.76});const upper=cabinet(rig,{y:top,height:.76});head(rig,.71,upper+.01);
  }else if(kind==='stack'){
   const top=cabinet(rig,{y:.035,height:.76});head(rig,.71,top+.01);
  }else{
   const top=cabinet(rig,{y:.035,width:.72,height:.44,speakers:2});head(rig,.68,top+.01);
  }
  // Batch the many small fittings into one draw per material per rig. Keep
  // transparent signature planes separate so their lettering remains crisp.
  rig.updateWorldMatrix(true,true);const inverse=rig.matrixWorld.clone().invert(),batches=new Map(),remove=[];
  rig.traverse(m=>{if(!m.isMesh||m.material.transparent)return;let batch=batches.get(m.material);if(!batch)batches.set(m.material,batch=[]);const geometry=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,m.matrixWorld));batch.push(geometry);remove.push(m);});
  for(const m of remove){m.removeFromParent();m.geometry.dispose();}
  for(const [material,geometries]of batches){const merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());if(merged)mesh(rig,merged,material,[0,0,0],name+' details');}
  return rig;
 }
 const rigs=[
  fixture('Lounge 2×12 signature rig',[-2.65,0,4.03],Math.PI-.12,'small'),
  fixture('Couch-side 4×12 signature stack',[2.42,0,4.83],Math.PI+.12,'stack'),
  fixture('West wall signature full stack',[-4.94,0,-.65],Math.PI/2,'double'),
  fixture('East wall signature full stack',[4.94,0,-.65],-Math.PI/2,'double')
 ];
 return {group,rigs};
}
