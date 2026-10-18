import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

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
