import * as T from 'three';
const textures=new Map(),pendingTextures=new Set(),failedTextures=new Set();
function texture(url){if(!textures.has(url)){let settle;const ready=new Promise(resolve=>{settle=resolve;});pendingTextures.add(ready);const done=()=>{pendingTextures.delete(ready);settle();};const t=new T.TextureLoader().load(url,done,undefined,()=>{failedTextures.add(url);done();});t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;textures.set(url,t);}return textures.get(url);}
export async function whenWoodTexturesReady(){while(pendingTextures.size)await Promise.all([...pendingTextures]);if(failedTextures.size)throw Error('A showroom wood texture could not load.');}
// The photograph's grain runs horizontally; orient it along the fretboard.
// Use the shared loader so completed images wait for this texture as well.
export function mapleFretboardTexture(){const t=texture('/assets/wood-real19-maple.jpg');t.center.set(.5,.5);t.rotation=Math.PI/2;return t;}
export function woodMaterial(F,state,region,model){const back=region==='back'||region==='side',neck=region==='neck',head=region==='headstock_front',binding=region==='binding';const prefix=back?'back':neck?'neck':'';const val=(key)=>state[prefix?prefix+key[0].toUpperCase()+key.slice(1):key];let wood=val('wood'),colorId=val('finish'),solid=val('finishType')==='solid',burst=val('burst');if(head&&state.headstockBurst==='black'){solid=true;colorId='black';burst='none';}if(binding){wood=state.wood==='quilt'?'quilt':'flame';colorId='natural';solid=false;burst='none';}
 const finish=F.FINISHES.find(f=>f.id===colorId)||F.FINISHES[0],natural=['natural','walnut','mahogany','blonde'].includes(colorId);const b=F.resolveBurst(state,region),faded=b.id==='faded';const color=binding?'#e7c996':faded?b.center:solid?F.SOLID_COLORS[colorId].color:natural?F.WOODS[wood].natural:finish.color;const sheen=val('sheen'),grain=texture('/assets/wood-'+(F.WOODS[wood].grain||'real19-'+wood)+'.jpg');const m=new T.MeshPhysicalMaterial({color,roughness:sheen==='gloss'?.24:sheen==='satin'?.48:.7,metalness:0,clearcoat:sheen==='gloss'?1:sheen==='satin'?.3:.05,clearcoatRoughness:sheen==='gloss'?.085:.3,map:solid?null:grain,envMapIntensity:1.1});m.name=region;const width=(faded?{subtle:.58,standard:.86,wide:1}:{subtle:.38,standard:.63,wide:1})[state.burstWidth]||.63;
 m.onBeforeCompile=shader=>{shader.uniforms.burstEdge={value:new T.Color(b.edge)};shader.uniforms.burstMid={value:new T.Color(b.mid)};shader.uniforms.burstActive={value:b.id!=='none'?1:0};shader.uniforms.fadedBurst={value:faded?1:0};shader.uniforms.burstWidth={value:width};shader.uniforms.carveDepth={value:model==='matadaur'?15.414:12.75};shader.uniforms.regionMode={value:head?3:neck?2:back?1:0};shader.uniforms.woodSolid={value:solid?1:0};shader.uniforms.naturalWood={value:natural?1:0};shader.vertexShader='varying vec3 cadPosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncadPosition = position * 1000.0;');shader.fragmentShader='varying vec3 cadPosition; uniform vec3 burstEdge; uniform vec3 burstMid; uniform float burstActive; uniform float fadedBurst; uniform float burstWidth; uniform float carveDepth; uniform float regionMode; uniform float woodSolid; uniform float naturalWood;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`float woodFigure = 1.0;
 #ifdef USE_MAP
 vec4 woodSample = texture2D(map,vMapUv);
 float luma = dot(woodSample.rgb,vec3(.24,.62,.14));
 // A neutral albedo retains real wood figure without baking lighting into the finish.
 woodFigure = clamp(pow(luma,1.1)*1.65,.18,1.5);
 diffuseColor.rgb *= woodFigure;
 #endif
 float edge;
 if(regionMode<.5){edge=clamp((-cadPosition.z-1.0)/carveDepth,0.0,1.0);}
 else if(regionMode>2.5){float along=(cadPosition.y-623.51)/182.18; edge=max(abs(cadPosition.x)/43.0,abs(along-.5)*2.0);}
 else if(regionMode>1.5){edge=abs(cadPosition.x)/(cadPosition.y>625.0?42.0:27.0);}
 else{edge=clamp(length(vec2(cadPosition.x/160.0,(cadPosition.y+60.0)/200.0)),0.0,1.0);}
 float fade=smoothstep(1.0-burstWidth,1.0,edge)*burstActive;
 vec3 tint=mix(burstMid,burstEdge,smoothstep(.42,1.0,fade));
 if(fadedBurst>.5){diffuseColor.rgb=mix(diffuseColor.rgb,tint*woodFigure,fade);}
 else{diffuseColor.rgb=mix(diffuseColor.rgb,tint*max(.32,dot(diffuseColor.rgb,vec3(.3,.5,.2))*1.8),fade*.94);}`);
 };
 m.customProgramCacheKey=()=>`cad-wood-v2-${solid}`;return m;}
export function configureUV(mesh,region){const p=mesh.geometry.attributes.position,uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(region==='side'||region==='binding'){uv[i*2]=(x+y)*2.5;uv[i*2+1]=z*4;}else if(region==='neck'||region==='headstock_front'){uv[i*2]=y*1.9;uv[i*2+1]=x*9+.5;}else{uv[i*2]=(y+.26)*2.2;uv[i*2+1]=x*2.8+.5;}}mesh.geometry.setAttribute('uv',new T.BufferAttribute(uv,2));}
export async function signatureTexture(){const im=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src='/assets/fostinis-headstock-signature.jpg';});const c=document.createElement('canvas');c.width=1092;c.height=867;const ctx=c.getContext('2d');ctx.drawImage(im,120,79,1092,867,0,0,1092,867);const data=ctx.getImageData(0,0,c.width,c.height);for(let i=0;i<data.data.length;i+=4){const a=data.data[i];data.data[i]=241;data.data[i+1]=230;data.data[i+2]=204;data.data[i+3]=a;}ctx.putImageData(data,0,0);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;}
