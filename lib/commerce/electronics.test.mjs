import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import catalog from './catalog.json' with {type:'json'};
import {createElectronics} from './electronics.mjs';
import {createPricingEngine} from './pricing-engine.mjs';
import {makePickups,makeControls,killswitchRecess,pickupFillNames,applyPickupFills,NECK,NUT_Y,SADDLE_Y} from '../../src/showroom3d/geometry.mjs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {configureUV} from '../../src/showroom3d/materials.mjs';
import placement from '../../scripts/cad/pickup-layouts/killswitch-placement.json' with {type:'json'};
const E=createElectronics(),pricing=createPricingEngine(catalog);
const html=fs.readFileSync('public/showroom.html','utf8'),scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)],window={};vm.runInNewContext(scripts[0][1].slice(scripts[0][1].indexOf('window.FostinisParts=')),{window});
const F=window.Fostinis,base=F.initial('sphyx');
const state=(layout,changes={})=>E.normalize({...base,pickupLayout:layout,...changes});

test('All layouts retain the approved allowance and exact default pickup surcharges',()=>{
 for(const model of Object.keys(catalog.models))for(const [layout,cents] of Object.entries({h:0,hh:0,hsh:9240,hss:6840,hs:0,sss:4440,ss:0})){
  const q=pricing.quote(model,state(layout));assert.equal(q.lines.find(l=>l.key==='pickupSet').cents,cents,model+' '+layout);
  assert.equal(q.lines.find(l=>l.key==='pickupLayout').cents,0,'No duplicate layout charge');assert.equal(q.subtotalCents,q.lines.reduce((n,l)=>n+l.cents,0));
 }
 for(const pickupSet of Object.keys(catalog.fields.pickupSet.options))assert.equal(pricing.quote('oryx',state('h',{pickupSet})).lines.find(l=>l.key==='pickupSet').cents,0);
 assert.equal(pricing.quote('sphyx',state('hsh',{pickupSet:'bkp-ragnarok'})).lines.find(l=>l.key==='pickupSet').cents,57480);
});

test('Every modified physical pot is $50; one pot splitting both costs once; gig bag and fitted case prices are exact',()=>{
 const none=pricing.quote('sphyx',state('hh'));
 const one=pricing.quote('sphyx',state('hh',{pot3Mod:'split-both'}));assert.equal(one.subtotalCents-none.subtotalCents,5000);assert.equal(one.electronicsUpgradeCents,5000);
 const two=pricing.quote('sphyx',state('hh',{pot1Mod:'split-neck',pot3Mod:'split-bridge'}));assert.equal(two.subtotalCents-none.subtotalCents,10000);
 const four=pricing.quote('sphyx',state('hh',{pot1Mod:'treble-bleed',pot2Mod:'treble-bleed',pot3Mod:'split-both',pot4Mod:'phase',killswitch:'momentary',caseOption:'fitted'}));
 assert.equal(four.electronicsUpgradeCents,27500);assert.equal(four.accessoryUpgradeCents,50000);assert.equal(four.subtotalCents-none.subtotalCents,77500);
 assert.equal(none.lines.find(l=>l.key==='caseOption').cents,0);assert.equal(four.lines.find(l=>l.key==='caseOption').cents,50000);
 assert.equal(Object.keys(four.selections).length+3<=50,true,'Checkout metadata remains within Stripe limits');
});

