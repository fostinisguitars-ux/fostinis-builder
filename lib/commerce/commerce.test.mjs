import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import catalog from './catalog.json' with {type:'json'};
import {createPricingEngine} from './pricing-engine.mjs';
import {createElectronics} from './electronics.mjs';
import {createCommerceService,paymentReady,verifyStripeSignature,ORIGIN,STRIPE_API_VERSION,stripeMode} from './service.mjs';
import {PUBLIC_ORIGINS} from './origins.mjs';

const selections=Object.fromEntries(Object.entries(catalog.fields).map(([k,f])=>[k,f.default??Object.keys(f.options)[0]]));
Object.assign(selections,{bridgeModel:'floyd-original',tunerModel:'hipshot-locking',pickupSet:'sd-jb-jazz',hardware:'chrome',wood:'ash',backWood:'mahogany',neckWood:'mahogany',burst:'none',backBurst:'none',neckBurst:'none'});
const request=(action,input,origin=ORIGIN)=>new Request(ORIGIN+'/api/commerce/'+action,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(input)});
const build={model:'sphyx',selections,notes:'',requestId:'12345678-1234-1234-1234-123456789abc'};

test('listed options are priced, US shipping is included, and incomplete merchant setup prevents payment',()=>{
 const engine=createPricingEngine(catalog),a=engine.quote('sphyx',selections),b=engine.quote('matadaur',{...selections,hardware:'gold'});
 assert.equal(a.confirmedSubtotalCents,373228);assert.equal(b.confirmedSubtotalCents,492006);
 assert.equal(a.hardwareUpgradeCents,23328);assert.equal(b.hardwareUpgradeCents,42106);
 assert.equal(a.subtotalCents,373228);assert.equal(a.totalCents,null);assert.equal(a.unresolved.length,0);
 assert.equal(a.lines.every(l=>Number.isSafeInteger(l.cents)&&l.cents>=0),true);
 assert.notEqual(a.referenceSubtotalCents,b.referenceSubtotalCents);
 const tuner=a.references.find(r=>r.key==='tunerModel');assert.equal(tuner.quantity,6);assert.equal(tuner.cents,2140);
 assert.equal(paymentReady({}),false);
 assert.deepEqual(catalog.shipping,{countries:['US'],cents:0});
});
test('all approved component and finish charges match the owner worksheet, with set allowances applied once',()=>{
 const expected={
  bridgeModel:{'floyd-original':[19920,22080,31800],'floyd-1000':[7200,8760,12719],'floyd-special':[0,960,3840],'floyd-pro':[20400,21960,27960],'hipshot-fixed':[4774,4096,10282],'hipshot-contour':[11760,11760,20069],'evertune':[30000,30000,30000],'gotoh-510':[7200,7200,7200],'toneomatic':[11707,11707,21816]},
  tunerModel:{'hipshot-open':[0,982,3624],'hipshot-locking':[3408,4524,10306],'gotoh-locking':[0,0,0],'schaller-locking':[12000,12000,12000]},
  pickupSet:{'sd-jb-jazz':0,'sd-distortion':0,'sd-nazgul-sentient':3480,'sd-saturday-night-special':5880,'bkp-ragnarok':48000,'bkp-juggernaut':42000,'fishman-modern':11994,'fishman-classic':11994,'emg-81-85':5880,'emg-57-66':4680,'instrumental-sfty3':3600,'dimarzio-request':0,'lundgren-request':21600}
 };
 const engine=createPricingEngine(catalog);
 for(const [key,options] of Object.entries(expected)){
  assert.deepEqual(Object.keys(options).sort(),Object.keys(catalog.fields[key].options).sort());
  for(const [id,charges] of Object.entries(options))for(const [i,hardware] of ['chrome','black','gold'].entries())for(const model of ['sphyx','oryx','matadaur']){
   const q=engine.quote(model,{...selections,[key]:id,hardware}),line=q.lines.find(l=>l.key===key);
   assert.equal(line.cents,Array.isArray(charges)?charges[i]:charges,model+' '+id+' '+hardware);
   assert.equal(line.allowanceCents,key==='pickupSet'?20000:10000);
  }
 }
 const changed=structuredClone(catalog);changed.references['floyd-1000'].variants.chrome.cents=99000;
 assert.equal(createPricingEngine(changed).priceOption('bridgeModel','floyd-1000',{hardware:'chrome'}).cents,7200,'Research changes cannot silently change approved selling prices');
 const pending=structuredClone(catalog);pending.fields.bridgeModel.options['floyd-1000'].approved=false;
 assert.equal(createPricingEngine(pending).priceOption('bridgeModel','floyd-1000',{hardware:'chrome'}).cents,null);
 for(const key of ['knobs','wiring','pickups','inlays','fretboard','finish','sheen'])for(const id of Object.keys(catalog.fields[key].options))assert.equal(engine.priceOption(key,id).cents,0,key+' is included');
 assert.throws(()=>engine.quote('sphyx',{...selections,pickupSet:'fostinis-custom'}));
});
test('every standalone route loads the same approved catalog before its shared pricing engine',()=>{
 const root=new URL('../../public/',import.meta.url),engine=readFileSync(new URL('./pricing-engine.mjs',import.meta.url),'utf8').replace("import {createElectronics} from './electronics.mjs';\n",'').replace('export function createPricingEngine','function createPricingEngine');
 const catalogSource=readFileSync(new URL('commerce-catalog.js',root),'utf8'),catalogContext={window:{}};vm.runInNewContext(catalogSource,catalogContext);assert.deepEqual(JSON.parse(JSON.stringify(catalogContext.window.FostinisCommerceCatalog)),catalog);
 let checked=0;
 for(const file of readdirSync(root).filter(f=>f.endsWith('.html'))){
  const html=readFileSync(new URL(file,root),'utf8');
  if(!html.includes('window.FostinisPricing=createPricingEngine('))continue;
  assert.ok(html.includes(engine),file+' engine differs');
  const catalogTag='<script src="/commerce-catalog.js?v='+catalog.version+'"></script>';
  assert(html.includes(catalogTag),file+' shared catalog missing');assert(html.indexOf(catalogTag)<html.indexOf('<script>'),file+' catalog must load before inline initialization');
  assert(html.includes('window.FostinisPricing=createPricingEngine(window.FostinisCommerceCatalog);'),file+' must use shared catalog');
  assert.doesNotMatch(html,/data-part="fostinis-custom"/);
  assert.equal(/name:'White maple'|"label":"White maple"|<dd>White maple<\/dd>|<small>White maple/.test(html),false,file+' contains a removed wood option');
  assert.equal(html.includes("?'Quote required'"),false,file+' contains an obsolete invoice label');
  for(const [,script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(script.trim()&&!script.trim().startsWith('{'))new vm.Script(script,{filename:file});
  checked++;
 }
 assert.equal(checked,233);
 const window={};vm.runInNewContext(catalogSource+engine+'\nwindow.FostinisPricing=createPricingEngine(window.FostinisCommerceCatalog);',{window,createElectronics});
 assert.equal(window.FostinisPricing.quote('sphyx',selections).confirmedSubtotalCents,373228);
});
test('figured woods and body/neck bursts add the fixed regional charge, without hardware markup or a width surcharge',()=>{
 const engine=createPricingEngine(catalog);
 for(const model of Object.keys(catalog.models)){
  const baseline=engine.quote(model,selections).confirmedSubtotalCents;
  for(const key of ['wood','backWood','neckWood']){
   assert.equal(Object.hasOwn(catalog.fields[key].options,'maple'),false);
   for(const [value,charge] of [['flame',20000],['quilt',40000],['burl',80000]])if(catalog.fields[key].options[value]){
    const q=engine.quote(model,{...selections,[key]:value});
    assert.equal(q.lines.find(l=>l.key===key).cents,charge);
    assert.equal(q.confirmedSubtotalCents,baseline+charge);
    assert.equal(q.materialUpgradeCents,charge);
    assert.equal(q.hardwareUpgradeCents,23328);
   }
  }
  for(const key of ['burst','backBurst','neckBurst'])for(const value of Object.keys(catalog.fields[key].options))for(const burstWidth of ['subtle','standard','wide']){
   const charge=value==='none'?0:15000,q=engine.quote(model,{...selections,[key]:value,burstWidth});
   assert.equal(q.lines.find(l=>l.key===key).cents,charge);
   assert.equal(q.confirmedSubtotalCents,baseline+charge);
   assert.equal(q.lines.find(l=>l.key==='burstWidth').cents,0);
  }
 }
 const combined={...selections,wood:'quilt',backWood:'flame',neckWood:'flame',burst:'cherry',backBurst:'honey',neckBurst:'violet'};
 const q=engine.quote('sphyx',combined);
 assert.equal(q.materialUpgradeCents,125000);assert.equal(q.confirmedSubtotalCents,498228);
 assert.equal(q.lines.find(l=>l.key==='backWood').value,'Flamed maple veneer');
 assert.equal(catalog.fields.backWood.options.quilt.label,'Quilted big leaf maple veneer');
 assert.equal(catalog.fields.wood.options.quilt.label.includes('veneer'),false);
 for(const key of ['wood','backWood','neckWood'])assert.throws(()=>engine.quote('sphyx',{...selections,[key]:'maple'}));
});
test('matching and classic-black headstocks are included, with body burst charged only once',()=>{
 const engine=createPricingEngine(catalog);
 assert.deepEqual(Object.keys(catalog.fields.headstockBurst.options),['match','black']);
 for(const model of Object.keys(catalog.models)){
  const baseline=engine.quote(model,selections);
  for(const headstockBurst of Object.keys(catalog.fields.headstockBurst.options)){
   const q=engine.quote(model,{...selections,headstockBurst});
   assert.equal(q.lines.find(l=>l.key==='headstockBurst').cents,0);
   assert.equal(q.confirmedSubtotalCents,baseline.confirmedSubtotalCents);
   assert.equal(q.materialUpgradeCents,baseline.materialUpgradeCents);
   assert.equal(q.subtotalCents,baseline.subtotalCents);
  }
  const legacy={...selections};delete legacy.headstockBurst;
  assert.equal(engine.quote(model,legacy).selections.headstockBurst,'black');
  for(const burst of Object.keys(catalog.fields.burst.options)){
   const q=engine.quote(model,{...selections,headstockBurst:'match',burst});
   const headstock=q.lines.find(l=>l.key==='headstockBurst');
   assert.equal(headstock.cents,0);
   assert.equal(headstock.value,'Match body color'+(burst==='none'?'':' with burst'));
   assert.equal(q.confirmedSubtotalCents,baseline.confirmedSubtotalCents+(burst==='none'?0:15000));
   const migrated=engine.quote(model,{...selections,headstockBurst:burst});
   assert.equal(migrated.selections.headstockBurst,burst==='none'?'black':'match');
  }
  assert.throws(()=>engine.quote(model,{...selections,headstockBurst:'unknown'}));
  assert.throws(()=>engine.quote(model,{...selections,headstockBurst:'__proto__'}));
 }
});
test('browser wood choices and legacy build migration agree with the pricing catalog',()=>{
 const html=readFileSync(new URL('../../public/showroom.html',import.meta.url),'utf8');
 const parts=JSON.parse(/window.FostinisParts=([^\n]+);/.exec(html)[1]);
 const anchor=html.indexOf('const PARTS=root.FostinisParts;');
 const start=html.lastIndexOf('(function(root)',anchor);
 const close="})(typeof window==='undefined'?globalThis:window);";
 const end=html.indexOf(close,anchor)+close.length;
 assert.ok(start>0&&end>start);
 const window={FostinisParts:parts,FostinisHardware:{},FostinisElectronics:createElectronics()};
 vm.runInNewContext(html.slice(start,end),{window});
 for(const key of ['wood','backWood','neckWood','fretboard','headstockBurst'])assert.deepEqual(Array.from(window.Fostinis.choices[key]).sort(),Object.keys(catalog.fields[key].options).sort());
 for(const model of ['sphyx','oryx','matadaur']){
  const defaults=window.Fostinis.initial(model);assert.equal(defaults.neckWood,'mahogany');
  const migrated=window.Fostinis.normalize(model,{...defaults,wood:'maple',backWood:'maple',neckWood:'maple',fretboard:'maple'});
  assert.equal(migrated.wood,'ash');assert.equal(migrated.backWood,'mahogany');assert.equal(migrated.neckWood,'mahogany');assert.equal(migrated.fretboard,'maple');
  assert.doesNotThrow(()=>createPricingEngine(catalog).validate(model,migrated));
  for(const burst of Object.keys(catalog.fields.burst.options)){
   const state=window.Fostinis.normalize(model,{...defaults,headstockBurst:burst});
   assert.equal(state.headstockBurst,burst==='none'?'black':'match');
  }
 }
 assert.equal(window.Fostinis.SOLID_COLORS.white.name,'Arctic white');
 assert.ok(window.Fostinis.FINISHES.every(f=>window.Fostinis.WOODS[f.wood]),'Finish presets reference available woods');
});
test('unknown IDs, missing options and prototype keys are rejected',()=>{
 const engine=createPricingEngine(catalog);
 assert.throws(()=>engine.quote('__proto__',selections));
 assert.throws(()=>engine.quote('sphyx',{...selections,bridgeModel:'fake-free-bridge'}));
 assert.throws(()=>engine.quote('sphyx',{}));
});
test('unapproved pricing, custom notes and merchant setup block payment before network access',async()=>{
 const handle=createCommerceService({}, {fetchImpl:()=>{throw new Error('Should not contact Stripe');}});
 assert.equal((await handle(request('checkout',build),'checkout')).status,503);
 const pending=structuredClone(catalog);pending.fields.wood.options.ash.approved=false;
 assert.equal((await createCommerceService({}, {prices:pending})(request('checkout',build),'checkout')).status,409);
 assert.equal((await handle(request('checkout',build,'https://example.com'),'checkout')).status,403);
 assert.equal((await handle(request('checkout',null),'checkout')).status,400);
 const p=approvedFixture();assert.equal(createPricingEngine(p).quote('sphyx',selections,'custom graphics').subtotalCents,null);
 const noKey=createCommerceService({}, {prices:p});assert.equal((await noKey(request('checkout',build),'checkout')).status,503);
});
test('restricted keys require an explicit matching environment and config identifies test mode',async()=>{
 const env={DB:{},STRIPE_SECRET_KEY:'rk_test_fixture_only',STRIPE_MODE:'test',PAYMENTS_ENABLED:'true',CHECKOUT_PUBLIC_READY:'true',STRIPE_WEBHOOK_SECRET:'whsec_fixture_only'};
 assert.equal(paymentReady(env,approvedFixture()),true);
 assert.equal(paymentReady({...env,STRIPE_MODE:'live'},approvedFixture()),false);
 assert.equal(paymentReady({...env,STRIPE_MODE:undefined},approvedFixture()),false);
 assert.equal(stripeMode({...env,STRIPE_SECRET_KEY:'pk_test_fixture_only'}),null);
 const handle=createCommerceService(env,{prices:approvedFixture()});
 const response=await handle(new Request(ORIGIN+'/api/commerce/config'),'config');
 assert.equal((await response.json()).mode,'test');
});

test('custom storefront domains retain secure checkout and return customers to their original storefront',async()=>{
 for(const origin of PUBLIC_ORIGINS){
  const db=database();let calls=0;
  const env={DB:db,STRIPE_SECRET_KEY:'rk_test_fixture_only',STRIPE_MODE:'test',PAYMENTS_ENABLED:'true',CHECKOUT_PUBLIC_READY:'true',STRIPE_WEBHOOK_SECRET:'whsec_fixture_only'};
  const handle=createCommerceService(env,{prices:approvedFixture(),fetchImpl:async(url,options)=>{
   calls++;const p=new URLSearchParams(options.body);
   assert.equal(p.get('success_url'),origin+'/review.html?checkout=success&session_id={CHECKOUT_SESSION_ID}#review');
   assert.equal(p.get('cancel_url'),origin+'/review.html?checkout=cancelled#review');
   return Response.json({id:'cs_test_domainFixture',url:'https://checkout.stripe.com/c/pay/cs_test_domainFixture',livemode:false});
  }});
  const response=await handle(request('checkout',build,origin),'checkout');
  assert.equal(response.status,200);assert.equal(calls,1);db.sql.close();
 }
 const handle=createCommerceService({}, {fetchImpl:()=>{throw Error('Untrusted origins must not reach Stripe');}});
 for(const origin of ['https://fostinisguitars.com.example.com','https://example.com','http://fostinisguitars.com','null'])assert.equal((await handle(request('checkout',build,origin),'checkout')).status,403);
 const guard='if('+JSON.stringify(PUBLIC_ORIGINS)+'.includes(location.origin))fetch(\'/api/commerce/config\'';
 for(const file of readdirSync('public').filter(f=>f.endsWith('.html'))){const html=readFileSync('public/'+file,'utf8');if(html.includes('window.FostinisStudio='))assert(html.includes(guard),file+' must enable checkout on the verified storefront domains');}
});

test('the actual checkout button opens Stripe from every storefront and stays disabled when payment is unavailable',async()=>{
 const root=new URL('../../public/',import.meta.url);
 const checkoutScript=html=>html.match(/\(function\(\)\{\n'use strict';\nlet current=null,config=null,busy=false,[\s\S]*?\n\}\)\(\);/)?.[0];
 const source=checkoutScript(readFileSync(new URL('review.html',root),'utf8'));
 assert.ok(source,'The review route must contain its checkout controls');
 let routes=0;
 for(const file of readdirSync(root).filter(f=>f.endsWith('.html'))){
  const html=readFileSync(new URL(file,root),'utf8');
  if(!html.includes('window.FostinisPricing=createPricingEngine('))continue;
  assert.equal(checkoutScript(html),source,file+' checkout behavior must match the review route');routes++;
 }
 assert.equal(routes,233);
 async function controls(origin,{ready=true,notes=''}={}){
  const calls=[],redirects=[],listeners={};
  const button={disabled:true,textContent:'',addEventListener(type,handler){listeners[type]=handler;}};
  const nodes={'checkout-stripe':button,'checkout-availability':{textContent:''},'checkout-result':{textContent:''}};
  const window={FostinisPricing:createPricingEngine(catalog)};
  vm.runInNewContext(source,{window,document:{getElementById:id=>nodes[id]||null,querySelectorAll:()=>[]},
   location:{origin,search:'',assign:url=>redirects.push(url)},URL,URLSearchParams,crypto,
   fetch:async(url,options)=>{
    calls.push({url,options});
    if(url==='/api/commerce/config')return Response.json({ready,mode:'live'});
    assert.equal(url,'/api/commerce/checkout');assert.equal(options.method,'POST');
    return Response.json({url:'https://checkout.stripe.com/c/pay/cs_test_browserFixture'});
   }});
  window.FostinisCommerce.update({model:build.model,selections:build.selections,notes});
  assert.equal(button.disabled,true,'Payment must wait for its configuration');
  await new Promise(setImmediate);
  return {button,calls,redirects,listeners};
 }
 for(const origin of PUBLIC_ORIGINS){
  const ui=await controls(origin);
  assert.equal(ui.button.disabled,false,origin+' must offer payment when the build is ready');
  assert.equal(ui.button.textContent,'Pay securely with Stripe');
  await ui.listeners.click();
  assert.deepEqual(ui.calls.map(c=>c.url),['/api/commerce/config','/api/commerce/checkout']);
  const payload=JSON.parse(ui.calls[1].options.body);
  assert.equal(payload.model,build.model);assert.deepEqual(payload.selections,build.selections);
  assert.match(payload.requestId,/^[a-f0-9-]{36}$/i);
  assert.deepEqual(ui.redirects,['https://checkout.stripe.com/c/pay/cs_test_browserFixture']);
  assert.equal(ui.button.disabled,false,'Checkout must release its busy state');
  assert.equal((await controls(origin,{ready:false})).button.disabled,true);
  assert.equal((await controls(origin,{notes:'Custom work requires a quote'})).button.disabled,true);
 }
 for(const origin of ['https://example.com','https://fostinisguitars.com.example.com','http://fostinisguitars.com']){
  const ui=await controls(origin);assert.equal(ui.button.disabled,true);assert.equal(ui.calls.length,0);
 }
});

test('launch configuration enables automatic tax and included shipping while paid verification includes Stripe tax',async()=>{
 const db=database(),env={DB:db,STRIPE_SECRET_KEY:'rk_live_fixture_only',STRIPE_MODE:'live',PAYMENTS_ENABLED:'true',CHECKOUT_PUBLIC_READY:'true',STRIPE_WEBHOOK_SECRET:'whsec_fixture_only'};
 assert.equal(catalog.checkoutEnabled,true);assert.equal(catalog.taxMode,'automatic');
 assert.equal(paymentReady(env),true);
 assert.equal(paymentReady({...env,PAYMENTS_ENABLED:'false'}),false);
 assert.equal(paymentReady({...env,CHECKOUT_PUBLIC_READY:'false'}),false);
 const subtotal=createPricingEngine(catalog).quote(build.model,build.selections).subtotalCents;
 const tax=Math.round(subtotal*0.06625);let session;
 const handle=createCommerceService(env,{fetchImpl:async(url,options)=>{
  if(options.method==='POST'){
   const p=new URLSearchParams(options.body);
   assert.equal(p.get('automatic_tax[enabled]'),'true');
   assert.equal(p.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'),'0');
   assert.equal(p.get('shipping_address_collection[allowed_countries][0]'),'US');
   assert.equal(p.get('line_items[0][price_data][unit_amount]'),String(subtotal));
   session={id:'cs_live_taxFixture',url:'https://checkout.stripe.com/c/pay/cs_live_taxFixture',livemode:true,mode:'payment',currency:'usd',amount_subtotal:subtotal,amount_total:subtotal+tax,total_details:{amount_shipping:0,amount_tax:tax,amount_discount:0},client_reference_id:p.get('client_reference_id'),metadata:{order_id:p.get('metadata[order_id]')},status:'open',payment_status:'unpaid'};
  }
  return Response.json(session);
 }});
 const config=await (await handle(new Request(ORIGIN+'/api/commerce/config'),'config')).json();
 assert.equal(config.ready,true);assert.equal(config.mode,'live');
 const checkout=await handle(request('checkout',build),'checkout');assert.equal(checkout.status,200);
 const {orderId}=await checkout.json();
 session.status='complete';session.payment_status='paid';
 const status=await handle(new Request(ORIGIN+'/api/commerce/status?session_id='+session.id),'status');
 assert.equal(status.status,200);assert.equal((await status.json()).paid,true);
 const order=db.sql.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
 assert.equal(order.total_cents,subtotal+tax);assert.equal(order.shipping_cents,0);assert.equal(order.status,'paid');
 db.sql.close();
});

function approvedFixture(){
 const p=structuredClone(catalog);p.currencyApproved=true;p.checkoutEnabled=true;p.shipping={countries:['US'],cents:10000};p.taxMode='none';p.termsUrl='https://example.com/test-terms';
 for(const field of Object.values(p.fields))for(const option of Object.values(field.options)){delete option.componentPricesCents;option.approved=true;option.cents=0;}
 // Deliberately synthetic prices, used only inside this test.
 p.fields.bridgeModel.options['floyd-original'].cents=30000;
 return p;
}
test('Checkout includes burl, maple, Cherub Wings, pickup layout, pot mods, killswitch and case in the exact stored and Stripe amount',async()=>{
 const chosen=createElectronics().normalize({...selections,wood:'burl',fretboard:'maple',inlays:'motif',pickupLayout:'hsh',pot1Mod:'split-neck',pot3Mod:'split-bridge',killswitch:'momentary',caseOption:'fitted'}),input={...build,selections:chosen};
 const db=database(),env={DB:db,STRIPE_SECRET_KEY:'rk_test_fixture_only',STRIPE_MODE:'test',PAYMENTS_ENABLED:'true',CHECKOUT_PUBLIC_READY:'true',STRIPE_WEBHOOK_SECRET:'whsec_fixture_only'};
 const expected=529968;assert.equal(createPricingEngine(catalog).quote(input.model,chosen).subtotalCents,expected);
 const handle=createCommerceService(env,{fetchImpl:async(url,options)=>{const p=new URLSearchParams(options.body);assert.equal(options.method,'POST');assert.equal(p.get('line_items[0][price_data][unit_amount]'),String(expected));for(const key of ['wood','fretboard','inlays','pickupLayout','singleCoilModel','pot1Mod','pot3Mod','killswitch','caseOption'])assert.equal(p.get('metadata[build_'+key+']'),chosen[key]);assert([...p.keys()].filter(k=>k.startsWith('metadata[')).length<=50);return Response.json({id:'cs_test_electronicsFixture',url:'https://checkout.stripe.com/c/pay/cs_test_electronicsFixture',livemode:false,mode:'payment',currency:'usd',amount_subtotal:expected,amount_total:expected,total_details:{amount_shipping:0,amount_tax:0,amount_discount:0},client_reference_id:p.get('client_reference_id'),metadata:{order_id:p.get('metadata[order_id]')},status:'open',payment_status:'unpaid'});}});
 const response=await handle(request('checkout',{...input,totalCents:1}),'checkout');assert.equal(response.status,200);const {orderId}=await response.json(),order=db.sql.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
 assert.equal(order.subtotal_cents,expected);assert.deepEqual(JSON.parse(order.build_json).selections,chosen);assert.equal(JSON.parse(order.quote_json).electronicsUpgradeCents,17500);assert.equal(JSON.parse(order.quote_json).accessoryUpgradeCents,50000);const q=JSON.parse(order.quote_json);assert.equal(q.materialUpgradeCents,80000);assert.equal(q.lines.find(l=>l.key==='wood').value,'Burl — may require resin filling');assert.equal(q.lines.find(l=>l.key==='inlays').value,'Cherub Wings');assert.equal(q.lines.find(l=>l.key==='fretboard').value,'Maple');db.sql.close();
});
function database(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../../drizzle/0000_grey_ricochet.sql',import.meta.url),'utf8'));
 return {sql,prepare(query){return{bind(...args){const statement=sql.prepare(query);return{first:async()=>statement.get(...args)||null,run:async()=>statement.run(...args)};}};}};
}
for(const mode of ['test','live'])test(mode+' checkout recomputes the full price, is idempotent, and records payment only after provider verification (mock Stripe)',async()=>{
 const db=database(),prices=approvedFixture(),sessions=new Map();let posts=0;
 const sessionId='cs_'+mode+'_fixtureABC',livemode=mode==='live',paidStatus=livemode?'paid':'test_paid';
 const handle=createCommerceService({DB:db,STRIPE_SECRET_KEY:'rk_'+mode+'_fixture_only',STRIPE_MODE:mode,PAYMENTS_ENABLED:'true',CHECKOUT_PUBLIC_READY:'true',STRIPE_WEBHOOK_SECRET:'whsec_fixture_only'}, {prices,fetchImpl:async(url,options)=>{
  const headers=new Headers(options.headers);assert.equal(headers.get('Stripe-Version'),STRIPE_API_VERSION);
  if(options.method==='POST'){
   posts++;const p=new URLSearchParams(options.body);assert.equal(p.get('line_items[0][price_data][unit_amount]'),'379900');
   assert.equal(p.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'),'10000');
   assert.equal(p.get('metadata[build_bridgeModel]'),'floyd-original');
   assert.equal(p.get('metadata[payment_mode]'),mode);
   assert.equal(p.get('mode'),'payment');
   assert.equal(p.get('ui_mode'),'hosted_page');
   assert.equal(p.get('origin_context'),'web');
   assert.equal(p.get('phone_number_collection[enabled]'),'true');
   assert.equal(p.get('allow_promotion_codes'),'false');
   assert.equal(p.get('consent_collection[terms_of_service]'),'required');
   assert.equal(p.get('custom_text[terms_of_service_acceptance][message]'),'I agree to the [Fostinis order terms]('+prices.termsUrl+'), including the no-returns policy.');
   assert.equal([...p.keys()].some(k=>k.startsWith('payment_method_types')),false);
   assert.match(p.get('integration_identifier'),/^fostinis-showroom-[a-z]{8}$/);
   assert.equal(p.get('branding_settings[display_name]'),'Fostinis Guitars');
   assert.match(headers.get('Idempotency-Key'),/^fostinis-FG-/);
   const id=sessionId,orderId=p.get('client_reference_id');
   sessions.set(id,{id,url:'https://checkout.stripe.com/c/pay/'+id,livemode,mode:'payment',currency:'usd',amount_subtotal:379900,amount_total:389900,total_details:{amount_shipping:10000,amount_tax:0,amount_discount:0},client_reference_id:orderId,metadata:{order_id:orderId},status:'open',payment_status:'unpaid'});
   return Response.json(sessions.get(id));
  }
  return Response.json(sessions.get(url.split('/').pop()));
 }});
 const first=await handle(request('checkout',{...build,amount:1,totalCents:1}),'checkout');assert.equal(first.status,200);const result=await first.json();
 assert.equal((await handle(request('checkout',build),'checkout')).status,200);assert.equal(posts,1);
 const changed=await handle(request('checkout',{...build,model:'oryx'}),'checkout');assert.equal(changed.status,409);
 const statusReq=new Request(ORIGIN+'/api/commerce/status?session_id='+sessionId);
 assert.equal((await (await handle(statusReq,'status')).json()).paid,false);
 const session=sessions.get(sessionId);session.status='complete';session.payment_status='paid';session.amount_total=1;
 assert.equal((await handle(statusReq,'status')).status,409);
 assert.equal(db.sql.prepare('SELECT status FROM orders WHERE id=?').get(result.orderId).status,'pending');
 session.amount_total=389900;
 session.livemode=!livemode;assert.equal((await handle(statusReq,'status')).status,409);session.livemode=livemode;
 const webhook=async(type)=>{
  const raw=JSON.stringify({id:'evt_fixture',type,livemode,data:{object:{id:session.id}}});
  const signature=await sign(raw,'whsec_fixture_only');
  return handle(new Request(ORIGIN+'/api/commerce/webhook',{method:'POST',body:raw,headers:{'stripe-signature':signature}}),'webhook');
 };
 session.payment_status='unpaid';
 assert.equal((await webhook('checkout.session.completed')).status,200);
 assert.equal(db.sql.prepare('SELECT status FROM orders WHERE id=?').get(result.orderId).status,'pending');
 session.payment_status='paid';
 assert.equal((await webhook('checkout.session.async_payment_succeeded')).status,200);
 assert.equal(db.sql.prepare('SELECT status FROM orders WHERE id=?').get(result.orderId).status,paidStatus);
 assert.equal((await (await handle(statusReq,'status')).json()).paid,true);
 assert.equal(db.sql.prepare('SELECT status FROM orders WHERE id=?').get(result.orderId).status,paidStatus);
 assert.equal((await handle(request('checkout',build),'checkout')).status,409);
 db.sql.close();
});
async function sign(raw,secret){
 const timestamp=Math.floor(Date.now()/1000);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+raw)));
 return 't='+timestamp+',v1='+Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
}
test('webhook requires a valid, recent Stripe signature; body changes invalidate it',async()=>{
 const secret='whsec_fixture_only',raw='{"type":"checkout.session.completed"}',timestamp=Math.floor(Date.now()/1000);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+raw)));
 const signature=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join(''),header='t='+timestamp+',v1='+signature;
 assert.equal(await verifyStripeSignature(raw,header,secret),true);
 assert.equal(await verifyStripeSignature(raw+' ',header,secret),false);
 assert.equal(await verifyStripeSignature(raw,header,secret,Date.now()+400000),false);
 const handle=createCommerceService({});assert.equal((await handle(new Request(ORIGIN+'/api/commerce/webhook',{method:'POST',body:raw}),'webhook')).status,400);
});
