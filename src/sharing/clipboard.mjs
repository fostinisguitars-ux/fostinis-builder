export function selectCopyText(field){
 field.focus({preventScroll:true});field.select();
 // select() alone does not reliably select a readonly textarea on iOS.
 field.setSelectionRange(0,field.value.length);
}

export async function copyText(value,{field,document,navigator}){
 field.value=value;
 // Keep the selection inside the open modal: nodes appended to document.body
 // are inert while a dialog is open. Run this compatibility path synchronously
 // in the click gesture, before awaiting a Clipboard API permission decision.
 try{selectCopyText(field);if(document.execCommand?.('copy')===true)return true;}catch{/* Try the standard Clipboard API next. */}
 try{
  if(typeof navigator.clipboard?.writeText!=='function')return false;
  await navigator.clipboard.writeText(value);return true;
 }catch{return false;}
}
