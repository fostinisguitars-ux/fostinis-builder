import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from 'three';
import catalog from './catalog.json' with {type:'json'};
import {createPricingEngine} from './pricing-engine.mjs';
import {makeFretboard} from '../../src/showroom3d/geometry.mjs';
import {woodMaterial,whenWoodTexturesReady} from '../../src/showroom3d/materials.mjs';

const html=fs.readFileSync('public/showroom.html','utf8'),inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)],window={};
vm.runInNewContext(inline[0][1].slice(inline[0][1].indexOf('window.FostinisParts=')),{window});
const F=window.Fostinis,pricing=createPricingEngine(catalog);

test('Burl is a top-only $800 upgrade and maple/Cherub Wings persist as included appointments',()=>{
 for(const model of Object.keys(catalog.models)){
  const base=F.initial(model),state=F.normalize(model,{...base,wood:'burl',fretboard:'maple',inlays:'motif'}),saved=F.normalize(model,JSON.parse(JSON.stringify(state)));
  assert.equal(saved.wood,'burl');assert.equal(saved.fretboard,'maple');assert.equal(saved.inlays,'motif');
  const q=pricing.quote(model,saved),baseline=pricing.quote(model,{...base,wood:'ash'});
  assert.equal(q.subtotalCents-baseline.subtotalCents,80000);
  assert.equal(q.lines.find(l=>l.key==='fretboard').cents,0);assert.equal(q.lines.find(l=>l.key==='inlays').value,'Cherub Wings');
  for(const field of ['backWood','neckWood']){assert(!F.choices[field].includes('burl'));assert.throws(()=>pricing.quote(model,{...saved,[field]:'burl'}));}
 }
});

test('Maple uses lengthwise real grain and unchanged fretboard geometry; burl shares the actual 3D texture path and export readiness',async()=>{
 const original=T.TextureLoader.prototype.load,pending=[];
 T.TextureLoader.prototype.load=function(url,onLoad){assert(fs.existsSync('public'+url),'Missing texture '+url);const map=new T.Texture();map.name=url;pending.push(()=>onLoad(map));return map;};
 try{
  const state={...F.initial('sphyx'),wood:'burl',finish:'natural',fretboard:'maple',headstockBurst:'match'},ebony=makeFretboard({...state,fretboard:'ebony'}),maple=makeFretboard(state);
  assert.equal(maple.children.length,ebony.children.length);
  for(let i=0;i<maple.children.length;i++)assert.deepEqual(maple.children[i].geometry.attributes.position.array,ebony.children[i].geometry.attributes.position.array);
  const board=maple.children[0].material;assert(board.isMeshStandardMaterial);assert.equal(board.color.getHexString(),'ffffff');assert.equal(board.map.name,'/assets/wood-real19-maple.jpg');
  const geometry=maple.children[0].geometry,points=new Map(),positions=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<positions.count;i++){const key=[positions.getX(i),positions.getY(i),positions.getZ(i)].map(n=>n.toFixed(4)).join(','),value=[uv.getX(i),uv.getY(i)];if(points.has(key))assert(value.every((n,j)=>Math.abs(n-points.get(key)[j])<1e-6),'Grain splits at a shared board edge');else points.set(key,value);}
  const along=new T.Vector2(1,0).rotateAround(new T.Vector2(),board.map.rotation);assert(Math.abs(along.x)<1e-8);assert(Math.abs(along.y-1)<1e-8);
  for(const model of Object.keys(catalog.models)){
   const top=woodMaterial(F,state,'top',model),head=woodMaterial(F,state,'headstock_front',model),binding=woodMaterial(F,state,'binding',model);
   assert.equal(top.map.name,'/assets/wood-real44-burl.jpg');assert.strictEqual(head.map,top.map);assert.equal(binding.map.name,'/assets/wood-real19-flame.jpg');
   assert.equal(woodMaterial(F,{...state,finishType:'solid',finish:'black'},'top',model).map,null);
   for(const region of ['back','neck'])assert(woodMaterial(F,state,region,model).map.name.includes('mahogany'));
   top.dispose();head.dispose();binding.dispose();
  }
  let ready=false;const wait=whenWoodTexturesReady().then(()=>{ready=true;});await Promise.resolve();assert.equal(ready,false,'Completed preview must wait for new wood textures');
  pending.forEach(done=>done());await wait;assert(ready);
 }finally{T.TextureLoader.prototype.load=original;}
});

test('All routes display the new names and resin note, and burl never requests a missing legacy finish render',()=>{
 let count=0;
 for(const file of fs.readdirSync('public').filter(f=>f.endsWith('.html'))){
  const h=fs.readFileSync('public/'+file,'utf8');if(!h.includes('window.FostinisStudio='))continue;
  assert(!h.includes('Reference-inspired motif'),file);assert(h.includes("['motif','Cherub Wings']"),file);assert(h.includes("['maple','Maple']"),file);assert(h.includes('Burl — may require resin filling'),file);assert(h.includes('Burl tops add $800 and may require resin filling.'),file);
  assert(h.includes("if(EMBEDDED||s.wood==='burl'){paintModel(id,undefined);"),file);
  const legacy=h.split('\n').find(l=>l.startsWith('function legacyPreview('));
  const render=vm.runInNewContext(legacy+';legacyPreview',{R:{svg(){throw Error('Burl must use its 3D preview');}},E:window.FostinisElectronics});
  assert.match(render('sphyx',{...F.initial('sphyx'),wood:'burl'},{}),/3D showroom/);count++;
 }
 assert.equal(count,233);
});
