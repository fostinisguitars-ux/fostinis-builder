import fs from 'node:fs';

// Keep the existing classic-script execution order, while serving the identical
// pricing/checkout code once instead of duplicating it in 233 HTML documents.
const pattern=/<script>(\/\/ One calculation is shared by the browser and the checkout server\.[\s\S]*?\(function\(\)\{\n'use strict';\nlet current=null,config=null,busy=false,[\s\S]*?\n\}\)\(\);)/;
const files=fs.readdirSync('public').filter(name=>name.endsWith('.html')).map(name=>({path:'public/'+name,html:fs.readFileSync('public/'+name,'utf8')}));
const sources=new Set(files.map(file=>file.html.match(pattern)?.[1]).filter(Boolean));
if(sources.size>1)throw Error('Checkout code differs between routes. Synchronize it before extraction.');
if(sources.size){
 fs.writeFileSync('public/build-commerce.js',[...sources][0]+'\n');
 for(const file of files)if(pattern.test(file.html))fs.writeFileSync(file.path,file.html.replace(pattern,'<script src="/build-commerce.js?v=54"></script>\n<script>'));
 console.log('Extracted identical pricing and checkout code into one cacheable asset.');
}
