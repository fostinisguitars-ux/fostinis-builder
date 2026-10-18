export const CUSTOM_LIMITS={text:2000,filesPerOption:3,filesPerBuild:8,fileBytes:10*1024*1024};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
export function cleanCustomRequests(value,allowedKeys){
 if(value===undefined||value===null)return {};
 if(!object(value))throw Error('Custom requests must belong to a guitar option.');
 const result={};let count=0;
 for(const [field,entry] of Object.entries(value)){
  if(!allowedKeys.includes(field)||!object(entry))throw Error('Choose a valid option for your custom request.');
  if(typeof entry.text!=='string'||entry.text.length>CUSTOM_LIMITS.text)throw Error('Keep each custom request to 2,000 characters.');
  const files=entry.files??[];
  if(!Array.isArray(files)||files.length>CUSTOM_LIMITS.filesPerOption)throw Error('Attach up to three files to each option.');
  count+=files.length;if(count>CUSTOM_LIMITS.filesPerBuild)throw Error('Attach up to eight files to a guitar.');
  const cleanFiles=files.map(f=>{
   if(!object(f)||!/^FU-[a-f0-9-]{36}$/i.test(f.id||'')||! /^[a-f0-9]{64}$/.test(f.token||'')||typeof f.name!=='string'||f.name.length>180||!['image/jpeg','image/png','image/webp','application/pdf'].includes(f.type)||!Number.isSafeInteger(f.size)||f.size<1||f.size>CUSTOM_LIMITS.fileBytes)throw Error('An attachment is invalid. Remove it and upload it again.');
   return {id:f.id,token:f.token,name:f.name,type:f.type,size:f.size};
  });
  if(new Set(cleanFiles.map(f=>f.id)).size!==cleanFiles.length)throw Error('An attachment was included twice.');
  const text=entry.text.trim();if(text||cleanFiles.length)result[field]={text,files:cleanFiles};
 }
 return result;
}
export const hasCustomRequests=value=>!!value&&Object.values(value).some(v=>v?.text?.trim()||v?.files?.length);
export function cleanAdjustments(value,allowedKeys){
 if(!Array.isArray(value)||value.length>12)throw Error('Use up to twelve invoice adjustments.');
 return value.map(v=>{
  if(!object(v)||typeof v.description!=='string'||!v.description.trim()||v.description.length>500||!Number.isSafeInteger(v.cents)||Math.abs(v.cents)>10000000||!(v.field===''||allowedKeys.includes(v.field)))throw Error('Each adjustment needs an option, a description, and a valid dollar amount.');
  return {field:v.field,description:v.description.trim(),cents:v.cents};
 });
}
export function invoiceSubtotal(baseCents,adjustments){
 const amount=baseCents+adjustments.reduce((sum,v)=>sum+v.cents,0);
 if(!Number.isSafeInteger(baseCents)||baseCents<0||!Number.isSafeInteger(amount)||amount<50||amount>100000000)throw Error('The final guitar price must be between $0.50 and $1,000,000.');
 return amount;
}
export function dollarsToCents(value){
 if(typeof value!=='string'||! /^-?\d+(?:\.\d{1,2})?$/.test(value.trim()))throw Error('Enter dollars with no more than two decimal places.');
 const negative=value.trim().startsWith('-'),[whole,fraction='']=value.trim().replace(/^-/,'').split('.');
 const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));if(!Number.isSafeInteger(cents))throw Error('Enter a valid amount.');return negative?-cents:cents;
}
