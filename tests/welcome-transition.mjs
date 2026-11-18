import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLogoTransition} from '../src/welcome/logo-transition.js';
import {LOGO_SEGMENTS} from '../src/welcome/logo-contour.js';
import {WELCOME_TIMING as T,cadPhaseTime} from '../src/welcome/timing.js';
// These are the CAD asset generator's logical phases. The deployed video
// welcome has its own lifecycle and duration, covered by welcome-lifecycle.cjs.
const milestones=[0,T.gold,T.formed,T.rotated,T.hold,T.dissolved];
assert(milestones.every(Number.isFinite));
for(let i=1;i<milestones.length;i++)assert(milestones[i]>milestones[i-1],'CAD phases must have positive durations');
assert(T.logoStart>T.hold&&T.logoStart<T.duration,'Logo reveal must follow the settled CAD pose');
assert(T.dissolved<=T.duration,'CAD dissolution must finish during generator playback');
assert(T.entryFade>=0&&T.duration+T.entryFade<=T.maxDuration,'Generator playback and fade must fit its deadline');
const phaseEndpoints=[0,1,3,4,5,6];
for(let i=0;i<milestones.length;i++){
 assert.equal(cadPhaseTime(milestones[i]),phaseEndpoints[i],'Each CAD milestone must reach its shader phase endpoint');
 if(i){
  const midpoint=(milestones[i-1]+milestones[i])/2;
  assert.equal(cadPhaseTime(midpoint),(phaseEndpoints[i-1]+phaseEndpoints[i])/2,'CAD phase interpolation must preserve its midpoint');
 }
}
let previousPhase=0;
for(let ms=0;ms<=T.maxDuration;ms++){
 const phase=cadPhaseTime(ms);
 assert(Number.isFinite(phase)&&phase>=previousPhase&&phase<=6,'CAD phase time must remain finite, monotonic and capped');
 previousPhase=phase;
}
for(const ms of [T.duration,T.maxDuration,T.maxDuration*2])assert.equal(cadPhaseTime(ms),6,'Completed CAD dissolution must stay at its final phase');
const camera=new THREE.OrthographicCamera(-4,4,4,-4,.1,20);camera.position.set(3,3,6);camera.lookAt(0,0,0);camera.updateMatrixWorld();
const box=new THREE.BoxGeometry(2,2,2),edges=new THREE.EdgesGeometry(box);
const transition=createLogoTransition({value:0},{value:new THREE.Vector2(1440,1440)});
const distance=(x,y,ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));return Math.hypot(x-ax-t*dx,y-ay-t*dy);};
for(const layout of [{width:.75,height:.75*158.5/485.7,x:0,y:0,pixelRatio:2},{width:.52,height:.52*158.5/485.7,x:.04,y:.18,pixelRatio:3}]){
 transition.update([edges],camera,layout);
 for(const name of ['aTargetA','aTargetB'])for(let i=0,points=transition.mesh.geometry.attributes[name].array;i<points.length;i+=2){
  const x=points[i]/2+.5,y=.5-points[i+1]/2;let nearest=Infinity;
  for(let j=0;j<LOGO_SEGMENTS.length;j+=4)nearest=Math.min(nearest,distance(x,y,...LOGO_SEGMENTS.slice(j,j+4)));
  assert(nearest<1e-5,'A ribbon endpoint must land on the source SVG outline, including offset landscape layouts');
 }
 for(const attr of Object.values(transition.mesh.geometry.attributes))assert([...attr.array].every(Number.isFinite));
 assert.equal(transition.mesh.material.uniforms.uPixelRatio.value,layout.pixelRatio);
}
const versions=Object.fromEntries(Object.entries(transition.mesh.geometry.attributes).map(([k,v])=>[k,v.version]));
transition.setLayout({width:.8,height:.26,x:0,y:.15});
assert.equal(transition.mesh.material.uniforms.uLogoOffset.value.y,.15);
for(const [key,attr]of Object.entries(transition.mesh.geometry.attributes))assert.equal(attr.version,versions[key],'Live layout updates must not rebuild vertex buffers');
transition.dispose();box.dispose();edges.dispose();
console.log('PASS: CAD generator phase endpoints/interpolation/deadline (not deployed welcome duration), original Logo contour endpoints, portrait/offset-landscape alignment, finite GPU buffers and pixel ratio.');