test('Checkout rejects incompatible active/single mixes, unavailable controls, duplicate mods, and conflicting coil circuits',()=>{
 const raw=(layout,change)=>({...state(layout),...change});
 for(const pickupSet of ['emg-81-85','fishman-modern'])assert.throws(()=>pricing.quote('sphyx',raw('hsh',{pickupSet})),/passive/);
 assert.throws(()=>pricing.quote('sphyx',raw('h',{pot2Mod:'split-bridge'})),/compatible/);
 assert.throws(()=>pricing.quote('sphyx',raw('sss',{pot3Mod:'split-bridge'})),/compatible/);
 assert.throws(()=>pricing.quote('sphyx',raw('hh',{pot1Mod:'parallel-bridge',pot3Mod:'split-bridge'})),/compatible/);
 assert.throws(()=>pricing.quote('sphyx',raw('hh',{pot1Mod:'split-both',pot3Mod:'split-neck'})),/compatible/);
 assert.throws(()=>pricing.quote('sphyx',raw('h',{pot1Mod:'phase'})),/compatible/);
 assert.throws(()=>pricing.quote('sphyx',raw('hss',{wiring:'threeway'})),/selector/);
 for(const field of ['pickupLayout','singleCoilModel','singleCoilCover','pot1Mod','pot2Mod','pot3Mod','pot4Mod','killswitch','caseOption'])assert.throws(()=>pricing.quote('sphyx',raw('hh',{[field]:'__proto__'})));
 assert.doesNotThrow(()=>pricing.quote('sphyx',state('hh',{pickupSet:'fishman-modern',pot3Mod:'voice'})));
});

test('Legacy split/voice builds migrate to one paid pot; plain HH builds retain zero electronics charge',()=>{
 const legacy={...base};for(const field of ['pickupLayout','singleCoilModel','singleCoilCover','killswitch','caseOption',...E.potFields])delete legacy[field];
 for(const [wiring,pickupSet,mod]of [['split','sd-jb-jazz','split-both'],['voice','fishman-modern','voice']]){
  const input={...legacy,wiring,pickupSet},browser=F.normalize('sphyx',input),server=pricing.validate('sphyx',input);
  assert.equal(browser.pot3Mod,mod);assert.equal(server.pot3Mod,mod);assert.equal(browser.wiring,'threeway');assert.equal(pricing.quote('sphyx',input).electronicsUpgradeCents,5000);
 }
 assert.equal(pricing.quote('sphyx',legacy).electronicsUpgradeCents,0);
});

test('3D pickup counts, positions and control counts match all layouts without changing scale',()=>{
 const expected={h:['H'],hh:['H','H'],hsh:['H','S','H'],hss:['S','S','H'],hs:['S','H'],sss:['S','S','S'],ss:['S','S']};
 for(const model of Object.keys(catalog.models))for(const [layout,kinds] of Object.entries(expected)){
  const s=state(layout),g=makePickups(s,window.FostinisParts);assert.deepEqual(g.children.map(p=>p.userData.pickupKind),kinds);
  if(layout==='h')assert.equal(g.children[0].userData.pickupPosition,'bridge');
  const controls=makeControls(model,s),pots=controls.children.filter(c=>c.userData.potIndex!==undefined);assert.equal(pots.length,E.layout(s).pots.length);
  const ys=g.children.map(p=>p.position.y);for(let i=1;i<ys.length;i++)assert(ys[i-1]-ys[i]>40);
 }
 assert.equal(NECK.scale,647.7);assert(Math.abs(NUT_Y-SADDLE_Y-647.7)<1e-8);
});

test('Supplemental wood surfaces fill only unused routings, load in Three, and use identical grain coordinates',async()=>{
 const expected={h:['neck_full','control_1','control_3','switch'],hh:[],hsh:['control_1'],hss:['neck_single','control_1'],hs:['neck_single','control_1','control_3'],sss:['neck_single','bridge_single','control_1'],ss:['neck_single','bridge_single','control_1','control_3']};
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 for(const model of Object.keys(catalog.models))for(const bridge of ['standard','tremolo']){
  const b=fs.readFileSync('public/assets/cad/pickup-layouts/'+model+'_'+bridge+'_pickup_fills.glb'),loaded=await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  const meshes=[];loaded.scene.traverse(m=>{if(m.isMesh){meshes.push(m);assert.equal(m.material.name,'top');const source=m.geometry.attributes.uv;configureUV(m,'top');const target=m.geometry.attributes.uv;assert.equal(source.count,target.count);for(let i=0;i<source.count;i++){assert(Math.abs(source.getX(i)-target.getX(i))<1e-6);assert(Math.abs(source.getY(i)-target.getY(i))<1e-6);}}});
  assert.equal(meshes.length,6);
  for(const [layout,names]of Object.entries(expected))for(const killswitch of ['none','momentary','none']){const s=state(layout,{killswitch}),visible=killswitch==='momentary'?names.filter(n=>n!=='control_1'):names;assert.deepEqual(pickupFillNames(s),visible);applyPickupFills(loaded.scene,s);assert.deepEqual(meshes.filter(m=>m.visible).map(m=>m.name).sort(),[...visible].sort());}
 }
});

