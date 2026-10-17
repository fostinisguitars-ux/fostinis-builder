import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import bodySpec from '../../scripts/cad/body-construction.json' with {type:'json'};
import assemblySpec from '../../scripts/cad/assembly-layout.json' with {type:'json'};
import killswitchPlacement from '../../scripts/cad/pickup-layouts/killswitch-placement.json' with {type:'json'};
import {createElectronics} from '../../lib/commerce/electronics.mjs';
import {mapleFretboardTexture} from './materials.mjs';
import {floydPlate,twoPointPlate} from './bridge-plates.mjs';
const electronics=createElectronics();
// All reduced-control layouts leave this original bridge-volume recess vacant.
export function killswitchRecess(s){return s.killswitch==='momentary'&&!electronics.layout(s).pots.includes(1)?1:null;}
export function pickupFillNames(s){const layout=electronics.layout(s),occupied=killswitchRecess(s);return [!layout.neck?'neck_full':layout.neck==='S'?'neck_single':null,layout.bridge==='S'?'bridge_single':null,!layout.pots.includes(1)&&occupied!==1?'control_1':null,!layout.pots.includes(3)?'control_3':null,electronics.wiring(s)==='direct'?'switch':null].filter(Boolean);}
export function applyPickupFills(object,s){const visible=new Set(pickupFillNames(s));object.traverse(m=>{if(m.isMesh)m.visible=visible.has(m.name);});}
export function bodyConstruction(model){const rim=bodySpec.rimZMm[model],capBase=rim-bodySpec.exposedMapleCapMm,back=capBase-bodySpec.bodyWoodThicknessMm;return {rim,capBase,back,rearTranslation:back-bodySpec.originalBackZMm};}
export const MM=.001;
export const NECK={offsetY:372.57195887,offsetZ:1.8625,nutX:-233.63439311,endX:265.38439311,scale:647.7};
export const NUT_Y=NECK.offsetY-NECK.nutX;
export const SADDLE_Y=NUT_Y-NECK.scale;
export const PICKUP_Y=[assemblySpec.neckPickupY,assemblySpec.bridgePickupY];
export function part(group,geometry,material,x=0,y=0,z=0){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
export function box(g,w,h,d,m,x=0,y=0,z=0,r=.5){return part(g,new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/3,h/3,d/3)),m,x,y,z);}
export function disc(g,r,d,m,x=0,y=0,z=0,segments=32,r2=r){const q=part(g,new T.CylinderGeometry(r2,r,d,segments),m,x,y,z);q.rotation.x=Math.PI/2;return q;}
export function ring(g,r,t,m,x=0,y=0,z=0){return part(g,new T.TorusGeometry(r,t,8,48),m,x,y,z);}
export function bar(g,a,b,r,m,segments=12){const av=new T.Vector3(...a),bv=new T.Vector3(...b),v=bv.clone().sub(av);const q=part(g,new T.CylinderGeometry(r,r,v.length(),segments),m,...av.add(bv).multiplyScalar(.5).toArray());q.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return q;}
export function screw(g,x,y,z,m,r=1.8,type='slot'){disc(g,r,1.2,m,x,y,z);const dark=materials().dark;if(type==='hex'){disc(g,r*.47,.25,dark,x,y,z+.7,6);}else{box(g,r*1.5,.35,.15,dark,x,y,z+.7,.04);if(type==='cross')box(g,.35,r*1.5,.15,dark,x,y,z+.71,.04);}}
let shared;
export function materials(){if(shared)return shared;const metal=(color,roughness=.23)=>new T.MeshStandardMaterial({color,metalness:1,roughness});return shared={chrome:metal('#cdd0d1'),gold:metal('#d8b56c'),black:metal('#24272a',.3),brass:metal('#b3974b',.32),steel:metal('#989fa4',.3),dark:new T.MeshStandardMaterial({color:'#111215',roughness:.45}),rubber:new T.MeshStandardMaterial({color:'#161719',roughness:.88}),cream:new T.MeshStandardMaterial({color:'#ded5b4',roughness:.35}),white:new T.MeshStandardMaterial({color:'#f0ede5',roughness:.35}),pearl:new T.MeshPhysicalMaterial({color:'#d6e0dc',roughness:.18,metalness:.08,clearcoat:1,iridescence:.65,iridescenceIOR:1.35,iridescenceThicknessRange:[220,420]}),ebony:new T.MeshStandardMaterial({color:'#17120e',roughness:.42}),rosewood:new T.MeshStandardMaterial({color:'#42291c',roughness:.48})};}
function knurl(g,x,y,z,r,depth,m,count=36){disc(g,r,depth,m,x,y,z);for(let i=0;i<count;i++){const a=i/count*Math.PI*2;bar(g,[x+Math.cos(a)*r,y+Math.sin(a)*r,z-depth*.43],[x+Math.cos(a+.024)*r,y+Math.sin(a+.024)*r,z+depth*.43],.16,m,5);}}
export function makeControls(model,s){const g=new T.Group(),M=materials(),metal=M[s.hardware];g.name='Controls';const points=model==='matadaur'?[[63.3504,-119.991,-8.4],[104.1,-100.12,-10],[62.13,-171.79,-8.6],[103.6,-152.8,-13]]:[[63.3504,-119.991,-7],[108.03,-100.12,-9.5],[62.88,-174.005,-9.7],[106.14,-153.63,-11.2]];
 for(const [i,[x,y,z]]of points.entries()){if(!electronics.layout(s).pots.includes(i))continue;const knob=new T.Group();knob.name=electronics.potName(s,i);knob.userData.potIndex=i;knob.userData.mod=s[electronics.potFields[i]]||'none';knob.position.set(x,y,z+(knob.userData.mod!=='none'?2.5:0));g.add(knob);disc(knob,8.4,1.7,M.dark,0,0,1);if(s.knobs==='pearl'||s.knobs==='knurled'){knurl(knob,0,0,7,8,11,metal);disc(knob,6.9,.8,s.knobs==='pearl'?M.pearl:metal,0,0,12.9);ring(knob,7.1,.35,metal,0,0,13.2);}else if(s.knobs==='dome'){disc(knob,8,9,metal,0,0,5);const cap=part(knob,new T.SphereGeometry(8,32,16,0,Math.PI*2,0,Math.PI/2),metal,0,0,9);cap.rotation.x=Math.PI/2;cap.scale.y=.45;}else{disc(knob,s.knobs==='bell'?10:10.7,10,M.dark,0,0,6,48,7.1);ring(knob,8.2,.4,metal,0,0,11);for(let j=0;j<10;j++){const a=j/10*Math.PI*2;box(knob,.38,1.7,.2,M.cream,Math.sin(a)*8.7,Math.cos(a)*8.7,1.1,.05);}}}
 // Centers are read from the actual switch bores in the supplied CAD.
 const x=86.6224,y=-79.361,selector=electronics.wiring(s);
 if(selector==='fiveway'){const toggle=new T.Group();toggle.name='5-way pickup selector';g.add(toggle);box(toggle,16,44,1.2,metal,x,y,-.2,3);box(toggle,2,27,.3,M.dark,x,y,.5,.4);for(const offset of [-18,18])screw(toggle,x,y+offset,.9,metal,1.6,'cross');bar(toggle,[x,y+6,1],[x+2,y+9,11],1.5,metal);box(toggle,6,8,6,M.dark,x+2,y+9,13,2);}
 else if(selector==='threeway'){disc(g,9,.9,metal,x,y,.2);ring(g,7.9,.6,metal,x,y,.8);disc(g,6,2.2,metal,x,y,1.6,6);bar(g,[x,y,2.7],[x+2.4,y-3,13.5],2.1,metal);const tip=part(g,new T.SphereGeometry(3.5,20,12),M.dark,x+2.6,y-3.2,15);tip.scale.z=1.4;}

 if(s.killswitch==='momentary'){const button=new T.Group(),recess=killswitchRecess(s),placement=recess===null?killswitchPlacement[model]:killswitchPlacement[model].vacantPot;button.name='Momentary killswitch';button.userData.killswitch=true;button.userData.recessIndex=recess;button.position.fromArray(placement.positionMm);button.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...placement.normal));g.add(button);disc(button,7.5,1.8,metal,0,0,.5);ring(button,6.4,.45,metal,0,0,1.35);disc(button,5.8,1.3,M.dark,0,0,1.8);}
 return g;
}
export function makePickups(s,catalog){const g=new T.Group(),M=materials(),metal=M[s.hardware],spec=catalog.pickups.find(p=>p.id===s.pickupSet)||{};g.name='Pickups';const layout=electronics.layout(s);for(const [position,y] of [['neck',PICKUP_Y[0]],['middle',(PICKUP_Y[0]+PICKUP_Y[1])/2],['bridge',PICKUP_Y[1]]]){const kind=layout[position];if(!kind)continue;const p=new T.Group();p.name=position+' '+(kind==='H'?'humbucker':'single coil');p.userData.pickupKind=kind;p.userData.pickupPosition=position;p.position.y=y;g.add(p);if(kind==='S'){const cover=s.singleCoilCover==='cream'?M.cream:s.singleCoilCover==='white'?M.white:M.dark;box(p,88,25,3.2,M.dark,0,0,-1,2.2);box(p,72,18,15,cover,0,0,2,4.5);for(const x of [-40,40])screw(p,x,0,.7,metal,2,'cross');for(let i=0;i<6;i++)disc(p,2.45,.8,M.steel,(i-2.5)*10.2,0,10);continue;}box(p,88,40,3.2,M.dark,0,0,-1,2.2);box(p,83,17,1.2,metal,0,0,-2,1);for(const x of [-40,40])screw(p,x,0,.7,metal,2,'cross');const active=spec.system==='active'||spec.system==='fluence'||s.pickups==='active',covered=!active&&s.pickups==='covered';if(active||covered){box(p,70,37,17,active?M.dark:metal,0,0,2,2.6);if(covered)for(let i=0;i<6;i++)screw(p,(i-2.5)*10.2,10,11.1,metal,2.35);else {box(p,29,.3,.1,M.steel,0,11,10.6,.05);}}else{for(const row of [-1,1]){box(p,68,17,15,s.pickups==='zebra'&&row===1?M.cream:M.dark,0,row*9,2,4.5);for(let i=0;i<6;i++){const x=(i-2.5)*10.2;if(spec.poles==='hex')screw(p,x,row*9,10,metal,2.45,'hex');else if(row<0)screw(p,x,row*9,10,metal,2.35);else disc(p,2.4,.7,metal,x,row*9,10.2);}}} }
 return g;}
