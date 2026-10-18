import fs from 'node:fs';
const version=64;
// The atelier uses the same model definitions and state manager as the builder.
// Keep its source of truth in the canonical showroom; append the new UI once.
let base=fs.readFileSync('public/showroom.html','utf8');
base=base.replace(/<title>[^<]*<\/title>/,'<title>Fostinis Atelier — A guitar made personal</title>')
 .replace('<body ', '<body class="atelier-page" data-atelier="true" ')
 .replace('</head>', '<meta name="referrer" content="no-referrer">\n</head>');
fs.writeFileSync('public/atelier.html',base);
for(const file of fs.readdirSync('public').filter(f=>f.endsWith('.html'))){
 const path='public/'+file;let html=fs.readFileSync(path,'utf8');if(!html.includes('window.FostinisStudio='))continue;
 if(!html.includes('/atelier.css'))html=html.replace('</head>',`<link rel="stylesheet" href="/atelier.css?v=${version}">\n</head>`);
 if(!html.includes('/atelier.js'))html=html.replace('</body>',`<script type="module" src="/atelier.js?v=${version}"></script>\n</body>`);
 html=html.replace('builds,notes,nicknames,labels:Object.fromEntries', 'builds,notes,nicknames,customRequests:window.FostinisCustomRequests?.getAll?.()||{},labels:Object.fromEntries');
 html=html.replace(/(\/build-sharing\.js\?v=)\d+/g,(_,prefix)=>prefix+version);
 html=html.replace(/(\/atelier\.(?:js|css)\?v=)\d+/g,(_,prefix)=>prefix+version);
 fs.writeFileSync(path,html);
}
fs.copyFileSync('src/atelier/atelier.css','public/atelier.css');

// The public root uses the same atelier entry even when static assets serve it first.
fs.writeFileSync('public/index.html',fs.readFileSync('public/atelier.html','utf8'));
