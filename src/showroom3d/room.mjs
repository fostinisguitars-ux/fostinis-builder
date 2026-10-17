import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Metres. The display and the camera occupy the clear centre of the room;
// furniture belongs to the perimeter, never to the rotating guitar assemblies.
export const ROOM = Object.freeze({width:10.8,depth:11.2,height:3.3});

function surface(kind,size=128){
 const data=new Uint8Array(size*size*4);let seed=4831;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  seed=(1664525*seed+1013904223)>>>0;const noise=seed/4294967296;
  const weave=(Math.sin(x*Math.PI/2)*Math.cos(y*Math.PI/2)+1)*.5;
  const value=kind==='weave'?130+weave*64+noise*20:kind==='leather'?172+noise*45+Math.sin(x*.6+y*.7)*8:185+noise*30;
  const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
 }
 const t=new T.DataTexture(data,size,size);t.wrapS=t.wrapT=T.RepeatWrapping;t.needsUpdate=true;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;
 t.repeat.set(kind==='leather'?4:kind==='weave'?10:3,kind==='leather'?4:kind==='weave'?10:3);return t;
}
function photo(url,repeat=[1,1],offset=[0,0]){
 const t=new T.TextureLoader().load(url);t.name=url;t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(...repeat);t.offset.set(...offset);return t;
}
function mesh(g,geometry,material,position,name){const m=new T.Mesh(geometry,material);m.position.set(...position);m.name=name||material.name;m.receiveShadow=true;g.add(m);return m;}
function box(g,size,pos,mat,r=.004,name){return mesh(g,r?new RoundedBoxGeometry(...size,2,Math.min(r,...size.map(v=>v*.45))):new T.BoxGeometry(...size),mat,pos,name);}
function cylinder(g,rTop,rBottom,height,pos,mat,segments=32){return mesh(g,new T.CylinderGeometry(rTop,rBottom,height,segments),mat,pos);}
function line(g,points,r,mat){return mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(12,points.length*6),r,6,false),mat,[0,0,0]);}
function part(g,name){const p=new T.Group();p.name=name;g.add(p);return p;}
function standard(name,color,properties={}){const m=new T.MeshStandardMaterial({color,roughness:.65,...properties});m.name=name;return m;}
function contact(g,x,z,w,d,opacity=.28){
 const size=64,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const q=Math.pow(Math.max(0,1-Math.hypot((x-31.5)/31.5,(y-31.5)/31.5)),1.8);data[(y*size+x)*4+3]=Math.round(q*255);}
 const t=new T.DataTexture(data,size,size);t.needsUpdate=true;t.magFilter=T.LinearFilter;t.minFilter=T.LinearFilter;
 const mat=new T.MeshBasicMaterial({color:'#090705',map:t,transparent:true,opacity,depthWrite:false});mat.name='Soft contact shadow';
 const s=mesh(g,new T.PlaneGeometry(w,d),mat,[x,.023,z]);s.rotation.x=-Math.PI/2;s.renderOrder=1;return s;
}
function lamp(g,x,z,M){
 cylinder(g,.18,.19,.028,[x,.035,z],M.black);
 cylinder(g,.012,.012,1.63,[x,.85,z],M.brass,12);
 const shade=mesh(g,new T.CylinderGeometry(.17,.25,.32,48,1,true),M.shade,[x,1.68,z]);shade.material.side=T.DoubleSide;
 cylinder(g,.23,.23,.006,[x,1.519,z],M.glow,40);
 const light=new T.PointLight('#ffc98e',10,2.8,2);light.position.set(x,1.49,z);g.add(light);
 contact(g,x,z,.6,.6,.18);
}
function plant(g,x,z,M){
 const p=part(g,'Olive tree');p.position.set(x,0,z);
 cylinder(p,.23,.17,.4,[0,.21,0],M.planter,40);cylinder(p,.216,.216,.012,[0,.41,0],M.soil);
 line(p,[[0,.4,0],[.015,.8,.01],[-.025,1.2,.015],[.02,1.85,-.01]],.014,M.branch);
 const leafGeometry=new T.SphereGeometry(1,8,6),leaves=new T.InstancedMesh(leafGeometry,M.leaf,150),dummy=new T.Object3D();let index=0;
 for(let b=0;b<10;b++){
  const a=b*2.399,y=.92+b*.085,end=[Math.cos(a)*(.27+b*.012),y+.32,Math.sin(a)*(.26+b*.012)];
  line(p,[[0,y-.15,0],[end[0]*.55,y+.02,end[2]*.55],end],.0045,M.branch);
  for(let i=0;i<15;i++){
   const t=.15+i*.055,sign=i%2?1:-1;
   dummy.position.set(end[0]*t+Math.cos(a+1.5)*sign*.06,y-.11+.44*t+Math.sin(i*2.7)*.04,end[2]*t+Math.sin(a+1.5)*sign*.06);
   dummy.rotation.set(.4+i*.7,a+i*.27,.7);dummy.scale.set(.018,.065,.006);dummy.updateMatrix();leaves.setMatrixAt(index++,dummy.matrix);
  }
 }
 leaves.name='Olive leaves';p.add(leaves);contact(g,x,z,.8,.8,.24);
}

