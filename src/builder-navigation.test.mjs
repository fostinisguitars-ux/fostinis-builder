import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createBuilderNavigation} from './builder-navigation.mjs';

function fixture({nested=false,previewHeight=380,headerHeight=112,height=844}={}){
 const names=['finish','hardware','details'],expanded={finish:2200,hardware:1700,details:450},queue=new Map(),resize=[];
 let pageY=1700,panelY=1000,sequence=0;
 const builder={style:{},clientTop:1,clientHeight:760,get scrollTop(){return panelY;},scrollTo({top}){panelY=Math.max(0,Math.min(top,3000));},querySelectorAll:()=>Object.values(sections),getBoundingClientRect:()=>({top:1400-pageY,height:760})};
 const header={getBoundingClientRect:()=>({height:headerHeight})};
 const preview={style:{},getBoundingClientRect:()=>({height:previewHeight})};
 const sections=Object.fromEntries(names.map((name,index)=>[name,{open:true,style:{},getBoundingClientRect(){
  const previous=names.slice(0,index).reduce((n,key)=>n+(sections[key].open?expanded[key]:54),0);
  return {top:builder.getBoundingClientRect().top+builder.clientTop+240+previewHeight+80+previous-(nested?panelY:0)};
 }}]));
 const calls=[];
 const win={innerHeight:height,get scrollY(){return pageY;},scrollTo(options){pageY=options.top;calls.push(options);},getComputedStyle:el=>el===builder?{overflowY:nested?'auto':'visible'}:{position:'sticky'},requestAnimationFrame:fn=>{queue.set(++sequence,fn);return sequence;},cancelAnimationFrame:id=>queue.delete(id),addEventListener(type,fn){if(type==='resize')resize.push(fn);},ResizeObserver:class{constructor(fn){resize.push(fn);}observe(){}}};
 const nav=createBuilderNavigation({builder,preview,header,win});nav.observe();
 const activate=name=>{for(const key of names)sections[key].open=key===name;nav.reveal(sections[name]);};
 const flush=()=>{const callbacks=[...queue.values()];queue.clear();callbacks.forEach(fn=>fn());};
 const assertVisible=name=>{
  const top=sections[name].getBoundingClientRect().top;
  const overlay=preview.style.position==='sticky'?(nested?builder.getBoundingClientRect().top+builder.clientTop:Number.parseFloat(preview.style.top))+previewHeight:headerHeight;
  assert(top>=overlay+11.9,'Category heading is behind the preview/header');
  assert(top+54+22+48<=height,'The first dropdown is outside the viewport');
 };
 return {nav,activate,flush,assertVisible,sections,builder,preview,calls,resize,changePreview:value=>{previewHeight=value;},changeHeader:value=>{headerHeight=value;}};
}

test('Mobile categories land below the measured preview after collapsing a long preceding group',()=>{
 for(const previewHeight of [310,380,440]){
  const f=fixture({previewHeight});
  for(const name of ['details','hardware','finish','details']){f.activate(name);f.flush();f.assertVisible(name);assert.equal(Object.values(f.sections).filter(s=>s.open).length,1);}
 }
});

test('Desktop navigation scrolls the inner builder and keeps it below the site header',()=>{
 for(const previewHeight of [350,460]){
  const f=fixture({nested:true,previewHeight,height:980});
  for(const name of ['details','finish','hardware']){f.activate(name);f.flush();f.assertVisible(name);assert(f.builder.getBoundingClientRect().top>=112);}
 }
});

test('Resized previews and wrapped headers use current measurements; short screens keep controls accessible',()=>{
 const f=fixture();f.changePreview(410);f.changeHeader(145);f.resize.forEach(fn=>fn());
 f.activate('details');f.flush();f.assertVisible('details');
 for(const nested of [false,true]){const short=fixture({nested,height:430,previewHeight:380});short.activate('details');short.flush();assert.equal(short.preview.style.position,'relative');short.assertVisible('details');}
});

test('Rapid category clicks only scroll to the latest open category',()=>{
 const f=fixture();f.activate('finish');f.activate('hardware');f.activate('details');f.flush();
 assert.equal(f.calls.length,1);f.assertVisible('details');
 f.activate('finish');f.sections.finish.open=false;f.flush();assert.equal(f.calls.length,1);
});

test('Every native route loads the shared navigation and handles both category tabs and accordion headings',()=>{
 const shared=fs.readFileSync('public/builder-navigation.js','utf8');
 assert(shared.includes(fs.readFileSync('src/builder-navigation.mjs','utf8').replace('export function createBuilderNavigation','function createBuilderNavigation')));
 let count=0;
 for(const name of fs.readdirSync('public').filter(f=>f.endsWith('.html'))){
  const h=fs.readFileSync('public/'+name,'utf8');if(!h.includes('window.FostinisStudio='))continue;
  assert(h.indexOf('<script src="/builder-navigation.js?v=45"></script>')<h.indexOf('<script>'),name);
  assert.equal(h.split('const builderNavigation=').length,2,name);
  assert.equal(h.split('builderNavigation.observe();').length,2,name);
  assert(h.includes("summary.addEventListener('click',event=>{if(section.open)return;event.preventDefault();selectStep(group,{scroll:true});});"),name);
  assert(h.includes("b.onclick=()=>selectStep(b.dataset.step,{scroll:true})"),name);
  const select=h.split('\n').find(line=>line.startsWith('function selectStep('));assert(!select.includes('scrollIntoView'));
  const sections=Object.fromEntries(['finish','hardware','details'].map(k=>['group-'+k,{open:true}])),buttons=['finish','hardware','details'].map(step=>({dataset:{step},setAttribute(key,value){this[key]=value;}}));let revealed;
  vm.runInNewContext(select+";selectStep('details',{scroll:true});",{step:'finish',GROUPS:{finish:[],hardware:[],details:[]},$:id=>sections[id],document:{querySelectorAll:()=>buttons},builderNavigation:{reveal:section=>{revealed=section;}}});
  assert.strictEqual(revealed,sections['group-details']);assert.equal(sections['group-finish'].open,false);assert.equal(sections['group-hardware'].open,false);assert.equal(buttons[2]['aria-pressed'],'true');
  for(const [,script]of h.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(script.trim()&&!script.trim().startsWith('{'))new vm.Script(script,{filename:name});count++;
 }
 assert.equal(count,234);
});
