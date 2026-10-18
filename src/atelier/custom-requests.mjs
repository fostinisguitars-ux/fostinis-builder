import {esc,readLocal,writeLocal,link,saveFile} from './core.mjs';
import {cleanCustomRequests,hasCustomRequests,CUSTOM_LIMITS} from '../../lib/custom-requests.mjs';
const STORAGE='fostinis-custom-requests-v1';
const fields=()=>window.FostinisPricing.catalog.fields;
const fieldLabel=key=>fields()[key]?.label||key;
export function customRequestMarkup(build){
 const requests=build?.customRequests||{};
 if(!hasCustomRequests(requests))return '';
 return `<section class="at-custom-summary"><h3>Your special requests</h3><p class="at-small">Custom choices and artwork are reviewed by the workshop. The 3D preview shows your selected catalog options.</p>${Object.entries(requests).map(([key,r])=>`<article><h4>${esc(fieldLabel(key))}</h4><p class="at-small">Selected: ${esc(fields()[key]?.options?.[build.selections[key]]?.label||build.selections[key])}</p>${r.text?`<p class="at-preserve-lines">${esc(r.text)}</p>`:''}<div class="at-file-list">${r.files.map(f=>`<button type="button" class="at-file" data-custom-download="${esc(f.id)}">↧ ${esc(f.name)} <small>${(f.size/1024/1024).toFixed(1)} MB</small></button>`).join('')}</div></article>`).join('')}</section>`;
}
export function bindCustomDownloads(container,build,{owner=false}={}){
 const files=Object.values(build?.customRequests||{}).flatMap(r=>r.files||[]);
 for(const button of container.querySelectorAll('[data-custom-download]'))button.onclick=async()=>{
  const file=files.find(f=>f.id===button.dataset.customDownload);if(!file)return;
  const old=button.textContent;button.disabled=true;button.textContent='Opening file…';
  try{const response=await fetch('/api/atelier/upload?id='+encodeURIComponent(file.id),{headers:owner?{}:{Authorization:'Bearer '+file.token}});if(!response.ok){const error=await response.json();throw Error(error.message);}saveFile(await response.blob(),file.name);button.textContent=old;}catch(error){button.textContent=error.message+' — retry';}finally{button.disabled=false;}
 };
}
export function initializeCustomRequests(){
 const studio=window.FostinisStudio;if(!studio?.ready||window.FostinisCustomRequests)return;
 const originalGet=studio.getSavedBuild.bind(studio),originalRestore=studio.restoreBuild.bind(studio),allowed=Object.keys(fields());
 let state=readLocal(STORAGE,{}),uploading=0;
 if(!state||typeof state!=='object'||Array.isArray(state))state={};
 for(const model of Object.keys(window.Fostinis.MODELS)){try{state[model]=cleanCustomRequests(state[model],allowed);}catch{state[model]={};}}
 if(studio.isSharedBuild?.())state[originalGet().model]={};
 const current=()=>state[originalGet().model]||{};
 const persist=()=>writeLocal(STORAGE,state);
 studio.getSavedBuild=()=>({...originalGet(),customRequests:JSON.parse(JSON.stringify(current()))});
 studio.restoreBuild=record=>{const clean=cleanCustomRequests(record.customRequests,allowed);originalRestore(record);state[record.model]=clean;persist();document.querySelectorAll('.at-option-request').forEach(p=>p.remove());refresh();};
 const commerce=window.FostinisCommerce,originalUpdate=commerce?.update.bind(commerce);
 if(commerce)commerce.update=data=>{const customRequests=state[data.model]||{};originalUpdate({...data,customRequests,notes:(data.notes||'')+(hasCustomRequests(customRequests)?'\nCustom option requests and design files need workshop approval.':'')});updateLinks();};
 function updateLinks(){
  const custom=hasCustomRequests(current()),url=link('commission');
  for(const a of document.querySelectorAll('[data-custom-request]'))a.href=url;
  if(custom){for(const a of document.querySelectorAll('[data-request-quote],#inquire-build'))a.href=url;const message=document.getElementById('checkout-availability');if(message)message.textContent='Your special requests need a personal quote. Send your configuration and files to receive the updated invoice.';}
  const summary=document.getElementById('at-custom-review');if(summary){summary.hidden=!custom;summary.innerHTML=customRequestMarkup(studio.getSavedBuild())+`<a class="at-button at-primary" href="${url}">Send my special-order request ↗</a>`;bindCustomDownloads(summary,studio.getSavedBuild());}
 }
 function refresh(){mountFields();if(originalUpdate)commerce.update(originalGet());updateLinks();}
 function commit(model,key,entry){if(studio.isSharedBuild?.())studio.saveSharedBuild();state[model]??={};if(entry.text.trim()||entry.files.length)state[model][key]=entry;else delete state[model][key];const saved=persist();if(originalUpdate)commerce.update(originalGet());updateLinks();return saved;}
 function mountFields(){
  const model=originalGet().model;
  for(const select of document.querySelectorAll('#fields select[id^="option-"]')){
   const key=select.id.slice(7);if(!allowed.includes(key))continue;
   let panel=select.parentElement.querySelector('.at-option-request');
   if(panel&&panel.dataset.model===model)continue;
   panel?.remove();panel=document.createElement('details');panel.className='at-option-request';panel.dataset.model=model;
   const entry=()=>state[model]?.[key]||{text:'',files:[]};panel.open=!!state[model]?.[key];
   panel.innerHTML=`<summary>${state[model]?.[key]?'Special request added':'Request another option / upload a design'}</summary><label for="custom-${key}">What would you like instead?<textarea id="custom-${key}" rows="3" maxlength="2000" placeholder="${key==='pickupSet'||key==='singleCoilModel'?'Example: replace the selected pickups with the exact make and model you want.':key==='inlays'?'Describe your inlay design, material, and fret positions. Attach your artwork below.':'Describe your preferred option, including make, model, color, or dimensions.'}">${esc(entry().text)}</textarea></label><label class="at-upload-label">Attach artwork or a reference<input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf"></label><p class="at-small">JPG, PNG, WebP, or PDF · 10 MB per file · 3 per option. Original files stay private with your request.</p><div class="at-file-list"></div><p class="at-status" role="status"></p>`;
   const list=panel.querySelector('.at-file-list'),status=panel.querySelector('.at-status'),summary=panel.querySelector('summary');
   function renderFiles(){list.innerHTML=entry().files.map(f=>`<div class="at-file-row"><span>${esc(f.name)}</span><button type="button" data-remove-file="${f.id}" aria-label="Remove ${esc(f.name)}">Remove</button></div>`).join('');for(const b of list.querySelectorAll('button'))b.onclick=()=>{commit(model,key,{...entry(),files:entry().files.filter(f=>f.id!==b.dataset.removeFile)});renderFiles();summary.textContent=state[model]?.[key]?'Special request added':'Request another option / upload a design';};}
   panel.querySelector('textarea').oninput=e=>{const saved=commit(model,key,{...entry(),text:e.target.value});summary.textContent=state[model]?.[key]?'Special request added':'Request another option / upload a design';status.textContent=saved?'Saved with your design.':'This browser cannot save your request. Submit it before leaving this page.';};
   const input=panel.querySelector('input');input.onchange=async()=>{
    const chosen=[...(input.files||[])];if(!chosen.length)return;
    if(uploading){status.textContent='Wait for the current files to finish uploading, then add these files.';input.value='';return;}
    try{
     const total=Object.values(state[model]||{}).reduce((n,r)=>n+r.files.length,0);
     if(entry().files.length+chosen.length>3||total+chosen.length>8)throw Error('Choose up to three files per option and eight files per guitar.');
     if(chosen.some(f=>f.size>CUSTOM_LIMITS.fileBytes))throw Error('Each file must be 10 MB or smaller.');
     input.disabled=true;uploading++;
     for(const file of chosen){status.textContent='Uploading '+file.name+'…';const response=await fetch('/api/atelier/upload?field='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream','X-Upload-Name':encodeURIComponent(file.name)},body:file});const data=await response.json();if(!response.ok)throw Error(data.message);commit(model,key,{...entry(),files:[...entry().files,data]});renderFiles();}
     summary.textContent='Special request added';status.textContent='Original files uploaded and saved with your design.';
    }catch(error){status.textContent=error.message;}finally{input.value='';input.disabled=false;uploading=Math.max(0,uploading-1);}
   };
   renderFiles();select.parentElement.append(panel);
  }
 }
 const review=document.getElementById('build-checkout');if(review){const box=document.createElement('div');box.id='at-custom-review';review.before(box);}
 const target=document.getElementById('fields');if(target)new MutationObserver(mountFields).observe(target,{childList:true});
 window.addEventListener('fostinis:build',refresh);
 document.getElementById('reset')?.addEventListener('click',()=>{state[originalGet().model]={};persist();document.querySelectorAll('.at-option-request').forEach(p=>p.remove());queueMicrotask(refresh);},true);
 window.addEventListener('beforeunload',event=>{if(uploading){event.preventDefault();event.returnValue='';}});
 window.FostinisCustomRequests={get:()=>JSON.parse(JSON.stringify(current())),getAll:()=>JSON.parse(JSON.stringify(state)),isUploading:()=>uploading>0,refresh};
 refresh();
}
