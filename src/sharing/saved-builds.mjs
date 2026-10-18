import {cleanNickname,SHARE_FIELDS,fileStem} from './share-core.mjs';
import {cleanCustomRequests} from '../../lib/custom-requests.mjs';
export const SAVED_BUILDS_KEY='fostinis-saved-builds-v1';
export function normalizeSavedBuild(input,F,{legacy=false}={}){
 if(!input||!Object.hasOwn(F.MODELS,input.model)||!input.selections||typeof input.selections!=='object')throw Error('This file does not contain a valid Fostinis build.');
 if(Object.hasOwn(input.selections,'handedness')&&!F.choices.handedness.includes(input.selections.handedness))throw Error('This build includes an unavailable handedness option.');
 if(!legacy)for(const key of SHARE_FIELDS){if(key==='handedness'&&!Object.hasOwn(input.selections,key))continue;if(!F.choices[key].includes(input.selections[key]))throw Error('This build includes an unavailable option. Please use a current build backup.');}
 return {model:input.model,selections:F.normalize(input.model,input.selections),nickname:cleanNickname(input.nickname),notes:typeof input.notes==='string'?input.notes.slice(0,3000):'',customRequests:cleanCustomRequests(input.customRequests,SHARE_FIELDS)};
}
export function parseBuildBackup(text,F){
 if(typeof text!=='string'||text.length>1024*1024)throw Error('Choose a Fostinis build backup smaller than 1 MB.');
 let parsed;try{parsed=JSON.parse(text);}catch{throw Error('This file is not a readable build backup.');}
 if(parsed?.format==='fostinis-build-backup'&&parsed.version===1&&Array.isArray(parsed.builds)&&parsed.builds.length>0&&parsed.builds.length<=20)return parsed.builds.map(b=>({...normalizeSavedBuild(b,F),name:cleanNickname(b.name)||cleanNickname(b.nickname)||'My '+F.MODELS[b.model].name}));
 // Keep previously downloaded Save build sheet files useful after this update.
 if(parsed?.schemaVersion===9&&parsed.builds&&typeof parsed.builds==='object')return Object.keys(F.MODELS).filter(model=>Object.hasOwn(parsed.builds,model)).map(model=>({...normalizeSavedBuild({model,selections:parsed.builds[model],nickname:parsed.nicknames?.[model],notes:parsed.notes?.[model],customRequests:parsed.customRequests?.[model]},F,{legacy:true}),name:cleanNickname(parsed.nicknames?.[model])||'My '+F.MODELS[model].name}));
 throw Error('Choose a Fostinis build backup or a saved Fostinis build sheet.');
}
export function serializeBuildBackup(builds){return JSON.stringify({format:'fostinis-build-backup',version:1,exportedAt:new Date().toISOString(),builds},null,2);}
export function createBuildStore(storage,F,{newId=()=>crypto.randomUUID(),now=()=>new Date().toISOString()}={}){
 function list(){
  let value;try{value=JSON.parse(storage.getItem(SAVED_BUILDS_KEY)||'[]');}catch{throw Error('Saved builds could not be read in this browser. Download a backup to keep your current guitar.');}
  if(!Array.isArray(value)||value.length>20)throw Error('The saved-build list could not be read. Your working build is still available.');
  return value.map(record=>{if(typeof record.id!=='string'||typeof record.name!=='string')throw Error('A saved build could not be read.');return {...normalizeSavedBuild(record,F),id:record.id,name:cleanNickname(record.name),createdAt:record.createdAt,updatedAt:record.updatedAt};});
 }
 function write(records){try{storage.setItem(SAVED_BUILDS_KEY,JSON.stringify(records));}catch{throw Error('This browser could not save the build. Download a backup below to keep it.');}return records;}
 function add(input,name){const records=list();if(records.length>=20)throw Error('You have 20 saved builds. Download a backup and remove a saved version to make room.');const time=now(),record={...normalizeSavedBuild(input,F),id:newId(),name:cleanNickname(name)||cleanNickname(input.nickname)||'My '+F.MODELS[input.model].name,createdAt:time,updatedAt:time};write([record,...records]);return record;}
 function remove(id){return write(list().filter(record=>record.id!==id));}
 function importAll(text){const incoming=parseBuildBackup(text,F),records=list();if(records.length+incoming.length>20)throw Error('There is room for '+(20-records.length)+' more saved builds. Remove a saved version before importing this file.');const time=now();return write([...incoming.map(record=>({...record,id:newId(),createdAt:time,updatedAt:time})),...records]);}
 return {list,add,remove,importAll};
}
export function initializeSavedBuilds({studio,F}){
 const $=id=>document.getElementById(id),dialog=$('saved-builds-dialog');if(!dialog)return;
 let storage;try{storage=window.localStorage;}catch{storage={getItem(){throw Error();},setItem(){throw Error();}};}
 const store=createBuildStore(storage,F);let downloadURLs=[],returnFocus=null;
 const status=message=>{$('saved-build-status').textContent=message;};
 function backupLink(link,records,name){const url=URL.createObjectURL(new Blob([serializeBuildBackup(records)],{type:'application/json'}));downloadURLs.push(url);link.href=url;link.download=name;link.hidden=false;}
 function refresh(){
  for(const url of downloadURLs)URL.revokeObjectURL(url);downloadURLs=[];const current=studio.getSavedBuild();
  backupLink($('download-current-build'),[current],fileStem({...current,modelName:F.MODELS[current.model].name})+'_Backup.json');
  const list=$('saved-build-list');list.replaceChildren();$('download-saved-builds').hidden=true;
  try{
   const records=store.list();if(records.length)backupLink($('download-saved-builds'),records,'Fostinis_Saved_Builds.json');
   if(!records.length){const p=document.createElement('p');p.textContent='Your named builds will appear here. Your current progress already saves automatically in this browser.';list.append(p);}
   for(const record of records){
    const item=document.createElement('article'),heading=document.createElement('h3'),detail=document.createElement('p'),actions=document.createElement('div'),resume=document.createElement('button'),download=document.createElement('a'),remove=document.createElement('button');
    heading.textContent=record.name;detail.textContent=F.MODELS[record.model].name+' · '+(record.selections.handedness==='left'?'Left-handed':'Right-handed')+(record.nickname?' · '+record.nickname:'')+' · '+new Date(record.updatedAt).toLocaleDateString();actions.className='saved-item-actions';resume.type=remove.type='button';resume.textContent='Resume build';remove.textContent='Remove saved version';download.textContent='Download backup';backupLink(download,[record],fileStem({...record,modelName:F.MODELS[record.model].name})+'_Backup.json');
    resume.onclick=()=>{try{studio.restoreBuild(record);dialog.close();}catch(error){status(error.message);}};
    remove.onclick=()=>{try{store.remove(record.id);refresh();status('Saved version removed. Your current working build is unchanged.');}catch(error){status(error.message);}};
    actions.append(resume,download,remove);item.append(heading,detail,actions);list.append(item);
   }
  }catch(error){status(error.message);}
 }
 function open(){returnFocus=document.activeElement;const current=studio.getSavedBuild();$('saved-build-name').value=current.nickname||'My '+F.MODELS[current.model].name;status('Changes save automatically in this browser. Save a named version to return to it later.');refresh();dialog.showModal();}
 for(const button of document.querySelectorAll('[data-saved-builds]'))button.addEventListener('click',open);
 $('saved-build-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{for(const url of downloadURLs)URL.revokeObjectURL(url);downloadURLs=[];returnFocus?.focus();});
 $('save-build-form').onsubmit=event=>{event.preventDefault();try{const record=store.add(studio.getSavedBuild(),$('saved-build-name').value);refresh();status('“'+record.name+'” is saved. Open Saved builds in this browser to continue later.');}catch(error){status(error.message);}};
 $('import-build-backup').onchange=async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>1024*1024)throw Error('Choose a build backup smaller than 1 MB.');store.importAll(await file.text());refresh();status('Backup imported. Choose Resume build below to continue editing.');}catch(error){status(error.message);}finally{event.target.value='';}};
}
