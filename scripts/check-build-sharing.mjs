import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {cleanNickname,encodeBuild,decodeBuild,buildURL,SHARE_FIELDS,SHARE_FIELDS_V1,PLATFORMS,messageFor,messageLink,nativePayload,canShareFiles,socialSummary,photoZIP} from '../src/sharing/share-core.mjs';
import {drawShareCard,wrapText,CARD_SIZES} from '../src/sharing/share-cards.mjs';
import catalog from '../lib/commerce/catalog.json' with {type:'json'};
import {createBuildStore,parseBuildBackup,serializeBuildBackup,SAVED_BUILDS_KEY} from '../src/sharing/saved-builds.mjs';

const html=fs.readFileSync('public/review.html','utf8'),scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)],window={};
vm.runInNewContext(scripts[0][1].slice(scripts[0][1].indexOf('window.FostinisParts=')),{window});const F=window.Fostinis;
// These labels and visibility rules come from the real inline configurator.
function fixture({saved,encoded}={}){
 const elements=new Map(),writes=[],navigation=[],windowCopy={...window,FostinisSharing:{cleanNickname,decodeBuild}},localStorage={getItem:key=>key==='fostinis-showroom-v4'&&saved?JSON.stringify(saved):null,setItem:(key,value)=>writes.push([key,JSON.parse(value)])};
 const $=id=>{if(!elements.has(id))elements.set(id,{textContent:'',value:'',hidden:true,focus(){this.focused=true;},select(){this.selected=true;},scrollIntoView(){this.scrolled=true;}});return elements.get(id);};
 windowCopy.FostinisPricing={catalog};windowCopy.location={search:encoded?'?build='+encoded:''};
 const schemaStart=html.indexOf('const SCHEMA='),schemaEnd=html.indexOf('function legacyPreview(',schemaStart),stateStart=html.indexOf("const STORAGE='fostinis-showroom-v4'"),stateEnd=html.indexOf('function toast(',stateStart);
 const context=vm.createContext({window:windowCopy,F,P:F.PARTS,$,localStorage,URLSearchParams,URL,document:{body:{dataset:{}}},location:{search:encoded?'?build='+encoded:'',href:'https://fostinisguitars.com/review.html'},history:{replaceState(){}},toast(){},go:(page,options)=>navigation.push({page,...options}),renderFields(){},updateSelected(){},renderLive(){},renderModel(){},updateSummary(){},updateInquiry(){},CustomEvent:class{constructor(type){this.type=type;}},console});
 vm.runInContext(html.slice(schemaStart,schemaEnd)+html.slice(stateStart,stateEnd)+html.split('\n').find(line=>line.startsWith('function setModel('))+`\nglobalThis.api={getShareData,getSavedBuild,restoreBuild,persist,renderNickname,saveSharedBuild,continueSharedBuild,isShared:()=>sharedBuildActive,error:()=>sharedBuildError,setModel:id=>selected=id,nicknames,notes,builds};`,context);
 const nicknameStart=html.indexOf("$('guitar-nickname').oninput="),nicknameEnd=html.indexOf("$('notes').oninput=",nicknameStart);windowCopy.dispatchEvent=()=>{};
 vm.runInContext(html.slice(nicknameStart,nicknameEnd),context);
 return {api:context.api,elements,$,writes,navigation};
}
test('Every model and option round-trips through a stable share link with no notes, prices, or other builds',()=>{
 assert.deepEqual([...Object.keys(F.choices)].sort(),[...SHARE_FIELDS].sort());let count=0;
 for(const model of Object.keys(F.MODELS))for(const [field,values] of Object.entries(F.choices))for(const value of values){
  const selections=F.normalize(model,{...F.initial(model),[field]:value}),data={model,selections,nickname:'Midnight 🌙 <Rose>',notes:'PRIVATE NOTE',email:'private@example.com'};
  const token=encodeBuild(data,F),decoded=decodeBuild(token,F);assert.equal(decoded.model,model);assert.deepEqual(decoded.selections,selections);assert.equal(decoded.nickname,data.nickname);assert(token.length<1800);
  const decodedJSON=Buffer.from(token,'base64url').toString();assert(!decodedJSON.includes('PRIVATE'));assert(!decodedJSON.includes('example.com'));
  const link=new URL(buildURL(data,F,'https://www.fostinisguitars.com'));assert.equal(link.pathname,'/review.html');assert.equal(link.hash,'#review');assert.deepEqual(decodeBuild(link.searchParams.get('build'),F),decoded);count++;
 }
 console.log('Round-tripped '+count+' model/option combinations.');
});
test('Malformed, oversized and unsupported shared builds are rejected before import',()=>{
 for(const input of ['',null,'=','a'.repeat(4097),Buffer.from('{}').toString('base64url')])assert.throws(()=>decodeBuild(input,F));
 const base=JSON.parse(Buffer.from(encodeBuild({model:'sphyx',selections:F.initial('sphyx'),nickname:''},F),'base64url'));
 for(const patch of [{v:3},{m:'__proto__'},{m:'constructor'},{s:[]},{s:[...base.s.slice(0,-1),'<script>']},{n:{html:'oops'}}])assert.throws(()=>decodeBuild(Buffer.from(JSON.stringify({...base,...patch})).toString('base64url'),F));
 assert.equal(cleanNickname('  Midnight\nRose\u202e  '),'Midnight Rose');assert.equal([...cleanNickname('🎸'.repeat(50))].length,40);
});
test('Nickname persists per model, migrates existing saves, and sits above appointments',()=>{
 const u=fixture({saved:{selected:'oryx',builds:{oryx:F.initial('oryx')},notes:{oryx:'My private notes'}}});
 u.$('guitar-nickname').oninput({target:{value:'  Midnight 🌙  '}});assert.equal(u.$('guitar-name').textContent,'Midnight 🌙');assert.equal(u.writes.at(-1)[1].nicknames.oryx,'Midnight 🌙');assert.equal(u.writes.at(-1)[1].notes.oryx,'My private notes');
 u.api.setModel('sphyx');u.api.renderNickname();assert.equal(u.$('guitar-nickname').value,'');u.$('guitar-nickname').oninput({target:{value:'Screamer'}});u.api.setModel('oryx');u.api.renderNickname();assert.equal(u.$('guitar-name').textContent,'Midnight 🌙');
 const restored=fixture({saved:u.writes.at(-1)[1]});restored.api.setModel('oryx');restored.api.renderNickname();assert.equal(restored.$('guitar-nickname').value,'Midnight 🌙');
 assert(html.indexOf('id="guitar-name"')<html.indexOf('<div class="eyebrow">All appointments</div>'));
});
test('Viewing a shared build never overwrites saved builds until Save as my build is chosen',()=>{
 const saved={selected:'oryx',builds:{oryx:F.normalize('oryx',{finish:'sapphire'}),sphyx:F.normalize('sphyx',{finish:'ruby'})},notes:{oryx:'private'},nicknames:{oryx:'Original',sphyx:'Keep me'}};
 const encoded=encodeBuild({model:'oryx',selections:F.normalize('oryx',{finish:'green',burst:'faded'}),nickname:'A shared guitar'},F),u=fixture({saved,encoded});
 assert(u.api.isShared());assert.equal(u.api.getShareData().nickname,'A shared guitar');assert.equal(u.api.notes.oryx,'');u.api.persist();assert.equal(u.writes.length,0);assert.equal(u.api.nicknames.sphyx,'Keep me');
 u.api.saveSharedBuild();assert.equal(u.writes.length,1);assert(!u.api.isShared());assert.equal(u.writes[0][1].nicknames.oryx,'A shared guitar');assert.equal(u.writes[0][1].builds.sphyx.finish,'ruby');
 const invalid=fixture({saved,encoded:'bad'});assert(invalid.api.error());assert.equal(invalid.api.getShareData().nickname,'Original');
});
test('Email and text include exactly the visible All Appointments; social exports contain only the requested categories',()=>{
 const u=fixture();u.$('guitar-nickname').oninput({target:{value:'Midnight Rose'}});u.api.notes.sphyx='PRIVATE NOTE';
 for(const pickupLayout of F.choices.pickupLayout){u.api.builds.sphyx=F.normalize('sphyx',{...u.api.builds.sphyx,pickupLayout});const data=u.api.getShareData(),url=buildURL(data,F,'https://fostinisguitars.com'),files=[new File(['photo'],'front.jpg',{type:'image/jpeg'})];
  const summary=socialSummary(data);assert.deepEqual(summary.map(row=>row.label),['FINISHES','PICKUPS','HARDWARE']);assert(!JSON.stringify(summary).includes('PRIVATE'));assert(!JSON.stringify(summary).includes('Fretboard'));
  for(const platform of Object.keys(PLATFORMS)){const message=messageFor(platform,data,url),payload=nativePayload(platform,data,url,files);assert(!message.includes('PRIVATE'));assert(message.includes('Midnight Rose'));assert(message.includes(url));
   if(['text','email'].includes(platform)){assert(message.includes('Midnight Rose\nAll Appointments'));for(const [name,value] of data.appointments)assert(message.includes(name+': '+value));assert.equal(payload.text,message);assert(messageLink(platform,data,url,'iPhone').includes('body='+encodeURIComponent(message)));}
   else{assert(!message.includes('All Appointments'));assert(!message.includes('Fretboard:'));assert.deepEqual(Object.keys(payload),['files']);}
  }
 }
 assert(!canShareFiles({},{}));assert(!canShareFiles({share(){},canShare(){throw Error();}},{files:[1]}));assert(canShareFiles({share(){},canShare:()=>true},{files:[1]}));
});
test('Branded photo layouts fit long real finish, pickup and hardware labels in both sizes',()=>{
 const u=fixture();u.api.nicknames.sphyx='Midnight Rose — The Very Long Guitar Name';
 const operations=[];const ctx={font:'',textAlign:'left',measureText(text){const size=Number(this.font.match(/(\d+)px/)?.[1]||20);return {width:[...text].length*size*.58};},fillText(text,x,y){operations.push({text,x,y,font:this.font});},fillRect(){},drawImage(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
 for(const pickupSet of ['sd-saturday-night-special','bkp-juggernaut'])for(const pickupLayout of ['hsh','sss'])for(const format of Object.keys(CARD_SIZES)){
  u.api.builds.sphyx=F.normalize('sphyx',{...u.api.builds.sphyx,pickupSet,pickupLayout,tunerModel:'schaller-locking',bridgeModel:'floyd-pro',burst:'faded',backBurst:'darkcherry',neckBurst:'charcoal'});
  operations.length=0;const result=drawShareCard(ctx,{width:720,height:1440},u.api.getShareData(),'angle',format);
  assert(operations.some(op=>op.text==='Fostinis Guitars'));assert(operations.some(op=>op.text.includes('45° VIEW')));assert(!operations.some(op=>op.text.includes('All Appointments')));assert(result.summaryBottom<result.footerTop,'summary collided with footer');assert(operations.every(op=>op.y>=0&&op.y<result.height));
 }
 assert(wrapText(ctx,'a'.repeat(200),330).length>1);
});
test('All photos are included in a standards-readable ZIP with valid headers and file bytes',async()=>{
 const files=['front','back','angle'].map(side=>new File(['photo '+side],'Fostinis_'+side+'.jpg',{type:'image/jpeg'})),zip=await photoZIP(files),bytes=new Uint8Array(await zip.arrayBuffer()),view=new DataView(bytes.buffer);let offset=0;
 for(const file of files){assert.equal(view.getUint32(offset,true),0x04034b50);const size=view.getUint32(offset+18,true),nameLength=view.getUint16(offset+26,true);assert.equal(new TextDecoder().decode(bytes.slice(offset+30,offset+30+nameLength)),file.name);assert.equal(new TextDecoder().decode(bytes.slice(offset+30+nameLength,offset+30+nameLength+size)),await file.text());offset+=30+nameLength+size;}
 assert.equal(view.getUint32(offset,true),0x02014b50);assert.equal(view.getUint32(bytes.length-22,true),0x06054b50);assert.equal(view.getUint16(bytes.length-12,true),3);
});
test('Every route has a single sharing entry point and nickname field and valid inline JavaScript',()=>{
 let count=0;for(const name of fs.readdirSync('public').filter(name=>name.endsWith('.html'))){const h=fs.readFileSync('public/'+name,'utf8');if(!h.includes('window.FostinisStudio='))continue;
  for(const id of ['guitar-nickname','guitar-name','share-build','build-share-dialog','share-gallery','share-native','share-copy-status','share-copy-label','save-shared-build','saved-builds-dialog','save-build-form','import-build-backup'])assert.equal(h.split('id="'+id+'"').length-1,1,name+'/'+id);
  assert(h.includes('/build-sharing.js?v=55'));assert(h.includes('/showroom-loader.js?v=55'));assert(h.includes('getShareData,getSavedBuild,restoreBuild,isSharedBuild:'));
  for(const match of h.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1],{filename:name});count++;
 }assert.equal(count,233);
});

test('Recipients customize, order or rename their own exact copy and can resume or share it independently',()=>{
 const sender=structuredClone({model:'oryx',selections:F.normalize('oryx',{handedness:'left',finish:'purple',burst:'faded',backBurst:'faded',neckBurst:'faded',pickupLayout:'hss',hardware:'gold',caseOption:'fitted'}),nickname:'Midnight Rose'}),encoded=encodeBuild(sender,F);
 for(const action of ['customize','order','rename']){
  const u=fixture({encoded,saved:{selected:'sphyx',builds:{sphyx:F.normalize('sphyx',{finish:'ruby'})},nicknames:{sphyx:'Keep me'}}});
  u.api.continueSharedBuild(action);
  assert(!u.api.isShared());assert.equal(u.api.getShareData().nickname,sender.nickname);assert.deepEqual({...u.api.getShareData().selections},sender.selections);
  const saved=u.writes.at(-1)[1];assert.equal(saved.nicknames.sphyx,'Keep me');assert.equal(saved.builds.sphyx.finish,'ruby');assert.deepEqual(saved.builds.oryx,sender.selections);
  assert.equal(u.navigation.at(-1).page,action==='customize'?'showroom':'review');
  if(action==='order')assert.equal(u.navigation.at(-1).target,'build-checkout');
  if(action==='rename')assert(u.$('guitar-nickname').focused&&u.$('guitar-nickname').selected&&u.$('guitar-nickname').scrolled);
  u.$('guitar-nickname').oninput({target:{value:'My Midnight'}});u.api.builds.oryx.finish='ruby';u.api.persist();
  const resumed=fixture({saved:u.writes.at(-1)[1]});assert.equal(resumed.api.getShareData().nickname,'My Midnight');assert.equal(resumed.api.getShareData().selections.finish,'ruby');
  const next=decodeBuild(encodeBuild(resumed.api.getShareData(),F),F);assert.equal(next.nickname,'My Midnight');assert.equal(next.selections.finish,'ruby');
  assert.deepEqual(structuredClone(decodeBuild(encoded,F)),sender,'The sender’s link remains an immutable snapshot');
 }
});

test('Named snapshots survive reload and restore selections, nickname and notes without changing other models',()=>{
 const memory=new Map(),storage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)};let nextId=0;
 const store=createBuildStore(storage,F,{newId:()=>String(++nextId)}),u=fixture();
 u.api.builds.oryx=F.normalize('oryx',{finish:'sapphire'});u.api.nicknames.oryx='Keep me';u.api.notes.sphyx='Remember the special strap.';u.api.nicknames.sphyx='Midnight Rose';u.api.builds.sphyx=F.normalize('sphyx',{finish:'purple',burst:'faded',backBurst:'faded',pickupLayout:'hss',hardware:'gold'});
 const original=u.api.getSavedBuild(),saved=store.add(original,'The stage guitar');u.api.builds.sphyx.finish='ruby';u.api.notes.sphyx='Changed';u.api.nicknames.sphyx='Other';
 const reloaded=createBuildStore(storage,F).list();assert.equal(reloaded.length,1);assert.equal(reloaded[0].name,'The stage guitar');assert.equal(reloaded[0].nickname,'Midnight Rose');assert.equal(reloaded[0].selections.finish,'purple');
 u.api.restoreBuild(reloaded[0]);assert.equal(u.api.getSavedBuild().nickname,'Midnight Rose');assert.equal(u.api.getSavedBuild().notes,original.notes);assert.deepEqual(u.api.getSavedBuild().selections,original.selections);assert.equal(u.api.builds.oryx.finish,'sapphire');assert.equal(u.api.nicknames.oryx,'Keep me');
 const later=fixture({saved:u.writes.at(-1)[1]});assert.equal(later.api.getSavedBuild().nickname,'Midnight Rose');assert.equal(later.api.getSavedBuild().notes,original.notes);assert.deepEqual({...later.api.getSavedBuild().selections},{...original.selections});
 const backup=serializeBuildBackup(reloaded),imported=parseBuildBackup(backup,F);assert.equal(imported[0].notes,original.notes);store.importAll(backup);assert.equal(store.list().length,2);assert.notEqual(store.list()[0].id,saved.id);
 store.remove(saved.id);assert.equal(store.list().length,1);assert.equal(store.list()[0].nickname,'Midnight Rose');
 assert(memory.has(SAVED_BUILDS_KEY));
});
test('Backups import on another device, including legacy build sheets, and fail safely for bad files or blocked storage',()=>{
 const selections=F.initial('matadaur'),backup=serializeBuildBackup([{model:'matadaur',selections,nickname:'Road guitar',notes:'Private notes'}]);
 const destination=new Map(),store=createBuildStore({getItem:key=>destination.get(key)||null,setItem:(key,value)=>destination.set(key,value)},F);
 store.importAll(backup);assert.equal(store.list()[0].nickname,'Road guitar');assert.equal(store.list()[0].notes,'Private notes');
 const legacy=parseBuildBackup(JSON.stringify({schemaVersion:9,builds:{matadaur:selections},nicknames:{matadaur:'Old friend'},notes:{matadaur:'Keep this'}}),F);assert.equal(legacy[0].nickname,'Old friend');assert.equal(legacy[0].notes,'Keep this');
 const before=JSON.stringify(store.list());for(const invalid of ['oops','{}',JSON.stringify({format:'fostinis-build-backup',version:1,builds:[{model:'constructor',selections}]}),JSON.stringify({format:'fostinis-build-backup',version:1,builds:[{model:'matadaur',selections:{...selections,finish:'bogus'}}]})])assert.throws(()=>store.importAll(invalid));assert.equal(JSON.stringify(store.list()),before);
 const blocked=createBuildStore({getItem:()=>null,setItem(){throw Error('quota');}},F);assert.throws(()=>blocked.add({model:'matadaur',selections},'Road guitar'),/could not save/);
 assert.throws(()=>parseBuildBackup('a'.repeat(1024*1024+1),F),/1 MB/);
});
