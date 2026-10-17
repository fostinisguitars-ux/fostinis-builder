import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from 'three';
import {woodMaterial} from '../src/showroom3d/materials.mjs';
import {createPricingEngine} from '../lib/commerce/pricing-engine.mjs';

const html=fs.readFileSync('public/showroom.html','utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const window={};
vm.runInNewContext(scripts[0][1].slice(scripts[0][1].indexOf('window.FostinisParts=')),{window});
const F=window.Fostinis,pricing=createPricingEngine(JSON.parse(fs.readFileSync('lib/commerce/catalog.json','utf8')));
const brightness=hex=>[1,3,5].reduce((n,i)=>n+parseInt(hex.slice(i,i+2),16),0);
const originalLoad=T.TextureLoader.prototype.load;
T.TextureLoader.prototype.load=function(url){const t=new T.Texture();t.name=url;return t;};
let combinations=0;
try{
 for(const model of Object.keys(F.MODELS))for(const finish of F.FINISHES)for(const type of ['dye','solid'])for(const sheen of ['gloss','satin','matte']){
  const state=F.normalize(model,JSON.parse(JSON.stringify({...F.initial(model),finish:finish.id,finishType:type,sheen,burst:'faded',backBurst:'faded',neckBurst:'faded',backFinish:finish.id,backFinishType:type,neckFinish:finish.id,neckFinishType:type,headstockBurst:'match'})));
  assert.equal(state.finish,finish.id,'Selecting a faded burst must retain the chosen color.');
  assert.equal(state.burst,'faded','Saved builds must retain their faded burst.');
  for(const region of ['top','back','neck','headstock_front']){
   const palette=F.resolveBurst(state,region),base=F.finishColor(state,region);
   assert.equal(palette.id,'faded');
   assert.equal(palette.mid,base);
   assert(brightness(palette.center)>brightness(base),'The center must be lighter than the chosen color.');
   assert(brightness(palette.edge)<brightness(base),'The edge must be darker than the chosen color.');
   const material=woodMaterial(F,state,region,model);
   assert.equal(material.color.getHexString(),palette.center.slice(1));
   assert.equal(Boolean(material.map),type==='dye','Solid paint covers grain; dye retains grain.');
   const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>'};
   material.onBeforeCompile(shader);
   assert.equal(shader.uniforms.fadedBurst.value,1);
   assert.equal(shader.uniforms.burstEdge.value.getHexString(),palette.edge.slice(1));
   assert(shader.fragmentShader.includes('tint*woodFigure'),'The burst must preserve grain at the edge.');
   material.dispose();
  }
  assert.equal(F.resolveBurst(state,'headstock_front').center,F.resolveBurst(state,'top').center);
  for(const region of ['binding','headstock_front']){
   const material=woodMaterial(F,{...state,headstockBurst:'black'},region,model);
   const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>'};
   material.onBeforeCompile(shader);assert.equal(shader.uniforms.burstActive.value,0);
   if(region==='binding')assert.equal(material.color.getHexString(),'e7c996');
   material.dispose();
  }
  const quote=pricing.quote(model,state);
  for(const key of ['burst','backBurst','neckBurst'])assert.equal(quote.lines.find(l=>l.key===key).cents,15000);
  assert.equal(quote.lines.find(l=>l.key==='headstockBurst').cents,0);
  combinations++;
 }
 for(const model of Object.keys(F.MODELS))for(const side of ['front','back']){
  const state={...F.initial(model),finish:'purple',burst:'faded',backBurst:'faded',neckBurst:'faded',headstockBurst:'match'};
  const svg=F.renderer({}).svg(model,state,{side});
  assert(svg.includes('data-component="faded-center"'));
  assert(svg.includes('data-burst="faded"'));
  assert(!svg.includes('NaN'));
 }
 // Earlier palettes and no-burst selections retain their existing colors.
 for(const palette of F.BURSTS.filter(b=>b.id!=='faded')){
  const state={...F.initial('oryx'),burst:palette.id};
  assert.equal(F.resolveBurst(state,'top'),palette);
  const material=woodMaterial(F,state,'top','oryx');
  assert.equal(material.color.getHexString(),F.finishColor(state).slice(1));material.dispose();
 }
}finally{T.TextureLoader.prototype.load=originalLoad;}
let routes=0;
for(const file of fs.readdirSync('public').filter(f=>f.endsWith('.html'))){
 const source=fs.readFileSync('public/'+file,'utf8');if(!source.includes('window.FostinisStudio='))continue;
 for(const match of source.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1],{filename:file});
 assert(source.includes("id:'faded',name:'Faded burst · chosen color'"));
 assert(source.includes('/showroom-360.js?v=48'));
 assert(source.includes('/commerce-catalog.js?v=2026-10-17-faded-burst'));
 assert.equal((source.match(/function createBurstFinishes\(/g)||[]).length,1);
 assert.equal((source.match(/function fadedWash\(/g)||[]).length,1);
 assert(source.includes("finish:linkedBurst==='faded'?builds[selected].finish:"));
 assert(source.includes("finish:id==='faded'?s.finish:"));
 routes++;
}
console.log(`PASS: ${combinations} model/color/type/sheen combinations; regional and matching headstock materials; saved choices; existing burst prices; SVG fallback; ${routes} routes.`);