function makeWorkshop(g,M){
 const w=part(g,'Luthier workshop');
 // The original workshop photograph lives at the back of a recessed, glazed bay.
 // Texture coordinates isolate the existing workshop, without its foreground floor.
 const backdrop=photo('/assets/room.jpg',[.585,.405],[.208,.428]);
 const imageMat=new T.MeshBasicMaterial({map:backdrop,toneMapped:false});imageMat.name='Original workshop photograph';
 mesh(w,new T.PlaneGeometry(7.9,2.79),imageMat,[0,1.465,-5.51],'Workshop interior beyond glass');
 for(const x of [-4.05,4.05])box(w,[.19,2.96,.66],[x,1.48,-5.24],M.walnut,.008,'Deep walnut window jamb');
 box(w,[8.3,.17,.68],[0,2.98,-5.23],M.walnut,.008,'Workshop lintel');
 box(w,[8.3,.085,.68],[0,.044,-5.23],M.walnut,.003,'Workshop threshold');
 box(w,[8.05,.012,.025],[0,2.885,-4.91],M.glow,.002,'Workshop warm cove');
 // Slender glazing bars have real depth and cast a different parallax than the image.
 for(const x of [-3.98,-2.12,2.12,3.98])box(w,[.035,2.81,.06],[x,1.47,-4.915],M.black,.003,'Bronze glazing mullion');
 for(const y of [.065,2.88])box(w,[8.02,.028,.06],[0,y,-4.915],M.black,.002);
 // Very restrained glass reflection: a clear view of the familiar workbench.
 const glass=new T.MeshPhysicalMaterial({color:'#e8e2d7',metalness:.05,roughness:.12,transparent:true,opacity:.035,depthWrite:false,side:T.DoubleSide,envMapIntensity:.35});glass.name='Clear workshop glazing';
 mesh(w,new T.PlaneGeometry(7.9,2.77),glass,[0,1.47,-4.9]);
 for(const x of [-4.75,4.75]){
  box(w,[.75,2.58,.055],[x,1.38,-5.51],M.walnut,.006,'Workshop side panel');
  for(let i=0;i<10;i++)box(w,[.026,2.55,.035],[x-.32+i*.071,1.38,-5.46],M.oak,.002);
  box(w,[.55,.025,.3],[x,1.12,-5.3],M.walnut,.005,'Display shelf');
  box(w,[.55,.008,.02],[x,1.098,-5.16],M.glow,.001);
  cylinder(w,.11,.08,.22,[x,1.24,-5.3],M.ceramic);
 }
 const light=new T.PointLight('#ffce98',16,4.1,2);light.position.set(0,2.65,-4.8);w.add(light);
 return w;
}

