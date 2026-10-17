import catalog from './catalog.json' with {type:'json'};
import {createPricingEngine} from './pricing-engine.mjs';
import Stripe from 'stripe';
import {ORIGIN,PUBLIC_ORIGINS} from './origins.mjs';

export {ORIGIN} from './origins.mjs';
export const STRIPE_API_VERSION='2026-09-30.endive';
// Generated once for this integration, and stable across idempotent retries.
export const INTEGRATION_IDENTIFIER='fostinis-showroom-pztfnjpg';
const JSON_HEADERS={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
export function stripeMode(env){const mode=/^(?:rk|sk)_(test|live)_\S+$/.exec(env.STRIPE_SECRET_KEY||'')?.[1];return mode&&mode===env.STRIPE_MODE?mode:null;}
export function paymentReady(env,c=catalog){return Boolean(c.checkoutEnabled&&c.currencyApproved&&c.currency==='usd'&&env.PAYMENTS_ENABLED==='true'&&env.CHECKOUT_PUBLIC_READY==='true'&&/^whsec_/.test(env.STRIPE_WEBHOOK_SECRET||'')&&stripeMode(env)&&env.DB&&Number.isSafeInteger(c.shipping.cents)&&c.shipping.cents>=0&&c.shipping.countries.length&&['automatic','none'].includes(c.taxMode)&&/^https:\/\//.test(c.termsUrl||''));}

export async function verifyStripeSignature(body,header,secret,now=Date.now()){
 if(!secret||!header)return false;
 const parts=header.split(',').map(x=>x.split('=')),timestamp=parts.find(x=>x[0]==='t')?.[1];
 if(!/^\d+$/.test(timestamp||'')||Math.abs(now/1000-Number(timestamp))>300)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 for(const [,sig]of parts.filter(x=>x[0]==='v1')){
  if(!/^[a-f0-9]{64}$/i.test(sig||''))continue;
  const bytes=Uint8Array.from(sig.match(/../g).map(x=>parseInt(x,16)));
  if(await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(timestamp+'.'+body)))return true;
 }
 return false;
}

export function createCommerceService(env,{prices=catalog,fetchImpl=fetch}={}){
 const pricing=createPricingEngine(prices);
 let stripeClient;
 async function stripe(operation){
  if(!stripeMode(env))throw fail('Online payment is awaiting merchant setup.',503);
  stripeClient??=new Stripe(env.STRIPE_SECRET_KEY,{apiVersion:STRIPE_API_VERSION,httpClient:Stripe.createFetchHttpClient(fetchImpl),maxNetworkRetries:2,timeout:20000,telemetry:false});
  try{return await operation(stripeClient);}catch{throw fail('Secure checkout is temporarily unavailable. Please contact Jimmy before retrying.',502);}
 }
 async function body(request,max=18000){
  if(Number(request.headers.get('content-length')||0)>max)throw fail('The request is too large.',413);
  const raw=await request.text();if(raw.length>max)throw fail('The request is too large.',413);
  try{return JSON.parse(raw);}catch{throw fail('Invalid build request.');}
 }
 function sameOrigin(request){const origin=request.headers.get('origin');if(!PUBLIC_ORIGINS.includes(origin))throw fail('Open checkout from the Fostinis showroom.',403);return origin;}
 function makeQuote(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw fail('Invalid build request.');
  if(typeof input.notes!=='undefined'&&(typeof input.notes!=='string'||input.notes.length>3000))throw fail('Build notes must be 3,000 characters or fewer.');
  try{return pricing.quote(input.model,input.selections,input.notes||'');}catch(e){throw fail(e.message);}
 }
 async function verifySession(sessionId){
  if(!/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(sessionId||''))throw fail('Invalid checkout reference.');
  if(!env.DB)throw fail('Order verification is unavailable.',503);
  const order=await env.DB.prepare('SELECT * FROM orders WHERE session_id = ?').bind(sessionId).first();
  if(!order)throw fail('Order not found.',404);
  const session=await stripe(client=>client.checkout.sessions.retrieve(sessionId));
  if(session.livemode!==(stripeMode(env)==='live'))throw fail('Payment environment does not match this order.',409);
  const paid=session.payment_status==='paid'&&session.status==='complete';
  const amountsMatch=session.mode==='payment'&&session.currency===order.currency&&session.amount_subtotal===order.subtotal_cents&&session.total_details?.amount_shipping===order.shipping_cents&&session.amount_total===order.subtotal_cents+order.shipping_cents+(session.total_details?.amount_tax??0)-(session.total_details?.amount_discount??0)&&!session.total_details?.amount_discount;
  const metadataMatch=session.client_reference_id===order.id&&session.metadata?.order_id===order.id;
  if(!amountsMatch||!metadataMatch)throw fail('Payment details require manual verification. Please contact Jimmy.',409);
  if(paid)await env.DB.prepare("UPDATE orders SET status = ?, total_cents = ?, paid_at = COALESCE(paid_at, ?) WHERE id = ?").bind(session.livemode?'paid':'test_paid',session.amount_total,new Date().toISOString(),order.id).run();
  return {paid,mode:stripeMode(env),orderId:order.id,totalCents:session.amount_total,currency:order.currency};
 }
 return async function handle(request,action){
  try{
   if(request.method==='GET'&&action==='config')return reply({ready:paymentReady(env,prices),mode:stripeMode(env),provider:'stripe',catalogVersion:prices.version});
   if(request.method==='POST'&&action==='quote'){sameOrigin(request);return reply(makeQuote(await body(request)));}
   if(request.method==='POST'&&action==='checkout'){
    const checkoutOrigin=sameOrigin(request);
    const input=await body(request),q=makeQuote(input);
    if(q.subtotalCents===null)throw fail('Your selected appointments need a final quote before payment.',409);
    if(!paymentReady(env,prices))throw fail('Online payment is awaiting final pricing and merchant setup.',503);
    if(!/^[a-f0-9-]{36}$/i.test(input.requestId||''))throw fail('Invalid checkout request.');
    const canonical=JSON.stringify({model:input.model,selections:q.selections,notes:input.notes||'',version:prices.version,paymentMode:stripeMode(env)}),fingerprint=await hash(canonical);
    const id='FG-'+crypto.randomUUID(),now=new Date().toISOString();
    await env.DB.prepare('INSERT OR IGNORE INTO orders (id,request_id,fingerprint,build_json,quote_json,subtotal_cents,shipping_cents,currency,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,input.requestId,fingerprint,canonical,JSON.stringify(q),q.subtotalCents,prices.shipping.cents,prices.currency,'pending',now).run();
    const order=await env.DB.prepare('SELECT * FROM orders WHERE request_id = ?').bind(input.requestId).first();
    if(order.fingerprint!==fingerprint)throw fail('This checkout request belongs to a different build. Please reload and try again.',409);
    if(['paid','test_paid'].includes(order.status))throw fail('This order has already been paid. Contact Jimmy with your receipt.',409);
    if(order.checkout_url){
     const existing=await stripe(client=>client.checkout.sessions.retrieve(order.session_id));
     if(existing.status!=='open')throw fail('This checkout is no longer open. Check your receipt or reload for a new checkout.',409);
     return reply({url:order.checkout_url,orderId:order.id});
    }
    const params={mode:'payment',ui_mode:'hosted_page',origin_context:'web',client_reference_id:order.id,integration_identifier:INTEGRATION_IDENTIFIER,
     success_url:checkoutOrigin+'/review.html?checkout=success&session_id={CHECKOUT_SESSION_ID}#review',
     cancel_url:checkoutOrigin+'/review.html?checkout=cancelled#review',
     line_items:[{quantity:1,price_data:{currency:prices.currency,unit_amount:q.subtotalCents,tax_behavior:'exclusive',product_data:{
      name:'Fostinis '+prices.models[input.model].name+' custom build',
      description:'Order '+order.id+' · Approved configuration '+prices.version}}}],
     metadata:{order_id:order.id,catalog_version:prices.version,payment_mode:stripeMode(env),...Object.fromEntries(Object.entries(q.selections).map(([key,value])=>['build_'+key,value]))},
     payment_intent_data:{metadata:{order_id:order.id}},
     automatic_tax:{enabled:prices.taxMode==='automatic'},
     billing_address_collection:'required',consent_collection:{terms_of_service:'required'},
     phone_number_collection:{enabled:true},allow_promotion_codes:false,
     custom_text:{submit:{message:'Review your complete Fostinis build total before paying. Terms: '+prices.termsUrl},terms_of_service_acceptance:{message:'I agree to the [Fostinis order terms]('+prices.termsUrl+'), including the no-returns policy.'}},
     shipping_options:[{shipping_rate_data:{type:'fixed_amount',fixed_amount:{amount:prices.shipping.cents,currency:prices.currency},display_name:prices.shipping.cents===0?'US guitar shipping · included':'Guitar shipping',tax_behavior:'exclusive'}}],
     shipping_address_collection:{allowed_countries:prices.shipping.countries},
     branding_settings:{display_name:'Fostinis Guitars',button_color:'#c8aa79',background_color:'#17191b',font_family:'lora',border_style:'rounded'},
     expires_at:Math.floor(Date.parse(order.created_at)/1000)+3600};
    // Omit payment_method_types: Stripe shows eligible methods configured by the merchant.
    const session=await stripe(client=>client.checkout.sessions.create(params,{idempotencyKey:'fostinis-'+order.id}));
    if(session.livemode!==(stripeMode(env)==='live'))throw fail('Payment environment does not match this order.',409);
    if(!session.id||new URL(session.url).origin!=='https://checkout.stripe.com')throw fail('Invalid payment provider response.',502);
    await env.DB.prepare('UPDATE orders SET session_id = ?, checkout_url = ? WHERE id = ?').bind(session.id,session.url,order.id).run();
    return reply({url:session.url,orderId:order.id});
   }
   if(request.method==='GET'&&action==='status')return reply(await verifySession(new URL(request.url).searchParams.get('session_id')));
   if(request.method==='POST'&&action==='webhook'){
    if(Number(request.headers.get('content-length')||0)>200000)throw fail('Payload too large.',413);
    const raw=await request.text();if(raw.length>200000)throw fail('Payload too large.',413);
    if(!await verifyStripeSignature(raw,request.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET))throw fail('Invalid signature.',400);
    let event;try{event=JSON.parse(raw);}catch{throw fail('Invalid event.',400);}
    if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))await verifySession(event.data?.object?.id);
    return reply({received:true});
   }
   return reply({message:'Not found.'},404);
  }catch(error){return reply({message:error.status?error.message:'We could not complete this request. Please contact Jimmy before retrying.'},error.status||500);}
 };
}
