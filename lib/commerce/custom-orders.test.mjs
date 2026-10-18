import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import catalog from './catalog.json' with {type:'json'};
import {createCommerceService} from './service.mjs';
import {createCustomOrderService} from './custom-orders.mjs';
import {createAtelierService} from '../atelier/service.mjs';
import {handleUpload} from '../atelier/uploads.mjs';
import {cleanCustomRequests,dollarsToCents} from '../custom-requests.mjs';
const ORIGIN='https://fostinisguitars.com';
const selections=Object.fromEntries(Object.entries(catalog.fields).map(([key,f])=>[key,f.default??Object.keys(f.options)[0]]));
const build={model:'sphyx',selections,nickname:'Custom instrument',notes:'',customRequests:{pickupSet:{text:'Replace the selected set with the agreed custom pickups.',files:[]}}};
function fixture({mode='test'}={}){
 const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8'));
 const DB={prepare(query){const s=sql.prepare(query);let args=[];const q={bind(...a){args=a.map(v=>v===undefined?null:v);return q;},async run(){return {meta:{changes:Number(s.run(...args).changes)}};},async first(){return s.get(...args)||null;},async all(){return {results:s.all(...args)};}};return q;},async batch(statements){sql.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sql.exec('COMMIT');return result;}catch(error){sql.exec('ROLLBACK');throw error;}}};
 const objects=new Map(),BUCKET={async put(key,bytes){objects.set(key,bytes);},async get(key){const value=objects.get(key);return value?{body:value}:null;},async delete(key){objects.delete(key);}};
 const env={DB,BUCKET,FOSTINIS_OWNER_EMAIL:'owner@example.test',STRIPE_SECRET_KEY:'rk_'+mode+'_fixture_only',STRIPE_MODE:mode,PAYMENTS_ENABLED:'true',CHECKOUT_PUBLIC_READY:'true',STRIPE_WEBHOOK_SECRET:'whsec_fixture_only'};
 const identity={userId:'verified-owner',email:'owner@example.test'},sessions=new Map(),calls=[];
 const fetchImpl=async(url,options={})=>{
  const path=new URL(url).pathname,p=new URLSearchParams(options.body||'');calls.push({path,method:options.method,p,headers:new Headers(options.headers)});
  if(path==='/v1/checkout/sessions'&&options.method==='POST'){
   let subtotal=0;for(let i=0;p.has(`line_items[${i}][price_data][unit_amount]`);i++)subtotal+=Number(p.get(`line_items[${i}][price_data][unit_amount]`));
   const id='cs_'+mode+'_customFixture'+(sessions.size+1),metadata=Object.fromEntries([...p].filter(([k])=>k.startsWith('metadata[')).map(([k,v])=>[k.slice(9,-1),v]));
   const session={id,livemode:mode==='live',mode:'payment',currency:'usd',status:'open',payment_status:'unpaid',url:'https://checkout.stripe.com/c/pay/'+id,client_reference_id:p.get('client_reference_id'),metadata,amount_subtotal:subtotal,amount_total:subtotal+27163,total_details:{amount_shipping:0,amount_tax:27163,amount_discount:0}};sessions.set(id,session);return Response.json(session);
  }
  const id=path.split('/')[4],session=sessions.get(id);if(!session)throw Error('Unknown fixture request: '+path);
  if(path.endsWith('/expire')){if(session.status!=='open')return Response.json({error:{message:'Not open'}},{status:400});session.status='expired';}
  return Response.json(session);
 };
 const service=createCustomOrderService(env,{identity,fetchImpl}),guest=createCustomOrderService(env,{fetchImpl}),commerce=createCommerceService(env,{fetchImpl}),atelier=createAtelierService(env);
 async function call(action,{data,token,owner=true,origin=ORIGIN,query='',serviceOverride}={}){const request=new Request(ORIGIN+'/api/commerce/'+action+query,{method:data?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined});const response=await (serviceOverride||(owner?service:guest))(request,action);return {status:response.status,body:await response.json()};}
 async function review(requestBuild=build){const response=await atelier(new Request(ORIGIN+'/api/atelier/request',{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json','cf-connecting-ip':'192.0.2.3'},body:JSON.stringify({kind:'review',name:'Example Customer',email:'customer@example.test',message:'Please quote this exact guitar.',build:requestBuild})}),'request');const r=await response.json();assert.equal(response.status,201,JSON.stringify(r));const existing=JSON.parse(sql.prepare('SELECT details_json FROM atelier_requests WHERE id=?').get(r.id).details_json);existing.configuredQuote.confirmedSubtotalCents=400000;sql.prepare('UPDATE atelier_requests SET details_json=? WHERE id=?').run(JSON.stringify(existing),r.id);return r;}
 async function draft(requestId,{adjustments=[{field:'pickupSet',description:'Agreed pickup substitution',cents:10000}],...other}={}){return call('custom-admin',{data:{operation:'save',requestId,adjustments,specification:'Fit the agreed custom pickup make and model; retain every other original selection.',leadTime:'Timing agreed with the customer',...other}});}
 async function issued(){const request=await review(),d=await draft(request.id);assert.equal(d.status,200,JSON.stringify(d));const result=await call('custom-admin',{data:{operation:'issue',requestId:request.id,id:d.body.invoice.id,revision:d.body.invoice.revision,confirmed:true}});assert.equal(result.status,200,JSON.stringify(result));return {request,invoice:result.body.invoice};}
 return {env,sql,call,review,draft,issued,commerce,sessions,calls,objects,atelier};
}
test('Money input preserves cents and custom request keys and attachment limits are validated',()=>{
 assert.equal(dollarsToCents('100.00'),10000);assert.equal(dollarsToCents('-25.50'),-2550);for(const value of ['1e3','1.001','Infinity',''])assert.throws(()=>dollarsToCents(value));
 assert.throws(()=>cleanCustomRequests({fake:{text:'x',files:[]}},Object.keys(catalog.fields)));assert.throws(()=>cleanCustomRequests({inlays:{text:'x'.repeat(2001),files:[]}},Object.keys(catalog.fields)));
});
test('Option-specific requests block catalog checkout even with a forged client price',async()=>{
 const f=fixture();const response=await f.call('checkout',{data:{...build,requestId:crypto.randomUUID(),totalCents:1},serviceOverride:f.commerce});assert.equal(response.status,409);assert.equal(f.calls.length,0);
});
test('Owner-only invoice editor freezes $4,000 base and adds exactly $100; forged base amounts are ignored',async()=>{
 const f=fixture(),r=await f.review();assert.equal((await f.draft(r.id,{baseCents:1,subtotalCents:1})).body.invoice.subtotalCents,410000);
 const d=await f.call('custom-admin',{query:'?requestId='+r.id});assert.equal(d.body.invoice.baseCents,400000);assert.equal(d.body.invoice.build.customRequests.pickupSet.text,build.customRequests.pickupSet.text);
 assert.equal((await f.call('custom-admin',{owner:false,query:'?requestId='+r.id})).status,403);
 assert.equal((await f.call('custom-admin',{owner:false,data:{operation:'issue',requestId:r.id,id:d.body.invoice.id,revision:1,confirmed:true}})).status,403);
 assert.equal((await f.call('custom-admin',{origin:'https://evil.example',data:{operation:'issue',requestId:r.id,id:d.body.invoice.id,revision:1,confirmed:true}})).status,403);
 assert.equal((await f.call('custom-invoice',{owner:false,token:d.body.invoice.accessToken})).status,404);
});
test('Draft revisions reject stale edits; issuing locks the price and public data requires a private link',async()=>{
 const f=fixture(),r=await f.review(),d=(await f.draft(r.id)).body.invoice;
 const updated=await f.draft(r.id,{id:d.id,revision:d.revision});assert.equal(updated.status,200);assert.equal((await f.draft(r.id,{id:d.id,revision:d.revision})).status,409);
 assert.equal((await f.call('custom-admin',{data:{operation:'issue',requestId:r.id,id:d.id,revision:2,confirmed:true}})).status,200);
 assert.equal((await f.draft(r.id,{id:d.id,revision:2})).status,409);assert.equal((await f.call('custom-invoice',{owner:false,token:'0'.repeat(64)})).status,404);
 const visible=await f.call('custom-invoice',{owner:false,token:d.accessToken});assert.equal(visible.status,200);assert.equal(visible.body.invoice.subtotalCents,410000);assert(!Object.hasOwn(visible.body.invoice,'accessToken'));
});
test('Customer checkout uses approved amount, requires acceptance, preserves tax, and retries one session',async()=>{
 const f=fixture(),{invoice}=await f.issued(),args={owner:false,token:invoice.accessToken,data:{accepted:true,revision:invoice.revision,subtotalCents:1,adjustments:[]}};
 assert.equal((await f.call('custom-checkout',{...args,data:{accepted:false,revision:invoice.revision}})).status,400);
 const a=await f.call('custom-checkout',args),b=await f.call('custom-checkout',args);assert.equal(a.status,200,JSON.stringify(a));assert.equal(a.body.url,b.body.url);assert.equal(f.sessions.size,1);
 const posted=f.calls.find(c=>c.method==='POST');assert.equal(posted.p.get('line_items[0][price_data][unit_amount]'),'400000');assert.equal(posted.p.get('line_items[1][price_data][unit_amount]'),'10000');assert.equal(posted.p.get('automatic_tax[enabled]'),'true');assert.equal(posted.p.get('customer_email'),'customer@example.test');assert(!posted.p.has('payment_method_types[0]'));assert.equal(posted.p.get('success_url'),'https://fostinisguitars.com/atelier.html?view=invoice&checkout=success#access='+invoice.accessToken);
});
test('Credits use a positive net line and never disable automatic tax',async()=>{
 const f=fixture(),r=await f.review(),d=(await f.draft(r.id,{adjustments:[{field:'pickupSet',description:'Lower-cost pickup credit',cents:-10000}]})).body.invoice;
 const issued=await f.call('custom-admin',{data:{operation:'issue',requestId:r.id,id:d.id,revision:1,confirmed:true}});assert.equal(issued.status,200);
 assert.equal((await f.call('custom-checkout',{token:d.accessToken,owner:false,data:{accepted:true,revision:1}})).status,200);
 const posted=f.calls.find(c=>c.method==='POST');assert.equal(posted.p.get('line_items[0][price_data][unit_amount]'),'390000');assert.equal(posted.p.has('line_items[1][price_data][unit_amount]'),false);assert.equal(posted.p.get('automatic_tax[enabled]'),'true');
});
test('Webhook verification records live custom payment and ties it to the request; bad metadata never marks it paid',async()=>{
 const f=fixture({mode:'live'}),{request,invoice}=await f.issued();await f.call('custom-checkout',{token:invoice.accessToken,owner:false,data:{accepted:true,revision:1}});const session=[...f.sessions.values()][0];session.status='complete';session.payment_status='paid';session.metadata.invoice_revision='999';
 const bad=await f.call('status',{query:'?session_id='+session.id,serviceOverride:f.commerce});assert.equal(bad.status,409);assert.equal(f.sql.prepare('SELECT status FROM orders').get().status,'pending');session.metadata.invoice_revision='1';
 const raw=JSON.stringify({type:'checkout.session.async_payment_succeeded',data:{object:{id:session.id}}}),time=Math.floor(Date.now()/1000),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(f.env.STRIPE_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signed=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(time+'.'+raw));const sig=Array.from(new Uint8Array(signed),v=>v.toString(16).padStart(2,'0')).join('');
 const response=await f.commerce(new Request(ORIGIN+'/api/commerce/webhook',{method:'POST',headers:{'stripe-signature':`t=${time},v1=${sig}`},body:raw}),'webhook');assert.equal(response.status,200);assert.equal(f.sql.prepare('SELECT status FROM atelier_invoices').get().status,'paid');assert.equal(f.sql.prepare('SELECT status,order_id FROM atelier_requests WHERE id=?').get(request.id).status,'confirmed');
 const visible=await f.call('custom-invoice',{token:invoice.accessToken,owner:false});assert.equal(visible.body.invoice.totalCents,437163);assert.equal(visible.body.invoice.status,'paid');
});
test('Asynchronous unpaid checkout stays pending and cannot be paid again or voided while processing',async()=>{
 const f=fixture(),{request,invoice}=await f.issued();await f.call('custom-checkout',{token:invoice.accessToken,data:{accepted:true,revision:1}});const session=[...f.sessions.values()][0];session.status='complete';
 assert.equal((await f.call('custom-checkout',{token:invoice.accessToken,data:{accepted:true,revision:1}})).status,409);assert.equal((await f.call('custom-admin',{data:{operation:'void',requestId:request.id,id:invoice.id}})).status,409);assert.equal(f.sql.prepare('SELECT status FROM atelier_invoices').get().status,'issued');
});
test('Voiding expires the open Stripe session and allows a replacement; the old link remains unpayable',async()=>{
 const f=fixture(),{request,invoice}=await f.issued();await f.call('custom-checkout',{token:invoice.accessToken,data:{accepted:true,revision:1}});
 assert.equal((await f.call('custom-admin',{data:{operation:'void',requestId:request.id,id:invoice.id}})).status,200);assert.equal([...f.sessions.values()][0].status,'expired');assert.equal((await f.call('custom-checkout',{token:invoice.accessToken,data:{accepted:true,revision:1}})).status,409);
 const replacement=await f.draft(request.id);assert.equal(replacement.status,200);assert.notEqual(replacement.body.invoice.id,invoice.id);
});
test('Original artwork uploads stay private, preserve bytes, and validate attachment ownership on submission',async()=>{
 const f=fixture(),bytes=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3]),upload=await handleUpload(new Request(ORIGIN+'/api/atelier/upload?field=inlays',{method:'POST',headers:{Origin:ORIGIN,'X-Upload-Name':encodeURIComponent('my-inlay.png'),'cf-connecting-ip':'192.0.2.4'},body:bytes}),f.env);
 assert.equal(upload.status,201);const file=await upload.json();assert.equal(file.size,bytes.length);assert.equal((await handleUpload(new Request(ORIGIN+'/api/atelier/upload?id='+file.id),f.env)).status,404);
 const download=await handleUpload(new Request(ORIGIN+'/api/atelier/upload?id='+file.id,{headers:{Authorization:'Bearer '+file.token}}),f.env);assert.equal(download.status,200);assert.deepEqual(new Uint8Array(await download.arrayBuffer()),bytes);assert(download.headers.get('content-disposition').startsWith('attachment;'));
 const valid={...build,customRequests:{inlays:{text:'Use this exact inlay design.',files:[file]}}};const r=await f.review(valid);const stored=JSON.parse(f.sql.prepare('SELECT build_json FROM atelier_requests WHERE id=?').get(r.id).build_json);assert.equal(stored.customRequests.inlays.files[0].name,'my-inlay.png');
 const bad={...valid,customRequests:{inlays:{text:'Other file',files:[{...file,token:'0'.repeat(64)}]}}};const response=await f.atelier(new Request(ORIGIN+'/api/atelier/request',{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({kind:'review',name:'Another Customer',email:'another@example.test',build:bad})}),'request');assert.equal(response.status,400);
 const script=await handleUpload(new Request(ORIGIN+'/api/atelier/upload?field=inlays',{method:'POST',headers:{Origin:ORIGIN,'X-Upload-Name':'bad.svg'},body:'<svg><script>alert(1)</script></svg>'}),f.env);assert.equal(script.status,400);
});