function makeLounge(g,M){
 const lounge=part(g,'Listening lounge');
 // A low, full-size three-seat sofa, outside the orbit/camera clearance.
 const sofa=part(lounge,'Leather sofa');sofa.position.set(-.6,0,4.95);
 for(const x of [-1.49,1.49])for(const z of [-.34,.31])cylinder(sofa,.024,.019,.14,[x,.08,z],M.brass,16);
 box(sofa,[3.28,.26,.96],[0,.27,0],M.leather,.095,'Upholstered sofa base');
 box(sofa,[3.22,.58,.2],[0,.65,.35],M.leather,.075,'Sofa back');
 for(const x of [-1.57,1.57])box(sofa,[.24,.42,.93],[x,.52,-.015],M.leather,.09,'Sofa arm');
 for(const x of [-1.0,0,1.0]){
  box(sofa,[.965,.18,.71],[x,.48,-.085],M.seat,.065,'Seat cushion');
  const back=box(sofa,[.965,.44,.18],[x,.72,.20],M.seat,.075,'Back cushion');back.rotation.x=.1;
  // Fine welting follows the seat and is barely raised from the leather.
  line(sofa,[[x-.40,.515,.235],[x-.46,.515,.17],[x-.46,.515,-.34],[x-.40,.515,-.405],[x+.40,.515,-.405],[x+.46,.515,-.34],[x+.46,.515,.17],[x+.40,.515,.235]],.0022,M.stitch);
 }
 for(const [x,rot]of [[-1.25,.18],[1.25,-.15]]){const cushion=box(sofa,[.37,.38,.14],[x,.72,-.005],M.fabric,.075,'Linen pillow');cushion.rotation.z=rot;cushion.rotation.x=.16;}
 contact(lounge,-.6,4.94,4.0,1.6,.45);
 // Rug and stone table sit beyond the clear central viewing area.
 box(lounge,[4.42,.012,1.7],[-.6,.009,4.5],M.rug,.035,'Woven lounge rug');
 const table=part(lounge,'Stone coffee table');table.position.set(-.6,0,4.12);
 for(const x of [-.52,.52])cylinder(table,.13,.16,.31,[x,.18,0],M.brass,40);
 box(table,[1.7,.055,.62],[0,.365,0],M.stone,.105,'Rounded dark stone tabletop');
 contact(lounge,-.6,4.12,2.0,.95,.24);
 box(table,[.30,.026,.22],[-.34,.409,.02],M.book,.005,'Workshop journal');
 box(table,[.302,.005,.222],[-.34,.425,.02],M.walnut,.002);
 cylinder(table,.15,.15,.012,[.40,.401,-.015],M.black,40);
 for(const x of [.34,.47]){cylinder(table,.036,.031,.065,[x,.44,-.015],M.ceramic,24);cylinder(table,.030,.03,.002,[x,.474,-.015],M.coffee,24);}
 // A timber wall with a quiet central artwork gives the seating area a destination.
 box(lounge,[4.3,2.6,.06],[-.6,1.5,5.53],M.walnut,.005,'Lounge walnut feature wall');
 for(const x of [-2.76,1.56])box(lounge,[.012,2.54,.02],[x,1.52,5.487],M.glow,.001);
 const signature=photo('/assets/fostinis-headstock-signature.jpg');
 const art=new T.MeshBasicMaterial({map:signature,color:'#c6b693',toneMapped:false});art.name='Fostinis signature wall art';
 box(lounge,[1.55,1.27,.055],[-.6,2.01,5.465],M.brass,.006,'Brass artwork frame');
 const sign=mesh(lounge,new T.PlaneGeometry(1.5,1.22),art,[-.6,2.01,5.43]);sign.rotation.y=Math.PI;
 lamp(lounge,1.75,4.9,M);plant(lounge,-3.28,4.95,M);
 const light=new T.SpotLight('#ffdcad',38,5.5,.98,.82,2);light.position.set(-1.9,3.08,3.65);light.target.position.set(-.6,.45,4.9);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.near=.1;light.shadow.camera.far=6;light.shadow.bias=-.00015;light.shadow.normalBias=.003;light.shadow.radius=3;lounge.add(light,light.target);
 return lounge;
}

