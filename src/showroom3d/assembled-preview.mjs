import * as T from 'three';

// The detail view and completed image render the very same scene objects. No
// second set of finish swatches, composited photographs, or material overrides.
export function renderGuitarView({scene,models,selected,environmentGroup,key,environment},render){
 const previous={background:scene.background,fog:scene.fog,environment:scene.environment,room:environmentGroup.visible,shadow:key.castShadow};
 const visibility=[...models.values()].map(rec=>[rec,rec.group.visible,rec.stand.visible]);
 try{
  scene.background=new T.Color('#1c1e22');scene.fog=null;scene.environment=environment;environmentGroup.visible=false;key.castShadow=false;
  for(const [id,rec] of models){rec.group.visible=id===selected;rec.stand.visible=false;}
  return render();
 }finally{
  for(const [rec,group,stand] of visibility){rec.group.visible=group;rec.stand.visible=stand;}
  scene.background=previous.background;scene.fog=previous.fog;scene.environment=previous.environment;environmentGroup.visible=previous.room;key.castShadow=previous.shadow;
 }
}

export function completedCamera(rec,{side='front',focus='full',aspect=8/3}={}){
 rec.group.updateWorldMatrix(true,true);
 const bounds=new T.Box3().setFromObject(focus==='body'?rec.body:rec.group);
 if(bounds.isEmpty())throw Error('The showroom guitar is still loading.');
 const center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
 const camera=new T.PerspectiveCamera(32,aspect,.005,10);
 // Roll the camera, not the guitar: this retains the showroom's light direction
 // on every material, and fits the entire selected model at either orientation.
 const tangent=Math.tan(T.MathUtils.degToRad(camera.fov/2));
 const distance=Math.max(size.x/(2*tangent),size.y/(2*tangent*aspect))*1.15+size.z/2;
 camera.up.set(-1,0,0);camera.position.copy(center).add(new T.Vector3(0,0,distance*(side==='back'?-1:1)));camera.lookAt(center);camera.updateMatrixWorld();
 return camera;
}

export function captureCompletedGuitar(context,{side='front',focus='full'}={}){
 const {renderer,models,selected,afterCapture}=context,rec=models.get(selected);
 if(!rec?.body)throw Error('The showroom guitar is still loading.');
 const width=1600,height=focus==='body'?1200:600;
 const camera=completedCamera(rec,{side,focus,aspect:width/height});
 const size=renderer.getSize(new T.Vector2()),ratio=renderer.getPixelRatio();
 try{
  renderer.setPixelRatio(1);renderer.setSize(width,height,false);
  const url=renderGuitarView(context,()=>{renderer.render(context.scene,camera);return renderer.domElement.toDataURL('image/png');});
  return {url,width,height};
 }finally{
  renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);afterCapture?.();
 }
}

export function completedKey(snapshot){return JSON.stringify([snapshot.selected,snapshot.builds[snapshot.selected],snapshot.review?.side||'front',snapshot.review?.focus||'full']);}

export function createCompletedPreview({studio,F,context,waitForBuilds,waitForTextures}){
 const host=document.getElementById('review-image');let revision=0,cached=null;
 function status(message){const p=document.createElement('p');p.className='completed-preview-status';p.setAttribute('role','status');p.textContent=message;host.replaceChildren(p);}
 function invalidate(){
  revision++;
  const snapshot=studio.getSnapshot();
  if(snapshot.review?.side==='original'){host.removeAttribute('aria-busy');return;}
  if(cached?.key!==completedKey(snapshot)){cached=null;host.setAttribute('aria-busy','true');status('Preparing your showroom guitar…');}
 }
 async function ready(){
  let pending;do{pending=waitForBuilds();await pending;await waitForTextures();}while(pending!==waitForBuilds());
  const snapshot=studio.getSnapshot(),rec=context.models.get(snapshot.selected);
  if(JSON.stringify(rec?.state)!==JSON.stringify(snapshot.builds[snapshot.selected]))throw Error('Your guitar is updating. Please try again in a moment.');
  if(context.renderer.getContext().isContextLost())throw Error('The 3D preview is unavailable. Reload the page to restore your showroom view.');
  return snapshot;
 }
 async function refresh(){
  const ticket=++revision,snapshot=studio.getSnapshot(),key=completedKey(snapshot);
  if(snapshot.review?.side==='original')return;
  if(cached?.key===key){host.replaceChildren(cached.image);host.removeAttribute('aria-busy');return cached;}
  host.setAttribute('aria-busy','true');status('Preparing your showroom guitar…');
  try{
   await ready();
   if(ticket!==revision||key!==completedKey(studio.getSnapshot()))return;
   const result=captureCompletedGuitar({...context,selected:snapshot.selected},snapshot.review);
   const img=new Image();img.width=result.width;img.height=result.height;img.alt=F.MODELS[snapshot.selected].name+' — completed '+(snapshot.review?.side==='back'?'back':'front')+' from your showroom build';img.src=result.url;
   await img.decode();
   if(ticket!==revision||key!==completedKey(studio.getSnapshot()))return;
   host.replaceChildren(img);host.removeAttribute('aria-busy');cached={...result,key,image:img};return cached;
  }catch(error){if(ticket===revision){cached=null;host.removeAttribute('aria-busy');status('The completed 3D preview is unavailable. Your selections are saved. Reload the page to restore your showroom view.');console.error('Completed showroom preview unavailable',error);}}
 }
 async function exportPNG(){
  const requested=completedKey(studio.getSnapshot()),snapshot=await ready(),key=completedKey(snapshot);
  if(requested!==key)throw Error('Your guitar changed. Please save the current preview again.');
  const result=cached?.key===key?cached:captureCompletedGuitar({...context,selected:snapshot.selected},{side:snapshot.review?.side==='back'?'back':'front',focus:snapshot.review?.focus||'full'});
  return (await fetch(result.url)).blob();
 }
 function unavailable(){revision++;cached=null;host.removeAttribute('aria-busy');if(studio.getSnapshot().review?.side!=='original')status('The completed 3D preview is unavailable. Your selections are saved. Reload the page to restore your showroom view.');}
 return {invalidate,refresh,exportPNG,unavailable};
}
