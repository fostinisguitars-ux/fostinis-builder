// Keep the shared link, customer preview and order record in agreement.
export function cleanNickname(value){return typeof value==='string'?[...value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim()].slice(0,40).join(''):'';}