export function makeBridge(s){const g=new T.Group(),M=materials(),metal=M[s.hardware],floyd=s.bridgeModel.startsWith('floyd'),trem=floyd||['hipshot-contour','gotoh-510'].includes(s.bridgeModel);g.name='Bridge '+s.bridgeModel;g.position.y=SADDLE_Y;
 if(s.bridgeModel==='toneomatic'){box(g,84,13,7,metal,0,-1,6,3);box(g,97,15,9,metal,0,-38,5,5);for(const x of [-37,37]){disc(g,5.5,6,metal,x,0,2);screw(g,x,0,10,metal,3);disc(g,7.5,3,metal,x,-38,1);screw(g,x,-38,10.3,metal,3.8);}for(let i=0;i<6;i++){const x=(i-2.5)*10.4;box(g,8,8,5,metal,x,0,10,1);bar(g,[x,-7,8],[x,5,8],.8,M.steel);disc(g,2.2,.4,M.dark,x,-35,10);}}
 else if(s.bridgeModel==='evertune'){box(g,89,91,4,metal,0,-27,1,3);box(g,70,76,3,M.dark,0,-27,3,2);for(let i=0;i<6;i++){const x=(i-2.5)*10.67;box(g,8.8,58,7,metal,x,-24,6,1);box(g,6,11,3,M.dark,x,-10,10,.6);bar(g,[x-3.6,0,10],[x+3.6,0,10],1.5,M.steel);screw(g,x,-53,10,metal,2,'hex');}for(const x of [-39,39])for(const y of [10,-65])screw(g,x,y,4,metal,2,'cross');}
 else {const pro=s.bridgeModel==='floyd-pro';
 if(floyd){const plate=part(g,floydPlate(pro),metal);plate.name='Shaped Floyd baseplate and fine-tuner rack';}
 else if(trem){const plate=part(g,twoPointPlate(s.bridgeModel),metal);plate.name='Dedicated two-point baseplate';}
 else box(g,79,43,3.4,metal,0,-10.5,1.5,2);
 if(trem){const span=floyd?74:s.bridgeModel==='hipshot-contour'?56.388:56,pivotY=s.bridgeModel==='hipshot-contour'?2:6.7;for(const x of [-span/2,span/2]){disc(g,5,11,M.steel,x,pivotY,-6.5);disc(g,4.25,2,metal,x,pivotY,2.8);screw(g,x,pivotY,4.2,metal,2.8,'hex');}box(g,floyd?50:s.bridgeModel==='gotoh-510'?64:68,12,33,M.steel,0,-18,-17,1.2);}else for(const x of [-33,33])for(const y of [-25,8])screw(g,x,y,3.7,metal,2,'cross');
 for(let i=0;i<6;i++){const pitch=floyd?(pro?10.67:10.8):s.bridgeModel==='gotoh-510'?10.8:s.bridgeModel==='hipshot-contour'?10.5664:10.5,x=(i-2.5)*pitch,offset=(i%3)*.6;box(g,9.2,floyd?27:22,7,metal,x,-7-offset,6.5,1);bar(g,[x-3.7,0-offset,10],[x+3.7,0-offset,10],1.3,metal);box(g,1,3,.3,M.dark,x,0-offset,11,.15);if(floyd){screw(g,x,3.5-offset,10.5,metal,2.4,'hex');box(g,6.5,7,4,M.dark,x,-16,10,1);const end=pro?-56:-64;bar(g,[x,-17,7],[x,end,7],1.4,M.steel);const lock=disc(g,2.8,3,M.dark,x,end,7,6);lock.rotation.x=0;for(let j=0;j<9;j++)ring(g,1.6,.22,M.steel,x,-25-j*.9,7).rotation.x=Math.PI/2;const tunerY=pro?-43:-49;bar(g,[x,tunerY,7],[x,tunerY,pro?11.4:15.4],1.5,M.steel);knurl(g,x,tunerY,pro?11.4:15.4,4.2,2.2,M.dark,24);}else{for(const xx of [-2.9,2.9])screw(g,x+xx,4-offset,10,metal,.9,'hex');bar(g,[x,-15,6],[x,-28,6],1.1,M.steel);}}
 if(trem){const ax=floyd?40:41;disc(g,5.2,4,metal,ax,-15,5);const pts=[[ax,-15,7],[ax,-11,15],[ax+3,10,18],[ax+9,52,20],[ax+11,112,23]].map(p=>new T.Vector3(...p));part(g,new T.TubeGeometry(new T.CatmullRomCurve3(pts),40,2.5,10,false),metal);if(!floyd)bar(g,[ax+10,96,22],[ax+11,112,23],3.4,M.dark);}
 }
 return g;}