test('Killswitch occupies an available knob recess on every reduced-control layout and seats against the carved dish',()=>{
 for(const model of Object.keys(catalog.models))for(const layout of Object.keys(E.layouts)){
  assert(!makeControls(model,state(layout)).children.some(m=>m.userData.killswitch));
  const s=state(layout,{killswitch:'momentary'}),g=makeControls(model,s),button=g.children.find(m=>m.userData.killswitch),available=E.layout(s).pots.length<4,p=available?placement[model].vacantPot:placement[model];
  assert(button);assert.deepEqual(button.position.toArray(),p.positionMm);assert(new T.Vector3(0,0,1).applyQuaternion(button.quaternion).distanceTo(new T.Vector3(...p.normal))<1e-8);
  assert.equal(button.userData.recessIndex,available?1:null);assert.equal(killswitchRecess(s),button.userData.recessIndex);
  if(available){assert(!E.layout(s).pots.includes(button.userData.recessIndex));assert.deepEqual(button.position.toArray().slice(0,2),p.boreCenterMm);assert.equal(p.rimSamplesInsideTop,p.samples);assert(p.minRimClearanceMm>=.149);assert(!pickupFillNames(s).includes('control_1'));}
  else assert.equal(p.frontCircleSamplesInsideTop,p.samples);
  assert.equal(p.backCircleSamplesInsideCover,p.samples);
  for(const knob of g.children.filter(m=>m.userData.potIndex!==undefined))assert(Math.hypot(knob.position.x-button.position.x,knob.position.y-button.position.y)>18.2,'Killswitch overlaps a knob');
 }
});

test('Visible layout and pickup prices match the compatibility normalization used when selected',()=>{
 const fn=html.split('\n').find(l=>l.startsWith('function optionPriceLabel(')),get=vm.runInNewContext(fn+';optionPriceLabel',{E,window:{FostinisPricing:pricing},Intl});
 assert.equal(get('pickupLayout','hsh',state('hh',{pickupSet:'fishman-modern'})),'+$92.40');
 assert.equal(get('pickupLayout','h',state('hh',{pickupSet:'bkp-ragnarok'})),'Included');
 assert.equal(get('pickupSet','emg-81-85',state('sss')),'+$58.80');
});

test('All native routes share electronics rules, options, and accessory totals',()=>{
 let count=0;const helper=fs.readFileSync('lib/commerce/electronics.mjs','utf8').replace('export function createElectronics','function createElectronics');
 for(const f of fs.readdirSync('public').filter(x=>x.endsWith('.html'))){const h=fs.readFileSync('public/'+f,'utf8').replace('<script src="/build-commerce.js?v=54"></script>',()=>'<script>'+fs.readFileSync('public/build-commerce.js','utf8')+'</script>');if(!h.includes('window.FostinisStudio='))continue;
  assert(h.includes(helper),f);assert(h.includes("details:['fretboard','inlays','caseOption']"));assert(h.includes("row(box,'Electronics modifications',money(q.electronicsUpgradeCents))"));assert(h.includes("row(box,'Case upgrade',money(q.accessoryUpgradeCents))"));
  for(const [,script]of h.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(script,{filename:f});count++;
 }
 assert.equal(count,233);
});
