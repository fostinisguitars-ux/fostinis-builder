import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Tabletop objects are measured in metres. No external tool branding.
export function makeBenchTools(scene,{texture,material,geometry}){
 const steel=material(new T.MeshStandardMaterial({color:'#c3c5c1',metalness:.88,roughness:.25}));
 const dark=material(new T.MeshStandardMaterial({color:'#242b28',metalness:.5,roughness:.4}));
 const brass=material(new T.MeshStandardMaterial({color:'#b69b61',metalness:.8,roughness:.32}));
 const timber=material(new T.MeshStandardMaterial({color:'#9a6840',map:texture('/assets/wood-real19-walnut.jpg'),roughness:.45}));
 const rubber=material(new T.MeshStandardMaterial({color:'#121816',roughness:.9}));
 const pearl=material(new T.MeshPhysicalMaterial({map:texture('/assets/wood-pearl-nacre-v9.jpg'),color:'#ebe7dd',roughness:.24,iridescence:.7,clearcoat:.8,metalness:.08}));
 const groups={};
 function station(id,x,y,z=0){const g=new T.Group();g.position.set(x,y,z);g.name=id;scene.add(g);groups[id]=g;return g;}
 function mesh(g,geo,mat,x=0,y=0,z=0){const m=new T.Mesh(geometry(geo),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
 const box=(g,w,h,d,mat,x=0,y=0,z=0,r=.002)=>mesh(g,new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)),mat,x,y,z);
 function cylinder(g,r,h,mat,x=0,y=0,z=0,r2=r){const m=mesh(g,new T.CylinderGeometry(r,r2,h,28),mat,x,y,z);m.rotation.x=Math.PI/2;return m;}
 const router=station('router',-.37,-.33,.005);
 box(router,.17,.14,.012,steel,0,0,0,.012);cylinder(router,.036,.014,rubber,0,0,.008);
 for(const x of [-.052,.052]){cylinder(router,.006,.14,steel,x,0,.075);cylinder(router,.012,.025,dark,x,0,.02);}
 cylinder(router,.043,.105,dark,0,0,.095);cylinder(router,.045,.017,steel,0,0,.151);
 for(let i=0;i<14;i++){const a=i/14*Math.PI*2;box(router,.004,.009,.055,rubber,Math.sin(a)*.043,Math.cos(a)*.043,.103,.001);}
 for(const x of [-.083,.083]){box(router,.026,.065,.025,timber,x,0,.065,.012);box(router,.038,.01,.012,steel,x*.75,0,.065);}
 cylinder(router,.008,.045,steel,0,0,.03);box(router,.016,.014,.004,brass,0,-.044,.11,.001);
 const chisels=station('chisel',.36,.25,.005);
 for(let i=0;i<3;i++){const tool=new T.Group();tool.position.set((i-1)*.041,0,0);tool.rotation.z=(i-1)*.09;chisels.add(tool);
  box(tool,.023,.10,.021,timber,0,.04,.012,.01);box(tool,.023,.015,.022,brass,0,-.015,.012,.003);box(tool,.014+i*.003,.085,.005,steel,0,-.065,.011,.0005);box(tool,.014+i*.003,.012,.001,steel,0,-.113,.009,.0003);
 }
 const plane=station('plane',.36,-.14,.005);
 box(plane,.078,.21,.018,steel,0,0,.009,.01);box(plane,.071,.18,.025,dark,0,0,.028,.008);
 const blade=box(plane,.058,.065,.009,steel,0,-.004,.055);blade.rotation.x=-.55;
 box(plane,.047,.06,.012,brass,0,-.007,.063,.006);cylinder(plane,.018,.03,timber,0,-.069,.054);
 const tote=box(plane,.018,.045,.07,timber,0,.067,.062,.008);tote.rotation.x=-.2;
 const abrasive=material(new T.MeshStandardMaterial({color:'#a27d4c',roughness:1}));box(plane,.07,.09,.014,abrasive,.10,0,.007,.003);
 const shavingMat=material(new T.MeshStandardMaterial({color:'#d4a96b',side:T.DoubleSide,roughness:.9}));
 for(let i=0;i<5;i++){const curl=mesh(plane,new T.TorusGeometry(.015+i*.002,.0012,5,24,Math.PI*1.65),shavingMat,.09+(i%2)*.026,-.09+i*.024,.017);curl.rotation.set(i*.55,.2,i*.8);}
 const inlays=station('inlays',-.35,.25,.004);
 box(inlays,.18,.16,.012,timber,0,0,0,.008);box(inlays,.163,.143,.003,rubber,0,0,.008,.004);
 for(let i=0;i<3;i++){cylinder(inlays,.008,.002,pearl,-.05+i*.028,.035,.012);}
 for(const s of [-1,1]){const wing=box(inlays,.065,.018,.002,pearl,s*.028,-.024,.012,.007);wing.rotation.z=s*.23;}
 box(inlays,.055,.035,.002,pearl,.041,.025,.012,.004);
 const setup=station('setup',.35,.55,.004);
 box(setup,.035,.27,.004,steel,0,0,.002,.001);
 for(let i=0;i<25;i++)box(setup,i%5===0?.018:.009,.0008,.0005,dark,-.006,.12-i*.01,.0046,.0001);
 box(setup,.11,.013,.007,steel,-.085,.02,.008,.001);box(setup,.018,.065,.008,steel,-.13,0,.009,.001);box(setup,.018,.065,.008,steel,-.065,0,.012,.001);
 box(setup,.035,.025,.015,dark,-.065,.021,.018,.004);box(setup,.025,.013,.001,brass,-.065,.021,.026,.001);
 const wood=station('wood',-.37,.57,-.005);
 const woodMats=['flame','walnut','mahogany'].map((id,i)=>material(new T.MeshStandardMaterial({color:i===0?'#ddbd8d':'#b99269',map:texture('/assets/wood-real19-'+id+'.jpg'),roughness:.8})));
 woodMats.forEach((mat,i)=>{const blank=box(wood,.18,.21,.014,mat,(i-1)*.009,(i-1)*.007,.008+i*.016);blank.rotation.z=(i-1)*.06;});
 return groups;
}