export const TUNER_STATIONS=[[-314.701170486,22.987],[-347.088024888,19.84375],[-379.474879290,21.43125]];
export function headstockSurfaceY(localX){return NECK.offsetY-localX;}
export function headstockZ(localX){return (localX+250.93955088)*Math.tan(17*Math.PI/180)+NECK.offsetZ;}
export function makeTuners(s){const g=new T.Group(),M=materials(),metal=M[s.hardware];g.name='Tuners '+s.tunerModel;const hip=s.tunerModel.startsWith('hipshot'),locking=s.tunerModel!=='hipshot-open';for(const [nx,yy]of TUNER_STATIONS)for(const sign of [-1,1]){const station=new T.Group();station.position.set(sign*yy,headstockSurfaceY(nx),headstockZ(nx));station.rotation.x=-17*Math.PI/180;g.add(station);disc(station,7.6,.9,metal,0,0,.7);disc(station,5.6,3.5,metal,0,0,2.5,6);disc(station,3,8,metal,0,0,7);bar(station,[-3,0,9],[3,0,9],.6,M.dark);const back=-16.2;const rear=new T.Group();rear.position.z=back;station.add(rear);if(hip){box(rear,15.7,18,2,metal,sign*1,0,-1,3);disc(rear,6.1,2.2,M.brass,0,0,-3);for(let j=0;j<24;j++){const a=j/24*Math.PI*2;box(rear,.75,1.5,1.7,M.brass,Math.sin(a)*5.9,Math.cos(a)*5.9,-3,.1).rotation.z=-a;}bar(rear,[sign*7,-7,-3],[sign*7,7,-3],1.5,M.steel);for(let j=0;j<12;j++){const ringmesh=ring(rear,1.65,.25,metal,sign*7,-5.5+j,-3);ringmesh.rotation.x=Math.PI/2;}if(locking)knurl(rear,0,0,-6.5,6.4,3.5,metal,24);else{const cap=disc(rear,2.6,1,metal,0,0,-4.8);cap.rotation.x=0;box(rear,3.5,.4,.15,M.dark,0,0,-5.35,.05);}}
 else {box(rear,17,s.tunerModel==='schaller-locking'?20:18,8.2,metal,0,0,-4,5);const tab=box(rear,7,11,2.5,metal,-sign*7,-9,-2,2.8);tab.rotation.z=sign*.65;screw(rear,-sign*9,-12,-3.6,metal,1.8,'cross');knurl(rear,0,0,-10,6.7,3.2,metal,28);}
 // Buttons project beyond the outline; gear housings remain behind the real CAD face.
 bar(rear,[sign*7,0,-4],[sign*25,0,-4],2.2,metal);disc(rear,3.2,1.5,metal,sign*24,0,-4).rotation.y=Math.PI/2;
 const button=box(rear,hip?12:10,hip?16:14,6,metal,sign*30,0,-4,hip?2.5:4);if(hip){button.rotation.z=sign*.1;button.scale.y=1.05;} }
 return g;}
