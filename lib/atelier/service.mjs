import catalog from '../commerce/catalog.json' with {type:'json'};
import {createPricingEngine} from '../commerce/pricing-engine.mjs';
import {PUBLIC_ORIGINS} from '../commerce/origins.mjs';
import {cleanCustomRequests} from '../custom-requests.mjs';
import {handleUpload,validateCustomUploads} from './uploads.mjs';

const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),n=>n.toString(16).padStart(2,'0')).join('');
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
const short=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
export function imageValue(v){if(!v)return '';if(typeof v!=='string'||v.length>180000||!/^data:image\/(?:jpeg|webp|png);base64,[A-Za-z0-9+/]+=*$/.test(v))throw fail('Choose a smaller JPG, PNG, or WebP photo.');return v;}
export function videoId(v){if(!v)return '';let url;try{url=new URL(v);}catch{throw fail('Enter a YouTube video link.');}const host=url.hostname.replace(/^www\./,'');if(!['youtube.com','m.youtube.com','youtu.be'].includes(host)||url.protocol!=='https:')throw fail('Use a YouTube video link.');const id=host==='youtu.be'?url.pathname.slice(1):url.searchParams.get('v')||url.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})/)?.[1];if(!/^[\w-]{11}$/.test(id||''))throw fail('Enter a link to an individual YouTube video.');return id;}
export const JOURNAL_STAGES=['design','confirmed','materials','construction','finishing','electronics','setup','complete','delivered'];
/**
 * @param {object} env Runtime bindings supplied by Sites.
 * @param {{identity?: {userId: string, email: string} | null, now?: () => string}} options
 */
