import * as THREE from 'three';
import {viewDirection} from './reference-space.js';

export function revealYaw(ms){
  const t=Math.max(0,Math.min(1,(ms-3000)/1000));
  return -Math.PI/2*t*t*(3-2*t);
}

// Each vertex retains its own part's construction frame through material merging.
// Plates open from an edge, cylinders curl around an axis, and round detail grows
// from its centre line. No camera movement or image blending creates the volume.
export function prepareFormation(g,meta,center){
  const p=g.attributes.position,n=p.count,uv=g.attributes.uv;
  g.computeBoundingBox();const box=g.boundingBox,mid=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const view=new THREE.Vector3(...viewDirection),right=new THREE.Vector3(0,1,0).cross(view).normalize(),up=view.clone().cross(right);
  const delay=Math.min(.13,Math.hypot(mid.clone().sub(center).dot(right),mid.clone().sub(center).dot(up))*.032);
  const arrays={aBuildOrigin:new Float32Array(n*3),aBuildU:new Float32Array(n*3),aBuildN:new Float32Array(n*3),aBuildSeed:new Float32Array(n*3),aBuildConfig:new Float32Array(n*4)};
  let kind=1,O=meta?.origin?new THREE.Vector3(...meta.origin):mid.clone(),U=new THREE.Vector3(),N=new THREE.Vector3(),radius=meta?.radius||1;
  if(meta?.kind==='cylinder'){
    U.set(...meta.axis).normalize();N.copy(meta.radial?new THREE.Vector3(...meta.radial):new THREE.Vector3(1,0,0));
    if(Math.abs(U.dot(N))>.95)N.set(0,1,0);N.addScaledVector(U,-N.dot(U)).normalize();
    kind=radius>=.075?2:3;
  }else if(meta?.kind==='ring'){
    kind=3;U.set(...meta.axis);N.set(1,0,0);
  }else if(meta?.kind==='tube'){
    kind=3;U.set(0,0,1);N.set(1,0,0);
  }else{
    if(meta?.normal)N.set(...meta.normal);else{const s=size.toArray(),axis=s.indexOf(Math.min(...s));N.setComponent(axis,1);}
    const axes=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)].filter(a=>Math.abs(a.dot(N))<.5);
    U.copy(axes.sort((a,b)=>Math.abs(size.dot(b))-Math.abs(size.dot(a)))[0]);
    const V=N.clone().cross(U).normalize();let min=Infinity;
    for(let i=0;i<n;i++)min=Math.min(min,new THREE.Vector3().fromBufferAttribute(p,i).sub(O).dot(V));
    O.addScaledVector(V,min);
  }
  const q=new THREE.Vector3(),seed=new THREE.Vector3();
  const theta=new Float32Array(n);
  if(kind===2){
    const sideCount=meta.sideCount,segments=sideCount/6,step=Math.PI*2/segments;
    for(let i=0;i<n;i++){
      if(i<sideCount){theta[i]=uv.getX(i)*Math.PI*2;continue;}
      // CylinderGeometry cap groups preserve sector order. The cap centre has
      // no polar angle; including its floating-point residue breaks the seam.
      const capIndex=i-sideCount,sector=Math.floor(capIndex/3)%segments,vertex=capIndex%3;
      const lower=capIndex>=segments*3;
      theta[i]=(sector+(vertex===2?.5:lower?(vertex===0?1:0):vertex))*step;
    }
  }
  const tubeCenters=meta?.centers?.map(p=>new THREE.Vector3(...p));
  for(let i=0;i<n;i++){
    q.fromBufferAttribute(p,i);seed.copy(q);
    if(meta?.kind==='cylinder'){const d=q.clone().sub(O);seed.copy(O).addScaledVector(U,d.dot(U));}
    else if(meta?.kind==='ring'){const d=q.clone().sub(O);d.addScaledVector(U,-d.dot(U)).normalize();seed.copy(O).addScaledVector(d,radius);}
    else if(tubeCenters){let best=Infinity;for(const c of tubeCenters){const d=q.distanceToSquared(c);if(d<best){best=d;seed.copy(c);}}}
    arrays.aBuildOrigin.set(O.clone().sub(center).toArray(),i*3);arrays.aBuildU.set(U.toArray(),i*3);arrays.aBuildN.set(N.toArray(),i*3);arrays.aBuildSeed.set(seed.sub(center).toArray(),i*3);
    arrays.aBuildConfig.set([kind,delay,radius,theta[i]],i*4);
  }
  for(const [key,array]of Object.entries(arrays))g.setAttribute(key,new THREE.BufferAttribute(array,key==='aBuildConfig'?4:3));
}

export const constructionShader=`
uniform float uTime;
attribute vec3 aBuildOrigin,aBuildU,aBuildN,aBuildSeed;
attribute vec4 aBuildConfig;
varying float vBuild;
float buildAmount(){return smoothstep(1.0+aBuildConfig.y,3.0,uTime);}
vec3 buildPosition(vec3 p){
 float k=buildAmount();if(k>=.99999)return p;
 vec3 q=p-aBuildOrigin,U=aBuildU,N=aBuildN;
 if(aBuildConfig.x<1.5){
   vec3 V=cross(N,U);float face=smoothstep(0.,.82,k),thick=smoothstep(.24,1.,k);
   return aBuildOrigin+U*dot(q,U)+V*dot(q,V)*face+N*dot(q,N)*thick;
 }
 if(aBuildConfig.x<2.5){
   vec3 B=cross(U,N);float axial=dot(q,U);float r=length(q-U*axial),phi=aBuildConfig.w*k;
   return aBuildOrigin+U*axial+(N*cos(phi)+B*sin(phi))*r+N*(1.-k)*(aBuildConfig.z-r);
 }
 return mix(aBuildSeed,p,k);
}
vec3 buildNormal(vec3 normal){
 float k=buildAmount();if(k>=.99999)return normal;
 vec3 U=aBuildU,N=aBuildN;
 if(aBuildConfig.x<1.5){vec3 V=cross(N,U);return normalize(U*dot(normal,U)+V*dot(normal,V)/max(.002,smoothstep(0.,.82,k))+N*dot(normal,N)/max(.002,smoothstep(.24,1.,k)));}
 if(aBuildConfig.x<2.5){float angle=aBuildConfig.w*(k-1.);vec3 axis=U;return normalize(normal*cos(angle)+cross(axis,normal)*sin(angle)+axis*dot(axis,normal)*(1.-cos(angle)));}
 return normal;
}`;
