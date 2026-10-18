import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from 'three';
import catalog from '../lib/commerce/catalog.json' with {type:'json'};
import {createPricingEngine} from '../lib/commerce/pricing-engine.mjs';
import {encodeBuild,decodeBuild,SHARE_FIELDS_V1} from '../src/sharing/share-core.mjs';
import {normalizeSavedBuild,createBuildStore,serializeBuildBackup,parseBuildBackup} from '../src/sharing/saved-builds.mjs';
import {applyHandedness} from '../src/showroom3d/handedness.mjs';
import {makeHardware} from '../src/showroom3d/geometry.mjs';

const html=fs.readFileSync('public/review.html','utf8'),window={};
const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
vm.runInNewContext(inline[0][1].slice(inline[0][1].indexOf('window.FostinisParts=')),{window});
const F=window.Fostinis,pricing=createPricingEngine(catalog);

test('All models retain handedness through shared links, snapshots, portable backups and server pricing',()=>{
 for(const model of Object.keys(F.MODELS))for(const handedness of ['left','right']){
  const input={model,selections:F.normalize(model,{...F.initial(model),handedness,burst:'faded',hardware:'gold'}),nickname:'My guitar',notes:'My setup'};
  const shared=decodeBuild(encodeBuild(input,F),F);assert.deepEqual(shared.selections,input.selections);
  let stored='[]';const storage={getItem:()=>stored,setItem:(key,value)=>stored=value};
  const saved=createBuildStore(storage,F,{newId:()=>model+handedness}).add(input);
  const resumed=createBuildStore(storage,F).list()[0];assert.deepEqual(resumed,saved);
  const portable=parseBuildBackup(serializeBuildBackup([resumed]),F)[0];assert.deepEqual(portable.selections,input.selections);assert.equal(portable.nickname,input.nickname);assert.equal(portable.notes,input.notes);
  const quote=pricing.quote(model,portable.selections);assert.equal(quote.selections.handedness,handedness);assert.equal(quote.lines.find(l=>l.key==='handedness').value,handedness==='left'?'Left-handed':'Right-handed');
  assert.equal(quote.subtotalCents,pricing.quote(model,{...portable.selections,handedness:'right'}).subtotalCents);
 }
});

test('Existing v1 links and older saved builds migrate to right-handed; invalid new choices fail safely',()=>{
 for(const model of Object.keys(F.MODELS)){
  const selections=F.initial(model);delete selections.handedness;
  const token=Buffer.from(JSON.stringify({v:1,m:model,s:SHARE_FIELDS_V1.map(k=>selections[k]),n:'Original'})).toString('base64url');
  const decoded=decodeBuild(token,F);assert.equal(decoded.selections.handedness,'right');assert.equal(decoded.nickname,'Original');
  assert.deepEqual(decoded.selections,F.normalize(model,selections));
  assert.equal(normalizeSavedBuild({model,selections},F).selections.handedness,'right');
  assert.equal(pricing.validate(model,selections).handedness,'right');
  for(const value of ['ambidextrous','__proto__',null,{}]){
   assert.throws(()=>normalizeSavedBuild({model,selections:{...selections,handedness:value}},F));
   assert.throws(()=>pricing.validate(model,{...selections,handedness:value}));
  }
 }
});

test('The actual selector updates each model independently and reveals the full left-handed preview',()=>{
 const elements=new Map();let handler,persisted,previewed;
 const element=()=>({children:[],append(...items){this.children.push(...items);},addEventListener(event,fn){if(event==='change')handler=fn;},setAttribute(){}});
 const context={F,P:F.PARTS,E:window.FostinisElectronics,selected:'sphyx',builds:Object.fromEntries(Object.keys(F.MODELS).map(id=>[id,F.initial(id)])),previewFocus:'controls',previewSide:'back',SCHEMA:{handedness:{name:'Handedness',values:[['right','Right-handed'],['left','Left-handed']]}},fieldName:()=> 'Handedness',document:{createElement:element},syncFields(){},persist(){persisted=structuredClone(context.builds);},renderLive(){previewed={focus:context.previewFocus,side:context.previewSide};},schedule(){},toast(){}};
 vm.createContext(context);
 vm.runInContext(html.slice(html.indexOf('function optionField('),html.indexOf('function renderFields('))+html.slice(html.indexOf('function configure('),html.indexOf('function schedule(')),context);
 for(const model of Object.keys(F.MODELS)){
  context.selected=model;const field=vm.runInContext("optionField('handedness')",context),[label,select,help]=field.children;
  assert.equal(label.htmlFor,select.id);assert.equal(select.value,'right');assert.equal(help.id,'help-handedness');
  select.value='left';handler();assert.equal(persisted[model].handedness,'left');assert.deepEqual(previewed,{focus:'full',side:'front'});
 }
 assert(Object.values(persisted).every(s=>s.handedness==='left'));
 context.selected='oryx';vm.runInContext("configure('handedness','right')",context);assert.equal(persisted.oryx.handedness,'right');assert.equal(persisted.sphyx.handedness,'left');assert.equal(persisted.matadaur.handedness,'left');
});

