import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {makeHardware,makeFretboard,mergeParts} from '../showroom3d/geometry.mjs';
import {woodMaterial,whenWoodTexturesReady} from '../showroom3d/materials.mjs';
import {applyHandedness} from '../showroom3d/handedness.mjs';
import {stageParts} from './journey.mjs';
import {makeBenchTools} from './bench-tools.mjs';

export function copyWorkshopGeometry(source){
 if(!source)return null;
 const copy=source.clone(true);
 copy.traverse(mesh=>{if(mesh.isMesh)mesh.geometry=mesh.geometry.clone();});
 return copy;
}

export function mountWorkbench(host,{record,F,parts,onPick=()=>{},onError=()=>{}}){
 let disposed=false,lost=false,frame=0,tween=null,visible=true,stage=0,revision=0;
 const geometrySet=new Set(),materialSet=new Set(),textureSet=new Set(),textureCache=new Map();
 const ownGeo=geo=>{geometrySet.add(geo);return geo;};
 const ownMat=mat=>{materialSet.add(mat);return mat;};
 const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
 const scene=new T.Scene();scene.background=new T.Color('#191e1a');
 const camera=new T.PerspectiveCamera(35,1,.01,20);camera.up.set(-1,0,0);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.enablePan=true;controls.minDistance=.22;controls.maxDistance=5;
 const pmrem=new T.PMREMGenerator(renderer),environmentTarget=pmrem.fromScene(new RoomEnvironment(),.03);scene.environment=environmentTarget.texture;pmrem.dispose();
 scene.add(new T.HemisphereLight('#fff8e9','#5b4934',2));
 const key=new T.DirectionalLight('#ffe3b4',3.5);key.position.set(-1.4,.8,2.8);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-1.2;key.shadow.camera.right=1.2;key.shadow.camera.top=1.2;key.shadow.camera.bottom=-1.2;key.shadow.camera.near=.1;key.shadow.camera.far=5;key.shadow.normalBias=.0007;key.shadow.bias=-.00015;scene.add(key);
 const fill=new T.DirectionalLight('#dce6ee',1);fill.position.set(1,-1,1);scene.add(fill);
 function texture(url){
  if(!textureCache.has(url)){
   const map=new T.TextureLoader().load(url,()=>draw(),undefined,()=>draw());
   map.colorSpace=T.SRGBColorSpace;map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());textureSet.add(map);textureCache.set(url,map);
  }
  return textureCache.get(url);
 }
 function box(w,h,d,mat,x,y,z){const m=new T.Mesh(ownGeo(new RoundedBoxGeometry(w,h,d,2,.004)),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m;}
 const tableMat=ownMat(new T.MeshStandardMaterial({map:texture('/assets/wood-real19-walnut.jpg'),color:'#8f7960',roughness:.62}));
 scene.add(box(1.12,1.72,.07,tableMat,0,0,-.09));
 const mat=ownMat(new T.MeshStandardMaterial({color:'#303f36',roughness:.96}));scene.add(box(.60,1.35,.009,mat,0,0,-.047));
 const tools=makeBenchTools(scene,{texture,material:ownMat,geometry:ownGeo});
 const supports=new T.Group();supports.add(box(.24,.18,.04,mat,0,-.36,-.023),box(.105,.10,.05,mat,0,.14,-.01));scene.add(supports);
 const instrument=new T.Group();instrument.scale.setScalar(.001);instrument.position.set(0,-.28,.04);scene.add(instrument);
 const body=copyWorkshopGeometry(record.body),neck=copyWorkshopGeometry(record.neck),fills=copyWorkshopGeometry(record.fills),signature=copyWorkshopGeometry(record.signature);
 const wooden=[body,neck,fills].filter(Boolean);
 for(const group of [...wooden,signature].filter(Boolean)){
  instrument.add(group);group.traverse(m=>{if(m.isMesh){geometrySet.add(m.geometry);m.userData.workshopVisible=m.visible;if(group===signature){m.material=ownMat(m.material.clone());}}});
 }
 let state={...record.state},hardware,board,finishMaterials=new Map();
 const timber=new T.Group();timber.userData.workshopStation='wood';scene.add(timber);
 const stockTop=ownMat(new T.MeshStandardMaterial({roughness:.85,color:'#e4c99d'}));
 const stockBack=ownMat(new T.MeshStandardMaterial({roughness:.9,color:'#a4794d',map:texture('/assets/wood-real19-'+state.backWood+'.jpg')}));
 const stockNeck=ownMat(new T.MeshStandardMaterial({roughness:.8,color:'#c3a076',map:texture('/assets/wood-real19-'+state.neckWood+'.jpg')}));
 timber.add(box(.36,.48,.0254,stockBack,0,-.36,-.013));
 for(const sign of [-1,1])timber.add(box(.177,.48,.00635,stockTop,sign*.09,-.36,.006));
 timber.add(box(.075,.67,.035,stockNeck,.03,.27,-.002));
 function releaseGroup(group){if(!group)return;group.removeFromParent();group.traverse(m=>{if(m.isMesh&&geometrySet.delete(m.geometry))m.geometry.dispose();});}
 function ownGroup(group){group.traverse(m=>{if(m.isMesh)geometrySet.add(m.geometry);});instrument.add(group);return group;}
 function rebuild(){
  for(const pair of finishMaterials.values())for(const value of Object.values(pair)){value.dispose();materialSet.delete(value);}finishMaterials=new Map();
  const raw={...state,finishType:'dye',finish:'natural',burst:'none',sheen:'matte',headstockBurst:'match',backFinishType:'dye',backFinish:'natural',backBurst:'none',backSheen:'matte',neckFinishType:'dye',neckFinish:'natural',neckBurst:'none',neckSheen:'matte'};
  for(const group of wooden)group.traverse(m=>{
   if(!m.isMesh)return;const region=m.userData.region||m.material.name;
   if(!finishMaterials.has(region)){
    const basic=()=>new T.MeshStandardMaterial({color:region==='cover'?'#141619':'#4b3020',roughness:.82});
    finishMaterials.set(region,{raw:ownMat(['cover','cavity'].includes(region)?basic():woodMaterial(F,raw,region,record.id)),finished:ownMat(['cover','cavity'].includes(region)?basic():woodMaterial(F,state,region,record.id))});
   }
  });
  releaseGroup(hardware);releaseGroup(board);
  hardware=ownGroup(makeHardware(record.id,state,parts));board=ownGroup(mergeParts(makeFretboard(state)));
  stockTop.map=texture('/assets/wood-'+(F.WOODS[state.wood].grain||'real19-'+state.wood)+'.jpg');stockTop.needsUpdate=true;
  applyHandedness({group:instrument,signature,logo:signature?.children[0]},state);
  setStage(stage,false);
  const ticket=++revision;whenWoodTexturesReady().then(()=>{if(!disposed&&ticket===revision)draw();}).catch(()=>{if(!disposed)onError('Some wood textures could not load. Your design and workshop choices are still available.');});
 }
 function setStage(value,animate=true){
  const flags=stageParts(value);stage=flags.stage;
  if(tween){tween.object.position.copy(tween.base);tween=null;}
  timber.visible=flags.timber;supports.visible=flags.body;body.visible=flags.body;neck.visible=flags.neck;if(fills)fills.visible=flags.body;
  board.visible=flags.fretboard;hardware.visible=flags.hardware;if(signature)signature.visible=flags.signature;
  for(const group of wooden)group.traverse(m=>{if(m.isMesh){m.material=finishMaterials.get(m.userData.region||m.material.name)?.[flags.finished?'finished':'raw']||m.material;m.visible=m.userData.workshopVisible&&(m.userData.region!=='cover'||flags.covers);}});
  if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&stage>0){const object=stage===2?neck:stage===3?board:stage===5?hardware:body;tween={object,base:object.position.clone(),start:performance.now()};}
  renderer.shadowMap.needsUpdate=true;draw();
 }
 const labels=[...host.querySelectorAll('[data-bench-hotspot]')];
 function draw(){if(disposed||lost||document.hidden||!visible||frame)return;frame=requestAnimationFrame(render);}
 function render(now){
  frame=0;if(disposed||lost||document.hidden||!visible)return;
  if(tween){const t=Math.min(1,(now-tween.start)/750),ease=1-Math.pow(1-t,3);tween.object.position.z=tween.base.z+(1-ease)*115;renderer.shadowMap.needsUpdate=true;if(t===1){tween.object.position.copy(tween.base);tween=null;}}
  renderer.render(scene,camera);
  for(const label of labels){const group=tools[label.dataset.benchHotspot];if(!group)continue;const point=group.getWorldPosition(new T.Vector3());point.z+=.08;point.project(camera);label.hidden=Math.abs(point.x)>.91||Math.abs(point.y)>.86||point.z>1;label.style.left=((point.x+1)/2*100)+'%';label.style.top=((-point.y+1)/2*100)+'%';}
  if(tween)draw();
 }
 let width=0,height=0;
 function reset(){const distance=Math.max(1.65,1.67/(2*Math.tan(camera.fov*Math.PI/360)*camera.aspect));camera.position.copy(new T.Vector3(.22,-.12,1).normalize().multiplyScalar(distance));controls.target.set(0,0,0);controls.update();draw();}
 function resize(){const r=host.getBoundingClientRect();if(!r.width||!r.height)return;const first=!width;width=r.width;height=r.height;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();if(first)reset();draw();}
 function focusStation(id){const group=tools[id];if(!group)return;const target=group.getWorldPosition(new T.Vector3());target.z+=.03;controls.target.copy(target);camera.position.copy(target).add(new T.Vector3(.07,-.06,.48));controls.update();draw();}
 const onChange=()=>draw();controls.addEventListener('change',onChange);
 renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('role','group');renderer.domElement.setAttribute('aria-label','Interactive luthier workbench. Drag to rotate, pinch or scroll to zoom. Arrow keys turn the view; plus and minus zoom. Use the station buttons to explore tools.');
 renderer.domElement.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(event.key))return;event.preventDefault();const offset=camera.position.clone().sub(controls.target);if(event.key.startsWith('Arrow')){const axis=event.key==='ArrowLeft'||event.key==='ArrowRight'?camera.up:new T.Vector3().crossVectors(offset,camera.up).normalize();offset.applyAxisAngle(axis,(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1)*.1);}else offset.multiplyScalar(event.key==='-'?1.12:.9);offset.clampLength(.22,5);camera.position.copy(controls.target).add(offset);controls.update();draw();});
 let down=null;
 renderer.domElement.addEventListener('pointerdown',event=>{down=event.isPrimary?{x:event.clientX,y:event.clientY}:null;});
 renderer.domElement.addEventListener('pointercancel',()=>{down=null;});
 renderer.domElement.addEventListener('pointerup',event=>{const start=down;down=null;if(!start||Math.hypot(event.clientX-start.x,event.clientY-start.y)>6)return;const r=renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),camera);const hits=ray.intersectObjects([...Object.values(tools),...(timber.visible?[timber]:[])],true);if(hits.length){let item=hits[0].object;while(item&&!item.userData.workshopStation)item=item.parent;if(item)onPick(item.userData.workshopStation);}});
 const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else draw();};document.addEventListener('visibilitychange',visibility);
 const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)draw();},{rootMargin:'80px'});intersection.observe(host);
 const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);
 renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;cancelAnimationFrame(frame);frame=0;onError('The 3D workbench was paused by your device. You can still explore the stages and choices below.',{fatal:true});});
 host.prepend(renderer.domElement);rebuild();resize();
 return {
  setStage,focusStation,reset,
  zoom(factor){const offset=camera.position.clone().sub(controls.target).multiplyScalar(factor).clampLength(.22,5);camera.position.copy(controls.target).add(offset);controls.update();draw();},
  setLight(value){const a=Number(value)*Math.PI/180;key.position.set(Math.sin(a)*2,1,Math.cos(a)*2+.5);renderer.shadowMap.needsUpdate=true;draw();},
  setDesign(choices){for(const id of ['wood','inlays','fretboard'])if(F.choices[id]?.includes(choices[id]))state[id]=choices[id];rebuild();},
  dispose(){if(disposed)return;disposed=true;revision++;cancelAnimationFrame(frame);resizeObserver.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);controls.dispose();for(const geo of geometrySet)geo.dispose();for(const mat of materialSet)mat.dispose();for(const tex of textureSet)tex.dispose();environmentTarget.dispose();renderer.dispose();renderer.domElement.remove();}
 };
}
