import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

// Exercise the built, shipped sharing controller with deterministic DOM/canvas
// adapters. This tests events and fallback behavior, not browser rendering.
class Element{
 constructor(){this.children=[];this.events={};this.dataset={};this.attrs={};this.hidden=false;this.open=false;this.disabled=false;this.value='';this.textContent='';}
 addEventListener(type,callback){(this.events[type]??=[]).push(callback);}async fire(type,event={}){this['on'+type]?.(event);for(const fn of this.events[type]||[])await fn(event);}
 setAttribute(key,value){this.attrs[key]=value;}removeAttribute(key){delete this.attrs[key];}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}focus(){}select(){}
 showModal(){this.open=true;}close(){this.open=false;this.fire('close');}
}
const markup=fs.readFileSync('public/review.html','utf8'),inline=[...markup.matchAll(/<script>([\s\S]*?)<\/script>/g)],Fwindow={};vm.runInNewContext(inline[0][1].slice(inline[0][1].indexOf('window.FostinisParts=')),{window:Fwindow});
const flush=async()=>{for(let i=0;i<15;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture({native=true,failedCapture=false}={}){
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const platforms=['tiktok','instagram','x','facebook','text','email'].map(id=>{const e=new Element();e.dataset.sharePlatform=id;return e;});get('build-share-dialog').querySelectorAll=()=>platforms;
 const selections=Fwindow.Fostinis.initial('sphyx');let data={model:'sphyx',modelName:'Sphyx',selections,nickname:'Midnight',labels:{finish:'Amber',burst:'No burst',sheen:'Gloss',backFinish:'Natural',backSheen:'Satin',neckFinish:'Natural',neckSheen:'Satin',pickupLayout:'HH',pickupSet:'JB / Jazz',hardware:'Chrome',bridgeModel:'Floyd Rose',tunerModel:'Hipshot'},appointments:[['Top finish','Amber'],['Fretboard','Ebony']]};
 const shares=[],copied=[],windowEvents={},storage=new Map();const canvasContext={measureText:t=>({width:String(t).length*15}),fillRect(){},fillText(){},drawImage(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
 const document={readyState:'complete',activeElement:new Element(),getElementById:get,querySelectorAll:()=>[get('saved-button')],createElement:tag=>{const e=new Element();if(tag==='canvas'){e.getContext=()=>canvasContext;e.toBlob=(callback,type)=>callback(new Blob(['JPEG'],{type}));}return e;}};
 const window={...Fwindow,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},FostinisStudio:{getShareData:()=>structuredClone(data),getSavedBuild:()=>({...structuredClone(data),notes:'private'}),isSharedBuild:()=>false,restoreBuild(){}},FostinisShowroom:{ready:true,exportShareViews:async()=>{if(failedCapture)throw Error('Capture failed. Try again.');return {snapshot:{selected:data.model,builds:{[data.model]:data.selections}},views:['front','back','angle'].map(side=>({side,url:'data:image/png;base64,AA=='}))};}},addEventListener:(event,fn)=>(windowEvents[event]??=[]).push(fn)};
 const navigator={userAgent:'iPhone',clipboard:{writeText:async text=>copied.push(text)}};if(native){navigator.canShare=()=>true;navigator.share=async payload=>{shares.push(payload);};}
 vm.runInNewContext(fs.readFileSync('public/build-sharing.js','utf8'),{window,document,navigator,location:{origin:'https://fostinisguitars.com'},Image:class{width=720;height=1440;async decode(){}},URL,URLSearchParams,TextEncoder,TextDecoder,File,Blob,btoa,atob,crypto,setTimeout,queueMicrotask,console});
 return {get,platforms,shares,copied,window,change:()=>{data.nickname='Changed';for(const fn of windowEvents['fostinis:identity']||[])fn();}};
}
test('The shipped UI prepares three photos, shares only images socially, includes appointments for email, and invalidates changed builds',async()=>{
 const u=fixture();await flush();await u.get('share-build').fire('click');await flush();assert.equal(u.get('share-gallery').children.length,3);assert(!u.get('share-native').disabled);assert(!u.get('share-download-all').hidden);
 await u.get('share-native').fire('click');assert.equal(u.shares.length,1);assert.equal(u.shares[0].files.length,3);assert.deepEqual(Object.keys(u.shares[0]),['files']);
 await u.platforms.find(p=>p.dataset.sharePlatform==='email').fire('click');assert(!u.get('share-message').hidden);assert(u.get('share-message').href.startsWith('mailto:'));
 await u.get('share-native').fire('click');assert(u.shares[1].text.includes('All Appointments'));assert(u.shares[1].text.includes('Fretboard: Ebony'));assert(!u.shares[1].text.includes('private'));
 await u.platforms.find(p=>p.dataset.sharePlatform==='tiktok').fire('click');await flush();assert(u.get('share-gallery').children.every(figure=>figure.children[0].height===1920));await u.get('share-native').fire('click');assert(u.shares[2].files.every(file=>file.name.endsWith('_story.jpg')));
 u.change();assert.equal(u.get('share-gallery').children.length,0);assert(u.get('share-native').disabled);assert(!u.get('share-retry').hidden);
 await u.get('share-retry').fire('click');await flush();assert.equal(u.get('share-gallery').children.length,3);await u.get('share-close').fire('click');assert(!u.get('build-share-dialog').open);
});
test('Browsers without file sharing offer downloadable images, direct messages, and copyable full appointments',async()=>{
 const u=fixture({native:false});await flush();await u.get('share-build').fire('click');await flush();assert.equal(u.get('share-gallery').children.length,3);assert(u.get('share-native').hidden);assert(!u.get('share-download-all').hidden);assert(!u.get('share-open-platform').hidden);
 await u.platforms.find(p=>p.dataset.sharePlatform==='text').fire('click');assert(u.get('share-message').href.startsWith('sms:&body='));await u.get('share-copy-message').fire('click');assert(u.copied[0].includes('All Appointments'));assert(u.copied[0].includes('https://fostinisguitars.com/review.html?build='));
});
test('A capture failure still exposes a valid build link and a retry instead of a dead share button',async()=>{
 const u=fixture({failedCapture:true});await flush();await u.get('share-build').fire('click');await flush();assert.match(u.get('share-status').textContent,/Capture failed/);assert(!u.get('share-retry').hidden);assert(u.get('share-native').hidden);await u.get('share-copy-link').fire('click');assert(u.copied[0].includes('?build='));
});
