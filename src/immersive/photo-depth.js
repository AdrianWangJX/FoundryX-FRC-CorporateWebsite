import * as THREE from 'three';
import maps from './depth/cleaned.js';

// Only the surfaces visible in the photograph are reconstructed.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const yieldWork=()=>new Promise(resolve=>setTimeout(resolve,0));
function sample(map,u,v){
 const x=clamp(u)*(map.width-1),y=clamp(v)*(map.height-1),x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(x0+1,map.width-1),y1=Math.min(y0+1,map.height-1),dx=x-x0,dy=y-y0;
 return ((map.data[y0*map.width+x0]*(1-dx)+map.data[y0*map.width+x1]*dx)*(1-dy)+(map.data[y1*map.width+x0]*(1-dx)+map.data[y1*map.width+x1]*dx)*dy)/255;
}
export async function createPhotoDepth(images,{initialIndex=0,shouldContinue=()=>true}={}){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,280),meshes=[],failedImages=new Map(),aim=new THREE.Vector3();
 let activated=false,ambientStarted=null,preparing=null;
 let viewport={width:1,height:1,photoHeight:1},active=-1,entered=0,manualAt=-Infinity,lastTime=0,disposed=false;
 const ranges=[2.8,2.45,2.15,2.65],gammas=[.75,.85,1,.85],limits=[1.08,.96,.82,1.02];
 camera.position.z=12;
 function failedUnchanged(index){
  const image=images[index],failure=failedImages.get(index);
  return failure&&failure.source===(image.currentSrc||image.src)&&failure.complete===image.complete&&failure.width===image.naturalWidth;
 }
 async function buildSurface(index,canPrepare=shouldContinue){
  await yieldWork();if(disposed||!canPrepare()||meshes[index]||failedUnchanged(index))return;
  try{
   const image=images[index];
   if(!image.complete)await new Promise((resolve,reject)=>{
    const clean=()=>{clearTimeout(timer);image.removeEventListener('load',loaded);image.removeEventListener('error',failed)};
    const loaded=()=>{clean();resolve()},failed=()=>{clean();reject(new Error('Photograph unavailable'))};
    const timer=setTimeout(()=>{clean();reject(new Error('Photograph loading timed out'))},8000);
    image.addEventListener('load',loaded,{once:true});image.addEventListener('error',failed,{once:true});
   });
   if(!image.naturalWidth)throw new Error(`Photograph ${index+1} unavailable`);
   await image.decode();if(disposed||!canPrepare())return;
   const map={...maps[index],data:Uint8Array.from(atob(maps[index].dataBase64),c=>c.charCodeAt(0))};
   const texture=new THREE.Texture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
   const geometry=new THREE.PlaneGeometry(1,1,160,106),uv=geometry.attributes.uv,depth=new Float32Array(uv.count);
   for(let i=0;i<uv.count;i++)depth[i]=.15+ranges[index]*Math.pow(sample(map,uv.getX(i),1-uv.getY(i)),gammas[index]);
   geometry.setAttribute('photoDepth',new THREE.BufferAttribute(depth,1));
   const size={value:new THREE.Vector2(1,1)};
   const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthTest:true,depthWrite:true,toneMapped:false,side:THREE.FrontSide});
   material.customProgramCacheKey=()=> 'photo-depth-v2';
   material.onBeforeCompile=shader=>{
    shader.uniforms.photoSize=size;
    shader.vertexShader='attribute float photoDepth;uniform vec2 photoSize;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','vec3 transformed=vec3(position.xy*photoSize*(12.0-photoDepth)/12.0,photoDepth);');
   };
   const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.userData={size,aspect:image.naturalWidth/image.naturalHeight};meshes[index]=mesh;scene.add(mesh);
   failedImages.delete(index);
  }catch(error){
   const image=images[index];
   failedImages.set(index,{source:image.currentSrc||image.src,complete:image.complete,width:image.naturalWidth});
   console.warn('FoundryX photograph unavailable:',error.message);
  }
 }
 await buildSurface(initialIndex);
 // Keep the failed surface's native image fallback and allow later photographs
 // to initialise. Do not recreate this renderer on every scroll after a failure.
 if(!meshes[initialIndex]&&!shouldContinue())return null;
 function resize(w,h){
  const photoHeight=w<=600?Math.min(h*.68,w*1.05):h;
  viewport={width:w,height:h,photoHeight};camera.aspect=w/photoHeight;camera.updateProjectionMatrix();
  const viewHeight=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*12,viewWidth=viewHeight*camera.aspect;
  for(const mesh of meshes.filter(Boolean)){
   const {aspect,size}=mesh.userData,height=Math.max(viewHeight,viewWidth/aspect)*1.12;
   size.value.set(height*aspect,height);
  }
 }
 function render(renderer,p,pointer,reduced,fade=1,time=performance.now()){
  const index=Math.min(3,Math.round(p));
  if(!meshes[index]){renderer.setScissorTest(false);renderer.clear(true,true,true);return false;}
  const dt=Math.min(.034,Math.max(.001,(time-lastTime)/1000||1/60));lastTime=time;
  if(active!==index){active=index;entered=time;ambientStarted=null;manualAt=-Infinity;camera.position.set(0,0,12)}
  if(ambientStarted===null)ambientStarted=time;
  const age=(time-(ambientStarted??time))/1000;
  const ambient=!reduced&&activated;
  const ramp=smooth(0,2.4,age),phase=age*.42;
  const manual=smooth(.2,1.5,(time-manualAt)/1000);
  const driftX=Math.sin(phase)*.58*ramp,driftY=Math.sin(phase*.73)*.10*ramp;
  const targetX=ambient?(pointer.x*.42+driftX*manual)*limits[index]:0;
  const targetY=ambient?pointer.y*.10+driftY*manual:0;
  const targetZ=12-(ambient?(1-Math.cos(phase*.7))*.14*ramp:0),alpha=1-Math.exp(-5.5*dt);
  camera.position.lerp(aim.set(targetX,targetY,targetZ),reduced?1:alpha);camera.lookAt(0,0,1.3);
  // Scene changes occur at zero opacity: never overlap two photographs.
  const opacity=fade*(1-smooth(.22,.48,Math.abs(p-Math.round(p))));
  meshes.forEach((mesh,i)=>{mesh.visible=i===index;mesh.material.opacity=opacity});
  const {width,height,photoHeight}=viewport;
  renderer.setViewport(0,0,width,height);renderer.setScissorTest(false);renderer.clear(true,true,true);
  renderer.setViewport(0,height-photoHeight,width,photoHeight);renderer.autoClear=false;renderer.render(scene,camera);renderer.autoClear=true;
  document.documentElement.dataset.depthView=`${index}:${camera.position.x.toFixed(3)},${camera.position.y.toFixed(3)},${camera.position.z.toFixed(3)}`;
  return ambient||Math.abs(camera.position.x-targetX)+Math.abs(camera.position.y-targetY)+Math.abs(camera.position.z-targetZ)>.0005;
 }
 function prepareAround(renderer,p,onReady,canPrepare=shouldContinue){
  if(preparing||disposed||!canPrepare())return preparing||Promise.resolve();
  const active=Math.min(images.length-1,Math.round(p));
  // Warm only the current/next photograph while the narrative is visible. Do
  // not build every depth mesh while the user is watching the FRC videos.
  const indices=[active,Math.min(images.length-1,active+1)].filter((index,position,list)=>!meshes[index]&&!failedUnchanged(index)&&list.indexOf(index)===position);
  if(!indices.length)return Promise.resolve();
  preparing=(async()=>{
   for(const index of indices){
    if(disposed||!canPrepare())return;
    await buildSurface(index,canPrepare);if(disposed||!canPrepare())return;if(!meshes[index])continue;
    resize(viewport.width,viewport.height);renderer.initTexture(meshes[index].material.map);
    await renderer.compileAsync(meshes[index],camera,scene);if(disposed||!canPrepare())return;onReady();
   }
  })().finally(()=>{preparing=null});
  return preparing;
 }
 function ready(p){return !!meshes[Math.min(3,Math.round(p))]}
 async function prepare(renderer){
  for(const mesh of meshes.filter(Boolean)){renderer.initTexture(mesh.material.map);await yieldWork()}
  await renderer.compileAsync(scene,camera);
 }
 function activate(){activated=true;active=-1;lastTime=0}
 function interact(){manualAt=performance.now()}
 function dispose(){disposed=true;meshes.forEach(mesh=>{mesh.geometry.dispose();mesh.material.map.dispose();mesh.material.dispose()})}
 return {resize,render,prepare,prepareAround,ready,activate,interact,dispose,scene,camera,get count(){return meshes.filter(Boolean).length}};
}
