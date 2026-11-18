import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {loadPackedCad} from '../welcome/cad-loader.js';

// The packed CAD has no assembly paths. These stable ID ranges follow the
// named mechanism clusters in the source model; fasteners travel with them.
const intakeAttachments=new Set([433,444,621,628,708]);
const chassisParts=new Set([434,441,448,600,603,624]);
const rightDriveAttachments=new Set([420,421,617]);
const leftDriveAttachments=new Set([601,622,629]);
const assemblies=[
 {name:'采球总成',offset:[0,.2,-1.65]},
 {name:'输送总成',offset:[0,1.4,-.25]},
 {name:'发射总成',offset:[0,1.5,.7]},
 {name:'右侧驱动总成',offset:[1.3,-.35,0]},
 {name:'左侧驱动总成',offset:[-1.3,-.35,0]},
 {name:'护框总成',offset:[0,.75,1.3]},
 {name:'底盘结构',offset:[0,-1,0]},
 {name:'电控、供电与视觉',offset:[0,1.5,.25]}
];
function assemblyFor(id){
 if(intakeAttachments.has(id)||id>=14&&id<=266)return 0;
 if(id>=267&&id<=419)return 1;
 if(id>=722)return 2;
 if(id>=631&&id<=642||id>=644&&id<=655||rightDriveAttachments.has(id))return 3;
 if(id>=695&&id<=706||id>=709&&id<=720||leftDriveAttachments.has(id))return 4;
 if(id>=656&&id<=694)return 5;
 if(chassisParts.has(id))return 6;
 return 7;
}

