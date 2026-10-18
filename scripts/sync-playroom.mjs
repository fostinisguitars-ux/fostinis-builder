import fs from 'node:fs';
fs.copyFileSync('src/playroom/playroom.css','public/playroom.css');
let count=0;
for(const file of fs.readdirSync('public').filter(f=>f.endsWith('.html'))){
 const path='public/'+file;let html=fs.readFileSync(path,'utf8');
 if(!html.includes('window.FostinisStudio='))continue;
 if(!html.includes('/playroom.css'))html=html.replace('</head>','<link rel="stylesheet" href="/playroom.css?v=62">\n</head>');
 if(!html.includes('/playroom.js'))html=html.replace('</body>','<script type="module" src="/playroom.js?v=62"></script>\n</body>');
 html=html.replace(/(\/playroom\.(?:js|css)\?v=)\d+/g,(_,base)=>base+'62');
 html=html.replace(/\/showroom-loader\.js\?v=\d+/g,'/showroom-loader.js?v=62');
 fs.writeFileSync(path,html);count++;
}
console.log('Connected the Fostinis playroom on '+count+' routes');
