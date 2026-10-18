import Stripe from 'stripe';
import catalog from './catalog.json' with {type:'json'};
import {createPricingEngine} from './pricing-engine.mjs';
import {PUBLIC_ORIGINS} from './origins.mjs';
import {STRIPE_API_VERSION,stripeMode,paymentReady,createCommerceService} from './service.mjs';
import {cleanAdjustments,invoiceSubtotal} from '../custom-requests.mjs';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const reply=(v,status=200)=>Response.json(v,{status,headers});
const secret=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),n=>n.toString(16).padStart(2,'0')).join('');
const parse=s=>{try{return JSON.parse(s);}catch{return null;}};
const validate=fn=>{try{return fn();}catch(error){throw fail(error.message);}};
/** @param {object} env @param {{identity?: {userId:string,email:string}|null, prices?:object, fetchImpl?:typeof fetch, now?:()=>string}} options */
export function createCustomOrderService(env,{identity=null,prices=catalog,fetchImpl=fetch,now=()=>new Date().toISOString()}={}){
 const db=env.DB,owner=!!(identity?.userId&&env.FOSTINIS_OWNER_EMAIL&&identity.email?.toLowerCase()===env.FOSTINIS_OWNER_EMAIL.toLowerCase());
 const run=(sql,...a)=>db.prepare(sql).bind(...a).run(),one=(sql,...a)=>db.prepare(sql).bind(...a).first();
 let client;const stripe=()=>client??=new Stripe(env.STRIPE_SECRET_KEY,{apiVersion:STRIPE_API_VERSION,httpClient:Stripe.createFetchHttpClient(fetchImpl),maxNetworkRetries:2,timeout:20000,telemetry:false});
 function admin(){if(!owner)throw fail('Sign in as the Fostinis owner to create or change invoices.',403);}
 function origin(request){const value=request.headers.get('origin');if(!PUBLIC_ORIGINS.includes(value))throw fail('Open this invoice from Fostinis Guitars.',403);return value;}
 async function body(request){const raw=await request.text();if(raw.length>50000)throw fail('This invoice is too large.',413);const value=parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw fail('Invalid invoice.');return value;}
 async function authorized(request){const access=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';if(!/^[a-f0-9]{64}$/.test(access))throw fail('Use the private invoice link from Fostinis.',404);const row=await one('SELECT * FROM atelier_invoices WHERE access_token=?',access);if(!row||row.status==='draft')throw fail('This invoice is not available.',404);return row;}
 const active=requestId=>one("SELECT * FROM atelier_invoices WHERE request_id=? AND status!='void'",requestId);
 async function view(row,includeToken=false){
  if(!row)return null;const r=await one('SELECT name,email FROM atelier_requests WHERE id=?',row.request_id);const order=row.order_id?await one('SELECT total_cents,status FROM orders WHERE id=?',row.order_id):null;
  return {id:row.id,requestId:row.request_id,customer:r,build:parse(row.build_json),quote:parse(row.quote_json),adjustments:parse(row.adjustments_json),baseCents:row.base_cents,subtotalCents:row.subtotal_cents,shippingCents:row.shipping_cents,currency:row.currency,specification:row.specification,leadTime:row.lead_time,status:row.status,revision:row.revision,orderId:row.order_id,totalCents:order?.total_cents??null,createdAt:row.created_at,issuedAt:row.issued_at,paidAt:row.paid_at,...(includeToken?{accessToken:row.access_token}:{})};
 }
 async function verifyOrder(order){
  const response=await createCommerceService(env,{prices,fetchImpl})(new Request(PUBLIC_ORIGINS[0]+'/api/commerce/status?session_id='+encodeURIComponent(order.session_id)),'status');
  const data=await response.json();if(!response.ok)throw fail(data.message,response.status);return data;
 }
 async function lock(row){const value=now()+':'+crypto.randomUUID(),before=new Date(Date.parse(now())-240000).toISOString();const result=await run("UPDATE atelier_invoices SET checkout_lock=? WHERE id=? AND status='issued' AND (checkout_lock IS NULL OR substr(checkout_lock,1,24)<?)",value,row.id,before);if(!result.meta?.changes)throw fail('This invoice is being updated. Please wait a moment and try again.',409);return value;}
 async function checkout(request,row){
  const storefront=origin(request),input=await body(request);
  if(input.accepted!==true||input.revision!==row.revision)throw fail('Review and accept the current invoice details before payment.');
  if(row.status!=='issued')throw fail(row.status==='void'?'This invoice has been cancelled. Request an updated invoice.':'This invoice has already been paid.',409);
  if(!paymentReady(env,prices))throw fail('Stripe checkout is temporarily unavailable. Please contact Fostinis before paying.',503);
  const held=await lock(row);
  try{
   row=await one('SELECT * FROM atelier_invoices WHERE id=?',row.id);
   const build=parse(row.build_json),orderId=row.order_id||'FG-C-'+row.id.slice(3),canonical=JSON.stringify({...build,customInvoiceId:row.id,invoiceRevision:row.revision,paymentMode:stripeMode(env)});
   const quote={...parse(row.quote_json),customInvoiceId:row.id,invoiceRevision:row.revision,specification:row.specification,adjustments:parse(row.adjustments_json),subtotalCents:row.subtotal_cents,acceptedAt:now()};
   await run('INSERT OR IGNORE INTO orders (id,request_id,fingerprint,build_json,quote_json,subtotal_cents,shipping_cents,currency,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',orderId,row.id,await hash(canonical),canonical,JSON.stringify(quote),row.subtotal_cents,row.shipping_cents,row.currency,'pending',now());
   await run('UPDATE atelier_invoices SET order_id=? WHERE id=?',orderId,row.id);
   let order=await one('SELECT * FROM orders WHERE id=?',orderId);
   if(['paid','test_paid'].includes(order.status))throw fail('This invoice has already been paid.',409);
   let expired=false;
   if(order.session_id){
    const session=await stripe().checkout.sessions.retrieve(order.session_id);
    if(session.livemode!==(stripeMode(env)==='live'))throw fail('Payment environment mismatch.',409);
    if(session.status==='open')return reply({url:order.checkout_url,orderId});
    if(session.status==='complete'){await verifyOrder(order);throw fail(session.payment_status==='paid'?'This invoice has already been paid.':'Your payment is processing. Please wait for confirmation before trying again.',409);}
    expired=session.status==='expired';if(!expired)throw fail('The previous payment needs review. Please contact Fostinis.',409);
   }
   const attempt=expired?row.checkout_attempt+1:Math.max(1,row.checkout_attempt),started=expired||!row.checkout_started_at?now():row.checkout_started_at;
   if(Date.parse(started)+3600000<Date.parse(now())&&!expired)throw fail('This payment attempt needs review. Please contact Fostinis before retrying.',409);
   await run('UPDATE atelier_invoices SET checkout_attempt=?,checkout_started_at=? WHERE id=?',attempt,started,row.id);
   const r=await one('SELECT name,email FROM atelier_requests WHERE id=?',row.request_id),adjustments=parse(row.adjustments_json),positiveOnly=adjustments.every(a=>a.cents>=0);
   const line=(name,amount,description)=>({quantity:1,price_data:{currency:row.currency,unit_amount:amount,tax_behavior:'exclusive',product_data:{name,description:description.slice(0,700)}}});
   const lineItems=positiveOnly?[line('Fostinis '+prices.models[build.model].name+' — configured guitar',row.base_cents,'Custom invoice '+row.id+' · Original selected specifications'),...adjustments.filter(a=>a.cents>0).map(a=>line(a.description.slice(0,120),a.cents,a.description))]:[line('Fostinis '+prices.models[build.model].name+' — agreed custom build',row.subtotal_cents,'Includes all agreed additions and credits on invoice '+row.id)];
   const returnUrl=storefront+'/atelier.html?view=invoice';
   const session=await stripe().checkout.sessions.create({mode:'payment',ui_mode:'hosted_page',origin_context:'web',integration_identifier:'fostinis-custom-orders-fndtvrqa',client_reference_id:order.id,
    customer_email:r.email,line_items:lineItems,success_url:returnUrl+'&checkout=success#access='+row.access_token,cancel_url:returnUrl+'&checkout=cancelled#access='+row.access_token,
    metadata:{order_id:order.id,custom_invoice_id:row.id,invoice_revision:String(row.revision),payment_mode:stripeMode(env)},payment_intent_data:{metadata:{order_id:order.id,custom_invoice_id:row.id}},
    automatic_tax:{enabled:prices.taxMode==='automatic'},billing_address_collection:'required',phone_number_collection:{enabled:true},consent_collection:{terms_of_service:'required'},allow_promotion_codes:false,
    custom_text:{submit:{message:'Approved Fostinis custom invoice '+row.id+'. Terms: '+prices.termsUrl},terms_of_service_acceptance:{message:'I agree to the [Fostinis order terms]('+prices.termsUrl+'), including the no-returns policy.'}},
    shipping_options:[{shipping_rate_data:{type:'fixed_amount',fixed_amount:{amount:row.shipping_cents,currency:row.currency},display_name:row.shipping_cents===0?'US guitar shipping · included':'Agreed guitar shipping',tax_behavior:'exclusive'}}],shipping_address_collection:{allowed_countries:prices.shipping.countries},
    branding_settings:{display_name:'Fostinis Guitars',button_color:'#c8aa79',background_color:'#17191b',font_family:'lora',border_style:'rounded'},expires_at:Math.floor(Date.parse(started)/1000)+3600
   },{idempotencyKey:'fostinis-custom-'+order.id+'-'+attempt});
   if(session.livemode!==(stripeMode(env)==='live')||!session.id||new URL(session.url).origin!=='https://checkout.stripe.com')throw fail('The payment link could not be verified.',502);
   await run('UPDATE orders SET session_id=?,checkout_url=? WHERE id=?',session.id,session.url,order.id);
   return reply({url:session.url,orderId:order.id});
  }finally{await run('UPDATE atelier_invoices SET checkout_lock=NULL WHERE id=? AND checkout_lock=?',row.id,held);}
 }
 return async(request,action)=>{
  try{
   if(!db)throw fail('Custom orders are temporarily unavailable.',503);
   if(action==='custom-invoice'&&request.method==='GET'){
    let row=await authorized(request);const order=row.order_id?await one('SELECT * FROM orders WHERE id=?',row.order_id):null;
    let verificationPending=false;if(row.status==='issued'&&order?.session_id){try{await verifyOrder(order);row=await one('SELECT * FROM atelier_invoices WHERE id=?',row.id);}catch{verificationPending=true;}}
    return reply({invoice:await view(row),ready:paymentReady(env,prices),mode:stripeMode(env),verificationPending,termsUrl:prices.termsUrl});
   }
   if(action==='custom-checkout'&&request.method==='POST')return await checkout(request,await authorized(request));
   if(action!=='custom-admin')throw fail('Not found.',404);admin();
   if(request.method==='GET'){const row=await active(new URL(request.url).searchParams.get('requestId')||'');return reply({invoice:await view(row,true)});}
   if(request.method!=='POST')throw fail('Not found.',404);origin(request);const input=await body(request);
   const r=await one('SELECT * FROM atelier_requests WHERE id=?',input.requestId||'');if(!r||r.kind!=='review')throw fail('Choose a customer design-review request.',404);
   let row=await active(r.id);
   if(input.operation==='save'){
    const adjustments=validate(()=>cleanAdjustments(input.adjustments,Object.keys(prices.fields)));
    if(typeof input.specification!=='string'||!input.specification.trim()||input.specification.length>10000||typeof input.leadTime!=='string'||input.leadTime.length>1000)throw fail('Add the agreed special-order specifications (up to 10,000 characters).');
    if(row&&(row.status!=='draft'||input.id!==row.id))throw fail('Reload this request to see its current invoice. Issued invoices must be voided before replacement.',409);
    if(row){const subtotal=validate(()=>invoiceSubtotal(row.base_cents,adjustments));const result=await run("UPDATE atelier_invoices SET adjustments_json=?,subtotal_cents=?,specification=?,lead_time=?,revision=revision+1,updated_at=? WHERE id=? AND status='draft' AND revision=?",JSON.stringify(adjustments),subtotal,input.specification.trim(),input.leadTime.trim(),now(),row.id,input.revision);if(!result.meta?.changes)throw fail('This draft changed in another window. Reload before editing.',409);}
    else{
     if(input.id)throw fail('This invoice draft is no longer active. Reload the request.',409);
     const build=parse(r.build_json),details=parse(r.details_json)||{},q=details.configuredQuote||createPricingEngine(prices).quote(build.model,build.selections),base=q.confirmedSubtotalCents,subtotal=validate(()=>invoiceSubtotal(base,adjustments)),id='FI-'+crypto.randomUUID();
     const inserted=await run('INSERT OR IGNORE INTO atelier_invoices (id,request_id,access_token,build_json,quote_json,adjustments_json,base_cents,subtotal_cents,shipping_cents,currency,specification,lead_time,status,revision,checkout_attempt,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,0,?,?)',id,r.id,secret(),r.build_json,JSON.stringify(q),JSON.stringify(adjustments),base,subtotal,details.shippingCents??prices.shipping.cents,prices.currency,input.specification.trim(),input.leadTime.trim(),'draft',now(),now());if(!inserted.meta?.changes)throw fail('An invoice was created in another window. Reload this request.',409);
    }
    return reply({invoice:await view(await active(r.id),true)});
   }
   if(!row||input.id!==row.id)throw fail('Reload this request to open its current invoice.',409);
   if(input.operation==='issue'){
    if(input.confirmed!==true)throw fail('Confirm the specifications and price before issuing the invoice.');
    const result=await run("UPDATE atelier_invoices SET status='issued',issued_at=?,updated_at=? WHERE id=? AND status='draft' AND revision=?",now(),now(),row.id,input.revision);if(!result.meta?.changes)throw fail('This invoice has changed. Reload it before issuing.',409);
    return reply({invoice:await view(await active(r.id),true)});
   }
   if(input.operation==='void'){
    if(row.status==='draft'){await run("UPDATE atelier_invoices SET status='void',updated_at=? WHERE id=? AND status='draft'",now(),row.id);return reply({voided:true});}
    if(row.status!=='issued')throw fail('A paid invoice cannot be voided here. Review the payment in Stripe.',409);
    const held=await lock(row);try{
     const order=row.order_id?await one('SELECT * FROM orders WHERE id=?',row.order_id):null;
     if(order){if(!order.session_id)throw fail('A checkout attempt is unresolved. Refresh the payment before cancelling this invoice.',409);const session=await stripe().checkout.sessions.retrieve(order.session_id);if(session.status==='complete'){await verifyOrder(order);throw fail('This payment is completed or processing and cannot be cancelled here.',409);}if(session.status==='open')await stripe().checkout.sessions.expire(session.id);}
     await run("UPDATE atelier_invoices SET status='void',updated_at=? WHERE id=? AND status='issued' AND checkout_lock=?",now(),row.id,held);return reply({voided:true});
    }finally{await run('UPDATE atelier_invoices SET checkout_lock=NULL WHERE id=? AND checkout_lock=?',row.id,held);}
   }
   throw fail('Unknown invoice action.');
  }catch(error){return reply({message:error.status?error.message:error.type?.startsWith('Stripe')?'Stripe could not open this payment. Please retry or contact Fostinis.':'This invoice could not be updated. Please try again.'},error.status||500);}
 };
}