test('The complete guitar and headstock logo reflect once and return to their original geometry',()=>{
 for(const model of Object.keys(F.MODELS)){
  const state=F.initial(model),group=new T.Group(),signature=new T.Group(),logo=new T.Mesh(new T.PlaneGeometry(80,60),new T.MeshBasicMaterial());
  group.position.set(.52,.42,0);group.scale.setScalar(.001);logo.rotation.set(-17*Math.PI/180,0,Math.PI/2);logo.position.set(0,736,-30);signature.add(logo);
  const hardware=makeHardware(model,state,F.PARTS);group.add(hardware,signature);const rec={group,signature};group.updateWorldMatrix(true,true);
  const meshes=[];hardware.traverse(o=>{if(o.isMesh)meshes.push(o);});
  const points=meshes.map(m=>m.getWorldPosition(new T.Vector3())),logoMatrix=logo.matrixWorld.clone(),geometries=meshes.map(m=>m.geometry);
  applyHandedness(rec,{handedness:'left'});applyHandedness(rec,{handedness:'left'});
  meshes.forEach((m,i)=>{const p=m.getWorldPosition(new T.Vector3());assert(Math.abs(p.x-(1.04-points[i].x))<1e-9);assert(Math.abs(p.y-points[i].y)<1e-9);assert(Math.abs(p.z-points[i].z)<1e-9);assert.strictEqual(m.geometry,geometries[i]);});
  const reflectedLogo=new T.Matrix4().makeTranslation(2*group.position.x,0,0).multiply(new T.Matrix4().makeScale(-1,1,1)).multiply(logoMatrix);
  logo.matrixWorld.elements.forEach((value,i)=>assert(Math.abs(value-reflectedLogo.elements[i])<1e-9,'Headstock logo must flip with the guitar'));
  assert(logo.matrixWorld.determinant()<0);
  applyHandedness(rec,{handedness:'right'});assert.deepEqual(logo.matrixWorld.elements,logoMatrix.elements);meshes.forEach((m,i)=>assert(m.getWorldPosition(new T.Vector3()).distanceTo(points[i])<1e-9));
 }
});

test('Every entry point exposes the same selector, and fallback front/back/detail SVGs mirror only the guitar',()=>{
 let routes=0;
 for(const file of fs.readdirSync('public').filter(f=>f.endsWith('.html'))){const page=fs.readFileSync('public/'+file,'utf8');if(!page.includes('window.FostinisStudio='))continue;
  assert(page.includes("fields.replaceChildren();fields.append(optionField('handedness'));"),file);
  assert(page.includes("handedness:['right','left']"),file);assert(page.includes('commerce-catalog.js?v='+catalog.version),file);routes++;
 }
 assert.equal(routes,233);
 for(const model of Object.keys(F.MODELS))for(const side of ['front','back'])for(const focus of ['full','body','headstock','controls'])for(const upright of [true,false]){
  const svg=F.renderer({'headstock-signature':'signature.jpg'}).svg(model,{...F.initial(model),handedness:'left'},{side,focus,upright,stand:true});
  assert(!svg.includes('<svg transform='),'The signature must not cancel the guitar reflection');
  assert(svg.includes('data-handedness="left"'));assert(svg.includes('Left-handed'));assert(svg.includes('data-component="guitar-handedness" transform="translate('));assert(svg.includes('scale(-1 1)'));
  assert(!svg.includes('NaN'));const bounds=svg.match(/viewBox="([^"]+)"/g).at(-1).match(/[\d.-]+/g).map(Number);assert(bounds.every(Number.isFinite));
 }
});