function makeEntrance(g,M){
 const entrance=part(g,'Entrance door');entrance.position.set(3.72,0,5.48);
 // The partially open leaf reveals a lit entry recess, not another guitar image.
 box(entrance,[1.18,2.48,.025],[0,1.24,.1],M.entrance,.002,'Warm entry recess');
 for(const x of [-.66,.66])box(entrance,[.095,2.59,.19],[x,1.295,0],M.walnut,.004,'Door jamb');
 box(entrance,[1.41,.09,.19],[0,2.60,0],M.walnut,.004,'Door header');
 box(entrance,[1.25,.009,.05],[0,2.53,-.10],M.glow,.001);
 box(entrance,[1.32,.025,.35],[0,.015,-.04],M.stone,.003,'Door threshold');
 const leaf=part(entrance,'Open walnut door');leaf.position.set(-.596,0,-.08);leaf.rotation.y=.20;
 box(leaf,[1.17,2.48,.055],[.585,1.26,0],M.walnut,.006,'Walnut door leaf');
 for(let i=0;i<16;i++)box(leaf,[.011,2.26,.005],[.065+i*.069,1.26,-.032],M.oak,.001);
 for(const y of [.45,2.07])cylinder(leaf,.012,.012,.09,[-.008,y,-.02],M.brass,12);
 box(leaf,[.026,.31,.026],[1.02,1.18,-.074],M.brass,.007,'Brass door pull');
 for(const y of [1.06,1.30])box(leaf,[.02,.02,.04],[1.02,y,-.055],M.brass,.004);
 box(entrance,[.10,.36,.06],[-.96,1.70,-.08],M.brass,.025,'Entrance sconce');
 box(entrance,[.075,.30,.01],[-.96,1.70,-.12],M.glow,.02);
 return entrance;
}

// Static architecture is merged per material within each zone, keeping mobile
// draw calls down. Transparent glazing and instanced foliage remain independent.
function batchZone(zone){
 zone.updateMatrixWorld(true);const inverse=zone.matrixWorld.clone().invert(),groups=new Map(),remove=[];
 zone.traverse(m=>{if(!m.isMesh||m.isInstancedMesh||m.material.transparent)return;const key=m.material.uuid;if(!groups.has(key))groups.set(key,{mat:m.material,geometries:[]});const geometry=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,m.matrixWorld));groups.get(key).geometries.push(geometry);remove.push(m);});
 for(const m of remove){m.removeFromParent();m.geometry.dispose();}
 for(const {mat,geometries}of groups.values()){const merged=mergeGeometries(geometries);for(const geo of geometries)geo.dispose();if(merged){const m=mesh(zone,merged,mat,[0,0,0],zone.name+' · '+mat.name);m.castShadow=zone.name==='Listening lounge';}}
}