// The visible CAD stays batched. Picking uses the assembled geometry, so a
// selected assembly moving outwards cannot cause a pick/unpick feedback loop.
export async function createInteractiveRobot(renderer,scene,camera,element,request,isActive){
 const data=await loadPackedCad('assets/welcome-cad/',{includeColors:true,includeEdges:true});
 const group=new THREE.Group(),gs=[],es=[],glassParts=[],proxies=[],pickMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
 const guards=new Set([50,146,230,659,682,694]),excluded=new Set([3,234,236,399,626,929]);
 const assemblyCounts=assemblies.map(()=>0);
 const hovered={value:-1},amount={value:0},raycaster=new THREE.Raycaster(),inverse=new THREE.Matrix4(),localRay=new THREE.Ray(),ndc=new THREE.Vector2();
 const rotation={yaw:1.1,pitch:0,targetYaw:1.1,targetPitch:0};
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)'),hoverCapability=matchMedia('(hover: hover)');
 let viewport={left:0,top:0,width:innerWidth,height:innerHeight};
 let targetAmount=0,pendingId=-1,drag=null,lastPick={x:-999,y:-999},pickPending=null,disposed=false;
 let pointerInside=false,autoVelocity=0,wasActive=false;
 for(const [i,m] of data.meshes.filter(m=>!excluded.has(m.id)).entries()){
  if(i%40===0)await new Promise(resolve=>setTimeout(resolve,0));
  const assemblyId=assemblyFor(m.id),direction=assemblies[assemblyId].offset;assemblyCounts[assemblyId]++;
  const g=new THREE.BufferGeometry(),position=m.position,offset=new Float32Array(position.length),ids=new Float32Array(position.length/3).fill(assemblyId);
  for(let n=0;n<position.length;n++){position[n]=(position[n]-[0,293.5,-90][n%3])/160;offset[n]=direction[n%3]}
  g.setAttribute('position',new THREE.BufferAttribute(position,3));g.setAttribute('normal',new THREE.BufferAttribute(m.normal,3));g.setAttribute('color',new THREE.BufferAttribute(m.vertexColor,3));g.setAttribute('partOffset',new THREE.BufferAttribute(offset,3));g.setAttribute('partId',new THREE.BufferAttribute(ids,1));g.setIndex(new THREE.BufferAttribute(m.index,1));
  g.computeBoundingBox();g.computeBoundingSphere();
  const proxy=new THREE.Mesh(g,pickMaterial);proxy.userData.partId=m.id;proxy.userData.assemblyId=assemblyId;proxy.matrixAutoUpdate=false;proxies.push(proxy);
  if(guards.has(m.id))glassParts.push({g,id:m.id});else gs.push(g);
  if(m.edges.length){const ep=m.edges,eo=new Float32Array(ep.length);for(let n=0;n<ep.length;n++){ep[n]=(ep[n]-[0,293.5,-90][n%3])/160;eo[n]=direction[n%3]}const e=new THREE.BufferGeometry();e.setAttribute('position',new THREE.BufferAttribute(ep,3));e.setAttribute('partOffset',new THREE.BufferAttribute(eo,3));e.setAttribute('partId',new THREE.BufferAttribute(new Float32Array(ep.length/3).fill(assemblyId),1));es.push(e)}
 }
 const addExplosion=shader=>{shader.uniforms.uHovered=hovered;shader.uniforms.uAmount=amount;shader.vertexShader='attribute vec3 partOffset;attribute float partId;uniform float uHovered;uniform float uAmount;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed += partOffset * uAmount * (1.0-step(0.1,abs(partId-uHovered)));')};
 const material=new THREE.MeshStandardMaterial({vertexColors:true,metalness:.42,roughness:.34,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});material.onBeforeCompile=addExplosion;
 const solid=new THREE.Mesh(mergeGeometries(gs),material);group.add(solid);
 const glass=new THREE.MeshPhysicalMaterial({color:0xb5d5de,roughness:.16,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,clearcoat:1});glass.onBeforeCompile=addExplosion;
 for(const {g,id}of glassParts){const panel=new THREE.Mesh(g,glass);panel.name=`Guard ${id}`;panel.renderOrder=1;group.add(panel)}
 const lineMaterial=new THREE.LineBasicMaterial({color:0xe8ce9f,transparent:true,opacity:.065,depthWrite:false});lineMaterial.onBeforeCompile=addExplosion;
 group.add(new THREE.LineSegments(mergeGeometries(es),lineMaterial));es.forEach(g=>g.dispose());group.scale.setScalar(1.17);scene.add(group);
 function select(id){
  const nextAmount=id>=0?1:0;
  // Returning to the assembly that is retracting reverses that motion. It
  // must not wait for a different hovered ID before it can expand again.
  if(id===pendingId){
   if(id===hovered.value&&targetAmount!==nextAmount){targetAmount=nextAmount;request()}
   return;
  }
  pendingId=id;
  if(id===hovered.value)targetAmount=nextAmount;
  else{
   targetAmount=0;
   if(amount.value<.01){amount.value=0;hovered.value=id;targetAmount=nextAmount}
  }
  request();
 }
 function pick(x,y){
  if(!isActive()||drag)return;
  group.updateMatrixWorld(true);camera.updateMatrixWorld();ndc.set((x-viewport.left)/viewport.width*2-1,1-(y-viewport.top)/viewport.height*2);raycaster.setFromCamera(ndc,camera);inverse.copy(group.matrixWorld).invert();localRay.copy(raycaster.ray).applyMatrix4(inverse);
  const hits=[];
  for(const proxy of proxies){if(guards.has(proxy.userData.partId)||!localRay.intersectsBox(proxy.geometry.boundingBox))continue;proxy.matrixWorld.copy(group.matrixWorld);proxy.raycast(raycaster,hits)}
  hits.sort((a,b)=>a.distance-b.distance);select(hits[0]?.object.userData.assemblyId??-1);lastPick={x,y};
 }
 const enter=e=>{if(e.pointerType==='touch')return;pointerInside=true;autoVelocity=0;if(!drag)rotation.targetYaw=rotation.yaw;request()};
 const down=e=>{if(!isActive()||e.button!==0||drag)return;e.preventDefault();autoVelocity=0;element.focus({preventScroll:true});drag={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:rotation.targetYaw,pitch:rotation.targetPitch};pickPending=null;element.setPointerCapture(e.pointerId);select(-1);element.classList.add('is-dragging');request()};
 const move=e=>{if(!isActive())return;if(drag){if(e.pointerId!==drag.id)return;e.preventDefault();const dx=e.clientX-drag.x,dy=e.clientY-drag.y;rotation.targetYaw=drag.yaw+dx/Math.min(viewport.width,1000)*Math.PI*2;rotation.targetPitch=THREE.MathUtils.clamp(drag.pitch+dy*.004,-.65,.65);request()}else if(e.pointerType!=='touch'&&Math.hypot(e.clientX-lastPick.x,e.clientY-lastPick.y)>4){pickPending={x:e.clientX,y:e.clientY};request()}};
 const up=e=>{if(!drag||e.pointerId!==drag.id)return;const tap=e.pointerType==='touch'&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<9;drag=null;element.classList.remove('is-dragging');if(element.hasPointerCapture(e.pointerId))element.releasePointerCapture(e.pointerId);const bounds=element.getBoundingClientRect();pointerInside=e.pointerType!=='touch'&&e.clientX>=bounds.left&&e.clientX<=bounds.right&&e.clientY>=bounds.top&&e.clientY<=bounds.bottom;lastPick={x:-999,y:-999};if(e.type==='pointerup'&&(pointerInside||tap))pickPending={x:e.clientX,y:e.clientY};request()};
 const leave=e=>{pointerInside=false;if(e.pointerType==='touch')return;if(!drag){pickPending=null;select(-1)}request()};
 const motionChange=()=>{autoVelocity=0;if(reducedMotion.matches&&!drag)rotation.targetYaw=rotation.yaw;request()};
 const key=e=>{if(!isActive()||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','Escape'].includes(e.key))return;e.preventDefault();e.stopImmediatePropagation();select(-1);if(e.key==='Home'){rotation.targetYaw=1.1;rotation.targetPitch=0}else if(e.key==='Escape')select(-1);else if(e.key==='ArrowLeft'||e.key==='ArrowRight')rotation.targetYaw+=(e.key==='ArrowRight'?1:-1)*Math.PI/6;else rotation.targetPitch=THREE.MathUtils.clamp(rotation.targetPitch+(e.key==='ArrowDown'?1:-1)*.12,-.65,.65);request()};
 element.addEventListener('pointerenter',enter);element.addEventListener('pointerdown',down);element.addEventListener('pointermove',move);element.addEventListener('pointerup',up);element.addEventListener('pointercancel',up);element.addEventListener('lostpointercapture',up);element.addEventListener('pointerleave',leave);element.addEventListener('keydown',key,{capture:true});reducedMotion.addEventListener('change',motionChange);
 await renderer.compileAsync(scene,camera);
 function update(dt){
  if(!isActive()){autoVelocity=0;wasActive=false;select(-1);pickPending=null;drag=null;return false}
  if(!wasActive){wasActive=true;autoVelocity=0;pointerInside=hoverCapability.matches&&element.matches(':hover')}
  // Integrate a small per-frame angle, rather than deriving it from wall time,
  // so re-entry and restoring a background tab cannot jump to another view.
  const idleEligible=!pointerInside&&!drag&&pendingId<0&&!reducedMotion.matches;
  if(idleEligible&&hovered.value<0){autoVelocity+=(.12-autoVelocity)*(1-Math.exp(-3*dt));rotation.targetYaw+=autoVelocity*dt}else autoVelocity=0;
  const alpha=1-Math.exp(-16*dt);rotation.yaw+=(rotation.targetYaw-rotation.yaw)*alpha;rotation.pitch+=(rotation.targetPitch-rotation.pitch)*alpha;group.rotation.set(rotation.pitch,rotation.yaw,0,'YXZ');
  if(pickPending&&!drag&&Math.abs(rotation.yaw-rotation.targetYaw)+Math.abs(rotation.pitch-rotation.targetPitch)<.01){const {x,y}=pickPending;pickPending=null;pick(x,y)}
  amount.value+=(targetAmount-amount.value)*(1-Math.exp(-12*dt));
  if(targetAmount===0&&amount.value<.01&&hovered.value!==pendingId){amount.value=0;hovered.value=pendingId;targetAmount=pendingId>=0?1:0}
  element.dataset.part=String(hovered.value);element.dataset.assemblyId=String(hovered.value);const name=assemblies[hovered.value]?.name??'';element.dataset.assemblyName=window.FXLanguage?.translate(name)??name;element.dataset.assemblyParts=String(assemblyCounts[hovered.value]??0);element.dataset.explode=amount.value.toFixed(3);element.dataset.rotation=rotation.yaw.toFixed(3);element.dataset.pitch=rotation.pitch.toFixed(3);element.dataset.autoRotation=autoVelocity.toFixed(3);element.dataset.modelMotion=reducedMotion.matches?'reduced':autoVelocity>0?'auto':'paused';
  return idleEligible||Math.abs(amount.value-targetAmount)>.001||Math.abs(rotation.yaw-rotation.targetYaw)+Math.abs(rotation.pitch-rotation.targetPitch)>.001;
 }
 function dispose(){if(disposed)return;disposed=true;for(const [type,fn]of [['pointerenter',enter],['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up],['lostpointercapture',up],['pointerleave',leave]])element.removeEventListener(type,fn);element.removeEventListener('keydown',key,true);reducedMotion.removeEventListener('change',motionChange);proxies.forEach(p=>p.geometry.dispose());pickMaterial.dispose()}
 return {group,update,dispose,reset(){if(drag&&element.hasPointerCapture(drag.id))element.releasePointerCapture(drag.id);drag=null;pickPending=null;pendingId=-1;hovered.value=-1;amount.value=0;targetAmount=0;autoVelocity=0;wasActive=false;pointerInside=false;rotation.targetYaw=rotation.yaw;rotation.targetPitch=rotation.pitch;element.classList.remove('is-dragging');element.dataset.assemblyId='-1';element.dataset.assemblyName='';element.dataset.assemblyParts='0';element.dataset.autoRotation='0';element.dataset.modelMotion='paused'},setViewport(v){viewport=v},count:proxies.length,assemblyCount:assemblies.length,assemblies:assemblies.map(({name},id)=>({id,name,parts:assemblyCounts[id]}))};
}