export function createAtelierService(env,{identity=null,now=()=>new Date().toISOString()}={}){
 const db=env.DB,pricing=createPricingEngine(catalog);
 const owner=!!(identity?.userId&&env.FOSTINIS_OWNER_EMAIL&&identity.email?.toLowerCase()===env.FOSTINIS_OWNER_EMAIL.toLowerCase());
 const parse=s=>{try{return JSON.parse(s);}catch{return null;}};
 const run=(sql,...args)=>db.prepare(sql).bind(...args).run();
 const one=(sql,...args)=>db.prepare(sql).bind(...args).first();
 const all=async(sql,...args)=>(await db.prepare(sql).bind(...args).all()).results||[];
 function cleanBuild(value){if(!value)return null;let selections,customRequests;try{selections=pricing.validate(value.model,value.selections);customRequests=cleanCustomRequests(value.customRequests,Object.keys(catalog.fields));}catch(e){throw fail(e.message);}return {model:value.model,selections,nickname:short(value.nickname,40),notes:short(value.notes,3000),customRequests};}
 function cleanSaved(value){const build=cleanBuild(value);if(!build)throw fail('A guitar configuration is required.');return {...build,id:/^[\w-]{1,60}$/.test(value.id||'')?value.id:crypto.randomUUID(),name:short(value.name,40)||build.nickname||'My '+catalog.models[build.model].name,image:imageValue(value.image),createdAt:short(value.createdAt,40)||now(),updatedAt:now()};}
 async function read(request){const size=Number(request.headers.get('content-length')||0);if(size>2400000)throw fail('This request is too large.',413);const raw=await request.text();if(raw.length>2400000)throw fail('This request is too large.',413);const data=parse(raw);if(!data||typeof data!=='object'||Array.isArray(data))throw fail('Invalid request.');return data;}
 function sameOrigin(request){const o=request.headers.get('origin');if(!PUBLIC_ORIGINS.includes(o)&&o!==new URL(request.url).origin)throw fail('Open this form from Fostinis Guitars.',403);}
 function admin(){if(!owner)throw fail('Sign in with the Fostinis owner account to open the workshop desk.',403);}
 async function bearer(request){const raw=request.headers.get('authorization')?.replace(/^Bearer /,'');if(!/^[a-f0-9]{64}$/.test(raw||''))throw fail('Open your private access link to continue.',401);return digest(raw);}
 async function limit(request,kind,max=18){const bucket=now().slice(0,13),ip=request.headers.get('cf-connecting-ip')||'anonymous',key=await digest(kind+':'+ip+':'+bucket);await run('INSERT INTO atelier_limits (id,count,created_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1',key,now());const row=await one('SELECT count FROM atelier_limits WHERE id=?',key);if(row.count>max)throw fail('Please wait before trying again.',429);}
 async function metric(name){await run('INSERT INTO atelier_metrics (id,event,count,day) VALUES (?,?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1',now().slice(0,10)+':'+name,name,now().slice(0,10));}
 const requestView=r=>({id:r.id,kind:r.kind,name:r.name,email:r.email,details:parse(r.details_json),build:parse(r.build_json),message:r.message,status:r.status,orderId:r.order_id,serial:r.serial||'',createdAt:r.created_at,updatedAt:r.updated_at});
 return async(request,action)=>{
  try{
   if(!db)throw fail('The atelier is temporarily unavailable.',503);
   const url=new URL(request.url),method=request.method;
   if(action==='upload')return handleUpload(request,env,{owner});
   if(method==='GET'&&action==='session')return reply({owner,signedIn:!!identity,signIn:'/signin-with-chatgpt?return_to=%2Fatelier.html%3Fview%3Dworkshop'});
   if(method==='GET'&&action==='circle')return reply({stories:(await all('SELECT * FROM atelier_stories ORDER BY created_at DESC LIMIT 24')).map(r=>({...r,build:parse(r.build_json),build_json:undefined})),events:await all('SELECT * FROM atelier_events WHERE starts_at>=? ORDER BY starts_at LIMIT 12',now()),settings:await all('SELECT key,value FROM atelier_settings')});
   if(method==='GET'&&action==='collection'){const row=await one('SELECT * FROM atelier_collections WHERE token_hash=?',await bearer(request));if(!row)throw fail('Collection not found. Check your private link.',404);return reply({id:row.id,name:row.name,builds:parse(row.builds_json)||[],revision:row.revision});}
   if(method==='GET'&&action==='journal'){const row=await one('SELECT * FROM atelier_requests WHERE token_hash=?',await bearer(request));if(!row)throw fail('Journal not found. Check your private link.',404);return reply({request:requestView(row),invoice:await one("SELECT status,access_token AS accessToken FROM atelier_invoices WHERE request_id=? AND status NOT IN ('draft','void') ORDER BY created_at DESC LIMIT 1",row.id),entries:await all('SELECT id,title,stage,note,image,video_id,created_at FROM atelier_journal WHERE request_id=? ORDER BY created_at',row.id)});}
   if(method==='GET'&&action==='poll'){const id=url.searchParams.get('id'),row=await one('SELECT * FROM atelier_polls WHERE id=?',id);if(!row)throw fail('This comparison could not be found.',404);const votes=await all('SELECT option_id,COUNT(*) AS count FROM atelier_votes WHERE poll_id=? GROUP BY option_id',id);return reply({id:row.id,title:row.title,options:parse(row.options_json),votes});}
   if(method==='GET'&&action==='admin-journal'){admin();const row=await one('SELECT * FROM atelier_requests WHERE id=?',url.searchParams.get('id'));if(!row)throw fail('Request not found.',404);return reply({request:requestView(row),invoice:await one("SELECT status,access_token AS accessToken FROM atelier_invoices WHERE request_id=? AND status NOT IN ('draft','void') ORDER BY created_at DESC LIMIT 1",row.id),entries:await all('SELECT id,title,stage,note,image,video_id,created_at FROM atelier_journal WHERE request_id=? ORDER BY created_at',row.id)});}
   if(method==='GET'&&action==='admin'){admin();return reply({requests:(await all('SELECT * FROM atelier_requests ORDER BY created_at DESC LIMIT 200')).map(requestView),metrics:await all('SELECT event,SUM(count) AS count FROM atelier_metrics WHERE day>=? GROUP BY event',new Date(Date.now()-30*86400000).toISOString().slice(0,10)),orders:await all("SELECT id,status,created_at,build_json FROM orders WHERE status='paid' ORDER BY created_at DESC LIMIT 100"),settings:await all('SELECT key,value FROM atelier_settings')});}
   if(method!=='POST')return reply({message:'Not found.'},404);sameOrigin(request);const data=await read(request);
   if(action==='collection'){
    if(!Array.isArray(data.builds)||data.builds.length>20)throw fail('Keep up to 20 guitars in a collection.');
    const builds=data.builds.map(cleanSaved);if(JSON.stringify(builds).length>1800000)throw fail('This collection is too large. Export a backup, then remove an older design before saving.');if(new Set(builds.map(b=>b.id)).size!==builds.length)throw fail('Each saved guitar must have a unique design ID.');const name=short(data.name,60)||'My Fostinis Collection';
    if(request.headers.has('authorization')){const hash=await bearer(request),current=await one('SELECT id,revision FROM atelier_collections WHERE token_hash=?',hash);if(!current)throw fail('Collection not found.',404);const result=await run('UPDATE atelier_collections SET name=?,builds_json=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?',name,JSON.stringify(builds),now(),current.id,data.revision);if(!result.meta?.changes)throw fail('This collection changed on another device. Reload it before saving.',409);return reply({id:current.id,name,builds,revision:current.revision+1});}
    await limit(request,'collection',8);const secret=token(),id=crypto.randomUUID();await run('INSERT INTO atelier_collections (id,token_hash,name,builds_json,revision,created_at,updated_at) VALUES (?,?,?,?,1,?,?)',id,await digest(secret),name,JSON.stringify(builds),now(),now());await metric('collection_created');return reply({id,token:secret,name,builds,revision:1},201);
   }
   if(action==='request'){
    if(data.website)throw fail('Please retry the form.');await limit(request,'request',8);
    if(!['review','circle','story'].includes(data.kind))throw fail('Choose a valid request type.');const name=short(data.name,100),email=short(data.email,240).toLowerCase();if(name.length<2||!/^\S+@\S+\.\S+$/.test(email))throw fail('Enter your name and email address.');
    const build=cleanBuild(data.build);if(data.kind==='review'&&!build)throw fail('Choose your guitar before requesting a review.');if(data.kind==='story'&&data.consent!==true)throw fail('Confirm that Fostinis may review your submission for publication.');
    if(build)build.customRequests=await validateCustomUploads(env,build.customRequests);
    const id='FA-'+crypto.randomUUID(),secret=token(),message=short(data.message,3000);const details=JSON.stringify({videoId:videoId(data.videoUrl),image:imageValue(data.image),title:short(data.title,100),consent:data.consent===true,interest:short(data.interest,100),...(data.kind==='review'?{configuredQuote:pricing.quote(build.model,build.selections),shippingCents:catalog.shipping.cents}:{})});
    await run('INSERT INTO atelier_requests (id,token_hash,kind,name,email,build_json,message,details_json,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',id,await digest(secret),data.kind,name,email,JSON.stringify(build),message,details,'received',now(),now());
    if(data.kind==='review')await run('INSERT INTO atelier_journal (id,request_id,title,stage,note,image,video_id,created_at) VALUES (?,?,?,?,?,?,?,?)',crypto.randomUUID(),id,'Your design review request','design','Your configuration has been saved for review. This request is not an order or a reserved production slot.','','',now());
    await metric(data.kind+'_requested');return reply({id,token:secret,status:'received'},201);
   }
   if(action==='poll'){
    await limit(request,'poll',12);if(!Array.isArray(data.options)||data.options.length!==2)throw fail('Choose two saved guitars to compare.');const options=data.options.map(x=>({...cleanSaved(x),notes:'',customRequests:{}})),id=crypto.randomUUID();if(options[0].id===options[1].id)throw fail('Choose two different guitars.');await run('INSERT INTO atelier_polls (id,title,options_json,created_at) VALUES (?,?,?,?)',id,short(data.title,100)||'Help me choose my Fostinis',JSON.stringify(options),now());return reply({id},201);
   }
   if(action==='vote'){
    await limit(request,'vote',60);if(!/^[a-f0-9-]{36}$/.test(data.voter||''))throw fail('Reload the comparison and try again.');const poll=await one('SELECT options_json FROM atelier_polls WHERE id=?',short(data.id,80));if(!poll)throw fail('Comparison not found.',404);if(!parse(poll.options_json).some(x=>x.id===data.optionId))throw fail('Choose one of the displayed guitars.');const voter=await digest(data.voter);await run('INSERT INTO atelier_votes (id,poll_id,voter_hash,option_id,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET option_id=excluded.option_id',data.id+':'+voter,data.id,voter,data.optionId,now());return reply({saved:true});
   }
   if(action==='metric'){if(!['atelier_visit','design_reveal','build_saved','commission_opened'].includes(data.event))throw fail('Invalid event.');await limit(request,'metric',120);await metric(data.event);return reply({saved:true});}
   if(action==='admin'){
    admin();const operation=data.operation;
    if(operation==='settings'){for(const key of ['leadTime','welcome'])if(typeof data[key]==='string')await run('INSERT INTO atelier_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,short(data[key],600));return reply({saved:true});}
    if(operation==='event'){const start=Date.parse(data.startsAt);if(!Number.isFinite(start)||!short(data.title,120))throw fail('Add an event title and date.');let link='';if(data.url){const u=new URL(data.url);if(u.protocol!=='https:')throw fail('Use a secure event link.');link=u.href;}await run('INSERT INTO atelier_events (id,title,starts_at,description,url) VALUES (?,?,?,?,?)',crypto.randomUUID(),short(data.title,120),new Date(start).toISOString(),short(data.description,1000),link);return reply({saved:true});}
    if(operation==='delete-event'){await run('DELETE FROM atelier_events WHERE id=?',short(data.id,80));return reply({saved:true});}
    const row=await one('SELECT * FROM atelier_requests WHERE id=?',short(data.id,80));if(!row)throw fail('Request not found.',404);
    if(operation==='status'){if(!['received','contacted','closed'].includes(data.status))throw fail('Invalid status.');await run('UPDATE atelier_requests SET status=?,updated_at=? WHERE id=?',data.status,now(),row.id);return reply({saved:true});}
    if(operation==='journal'){
     if(row.kind!=='review'||!JOURNAL_STAGES.includes(data.stage))throw fail('Choose a valid build stage.');if(!short(data.title,120))throw fail('Add an update title.');
     let orderId=row.order_id;if(data.orderId){const order=await one("SELECT id FROM orders WHERE id=? AND status='paid'",short(data.orderId,80));if(!order)throw fail('Choose a verified paid order.');orderId=order.id;}
     const serial=data.serial===undefined?row.serial:short(data.serial,80),image=imageValue(data.image),video=videoId(data.videoUrl);
     await db.batch([
      db.prepare('INSERT INTO atelier_journal (id,request_id,title,stage,note,image,video_id,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),row.id,short(data.title,120),data.stage,short(data.note,3000),image,video,now()),
      db.prepare('UPDATE atelier_requests SET status=?,updated_at=?,serial=?,order_id=? WHERE id=?').bind(data.stage,now(),serial,orderId,row.id)
     ]);return reply({saved:true});
    }
    if(operation==='publish-story'){
     const details=parse(row.details_json)||{};if(row.kind!=='story'||!details.consent)throw fail('Only a submitted story with publication consent can be published.');
     const title=short(data.title,120)||details.title||'A personal Fostinis design',story=short(data.story,3000)||row.message;let orderId=row.order_id;if(data.orderId){const order=await one("SELECT id FROM orders WHERE id=? AND status='paid'",short(data.orderId,80));if(!order)throw fail('Choose a verified paid order.');orderId=order.id;await run('UPDATE atelier_requests SET order_id=? WHERE id=?',orderId,row.id);}const kind=orderId?'owner':'community';
     await run('INSERT INTO atelier_stories (id,request_id,title,author,story,build_json,image,video_id,kind,created_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(request_id) DO UPDATE SET title=excluded.title,story=excluded.story,kind=excluded.kind',crypto.randomUUID(),row.id,title,row.name,story,JSON.stringify(parse(row.build_json)?{...parse(row.build_json),notes:'',customRequests:{}}:null),details.image||'',details.videoId||'',kind,now());await run('UPDATE atelier_requests SET status=?,updated_at=? WHERE id=?','published',now(),row.id);return reply({saved:true});
    }
    if(operation==='unpublish-story'){await run('DELETE FROM atelier_stories WHERE request_id=?',row.id);return reply({saved:true});}
    throw fail('Unknown workshop action.');
   }
   return reply({message:'Not found.'},404);
  }catch(error){return reply({message:error.status?error.message:'We could not save this right now. Please try again.'},error.status||500);}
 };
}
