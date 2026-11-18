import * as THREE from 'three';
import {LOGO_SEGMENTS} from './logo-contour.js';
import {WELCOME_TURN_RADIANS} from './timing.js';

// Short filaments begin on CAD edges and finish on the original logo contours.
// All motion is on the GPU; the solid itself never changes shape.
export function createLogoTransition(progress,resolution){
 const count=960,geometry=new THREE.InstancedBufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,-1,0,1,-1,0,1,1,0,0,1,0],3));geometry.setIndex([0,1,2,0,2,3]);geometry.instanceCount=count;
 const sourceA=new Float32Array(count*2),sourceB=new Float32Array(count*2),targetA=new Float32Array(count*2),targetB=new Float32Array(count*2),seed=new Float32Array(count);
 for(let i=0;i<count;i++)seed[i]=((i*16807+73)%2147483647%1009)/1009;
 for(const [name,array,size]of [['aSourceA',sourceA,2],['aSourceB',sourceB,2],['aTargetA',targetA,2],['aTargetB',targetB,2],['aSeed',seed,1]])geometry.setAttribute(name,new THREE.InstancedBufferAttribute(array,size));
 const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,
 uniforms:{uProgress:progress,uResolution:resolution,uPixelRatio:{value:1},uLogoScale:{value:new THREE.Vector2(.67,.67*158.5/485.7)},uLogoOffset:{value:new THREE.Vector2()}},
 vertexShader:`attribute vec2 aSourceA,aSourceB,aTargetA,aTargetB;attribute float aSeed;uniform float uProgress;uniform vec2 uResolution,uLogoScale,uLogoOffset;uniform float uPixelRatio;varying float vAcross;varying float vAlpha;varying float vHeat;
 vec2 travel(vec2 a,vec2 b,float p){float k=p*p*p*(p*(p*6.-15.)+10.);vec2 control=mix(a,b,.50)+vec2(0.,.10*sin(a.x*2.));return (1.-k)*(1.-k)*a+2.*(1.-k)*k*control+k*k*b;}
 void main(){vec2 targetA=aTargetA*uLogoScale+uLogoOffset,targetB=aTargetB*uLogoScale+uLogoOffset;float local=clamp((uProgress-.09-aSeed*.08)/.59,0.,1.);vec2 a=travel(aSourceA,targetA,max(0.,local-.055*sin(local*3.14159265))),b=travel(aSourceB,targetB,local);
 vec2 direction=normalize((b-a)*uResolution+vec2(.0001));vec2 normal=vec2(-direction.y,direction.x);
 float transit=sin(local*3.14159265);float width=(1.9+transit*.45)*uPixelRatio;
 vec2 p=mix(a,b,position.x)+normal*position.y*width/uResolution;
 gl_Position=vec4(p,0.,1.);vAcross=position.y;vHeat=transit;vAlpha=smoothstep(0.,.14,uProgress)*(1.-smoothstep(.72,1.,uProgress))*(.56+.30*aSeed);}`,
 fragmentShader:`varying float vAcross,vAlpha,vHeat;void main(){float core=exp(-12.*vAcross*vAcross),halo=exp(-3.*vAcross*vAcross)*.20;vec3 color=mix(vec3(1.,.54,.12),vec3(1.8,1.32,.65),vHeat*.6+core*.25);gl_FragColor=vec4(color,(core+halo)*vAlpha);
 #include <colorspace_fragment>
 }`});
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;
 function setLayout(layout){material.uniforms.uLogoScale.value.set(layout.width,layout.height);material.uniforms.uLogoOffset.value.set(layout.x,layout.y);if(layout.pixelRatio)material.uniforms.uPixelRatio.value=layout.pixelRatio;}
 function update(edgeGeometries,camera,layout){
  setLayout(layout);
  camera.updateMatrixWorld();const rotation=new THREE.Matrix4().makeRotationY(WELCOME_TURN_RADIANS),a=new THREE.Vector3(),b=new THREE.Vector3(),sources=[];let sourceTotal=0;
  for(const g of edgeGeometries){const p=g.attributes.position.array;for(let i=0;i<p.length;i+=6){a.fromArray(p,i).applyMatrix4(rotation).project(camera);b.fromArray(p,i+3).applyMatrix4(rotation).project(camera);const length=Math.hypot(a.x-b.x,a.y-b.y);if(length<.006||length>.9)continue;sourceTotal+=length;sources.push([a.x,a.y,b.x,b.y,sourceTotal]);}}
  const targets=[];let targetTotal=0;
  for(let i=0;i<LOGO_SEGMENTS.length;i+=4){const [ax,ay,bx,by]=LOGO_SEGMENTS.slice(i,i+4);const x1=(ax-.5)*2,y1=(.5-ay)*2,x2=(bx-.5)*2,y2=(.5-by)*2;const length=Math.hypot((x2-x1)*layout.width,(y2-y1)*layout.height);targetTotal+=length;targets.push([x1,y1,x2,y2,targetTotal]);}
  const pick=(segments,total,u)=>{let lo=0,hi=segments.length-1;const at=u*total;while(lo<hi){const mid=(lo+hi)>>1;if(segments[mid][4]<at)lo=mid+1;else hi=mid;}const s=segments[lo],before=lo?segments[lo-1][4]:0,t=(at-before)/(s[4]-before);return {s,t};};
  for(let i=0;i<count;i++){
   const s=pick(sources,sourceTotal,(i+.5)/count),t=pick(targets,targetTotal,((i*941)%count+.5)/count);
   const length=Math.hypot(s.s[2]-s.s[0],s.s[3]-s.s[1]),part=Math.min(.018/length,.6),lo=Math.max(0,s.t-part*.5),hi=Math.min(1,s.t+part*.5);
   sourceA.set([THREE.MathUtils.lerp(s.s[0],s.s[2],lo),THREE.MathUtils.lerp(s.s[1],s.s[3],lo)],i*2);sourceB.set([THREE.MathUtils.lerp(s.s[0],s.s[2],hi),THREE.MathUtils.lerp(s.s[1],s.s[3],hi)],i*2);
   const tl=Math.hypot((t.s[2]-t.s[0])*layout.width,(t.s[3]-t.s[1])*layout.height),tp=Math.min(.013/tl,.8),ta=Math.max(0,t.t-tp*.5),tb=Math.min(1,t.t+tp*.5);
   targetA.set([THREE.MathUtils.lerp(t.s[0],t.s[2],ta),THREE.MathUtils.lerp(t.s[1],t.s[3],ta)],i*2);targetB.set([THREE.MathUtils.lerp(t.s[0],t.s[2],tb),THREE.MathUtils.lerp(t.s[1],t.s[3],tb)],i*2);
  }
  // Match horizontal position so ribbons keep their order instead of crossing.
  const orderA=Array.from({length:count},(_,i)=>i).sort((a,b)=>(sourceA[a*2]+sourceB[a*2])-(sourceA[b*2]+sourceB[b*2])||(sourceA[a*2+1]-sourceA[b*2+1]));
  const orderB=Array.from({length:count},(_,i)=>i).sort((a,b)=>(targetA[a*2]+targetB[a*2])-(targetA[b*2]+targetB[b*2])||(targetA[a*2+1]-targetA[b*2+1]));
  const originalA=targetA.slice(),originalB=targetB.slice();
  for(let rank=0;rank<count;rank++){targetA.set(originalA.subarray(orderB[rank]*2,orderB[rank]*2+2),orderA[rank]*2);targetB.set(originalB.subarray(orderB[rank]*2,orderB[rank]*2+2),orderA[rank]*2);}
  for(const attr of Object.values(geometry.attributes))attr.needsUpdate=true;
 }
 return {mesh,update,setLayout,dispose(){geometry.dispose();material.dispose();}};
}
