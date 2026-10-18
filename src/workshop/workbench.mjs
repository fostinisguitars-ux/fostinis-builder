import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {makePickups} from '../showroom3d/geometry.mjs';
import {woodMaterial,whenWoodTexturesReady} from '../showroom3d/materials.mjs';
import {applyHandedness} from '../showroom3d/handedness.mjs';
import {makeBenchTools} from './bench-tools.mjs';
import {makeAppointments,makeConstructionEffects} from './construction.mjs';
import {createBuildClock,span,TOTAL_SECONDS} from './sequence.mjs';

export function copyWorkshopGeometry(source){
 if(!source)return null;const copy=source.clone(true);
 copy.traverse(mesh=>{if(mesh.isMesh)mesh.geometry=mesh.geometry.clone();});return copy;
}

export function mountWorkbench(host,{record,F,parts,onFrame=()=>{},onError=()=>{}}){
 let disposed=false,lost=false,frame=0,visible=true,revision=0,lastTime=null,lastDraw=0,lastStage=-1,notified=-1;
 const clock=createBuildClock(),motion=matchMedia('(prefers-reduced-motion: reduce)');
 const geometrySet=new Set(),materialSet=new Set(),textureSet=new Set(),textureCache=new Map();
 const ownGeo=geo=>{geometrySet.add(geo);return geo;},ownMat=mat=>{materialSet.add(mat);return mat;};
 const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.localClippingEnabled=true;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
 const scene=new T.Scene();scene.background=new T.Color('#191e1a');
 const camera=new T.PerspectiveCamera(35,1,.01,20);camera.up.set(-1,0,0);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.enablePan=true;controls.minDistance=.22;controls.maxDistance=5;
 const pmrem=new T.PMREMGenerator(renderer),roomEnvironment=new RoomEnvironment(),environmentTarget=pmrem.fromScene(roomEnvironment,.03);scene.environment=environmentTarget.texture;roomEnvironment.dispose();pmrem.dispose();
 scene.add(new T.HemisphereLight('#fff8e9','#5b4934',2));
 const key=new T.DirectionalLight('#ffe3b4',3.5);key.position.set(-1.4,.8,2.8);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-1.2;key.shadow.camera.right=1.2;key.shadow.camera.top=1.7;key.shadow.camera.bottom=-1.2;key.shadow.camera.near=.1;key.shadow.camera.far=6;key.shadow.normalBias=.0007;key.shadow.bias=-.00015;scene.add(key);
 const fill=new T.DirectionalLight('#dce6ee',1.4);fill.position.set(1,-1,1);scene.add(fill);
 function texture(url){
  if(!textureCache.has(url)){const map=new T.TextureLoader().load(url,()=>draw(),undefined,()=>draw());map.colorSpace=T.SRGBColorSpace;map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());textureSet.add(map);textureCache.set(url,map);}return textureCache.get(url);
 }
 function box(w,h,d,mat,x,y,z){const m=new T.Mesh(ownGeo(new RoundedBoxGeometry(w,h,d,2,Math.min(.004,w/3,h/3,d/3))),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m;}
 const bench=new T.Group();scene.add(bench);
 const tableMat=ownMat(new T.MeshStandardMaterial({map:texture('/assets/wood-real19-walnut.jpg'),color:'#8f7960',roughness:.62}));bench.add(box(1.12,1.72,.07,tableMat,0,0,-.09));
 const mat=ownMat(new T.MeshStandardMaterial({color:'#303f36',roughness:.96}));bench.add(box(.60,1.35,.009,mat,0,0,-.047));
 makeBenchTools(bench,{texture,material:ownMat,geometry:ownGeo}); // Quiet scenery, with no inspection links or hit targets.
 const supports=new T.Group();supports.add(box(.24,.18,.04,mat,0,-.36,-.023),box(.105,.10,.05,mat,0,.14,-.01));bench.add(supports);
 const rig=new T.Group(),instrument=new T.Group();instrument.scale.setScalar(.001);instrument.position.set(0,-.28,.04);rig.add(instrument);scene.add(rig);
 const body=copyWorkshopGeometry(record.body),neck=copyWorkshopGeometry(record.neck),fills=copyWorkshopGeometry(record.fills),signature=copyWorkshopGeometry(record.signature);
 const wooden=[body,neck,fills].filter(Boolean),baseNeck=neck.position.clone(),shell=new T.Group();instrument.add(shell);
 const rawPlane=new T.Plane(new T.Vector3(0,0,1),0),finishPlane=new T.Plane(new T.Vector3(0,0,-1),0);
 for(const group of [...wooden,signature].filter(Boolean)){
  instrument.add(group);group.traverse(m=>{if(m.isMesh){geometrySet.add(m.geometry);m.userData.workshopVisible=m.visible;if(group===signature)m.material=ownMat(m.material.clone());}});
  if(group!==signature){const finished=group.clone(true);finished.traverse(m=>{if(m.isMesh)m.userData.region=m.userData.region||m.material.name;});shell.add(finished);}
 }
 let state={...record.state},appointments,finishMaterials=new Map();
 const timber=new T.Group();bench.add(timber);
 const stockTop=ownMat(new T.MeshStandardMaterial({roughness:.85,color:'#e4c99d',transparent:true}));
 const stockBack=ownMat(new T.MeshStandardMaterial({roughness:.9,color:'#a4794d',map:texture('/assets/wood-real19-'+state.backWood+'.jpg'),transparent:true}));
 const stockNeck=ownMat(new T.MeshStandardMaterial({roughness:.8,color:'#c3a076',map:texture('/assets/wood-real19-'+state.neckWood+'.jpg'),transparent:true}));
 timber.add(box(.36,.48,.0254,stockBack,0,-.36,-.013));
 const topHalves=[-1,1].map(sign=>{const m=box(.177,.48,.00635,stockTop,sign*.09,-.36,.006);timber.add(m);return m;});
 timber.add(box(.075,.67,.035,stockNeck,.24,.20,-.002));
 const effects=makeConstructionEffects(scene,{geometry:ownGeo,material:ownMat});
 function releaseGroup(group){if(!group)return;group.removeFromParent();group.traverse(m=>{if(m.isMesh&&geometrySet.delete(m.geometry))m.geometry.dispose();});}
 function rebuild(){
  for(const pair of finishMaterials.values())for(const value of Object.values(pair)){value.dispose();materialSet.delete(value);}finishMaterials=new Map();
  const raw={...state,finishType:'dye',finish:'natural',burst:'none',sheen:'matte',headstockBurst:'match',backFinishType:'dye',backFinish:'natural',backBurst:'none',backSheen:'matte',neckFinishType:'dye',neckFinish:'natural',neckBurst:'none',neckSheen:'matte'};
  for(const group of wooden)group.traverse(m=>{
   if(!m.isMesh)return;const region=m.userData.region||m.material.name;m.userData.region=region;
   if(!finishMaterials.has(region)){
    const basic=()=>new T.MeshStandardMaterial({color:region==='cover'?'#141619':'#4b3020',roughness:.82});
    const pair={raw:ownMat(['cover','cavity'].includes(region)?basic():woodMaterial(F,raw,region,record.id)),finished:ownMat(['cover','cavity'].includes(region)?basic():woodMaterial(F,state,region,record.id))};
    pair.raw.clipShadows=pair.finished.clipShadows=true;finishMaterials.set(region,pair);
   }
  });
  releaseGroup(appointments?.group);appointments=makeAppointments(record.id,state,parts);appointments.group.traverse(m=>{if(m.isMesh)ownGeo(m.geometry);});instrument.add(appointments.group);
  stockTop.map=texture('/assets/wood-'+(F.WOODS[state.wood].grain||'real19-'+state.wood)+'.jpg');stockTop.needsUpdate=true;
  applyHandedness({group:instrument,signature,logo:signature?.children[0]},state);
  rig.position.set(0,0,0);rig.rotation.set(0,0,0);neck.position.copy(baseNeck);body.visible=true;
  const pickups=makePickups(state,parts),pickupY=pickups.children.map(p=>({y:p.position.y,kind:p.userData.pickupKind}));pickups.traverse(m=>{if(m.isMesh)m.geometry.dispose();});
  effects.configureRouting(body,instrument,pickupY);effects.setHangerTop(new T.Box3().setFromObject(neck).max.y+.68);
  lastStage=-1;updateScene(clock.read());notify(true);draw();
  const ticket=++revision;whenWoodTexturesReady().then(()=>{if(!disposed&&ticket===revision)draw();}).catch(()=>{if(!disposed)onError('Some wood textures could not load. Your design and workshop choices are still available.');});
 }
 function updateScene(snapshot){
  const {stage,progress:p,time}=snapshot,booth=stage===4,changed=stage!==lastStage;
  bench.visible=!booth;rig.rotation.x=booth?Math.PI/2:0;rig.position.z=booth?.68:0;
  timber.visible=stage===0||(stage===1&&p<.2);supports.visible=stage>0;
  for(const m of [stockTop,stockBack,stockNeck])m.opacity=stage===1?1-span(p,0,.20):1;
  topHalves.forEach((m,i)=>{m.position.x=(i===0?-1:1)*(.09+(stage===0?(1-span(p,0,.8))*.055:0));});
  body.visible=stage>=1;neck.visible=stage>=2;if(fills)fills.visible=stage>=1;
  neck.position.copy(baseNeck);if(stage===2){const t=1-span(p,.08,.86);neck.position.add(new T.Vector3(30*t,130*t,95*t));}
  appointments.update(stage,p);if(signature)signature.visible=stage>=4;shell.visible=booth;
  const boundary=effects.update(stage,p,time);finishPlane.constant=boundary;rawPlane.constant=-boundary;
  if(changed){
   for(const [region,pair] of finishMaterials){const clipped=booth&&!['cavity','cover'].includes(region);pair.raw.clippingPlanes=clipped?[rawPlane]:null;pair.finished.clippingPlanes=clipped?[finishPlane]:null;pair.raw.needsUpdate=pair.finished.needsUpdate=true;}
   for(const group of wooden)group.traverse(m=>{if(m.isMesh)m.material=finishMaterials.get(m.userData.region)?.[stage===5?'finished':'raw']||m.material;});
   shell.traverse(m=>{if(m.isMesh){m.material=finishMaterials.get(m.userData.region)?.finished||m.material;m.visible=m.userData.workshopVisible&&!['cover','cavity'].includes(m.userData.region);}});
   key.position.set(-1.4,booth?-1.8:.8,2.8);lastStage=stage;reset();
  }
  for(const group of wooden)group.traverse(m=>{if(m.isMesh)m.visible=m.userData.workshopVisible&&(m.userData.region!=='cover'||stage===5&&p>=.64);});
  renderer.shadowMap.needsUpdate=true;
 }
 function notify(force=false){const s=clock.read(),key=Math.floor(s.time*10)+':'+s.playing;if(force||key!==notified){notified=key;onFrame(s);}}
 function draw(){if(disposed||lost||document.hidden||!visible||frame)return;frame=requestAnimationFrame(render);}
 function render(now){
  frame=0;if(disposed||lost||document.hidden||!visible){lastTime=null;return;}
  if(clock.read().playing&&lastTime!==null&&now-lastDraw<1000/30){draw();return;}
  const s=clock.advance(lastTime===null?0:Math.min(.1,(now-lastTime)/1000));lastTime=s.playing?now:null;lastDraw=now;
  updateScene(s);renderer.render(scene,camera);notify();if(s.playing)draw();
 }
 let width=0,height=0;
 function reset(){
  const booth=clock.read().stage===4;camera.up.set(booth?0:-1,0,booth?1:0);
  if(booth){const distance=Math.max(2.70,1.3/(2*Math.tan(camera.fov*Math.PI/360)*camera.aspect));controls.target.set(0,0,.78);camera.position.copy(controls.target).add(new T.Vector3(.22,-1,.12).normalize().multiplyScalar(distance));}
  else {const distance=Math.max(1.65,1.32/(2*Math.tan(camera.fov*Math.PI/360)*camera.aspect));controls.target.set(0,0,.025);camera.position.copy(controls.target).add(new T.Vector3(.20,-.12,1).normalize().multiplyScalar(distance));}
  controls.update();draw();
 }
 function resize(){const r=host.getBoundingClientRect();if(!r.width||!r.height)return;const changed=Math.abs(width-r.width)>1;width=r.width;height=r.height;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();if(changed)reset();draw();}
 function pause(){clock.pause();lastTime=null;notify(true);draw();}
 function play(){clock.play();lastTime=null;notify(true);draw();}
 function setStage(index,animate=!motion.matches){clock.jump(index,animate?0:Number(index)===5?1:.999999);if(animate)clock.play();else clock.pause();lastTime=null;updateScene(clock.read());notify(true);draw();}
 const onChange=()=>draw();controls.addEventListener('change',onChange);controls.addEventListener('start',pause);
 renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('role','group');renderer.domElement.setAttribute('aria-label','Animated guitar construction. Drag to rotate, pinch or scroll to zoom. Arrow keys turn the view; plus and minus zoom. Use the build controls to pause, replay, or select a stage.');
 renderer.domElement.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(event.key))return;event.preventDefault();pause();const offset=camera.position.clone().sub(controls.target);if(event.key.startsWith('Arrow')){const axis=event.key==='ArrowLeft'||event.key==='ArrowRight'?camera.up:new T.Vector3().crossVectors(offset,camera.up).normalize();offset.applyAxisAngle(axis,(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1)*.1);}else offset.multiplyScalar(event.key==='-'?1.12:.9);offset.clampLength(.22,5);camera.position.copy(controls.target).add(offset);controls.update();draw();});
 const visibility=()=>{lastTime=null;if(document.hidden){cancelAnimationFrame(frame);frame=0;}else draw();};document.addEventListener('visibilitychange',visibility);
 const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;lastTime=null;if(visible)draw();else{cancelAnimationFrame(frame);frame=0;}},{threshold:.15});intersection.observe(host);
 const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);
 const motionChanged=()=>{if(motion.matches)pause();};motion.addEventListener('change',motionChanged);
 renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;clock.pause();cancelAnimationFrame(frame);frame=0;onError('The 3D build was paused by your device. Reopen the workshop to try again. Materials and real workshop films are still available.',{fatal:true});});
 host.prepend(renderer.domElement);rebuild();resize();
 return {
  play,pause,setStage,reset,
  replay(){clock.seek(0);play();},
  seek(fraction){clock.pause();clock.seek(Number(fraction)*TOTAL_SECONDS);lastTime=null;updateScene(clock.read());notify(true);draw();},
  zoom(factor){pause();const offset=camera.position.clone().sub(controls.target).multiplyScalar(factor).clampLength(.22,5);camera.position.copy(controls.target).add(offset);controls.update();draw();},
  setLight(value){const a=Number(value)*Math.PI/180;key.position.set(Math.sin(a)*2,clock.read().stage===4?-1.8:1,Math.cos(a)*2+.5);renderer.shadowMap.needsUpdate=true;draw();},
  setDesign(choices){for(const id of ['wood','inlays','fretboard'])if(F.choices[id]?.includes(choices[id]))state[id]=choices[id];rebuild();},
  dispose(){if(disposed)return;disposed=true;revision++;cancelAnimationFrame(frame);resizeObserver.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);motion.removeEventListener('change',motionChanged);controls.dispose();for(const geo of geometrySet)geo.dispose();for(const mat of materialSet)mat.dispose();for(const tex of textureSet)tex.dispose();environmentTarget.dispose();key.shadow.map?.dispose();renderer.dispose();renderer.domElement.remove();}
 };
}