function boardGeometry(){
 const nut=NUT_Y,end=NECK.offsetY-NECK.endX,segments=56,verts=[],uv=[],indices=[];
 const point=(j,i)=>{const t=j/segments,x=(i/16-.5)*(42.1+(55.5625-42.1)*t);return [x,nut+(end-nut)*t,NECK.offsetZ+6.4-(355.6-Math.sqrt(355.6**2-x*x))];};
 for(let j=0;j<=segments;j++)for(let i=0;i<=16;i++){verts.push(...point(j,i));uv.push(i/16,j/segments);}
 for(let j=0;j<segments;j++)for(let i=0;i<16;i++){const a=j*17+i,b=a+17;indices.push(a,b,a+1,b,b+1,a+1);}
 const bottom=p=>[p[0],p[1],NECK.offsetZ];
 // Continue the same lengthwise grain across side segments and board ends.
 const quad=(a,b,c,d)=>{const i=verts.length/3;verts.push(...a,...b,...c,...d);for(const p of [a,b,c,d]){const t=(nut-p[1])/(nut-end);uv.push(.5+p[0]/(42.1+(55.5625-42.1)*t),t);}indices.push(i,i+1,i+2,i,i+2,i+3);};
 // Complete the sides, radiused end grain and underside as one closed board.
 // Top dimensions, radius, fret positions and scale remain unchanged.
 for(let j=0;j<segments;j++){
  const l=point(j,0),ln=point(j+1,0),r=point(j,16),rn=point(j+1,16);
  quad(l,bottom(l),bottom(ln),ln);quad(r,rn,bottom(rn),bottom(r));
 }
 for(let i=0;i<16;i++){
  const a=point(segments,i),b=point(segments,i+1),c=point(0,i),d=point(0,i+1);
  quad(bottom(a),bottom(b),b,a);quad(bottom(c),c,d,bottom(d));
 }
 const underside=verts.length/3;for(let j=0;j<=segments;j++)for(let i=0;i<=16;i++){verts.push(...bottom(point(j,i)));uv.push(i/16,j/segments);}
 for(let j=0;j<segments;j++)for(let i=0;i<16;i++){const a=underside+j*17+i,b=a+17;indices.push(a,a+1,b,b,a+1,b+1);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
export function makeFretboard(s){const g=new T.Group(),M=materials();if(s.fretboard==='maple'&&!M.maple)M.maple=new T.MeshStandardMaterial({color:'#ffffff',roughness:.42,map:mapleFretboardTexture()});const material=M[s.fretboard];g.name='Fretboard';part(g,boardGeometry(),material);const nut=NUT_Y,end=NECK.offsetY-NECK.endX;
 for(let f=1;f<=24;f++){const d=NECK.scale*(1-2**(-f/12)),y=nut-d,w=42.1+(55.5625-42.1)*(d/(nut-end));const pts=[];for(let i=0;i<=16;i++){const x=(i/16-.5)*(w-.9);pts.push(new T.Vector3(x,y,NECK.offsetZ+6.9-(355.6-Math.sqrt(355.6**2-x*x))));}part(g,new T.TubeGeometry(new T.CatmullRomCurve3(pts),20,.6,7,false),M.chrome);if([3,5,7,9,12,15,17,19,21,24].includes(f)&&s.inlays!=='none'){const previous=NECK.scale*(1-2**(-(f-1)/12)),iy=nut-(d+previous)/2;if(s.inlays==='dots'){for(const x of f===12||f===24?[-7,7]:[0])disc(g,2.25,.12,M.pearl,x,iy,NECK.offsetZ+6.47-(355.6-Math.sqrt(355.6**2-x*x)));}else{const sh=new T.Shape();const w2=Math.min(w*.28,14),h=Math.min((d-previous)*.3,7);sh.moveTo(-w2,-h);sh.quadraticCurveTo(0,-h*.4,w2,-h);sh.quadraticCurveTo(w2*.75,0,w2,h);sh.quadraticCurveTo(0,h*.4,-w2,h);sh.quadraticCurveTo(-w2*.75,0,-w2,-h);const inlay=new T.ShapeGeometry(sh,20),pv=inlay.attributes.position;for(let k=0;k<pv.count;k++){const xx=pv.getX(k);pv.setZ(k,NECK.offsetZ+6.57-(355.6-Math.sqrt(355.6**2-xx*xx)));}inlay.computeVertexNormals();part(g,inlay,M.pearl,0,iy,0);}}}
 const lock=s.bridgeModel.startsWith('floyd');box(g,43,lock?15:5,5,lock?M[s.hardware]:M.cream,0,nut+2.5,NECK.offsetZ+3.7,1);if(lock)for(let i=0;i<3;i++){box(g,12,10,3,M[s.hardware],(i-1)*14,nut+3,NECK.offsetZ+7,.8);screw(g,(i-1)*14,nut+3,NECK.offsetZ+9,M.steel,2,'hex');}
 return g;}
export function makeStrings(s){const g=new T.Group(),M=materials();g.name='Strings';for(let i=0;i<6;i++){const x=(i-2.5)*10.6,nx=(i-2.5)*7.1,sign=i<3?-1:1,station=TUNER_STATIONS[i<3?i:5-i],end=[sign*station[1],headstockSurfaceY(station[0]),headstockZ(station[0])+7.5];bar(g,[x,SADDLE_Y,12],[nx,NUT_Y,10.5],[.55,.43,.32,.22,.17,.13][i],M.steel,7);bar(g,[nx,NUT_Y,10.5],end,[.55,.43,.32,.22,.17,.13][i],M.steel,7);}
 return g;}
export function makeRearCovers(model,s){const g=new T.Group(),M=materials();g.name='Rear access covers';g.position.z=bodyConstruction(model).rearTranslation;
 // These are the actual CAD cover outlines, shared by the three body models.
 // Centers sit 4.49–5.83 mm inside the perimeter; retain the existing screw heads.
 const mount=(name,points,surfaceZ,radius)=>{for(const [x,y]of points){const sc=new T.Group();sc.name=name;sc.position.set(x,y,surfaceZ-.55);sc.rotation.y=Math.PI;g.add(sc);screw(sc,0,0,0,M[s.hardware],radius,'cross');}};
 // Seat the 1.2 mm heads with 0.05 mm engagement into the cover surface.
 mount('Control cover screw',[[90.641,-57.872],[142.696,-135.367],[73.249,-199.274],[38.937,-136.642]],-58.9,1.6);
 if(!['hipshot-fixed','toneomatic'].includes(s.bridgeModel))mount('Tremolo cover screw',[[-25,45],[25.5,45],[-34,-79],[47.4,-79]],-60.75,1.5);
 return g;}
export function makeHardware(model,state,catalog){const g=new T.Group();g.name='Hardware';g.add(makeControls(model,state),makePickups(state,catalog),makeBridge(state),makeTuners(state),makeFretboard(state),makeStrings(state),makeRearCovers(model,state));return mergeParts(g);}

export function mergeParts(group){group.updateMatrixWorld(true);const buckets=new Map();group.traverse(m=>{if(m.isMesh){const geom=(m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone()).applyMatrix4(m.matrixWorld);if(!buckets.has(m.material))buckets.set(m.material,[]);buckets.get(m.material).push(geom);m.geometry.dispose();}});const out=new T.Group();out.name=group.name;for(const [material,geometries]of buckets){const merged=mergeGeometries(geometries,false);const m=new T.Mesh(merged,material);m.castShadow=true;m.receiveShadow=true;out.add(m);geometries.forEach(g=>g.dispose());}return out;}
