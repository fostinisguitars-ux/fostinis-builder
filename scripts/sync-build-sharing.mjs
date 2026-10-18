import fs from 'node:fs';
import {decorateShareButtons,shareEntryIcons} from '../src/sharing/social-icons.mjs';
const dialog=decorateShareButtons(fs.readFileSync('src/sharing/share-dialog.html','utf8'));
const saveDialog=fs.readFileSync('src/sharing/save-dialog.html','utf8');
fs.copyFileSync('src/sharing/share.css','public/build-sharing.css');
const marker='// Branded build sharing and per-model nicknames, revision 51.';
const sharedState=`${marker}
const cleanNickname=value=>window.FostinisSharing?.cleanNickname(value)||'';
let sharedBuildActive=false,sharedBuildError='';
try{const encoded=new URLSearchParams(location.search).get('build');if(encoded){
 const shared=window.FostinisSharing.decodeBuild(encoded,F);selected=shared.model;builds[selected]=shared.selections;nicknames[selected]=shared.nickname;notes[selected]='';sharedBuildActive=true;previewFocus='full';previewSide='front';
}}catch(error){sharedBuildError=error.message||'This shared build could not be opened. Ask for a new link.';}
function visibleAppointmentKeys(state){return Object.keys(SCHEMA).filter(k=>!(E.potFields.includes(k)&&!E.layout(state).pots.includes(E.potFields.indexOf(k)))&&!(['singleCoilModel','singleCoilCover'].includes(k)&&!E.count(state,'S'))&&!(['pickupSet','pickups'].includes(k)&&!E.count(state,'H')));}
function getShareData(){const state=builds[selected];return {model:selected,modelName:F.MODELS[selected].name,selections:JSON.parse(JSON.stringify(state)),nickname:nicknames[selected]||'',labels:Object.fromEntries(Object.keys(SCHEMA).map(k=>[k,label(k,state)])),appointments:visibleAppointmentKeys(state).map(k=>[fieldName(k,state),label(k,state)])};}
function renderNickname(){const name=nicknames[selected]||'';$('guitar-name').textContent=name||'Made personal.';$('guitar-nickname').value=name;}
function saveSharedBuild(){sharedBuildActive=false;persist();$('shared-build-notice').hidden=true;try{const url=new URL(location.href);url.searchParams.delete('build');history.replaceState(null,'',url.pathname+url.search+url.hash);}catch{}toast('This guitar is now saved as your '+F.MODELS[selected].name+' build.');}
`;
let count=0;
for(const file of fs.readdirSync('public').filter(name=>name.endsWith('.html'))){
 const path='public/'+file;let html=fs.readFileSync(path,'utf8');if(!html.includes('window.FostinisStudio='))continue;
 function replace(from,to){if(!html.includes(from))throw Error('Missing sharing insertion in '+file+': '+from.slice(0,90));html=html.replace(from,to);}
 if(!html.includes(marker)){
  replace("notes={sphyx:'',oryx:'',matadaur:''};","notes={sphyx:'',oryx:'',matadaur:''},nicknames={sphyx:'',oryx:'',matadaur:''};");
  replace("notes[id]=typeof saved.notes?.[id]==='string'?saved.notes[id].slice(0,3000):'';","notes[id]=typeof saved.notes?.[id]==='string'?saved.notes[id].slice(0,3000):'';nicknames[id]=window.FostinisSharing?.cleanNickname(saved.nicknames?.[id])||'';");
  replace('function label(key,state=builds[selected]){',sharedState+'function label(key,state=builds[selected]){');
  replace('function persist(){try{',"function persist(){if(sharedBuildActive){$('storage-status').textContent='Viewing a shared build. Save it as your build to keep these choices.';return;}try{");
  replace('JSON.stringify({selected,builds,notes})','JSON.stringify({selected,builds,notes,nicknames})');
  replace('function renderReview(){const s=builds[selected];','function renderReview(){renderNickname();const s=builds[selected];');
  replace('selectedModel:selected,builds,notes,labels:','selectedModel:selected,builds,notes,nicknames,labels:');
  replace("notes[selected]='';view='front';","notes[selected]='';nicknames[selected]='';view='front';");
  replace("$('notes').oninput=e=>{",`$('guitar-nickname').oninput=e=>{nicknames[selected]=cleanNickname(e.target.value);$('guitar-name').textContent=nicknames[selected]||'Made personal.';persist();window.dispatchEvent(new CustomEvent('fostinis:identity'));};
 $('guitar-nickname').onblur=renderNickname;
 $('save-shared-build').onclick=saveSharedBuild;
 $('shared-build-notice').hidden=!sharedBuildActive;
 $('notes').oninput=e=>{`);
  replace("window.FostinisStudio={root:$('main'),ready:true,getSnapshot:","window.FostinisStudio={root:$('main'),ready:true,getShareData,isSharedBuild:()=>sharedBuildActive,sharedBuildError,getSnapshot:");
  replace('builds:JSON.parse(JSON.stringify(builds)),side:previewSide','builds:JSON.parse(JSON.stringify(builds)),nicknames:{...nicknames},side:previewSide');
  replace('<div class="details-box"><div class="eyebrow">All appointments</div><h2 style="margin-top:12px">Made personal.</h2>',`<div class="details-box"><h2 id="guitar-name">Made personal.</h2><div class="eyebrow">All appointments</div><div class="guitar-nickname-field"><label for="guitar-nickname">Give your guitar a nickname (optional)</label><input disabled data-requires-js id="guitar-nickname" type="text" maxlength="40" autocomplete="off" placeholder="e.g. Midnight Rose" aria-describedby="nickname-hint"><p class="note" id="nickname-hint">Up to 40 characters. Appears on your build and shared photos.</p></div>`);
  replace('<button disabled data-requires-js id="export-image">Save preview</button>','<button disabled data-requires-js id="export-image">Save preview</button><button disabled data-requires-js id="share-build" type="button" class="primary" aria-haspopup="dialog" aria-controls="build-share-dialog">Share your build</button>');
  replace('<section id="review" class="page section">','<section id="review" class="page section"><div id="shared-build-notice" hidden><p id="shared-build-message">You’re viewing a shared guitar. Your saved builds are unchanged.</p><button type="button" id="save-shared-build">Save as my build</button></div>');
 }
 if(!html.includes('// Saved snapshots and portable backups, revision 51.')){
  replace('function getShareData(){',`// Saved snapshots and portable backups, revision 51.
function getSavedBuild(){return {model:selected,selections:JSON.parse(JSON.stringify(builds[selected])),nickname:nicknames[selected]||'',notes:notes[selected]||''};}
function restoreBuild(record){if(!Object.prototype.hasOwnProperty.call(F.MODELS,record.model))throw Error('Unknown guitar model.');selected=record.model;builds[selected]=F.normalize(selected,record.selections);notes[selected]=typeof record.notes==='string'?record.notes.slice(0,3000):'';nicknames[selected]=cleanNickname(record.nickname);sharedBuildActive=false;$('shared-build-notice').hidden=true;try{const url=new URL(location.href);url.searchParams.delete('build');history.replaceState(null,'',url.pathname+url.search+url.hash);}catch{}setModel(selected);renderNickname();go('showroom',{target:'builder'});toast('Your saved '+F.MODELS[selected].name+' is ready to continue.');}
function getShareData(){`);
  replace('ready:true,getShareData,isSharedBuild:','ready:true,getShareData,getSavedBuild,restoreBuild,isSharedBuild:');
  replace('<button disabled data-requires-js id="share-build"','<button disabled data-requires-js data-saved-builds type="button" aria-haspopup="dialog" aria-controls="saved-builds-dialog">Save / resume builds</button><button disabled data-requires-js id="share-build"');
  html=html.replace(/(<strong data-current-model>[^<]+<\/strong>)/,'$1<button disabled data-requires-js data-saved-builds class="saved-builds-dock" type="button" aria-haspopup="dialog" aria-controls="saved-builds-dialog">Saved builds</button>');
 }
 if(!html.includes('/build-sharing.js'))html=html.replace('</head>','<link rel="stylesheet" href="/build-sharing.css?v=54">\n<script src="/build-sharing.js?v=54"></script>\n</head>');
 if(!html.includes("window.addEventListener('pagehide',persist)"))replace("$('notes').oninput=e=>{notes[selected]=e.target.value;updateInquiry();clearTimeout(saveTimer);saveTimer=setTimeout(persist,200);};",`$('notes').oninput=e=>{notes[selected]=e.target.value;updateInquiry();clearTimeout(saveTimer);saveTimer=setTimeout(persist,200);};
 // Flush pending note edits when a customer leaves or backgrounds the page.
 window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persist();});`);
 if(!html.includes('id="build-share-dialog"'))html=html.replace('</body>',dialog+'\n</body>');
 else html=html.replace(/<dialog id="build-share-dialog"[\s\S]*?<\/dialog>/,dialog.trim());
 if(!html.includes('id="saved-builds-dialog"'))html=html.replace('</body>',saveDialog+'\n</body>');
 else html=html.replace(/<dialog id="saved-builds-dialog"[\s\S]*?<\/dialog>/,saveDialog.trim());
 html=html.replace(/(\/build-sharing\.(?:js|css)\?v=)\d+/g,(_,prefix)=>prefix+'54');
 html=html.replace(/(<button[^>]*id="share-build"[^>]*>)[\s\S]*?(<\/button>)/g,(_,open,close)=>open+'Share your build'+shareEntryIcons+close);
 fs.writeFileSync(path,html);count++;
}
console.log('Connected sharing and nicknames on '+count+' routes');
