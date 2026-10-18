import {cleanNickname,decodeBuild,buildURL,shareKey,PLATFORMS,messageFor,messageLink,nativePayload,canShareFiles,photoZIP,fileStem} from './share-core.mjs';
import {makeShareCards} from './share-cards.mjs';
import {initializeSavedBuilds} from './saved-builds.mjs';

// This small classic bundle loads before the inline configurator, so a validated
// shared build is applied before any model is rendered or persisted.
window.FostinisSharing={cleanNickname,decodeBuild};
function initialize(){
 const studio=window.FostinisStudio,F=window.Fostinis,$=id=>document.getElementById(id),dialog=$('build-share-dialog');
 if(!studio?.getShareData||!dialog)return;
 initializeSavedBuilds({studio,F});
 let platform='instagram',data=null,url='',key='',revision=0,photos=null,rawViews=null,rawKey='',urls=[],sharing=false,returnFocus=null;
 const cache=new Map();
 function status(message){$('share-status').textContent=message;}
 function revoke(){for(const value of urls)URL.revokeObjectURL(value);urls=[];}
 function objectURL(blob){const value=URL.createObjectURL(blob);urls.push(value);return value;}
 function current(){return studio.getShareData();}
 function fresh(){if(data&&shareKey(current())===key)return true;status('Your build changed. Prepare the photos again to share your latest choices.');$('share-retry').hidden=false;$('share-native').disabled=true;return false;}
 function configureActions(){
  if(!data)return;const p=PLATFORMS[platform],privateMessage=platform==='email'||platform==='text';
  for(const button of dialog.querySelectorAll('[data-share-platform]'))button.setAttribute('aria-pressed',String(button.dataset.sharePlatform===platform));
  $('share-copy-area').value=messageFor(platform,data,url);$('share-copy-message').textContent=privateMessage?'Copy full appointments':'Copy caption';
  $('share-message').hidden=!privateMessage;if(privateMessage){$('share-message').href=messageLink(platform,data,url,navigator.userAgent);$('share-message').textContent=platform==='email'?'Open email with appointments':'Open text with appointments';}
  $('share-open-platform').hidden=privateMessage;if(!privateMessage){$('share-open-platform').href=p.url;$('share-open-platform').textContent='Open '+p.name+' ↗';}
  const payload=nativePayload(platform,data,url,photos?.map(photo=>photo.file)||[]),supported=canShareFiles(navigator,payload);
  $('share-native').hidden=!!photos&&!supported;$('share-native').disabled=!photos||sharing;
  $('share-native').textContent=privateMessage?'Share photos + appointments…':'Share photos…';
  $('share-help').textContent=privateMessage?'Choose '+(platform==='email'?'Mail':'Messages')+' in the share menu to include the photos and full appointments. The direct '+p.name.toLowerCase()+' link includes all appointments and a link to the three views; attach downloaded photos if you like.':
   'Choose '+p.name+' in your phone’s share menu. If it is not listed, save the photos below, open '+p.name+' and add them to a '+(platform==='tiktok'?'photo post':platform==='instagram'?'carousel or story':'post')+'. Paste the caption if you want to include your build link.';
 }
 async function prepare(){
  const ticket=++revision;data=current();key=shareKey(data);url=buildURL(data,F,location.origin);photos=null;revoke();$('share-gallery').replaceChildren();$('share-gallery').setAttribute('aria-busy','true');$('share-download-all').hidden=true;$('share-retry').hidden=true;$('share-title').textContent=(data.nickname?'Share “'+data.nickname+'”':'Share your '+data.modelName)+'.';configureActions();status('Preparing the front, back and 45° photos…');
  const format=PLATFORMS[platform].format,cacheKey=key+':'+format;
  try{
   let result=cache.get(cacheKey);
   if(!result){
    if(rawKey!==key){
     // The 3D loader starts after DOMContentLoaded. Poll only while this dialog
     // is open, with a deadline and an actionable fallback if WebGL is missing.
     const deadline=Date.now()+45000;
     while(!window.FostinisShowroom?.ready){if(ticket!==revision||!dialog.open)return;if(Date.now()>deadline)throw Error('The 3D photos are still loading. Try again in a moment, or share the build link below.');await new Promise(resolve=>setTimeout(resolve,250));}
     const captured=await window.FostinisShowroom.exportShareViews();
     if(ticket!==revision||!dialog.open)return;
     if(key!==shareKey(current())||captured.snapshot.selected!==data.model||JSON.stringify(captured.snapshot.builds[data.model])!==JSON.stringify(data.selections))throw Error('Your build changed. Prepare the photos again.');
     rawViews=captured.views;rawKey=key;
    }
    const cards=await makeShareCards(rawViews,data,format),zip=await photoZIP(cards.map(photo=>photo.file));result={cards,zip};
    if(ticket!==revision||key!==shareKey(current())||!dialog.open)return;
    cache.set(cacheKey,result);while(cache.size>2)cache.delete(cache.keys().next().value);
   }
   if(ticket!==revision||!dialog.open)return;photos=result.cards;
   for(const photo of photos){const figure=document.createElement('figure'),image=document.createElement('img'),caption=document.createElement('figcaption'),label=document.createElement('span'),save=document.createElement('a'),src=objectURL(photo.file);image.src=src;image.alt=(data.nickname||data.modelName)+' — '+photo.label+' — Fostinis Guitars';image.width=1080;image.height=format==='story'?1920:1350;label.textContent=photo.label;save.href=src;save.download=photo.file.name;save.textContent='Save photo';caption.append(label,save);figure.append(image,caption);$('share-gallery').append(figure);}
   const download=$('share-download-all');download.href=objectURL(result.zip);download.download=fileStem(data)+'_'+format+'_Photos.zip';download.hidden=false;
   status('Your three '+(format==='story'?'9:16':'4:5')+' photos are ready. Swipe through them on your phone, then choose how to share.');configureActions();
  }catch(error){if(ticket!==revision)return;photos=null;status(error.message||'The photos could not be prepared. Try again, or share the build link.');$('share-retry').hidden=false;configureActions();$('share-native').hidden=true;}
  finally{if(ticket===revision)$('share-gallery').removeAttribute('aria-busy');}
 }
 function open(){returnFocus=document.activeElement;dialog.showModal();prepare();}
 $('share-build').addEventListener('click',open);$('share-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{revision++;revoke();photos=null;returnFocus?.focus();});
 for(const button of dialog.querySelectorAll('[data-share-platform]'))button.addEventListener('click',()=>{const previous=PLATFORMS[platform].format;platform=button.dataset.sharePlatform;if(previous!==PLATFORMS[platform].format)prepare();else configureActions();});
 $('share-retry').addEventListener('click',prepare);
 $('share-native').addEventListener('click',async()=>{
  if(sharing||!photos||!fresh())return;
  const payload=nativePayload(platform,data,url,photos.map(photo=>photo.file));
  if(!canShareFiles(navigator,payload)){status('Save the photos below and add them in '+PLATFORMS[platform].name+'.');configureActions();return;}
  sharing=true;configureActions();
  try{await navigator.share(payload);status('The share menu has closed. Finish your post or message in the app you chose.');}
  catch(error){status(error.name==='AbortError'?'Sharing canceled. Your photos are still ready.':'This device could not share the photos directly. Save them below and add them in your app.');}
  finally{sharing=false;configureActions();}
 });
 async function copy(value,label){
  try{if(!navigator.clipboard?.writeText)throw Error('clipboard');await navigator.clipboard.writeText(value);status(label+' copied.');}
  catch{$('share-copy-area').value=value;$('share-copy-area').focus();$('share-copy-area').select();status('Select and copy the text shown below.');}
 }
 $('share-copy-link').addEventListener('click',()=>{if(fresh())copy(url,'Build link');});
 $('share-copy-message').addEventListener('click',()=>{if(fresh())copy(messageFor(platform,data,url),platform==='email'||platform==='text'?'Full appointments':'Caption');});
 $('share-message').addEventListener('click',event=>{if(!fresh())event.preventDefault();});
 for(const event of ['fostinis:build','fostinis:identity'])window.addEventListener(event,()=>{if(dialog.open&&data&&shareKey(current())!==key){revision++;photos=null;revoke();$('share-gallery').replaceChildren();$('share-download-all').hidden=true;$('share-gallery').removeAttribute('aria-busy');fresh();}});
 if(studio.isSharedBuild?.())open();
 if(studio.sharedBuildError){$('shared-build-notice').hidden=false;$('shared-build-message').textContent=studio.sharedBuildError;$('save-shared-build').hidden=true;}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else queueMicrotask(initialize);
