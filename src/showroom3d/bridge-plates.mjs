import * as T from 'three';

// Real plates stop before the projecting string-lock screws. The narrowed
// rear is a raised fine-tuner rack, not a broad rectangular metal cover.
export function floydPlate(pro=false){
 const width=pro?90.81:91.7,left=-width/2+2.4,right=width/2+2.4,rear=pro?33.335:33.65,front=10.5,shoulder=front-(pro?37.45:37.2),end=pro?-47:-55;
 const s=new T.Shape();s.moveTo(left+2,front);s.lineTo(-42.4,front);s.lineTo(-41.4,front-3.8);s.quadraticCurveTo(-37,front-8,-32.6,front-3.8);s.lineTo(-31.6,front);s.lineTo(31.6,front);s.lineTo(32.6,front-3.8);s.quadraticCurveTo(37,front-8,41.4,front-3.8);s.lineTo(42.4,front);s.lineTo(right-2,front);s.quadraticCurveTo(right,front,right,front-2);s.lineTo(right,shoulder+3);s.quadraticCurveTo(right,shoulder,right-3,shoulder);s.lineTo(rear+1,shoulder);s.quadraticCurveTo(rear,shoulder,rear,shoulder-1);s.lineTo(rear,end+1);s.quadraticCurveTo(rear,end,rear-1,end);s.lineTo(-rear+1,end);s.quadraticCurveTo(-rear,end,-rear,end+1);s.lineTo(-rear,shoulder-1);s.quadraticCurveTo(-rear,shoulder,-rear-1,shoulder);s.lineTo(left+3,shoulder);s.quadraticCurveTo(left,shoulder,left,shoulder+3);s.lineTo(left,front-2);s.quadraticCurveTo(left,front,left+2,front);
 const flat=new T.ExtrudeGeometry(s,{depth:3.5,bevelEnabled:false,curveSegments:12}),p=flat.attributes.position,vertices=[];
 // Split at both bends before raising the rack, retaining flat faces on each
 // side of a bend instead of stretching large triangles diagonally across it.
 for(let i=0;i<p.count;i+=3){let polygons=[[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j),p.getZ(i+j)])];
  for(const cut of [-30,-43]){const next=[];for(const poly of polygons){const above=[],below=[];for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length],da=a[1]-cut,db=b[1]-cut;(da>=0?above:below).push(a);if((da>=0)!==(db>=0)){const t=da/(da-db),v=a.map((x,k)=>x+(b[k]-x)*t);above.push(v);below.push(v);}}if(above.length>2)next.push(above);if(below.length>2)next.push(below);}polygons=next;}
  for(const poly of polygons)for(let j=1;j<poly.length-1;j++)for(const v of [poly[0],poly[j],poly[j+1]])vertices.push(v[0],v[1],v[2]-.2+Math.max(0,Math.min(1,(-v[1]-30)/13))*(pro?5:9));
 }
 flat.dispose();const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(vertices.length/3*2),2));
 geometry.computeVertexNormals();geometry.userData={kind:'floyd-shaped-baseplate',frontWidthMm:width,rearWidthMm:rear*2,front,shoulder,end};return geometry;
}

export function twoPointPlate(id){
 const s=new T.Shape(),gotoh=id==='gotoh-510';
 if(gotoh){
  s.moveTo(-34.75,10.5);s.lineTo(-32.2,10.5);s.lineTo(-32.2,6.7);s.quadraticCurveTo(-28,1.8,-23.8,6.7);s.lineTo(-23.8,10.5);s.lineTo(23.8,10.5);s.lineTo(23.8,6.7);s.quadraticCurveTo(28,1.8,32.2,6.7);s.lineTo(32.2,10.5);s.lineTo(34.75,10.5);s.quadraticCurveTo(36.75,10.5,36.75,8.5);s.lineTo(36.75,-6);s.lineTo(44.75,-6);s.quadraticCurveTo(46.75,-6,46.75,-8);s.lineTo(46.75,-27.5);s.quadraticCurveTo(46.75,-29.5,44.75,-29.5);s.lineTo(-34.75,-29.5);s.quadraticCurveTo(-36.75,-29.5,-36.75,-27.5);s.lineTo(-36.75,8.5);s.quadraticCurveTo(-36.75,10.5,-34.75,10.5);
 }else{
  s.moveTo(-34,5.5626);s.lineTo(-32.4,5.5626);s.lineTo(-32.4,2);s.quadraticCurveTo(-28.194,-2,-24,2);s.lineTo(-24,5.5626);s.lineTo(24,5.5626);s.lineTo(24,2);s.quadraticCurveTo(28.194,-2,32.4,2);s.lineTo(32.4,5.5626);s.lineTo(34,5.5626);s.quadraticCurveTo(36.2,5.5626,36.2,2);s.lineTo(36.2,-2);s.quadraticCurveTo(36.2,-5,42,-7);s.quadraticCurveTo(48.89,-9,48.89,-17);s.lineTo(48.89,-24);s.quadraticCurveTo(48.89,-32.5374,40,-32.5374);s.lineTo(-27,-32.5374);s.quadraticCurveTo(-36.2,-32.5374,-36.2,-23);s.lineTo(-36.2,2);s.quadraticCurveTo(-36.2,5.5626,-34,5.5626);
 }
 const geometry=new T.ExtrudeGeometry(s,{depth:gotoh?2.6:3.5,bevelEnabled:false,curveSegments:12});geometry.translate(0,0,-.2);return geometry;
}