export function makeRoom(g){
 const walnut=photo('/assets/wood-real19-walnut.jpg',[2,4]);
 const M={
  black:standard('Satin black metal','#171a19',{metalness:.65,roughness:.3}),
  brass:standard('Brushed aged brass','#a98b57',{metalness:.82,roughness:.29}),
  walnut:standard('Walnut joinery','#695e50',{map:walnut,roughness:.38}),
  oak:standard('Timber fluting','#5d4733',{roughness:.5}),
  wall:standard('Warm charcoal plaster','#393731',{bumpMap:surface('plaster'),bumpScale:.003}),
  ceiling:standard('Dark plaster ceiling','#302d27'),
  floor:standard('Honed limestone floor','#3a342e',{roughness:.53,metalness:.025,bumpMap:surface('stone'),bumpScale:.0015}),
  seam:standard('Stone floor joints','#2e2b26'),
  leather:standard('Cognac leather','#79503a',{roughness:.48,bumpMap:surface('leather'),bumpScale:.0013}),
  seat:standard('Soft leather cushions','#986b4c',{roughness:.56,bumpMap:surface('leather'),bumpScale:.0011}),
  stitch:standard('Leather piping','#674631'),
  fabric:standard('Natural linen cushions','#a89c80',{bumpMap:surface('weave'),bumpScale:.0018,roughness:.94}),
  rug:standard('Woven wool rug','#7e7464',{bumpMap:surface('weave'),bumpScale:.002,roughness:1}),
  stone:standard('Dark polished stone','#252622',{roughness:.25,metalness:.06,bumpMap:surface('stone'),bumpScale:.0007}),
  ceramic:standard('Ivory ceramic','#c6bda7',{roughness:.27}),
  coffee:standard('Coffee','#1a0d06',{roughness:.23}),
  book:standard('Journal pages','#bcb5a3'),
  glow:standard('Warm architectural lighting','#fff1ca',{emissive:'#ffc68b',emissiveIntensity:2.4,roughness:.45}),
  shade:standard('Warm linen lampshade','#af9f7d',{roughness:1}),
  planter:standard('Bronze ceramic planter','#494d42',{roughness:.58,metalness:.1}),
  soil:standard('Plant soil','#17130d',{roughness:1}),
  branch:standard('Olive bark','#554a37'),
  leaf:standard('Olive foliage','#66744c',{roughness:.85}),
  entrance:standard('Lit entrance beyond door','#d0b584',{emissive:'#cf9e59',emissiveIntensity:.35})
 };
 const architecture=part(g,'Showroom architecture');
 const floor=mesh(architecture,new T.PlaneGeometry(ROOM.width,ROOM.depth),M.floor,[0,0,0]);floor.rotation.x=-Math.PI/2;
 for(let x=-4.5;x<=4.5;x+=1.5)box(architecture,[.002,.001,11.2],[x,.001,0],M.seam,0);
 for(let z=-4.5;z<=4.5;z+=1.5)box(architecture,[10.8,.001,.002],[0,.001,z],M.seam,0);
 box(architecture,[10.9,.10,11.3],[0,3.35,0],M.ceiling,0,'Ceiling');
 for(const z of [-5.65,5.65])box(architecture,[10.9,3.4,.1],[0,1.7,z],M.wall,0);
 for(const x of [-5.45,5.45])box(architecture,[.1,3.4,11.3],[x,1.7,0],M.wall,0);
 // Low plinths, continuous cove light and periodic acoustic timber panels.
 for(const side of [-1,1]){
  box(architecture,[.06,.14,11.2],[side*5.365,.07,0],M.walnut,.002);
  box(architecture,[.016,.016,11.12],[side*5.30,3.16,0],M.glow,.002);
  box(architecture,[10.65,.14,.06],[0,.07,side*5.565],M.walnut,.002);
  box(architecture,[10.65,.016,.016],[0,3.16,side*5.49],M.glow,.002);
  for(const z of [-2.65,0,2.65]){
   box(architecture,[.05,2.7,1.52],[side*5.36,1.49,z],M.walnut,.004);
   for(let i=0;i<20;i++)box(architecture,[.025,2.68,.023],[side*5.32,1.49,z-.70+i*.074],M.oak,.002);
   box(architecture,[.016,.34,.12],[side*5.28,1.74,z],M.brass,.009);
   box(architecture,[.008,.28,.08],[side*5.265,1.74,z],M.glow,.006);
  }
 }
 // Overhead fittings complete the enclosure when the visitor tilts upward.
 for(const z of [-2.2,2.2]){
  box(architecture,[7,.035,.04],[0,3.20,z],M.black,.004);
  for(const x of [-2.7,-1.35,0,1.35,2.7]){
   cylinder(architecture,.038,.047,.14,[x,3.10,z],M.black,16);
   cylinder(architecture,.035,.035,.003,[x,3.027,z],M.glow,16);
  }
 }
 const workshop=makeWorkshop(g,M),lounge=makeLounge(g,M),entrance=makeEntrance(g,M);
 for(const zone of [architecture,workshop,lounge,entrance])batchZone(zone);
 g.userData.room={...ROOM,workshopSide:'north',loungeSide:'south',entranceSide:'south-east'};
 return {architecture,workshop,lounge,entrance};
}
