import {buildURL} from '../sharing/share-core.mjs';
export const esc = value => String(value??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(cents/100);
export const date = value => new Date(value).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'});
export const readLocal = (key,fallback=null) => {try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
export function writeLocal(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
export async function api(action,{data,token,query=''}={}) {
 const response=await fetch('/api/atelier/'+action+query,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined});
 const body=await response.json();if(!response.ok)throw Object.assign(new Error(body.message||'Please try again.'),{status:response.status});return body;
}
export function metric(event){api('metric',{data:{event}}).catch(()=>{});}
export function link(view,params={}){const u=new URL('/atelier.html',location.origin);u.searchParams.set('view',view);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));return u.pathname+u.search;}
export function privateLink(view,token){return location.origin+link(view)+'#access='+token;}
export function publicBuild(build){return buildURL({model:build.model,selections:build.selections,nickname:build.nickname},window.Fostinis,location.origin);}
export function labels(build){const F=window.Fostinis;return Object.fromEntries(Object.entries(build.selections||{}).map(([key,value])=>[key,window.FostinisCommerceCatalog?.fields?.[key]?.options?.[value]?.label||F?.LABELS?.[value]||value]));}
export const specNames={wood:'Top wood',finish:'Top color',burst:'Burst',sheen:'Sheen',backWood:'Body wood',neckWood:'Neck wood',pickupSet:'Humbuckers',pickupLayout:'Pickup layout',singleCoilModel:'Single coils',bridgeModel:'Bridge',tunerModel:'Tuners',hardware:'Hardware',handedness:'Handedness',fretboard:'Fretboard'};
export function specRows(build){const l=labels(build);return Object.entries(specNames).filter(([k])=>k!=='singleCoilModel'||build.selections.pickupLayout.includes('s')).filter(([k])=>k!=='pickupSet'||build.selections.pickupLayout.includes('h')).map(([k,n])=>`<div><dt>${n}</dt><dd>${esc(l[k]||'—')}</dd></div>`).join('');}
export function differences(a,b){const aa=labels(a),bb=labels(b);return Object.entries(specNames).filter(([key])=>a.selections[key]!==b.selections[key]).map(([key,label])=>({key,label,a:aa[key],b:bb[key]}));}
export function snapshot(){return window.FostinisStudio.getSavedBuild();}
export function modelName(id){return window.Fostinis.MODELS[id]?.name||id;}
export async function prepareShowroom(){
 if(window.FostinisShowroom?.ready)return window.FostinisShowroom;
 return new Promise((resolve,reject)=>{
  let timer;const clear=()=>{clearTimeout(timer);window.removeEventListener('fostinis:room-ready',ready);window.removeEventListener('fostinis:3d-unavailable',failed);};
  const ready=()=>{clear();resolve(window.FostinisShowroom);},failed=()=>{clear();reject(Error('The 3D preview could not load on this device. Your design is still saved.'));};
  window.addEventListener('fostinis:room-ready',ready,{once:true});window.addEventListener('fostinis:3d-unavailable',failed,{once:true});timer=setTimeout(failed,45000);window.dispatchEvent(new CustomEvent('fostinis:playroom-open'));
 });
}
export async function compressImage(source,max=1000){
 const url=typeof source==='string'?source:URL.createObjectURL(source);try{const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas'),ratio=Math.min(1,max/Math.max(image.width,image.height));c.width=Math.round(image.width*ratio);c.height=Math.round(image.height*ratio);c.getContext('2d').drawImage(image,0,0,c.width,c.height);let result=c.toDataURL('image/webp',.76);if(result.length>175000)result=c.toDataURL('image/jpeg',.45);if(result.length>175000)throw Error('Choose a smaller photo.');return result;}finally{if(typeof source!=='string')URL.revokeObjectURL(url);}
}
export async function captureThumb(){const showroom=await prepareShowroom();return compressImage(await showroom.exportPreview(),800);}
export async function copy(text){if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}const field=document.createElement('textarea');field.value=text;document.body.append(field);field.select();const ok=document.execCommand('copy');field.remove();if(!ok)throw Error('Copy this link from the displayed field.');}
export function saveFile(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
