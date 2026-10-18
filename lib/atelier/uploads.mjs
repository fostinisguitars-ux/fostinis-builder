import catalog from '../commerce/catalog.json' with {type:'json'};
import {CUSTOM_LIMITS,cleanCustomRequests} from '../custom-requests.mjs';
import {PUBLIC_ORIGINS} from '../commerce/origins.mjs';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),n=>n.toString(16).padStart(2,'0')).join('');
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json=(data,status=200)=>Response.json(data,{status,headers});
export async function validateCustomUploads(env,value){
 const requests=cleanCustomRequests(value,Object.keys(catalog.fields));
 for(const [field,entry] of Object.entries(requests))for(const file of entry.files){
  const row=await env.DB.prepare('SELECT * FROM atelier_uploads WHERE id=? AND token_hash=?').bind(file.id,await digest(file.token)).first();
  if(!row||row.field!==field)throw fail('An attachment is no longer available. Please upload it again.');
  Object.assign(file,{name:row.name,type:row.type,size:row.size});
 }
 return requests;
}
export async function handleUpload(request,env,{owner=false}={}){
 try{
  if(!env.DB||!env.BUCKET)throw fail('Design uploads are temporarily unavailable. Please try again shortly.',503);
  const url=new URL(request.url);
  if(request.method==='GET'){
   const row=await env.DB.prepare('SELECT * FROM atelier_uploads WHERE id=?').bind(url.searchParams.get('id')||'').first();
   const access=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
   if(!row||(!owner&&(!/^[a-f0-9]{64}$/.test(access)||await digest(access)!==row.token_hash)))throw fail('Open this file from your private design or the workshop desk.',404);
   const file=await env.BUCKET.get(row.object_key);if(!file)throw fail('This design file is unavailable.',404);
   return new Response(file.body,{headers:{...headers,'Content-Type':row.type,'Content-Length':String(row.size),'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(row.name),'Content-Security-Policy':"sandbox; default-src 'none'"}});
  }
  if(request.method!=='POST')throw fail('Not found.',404);
  if(!PUBLIC_ORIGINS.includes(request.headers.get('origin')))throw fail('Upload your design from Fostinis Guitars.',403);
  const field=url.searchParams.get('field');if(!Object.hasOwn(catalog.fields,field||''))throw fail('Choose the option this design belongs to.');
  const hour=new Date().toISOString().slice(0,13),limitKey='upload:'+await digest((request.headers.get('cf-connecting-ip')||'anonymous')+':'+hour);
  await env.DB.prepare('INSERT INTO atelier_limits (id,count,created_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1').bind(limitKey,new Date().toISOString()).run();
  const limit=await env.DB.prepare('SELECT count FROM atelier_limits WHERE id=?').bind(limitKey).first();if(limit.count>24)throw fail('Please wait before uploading more design files.',429);
  if(Number(request.headers.get('content-length')||0)>CUSTOM_LIMITS.fileBytes)throw fail('Choose a file no larger than 10 MB.',413);
  const reader=request.body?.getReader();if(!reader)throw fail('Choose a design file.');let size=0;const chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>CUSTOM_LIMITS.fileBytes){await reader.cancel();throw fail('Choose a file no larger than 10 MB.',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const ascii=(a,b)=>String.fromCharCode(...bytes.slice(a,b));
  const type=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes[0]===137&&ascii(1,4)==='PNG'&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10?'image/png':ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'?'image/webp':ascii(0,5)==='%PDF-'?'application/pdf':null;
  if(!type)throw fail('Upload an original JPG, PNG, WebP, or PDF file.');
  let name;try{name=decodeURIComponent(request.headers.get('x-upload-name')||'Design');}catch{throw fail('Choose a file with a valid name.');}
  name=name.replace(/[\u0000-\u001f\u007f/\\]/g,'_').trim().slice(0,170)||'Design';
  const extension={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','application/pdf':'.pdf'}[type];
  if(!name.toLowerCase().endsWith(extension)&&!(type==='image/jpeg'&&name.toLowerCase().endsWith('.jpeg')))name+=extension;
  const id='FU-'+crypto.randomUUID(),secret=token(),objectKey='custom-designs/'+id;
  await env.BUCKET.put(objectKey,bytes,{httpMetadata:{contentType:type}});
  try{await env.DB.prepare('INSERT INTO atelier_uploads (id,token_hash,object_key,field,name,type,size,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,await digest(secret),objectKey,field,name,type,size,new Date().toISOString()).run();}catch(error){await env.BUCKET.delete(objectKey);throw error;}
  return json({id,token:secret,name,type,size},201);
 }catch(error){return json({message:error.status?error.message:'This file could not be uploaded. Please try again.'},error.status||500);}
}
