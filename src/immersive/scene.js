import {setupFilm} from './film.js';
import {createMobilePhotoMotion} from './mobile-photo-motion.js';

const root=document.documentElement,canvas=document.querySelector('#robot-stage'),stage=document.querySelector('.stage');
const sections=[...document.querySelectorAll('[data-chapter]')],copies=[...document.querySelectorAll('.scene-copy')],links=[...document.querySelectorAll('.top-nav a[data-section]')];
const screenPanels=[...document.querySelectorAll('.chapter,.frc-scene,.showcase')],interaction=document.querySelector('.depth-interaction');
const frcSection=document.querySelector('#about-frc'),frcEntry=document.querySelector('#about-frc .frc-panel-body'),connectSection=document.querySelector('#connect');
const connectPhoto=connectSection.querySelector('.mobile-scene-photo'),connectCopy=connectSection.querySelector('.scene-copy'),header=document.querySelector('.fx-header');
let viewportWidth=innerWidth,viewportHeight=Math.max(1,innerHeight),lastScrollY=scrollY,resizing=false,resizeFrame=0,layoutFrame=0;
let initialRoute=['#idea','#about-frc','#frc-season','#frc-roles','#frc-growth','#showcase'].includes(location.hash)?location.hash:null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),small=matchMedia('(max-width:760px)');
const mobilePhotoMotion=createMobilePhotoMotion({small,reduced});
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
let renderer,scene,camera,robot,photoDepth,webglModule,gpuPreparation=null,depthPreparation=null,gpuEpoch=0,depthEpoch=0;
let raf=0,current=0,target=0,pointer={x:0,y:0},pointerTarget={x:0,y:0},disposed=false,started=false;
let robotControl,lastModelRect='',layout={tops:[],panelTops:[],frcTop:Infinity,connectTop:0,connectBottom:0,photoLeft:0,photoTop:0,photoWidth:1,copyTop:0,head:0};
const updateFilmArrival=setupFilm();
const photographs=[...document.querySelectorAll('.scene-photograph')],cutawayButton=document.querySelector('.cutaway-toggle');
let showCutaway=false,entryComplete=false,preparation=null,robotPreparation=null,lastFrame=0,lastCopy=-Infinity,stageOpacity=1,lastBlend=-1,lastMobile=small.matches,lastModelOpen=false;
root.dataset.sceneGpu='idle';root.dataset.depthSurfaces='0';
cutawayButton.disabled=false;cutawayButton.textContent='2026冠军机器模型';

// Cache document coordinates once after layout changes. Scroll and animation
// frames consume these numbers instead of repeatedly forcing layout.
function measureLayout(){
 const y=scrollY,connect=connectSection.getBoundingClientRect(),photo=connectPhoto.getBoundingClientRect(),copy=connectCopy.getBoundingClientRect();
 layout={tops:sections.map(section=>section.getBoundingClientRect().top+y),panelTops:screenPanels.map(section=>section.getBoundingClientRect().top+y),frcTop:frcSection.getBoundingClientRect().top+y,connectTop:connect.top+y,connectBottom:connect.bottom+y,photoLeft:photo.left,photoTop:photo.top+y,photoWidth:photo.width,copyTop:copy.top+y,head:header.getBoundingClientRect().height+14};
 lastModelRect='';
}
function layoutRequest(){if(!layoutFrame&&!disposed)layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;measureLayout();target=progress();lastCopy=-Infinity;request();maybePrepareDesktop()})}
function modelViewport(){
 const mobile=small.matches,left=mobile?layout.photoLeft+20:viewportWidth*.39,top=mobile?layout.photoTop-lastScrollY+layout.head:0;
 const width=mobile?layout.photoWidth-40:viewportWidth-left,height=mobile?Math.max(1,layout.copyTop-lastScrollY-top-18):viewportHeight;
 const key=[left,top,width,height].join(',');
 if(key!==lastModelRect){lastModelRect=key;for(const [name,value]of Object.entries({left,top,width,height}))interaction.style.setProperty(`--model-${name}`,`${value}px`)}
 return {left,top,width,height};
}
function progress(){
 const y=lastScrollY,tops=layout.tops;
 for(let i=0;i<tops.length-1;i++)if(y<tops[i+1])return i+clamp((y-tops[i])/Math.max(1,tops[i+1]-tops[i]));
 return Math.max(0,tops.length-1);
}
function storyVisible(){return lastScrollY<layout.frcTop&&lastScrollY+viewportHeight>0}
function desktopEligible(){return started&&entryComplete&&!disposed&&!small.matches&&!document.hidden&&storyVisible()}
function setModelState(){
 if(lastModelOpen===showCutaway)return;lastModelOpen=showCutaway;
 root.classList.toggle('model-open',showCutaway);mobilePhotoMotion.setModelOpen(showCutaway);
 cutawayButton.setAttribute('aria-pressed',String(showCutaway));cutawayButton.textContent=showCutaway&&!small.matches?'2026冠军机器模型 −':'2026冠军机器模型';
 if(!showCutaway)robotControl?.reset();
}
cutawayButton.addEventListener('click',async()=>{
 if(!robot){
  cutawayButton.disabled=true;cutawayButton.textContent='正在准备结构视图';
  await (robotPreparation??=prepareRobot());
  if(!robot||disposed||!small.matches&&(current<1.4||current>2.7))return;
 }
 showCutaway=!showCutaway;
 if(showCutaway&&small.matches){window.scrollTo({top:layout.connectTop,behavior:'instant'});lastScrollY=scrollY;target=progress()}
 setModelState();lastCopy=-Infinity;request();
});
function updateCopy(p){
 if(Math.abs(p-lastCopy)<.00001)return;lastCopy=p;
 const mobile=small.matches,active=p>=4?4:Math.round(p);
 if(!mobile){
  copies.forEach((copy,i)=>{const distance=p-i,opacity=1-smooth(.2,.68,Math.abs(distance));copy.style.opacity=String(opacity);copy.style.transform=`translateY(${-distance*60}px)`;copy.style.pointerEvents=opacity>.6?'auto':'none';copy.inert=opacity<.6});
  const photoProgress=Math.min(p,3);photographs.forEach((photo,i)=>{photo.style.opacity=String(1-smooth(0,1,Math.abs(photoProgress-i)))})
 }
 const group=lastScrollY+viewportHeight*.5>=layout.frcTop?'frc':'home';
 if(root.dataset.navSection!==group){links.forEach(link=>{if(link.dataset.section===group)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current')});root.dataset.navSection=group}
 const sceneName=['venue','workshop','detail','competition','frc'][active];if(root.dataset.scene!==sceneName)root.dataset.scene=sceneName;
 if(showCutaway&&(mobile?layout.connectBottom-lastScrollY<88||layout.connectTop-lastScrollY>viewportHeight:active!==2))showCutaway=false;
 setModelState();
 const cutaway=showCutaway?(mobile?1:smooth(1.5,1.95,p)*(1-smooth(2.2,2.65,p))):0;
 root.style.setProperty('--cutaway',String(cutaway));canvas.style.opacity=renderer&&(!mobile&&photoDepth||showCutaway&&robot)?'1':'0';
}
function request(){if(entryComplete&&!raf&&!disposed&&!document.hidden)raf=requestAnimationFrame(frame)}
function frame(time){
 raf=0;if(disposed||document.hidden)return;
 const dt=Math.min(.034,Math.max(.001,(time-lastFrame)/1000||1/60));lastFrame=time;
 const mobile=small.matches;
 current=mobile||reduced.matches?target:current+(target-current)*(1-Math.exp(-9*dt));
 if(Math.abs(current-target)<.001)current=target;
 if(!mobile){const alpha=1-Math.exp(-12*dt);pointer.x+=(pointerTarget.x-pointer.x)*alpha;pointer.y+=(pointerTarget.y-pointer.y)*alpha}
 const p=Math.min(current,3);updateCopy(current);
 // Mobile FRC panels are normal page content; their own visibility controls
 // playback. A hidden desktop stage must not delay video arrival on phones.
 const opacityTarget=mobile?0:1-smooth(3.04,3.98,target);
 stageOpacity=mobile||reduced.matches?opacityTarget:stageOpacity+(opacityTarget-stageOpacity)*(1-Math.exp(-2.7*dt));
 if(Math.abs(stageOpacity-opacityTarget)<.001)stageOpacity=opacityTarget;
 if(lastBlend!==stageOpacity){
  lastBlend=stageOpacity;stage.style.opacity=String(stageOpacity);
  frcEntry.style.opacity=mobile?'1':String(1-smooth(.02,.7,stageOpacity));frcEntry.style.transform=mobile?'none':`translateY(${stageOpacity*24}px)`;
  root.dataset.sceneBlend=stageOpacity.toFixed(3);
 }
 // Later FRC panels keep arriving after the opening stage has fully faded.
 updateFilmArrival(1-stageOpacity);
 if(!mobile&&photoDepth&&renderer&&storyVisible()){
  const animating=photoDepth.render(renderer,p,pointer,reduced.matches||!entryComplete,showCutaway?.10:1,time);
  root.classList.toggle('has-depth',photoDepth.ready(p));if(animating)request();
  photoDepth.prepareAround(renderer,p,()=>{root.dataset.depthSurfaces=String(photoDepth.count);lastCopy=-Infinity;request()},desktopEligible).catch(error=>console.warn('FoundryX scene loading:',error.message));
 }
 if(robot&&renderer&&showCutaway&&(mobile||current>1.4&&current<2.7)){
  const {left,top,width:w,height:h}=modelViewport();if(camera.aspect!==w/h||camera.fov!==38){camera.aspect=w/h;camera.fov=38;camera.updateProjectionMatrix()}
  camera.position.set(mobile?11:9,mobile?8:6.5,mobile?14:11);camera.lookAt(0,0,0);
  robotControl.setViewport({left,top,width:w,height:h});if(robotControl.update(dt))request();
  renderer.setViewport(left,viewportHeight-h-top,w,h);renderer.autoClear=mobile||!photoDepth;if(!mobile&&photoDepth)renderer.clearDepth();renderer.render(scene,camera);renderer.autoClear=true;
 }
 if(!mobile&&(Math.abs(stageOpacity-opacityTarget)>.001||Math.abs(current-target)>.001||Math.abs(pointer.x-pointerTarget.x)>.001||Math.abs(pointer.y-pointerTarget.y)>.001))request();
}
function sizeRenderer(){if(!renderer)return;renderer.setPixelRatio(Math.min(devicePixelRatio||1,small.matches?1.25:1.5));renderer.setSize(viewportWidth,viewportHeight,false);camera.aspect=viewportWidth/viewportHeight;camera.fov=small.matches?42:38;camera.updateProjectionMatrix();photoDepth?.resize(viewportWidth,viewportHeight)}
function applyResponsiveMode(){
 const mobile=small.matches;
 if(mobile){copies.forEach(copy=>{copy.style.opacity='1';copy.style.transform='none';copy.style.pointerEvents='auto';copy.inert=false})}
 if(mobile!==lastMobile){
  lastMobile=mobile;lastCopy=-Infinity;lastBlend=-1;pointer={x:0,y:0};pointerTarget={x:0,y:0};
  if(mobile){dropDepth();if(!showCutaway)releaseGpu()}
 }
}
function resize(){
 const w=innerWidth,h=innerHeight;if(w<1||h<1)return;
 const active=layout.panelTops.reduce((best,top,index)=>Math.abs(top-lastScrollY)<Math.abs((layout.panelTops[best]??0)-lastScrollY)?index:best,0);
 const changed=!small.matches&&Math.abs(w-viewportWidth)>32;viewportWidth=w;viewportHeight=h;root.style.setProperty('--screen-height',`${h}px`);applyResponsiveMode();measureLayout();lastCopy=-Infinity;
 if(initialRoute&&started){document.querySelector(initialRoute)?.scrollIntoView({behavior:'instant',block:'start'});initialRoute=null;lastScrollY=scrollY;current=target=progress()}
 else if(changed&&started){
  resizing=true;cancelAnimationFrame(resizeFrame);
  const restore=()=>{lastScrollY=layout.panelTops[active]??0;window.scrollTo({top:lastScrollY,behavior:'instant'});current=target=progress();request()};
  restore();resizeFrame=requestAnimationFrame(()=>{restore();resizeFrame=requestAnimationFrame(()=>{restore();resizing=false})});
 }
 sizeRenderer();target=progress();galleryRequest();request();maybePrepareDesktop();
}
function onScroll(){if(resizing)return;lastScrollY=scrollY;target=progress();request();maybePrepareDesktop()}
function onPointer(e){if(small.matches||!entryComplete||showCutaway||reduced.matches||!storyVisible()||e.pointerType==='touch')return;pointerTarget.x=(e.clientX/viewportWidth-.5)*2;pointerTarget.y=(.5-e.clientY/viewportHeight)*2;photoDepth?.interact();request()}
function onVisibility(){if(document.hidden){cancelAnimationFrame(raf);raf=0}else{lastFrame=0;request();maybePrepareDesktop()}}
function dropDepth(){depthEpoch++;photoDepth?.dispose();photoDepth=null;root.classList.remove('has-depth');root.dataset.depthSurfaces='0'}
function releaseGpu(){
 gpuEpoch++;dropDepth();robotControl?.dispose();webglModule?.disposeSceneRenderer({renderer,scene});renderer=scene=camera=robot=robotControl=null;robotPreparation=null;lastModelRect='';
 root.classList.remove('has-scene');canvas.style.opacity='0';root.dataset.sceneGpu='idle';cutawayButton.disabled=false;cutawayButton.textContent='2026冠军机器模型';
}
function fallback(){showCutaway=false;setModelState();root.style.setProperty('--cutaway','0');releaseGpu();cutawayButton.textContent='结构视图暂不可用，点击重试';request()}
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback()});
async function ensureRenderer(){
 if(renderer)return true;if(disposed)return false;if(gpuPreparation)return gpuPreparation;
 const epoch=gpuEpoch;
 const attempt=(async()=>{webglModule=await import('./scene-webgl.js');if(disposed||epoch!==gpuEpoch)return false;({renderer,scene,camera}=webglModule.createSceneRenderer(canvas));sizeRenderer();root.dataset.sceneGpu='ready';return true})();
 gpuPreparation=attempt;
 try{return await attempt}finally{if(gpuPreparation===attempt)gpuPreparation=null}
}
function maybePrepareDesktop(){
 if(!desktopEligible()||photoDepth||depthPreparation)return;
 const epoch=depthEpoch;
 const attempt=(async()=>{
  try{
   if(!await ensureRenderer()||!desktopEligible()||epoch!==depthEpoch)return;
   const {createPhotoDepth}=await import('./photo-depth.js');if(!desktopEligible()||epoch!==depthEpoch)return;
   const depth=await createPhotoDepth(photographs,{initialIndex:Math.min(3,Math.round(target)),shouldContinue:desktopEligible});
   if(disposed||epoch!==depthEpoch||!desktopEligible()){depth?.dispose();return}if(!depth)return;
   photoDepth=depth;depth.resize(viewportWidth,viewportHeight);await depth.prepare(renderer);
   if(disposed||epoch!==depthEpoch||photoDepth!==depth)return;
   if(entryComplete)depth.activate();root.dataset.depthSurfaces=String(depth.count);root.dataset.sceneReady='true';lastCopy=-Infinity;request();
  }catch(error){console.warn('FoundryX photo depth unavailable:',error.message)}
 })();
 depthPreparation=attempt;attempt.finally(()=>{if(depthPreparation===attempt)depthPreparation=null});
}
async function init(){
 if(started)return;started=true;lastScrollY=scrollY;measureLayout();applyResponsiveMode();current=target=progress();stageOpacity=small.matches?0:1-smooth(3.04,3.98,target);
 addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',resize);addEventListener('pointermove',onPointer,{passive:true});document.addEventListener('visibilitychange',onVisibility);reduced.addEventListener('change',request);
 root.dataset.sceneReady='true';resize();maybePrepareDesktop();request();
}
async function prepareRobot(){
 try{
  if(!await ensureRenderer()||disposed)return;
  const epoch=gpuEpoch,{createInteractiveRobot}=await import('./robot-interaction.js');if(disposed||epoch!==gpuEpoch)return;
  const control=await createInteractiveRobot(renderer,scene,camera,interaction,request,()=>showCutaway&&(small.matches||current>1.5&&current<2.5));
  if(disposed||epoch!==gpuEpoch){control.dispose();webglModule?.disposeSceneRenderer({scene:control.group});return}
  robotControl=control;robot=control.group;root.classList.add('has-scene');root.dataset.robotParts=String(control.count);root.dataset.robotAssemblies=String(control.assemblyCount);cutawayButton.disabled=false;cutawayButton.textContent='2026冠军机器模型';current=target=progress();request();
 }catch(error){fallback();console.warn('FoundryX model unavailable:',error.message)}
 finally{if(!robot){robotPreparation=null;cutawayButton.disabled=false}}
}
const layoutObserver=typeof ResizeObserver==='function'?new ResizeObserver(layoutRequest):null;
sections.forEach(section=>layoutObserver?.observe(section));layoutObserver?.observe(header);
document.fonts?.ready.then(layoutRequest);
function dispose(){
 disposed=true;cancelAnimationFrame(resizeFrame);cancelAnimationFrame(layoutFrame);cancelAnimationFrame(raf);raf=0;
 layoutObserver?.disconnect();mobilePhotoMotion.dispose();releaseGpu();
 removeEventListener('scroll',onScroll);removeEventListener('resize',resize);removeEventListener('pointermove',onPointer);document.removeEventListener('visibilitychange',onVisibility);reduced.removeEventListener('change',request);
}
addEventListener('pagehide',event=>{if(event.persisted){cancelAnimationFrame(raf);raf=0}else dispose()});
addEventListener('pageshow',event=>{if(event.persisted&&!disposed){lastScrollY=scrollY;resize()}});
const prepare=()=>preparation??=init();
function reveal(){entryComplete=true;photoDepth?.activate();mobilePhotoMotion.activate();lastFrame=0;request();maybePrepareDesktop()}
function revealAndPrepare(){reveal();requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!disposed)prepare()}))}
async function boot(){
 root.classList.add('is-enhanced');
 if(['#idea','#about-frc','#frc-season','#frc-roles','#frc-growth','#showcase'].includes(location.hash)){
  window.FoundryWelcome={state:'complete'};document.querySelector(location.hash)?.scrollIntoView({behavior:'instant',block:'start'});
  const ready=prepare();root.classList.remove('fx-welcome-pending');reveal();await ready;request();
 }else{
  if (window.FoundryWelcome?.state === 'complete') {
   revealAndPrepare();
   return;
  }
  document.addEventListener('foundryx:welcome-complete', revealAndPrepare, {once: true});
  try {
   await import('../welcome/lifecycle.js');
  } catch {
   if (window.FoundryWelcome?.state !== 'complete') {
    window.FoundryWelcome = {state: 'complete'};
    root.classList.remove('fx-welcome-pending');
    document.dispatchEvent(new Event('foundryx:welcome-complete'));
   }
  }
 }
}
// Native scrolling provides touch and keyboard access to the curved gallery.
const gallery=document.querySelector('.showcase-track'),moments=[...document.querySelectorAll('.team-moment')];
const previous=document.querySelector('.gallery-prev'),next=document.querySelector('.gallery-next');
let galleryFrame=0,galleryIndex=0;
const galleryImages=moments.map(item=>item.querySelector('img'));
galleryImages.forEach(img=>{
 const slot=img.closest('.photo-slot'),status=document.createElement('span');
 status.className='photo-loading';status.textContent='照片加载中…';status.setAttribute('aria-hidden','true');
 slot.append(status);slot.classList.add('is-loading');
 async function revealPhoto(){
  try{await img.decode()}catch{if(!img.naturalWidth)return}
  slot.classList.remove('is-loading');status.hidden=true;
 }
 img.addEventListener('load',revealPhoto);
 img.addEventListener('error',()=>{status.textContent='照片暂时未能加载'});
 if(img.complete){if(img.naturalWidth)revealPhoto();else status.textContent='照片暂时未能加载'}
});
function warmGallery(index){
 galleryImages.slice(Math.max(0,index-1),index+2).forEach(img=>{img.loading='eager'});
}
let galleryIsNear=false;
const galleryObserver=new IntersectionObserver(entries=>{
 if(entries.some(entry=>entry.isIntersecting)){galleryIsNear=true;warmGallery(galleryIndex);galleryObserver.disconnect()}
},{rootMargin:'100% 0px'});
galleryObserver.observe(gallery.closest('.showcase'));
function updateGallery(){
 galleryFrame=0;const center=gallery.scrollLeft+gallery.clientWidth/2;
 const distances=moments.map(item=>(item.offsetLeft+item.offsetWidth/2-center)/Math.max(item.offsetWidth,1));
 let nearest=Infinity;
 moments.forEach((item,i)=>{
  const distance=distances[i],absolute=Math.abs(distance);
  if(absolute<nearest){nearest=absolute;galleryIndex=i}
  item.style.setProperty('--turn',`${reduced.matches||small.matches?0:clamp(distance,-1.7,1.7)*-16}deg`);
  item.style.setProperty('--lift',`${reduced.matches||small.matches?0:Math.min(absolute,2)*20}px`);
  item.style.setProperty('--scale',String(small.matches?1:1-Math.min(absolute,2)*.075));
  item.style.setProperty('--alpha',String(small.matches?1:1-Math.min(absolute,2)*.23));
 });
 if(galleryIsNear)warmGallery(galleryIndex);
 previous.disabled=galleryIndex===0;next.disabled=galleryIndex===moments.length-1;
}
function galleryRequest(){if(!galleryFrame)galleryFrame=requestAnimationFrame(updateGallery)}
function galleryMove(index){index=clamp(index,0,moments.length-1);warmGallery(index);const item=moments[index];gallery.scrollTo({left:item.offsetLeft+item.offsetWidth/2-gallery.clientWidth/2,behavior:reduced.matches?'instant':'smooth'})}
gallery.addEventListener('scroll',galleryRequest,{passive:true});addEventListener('resize',galleryRequest);previous.addEventListener('click',()=>galleryMove(galleryIndex-1));next.addEventListener('click',()=>galleryMove(galleryIndex+1));gallery.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();galleryMove(galleryIndex+(e.key==='ArrowRight'?1:-1))}});updateGallery();

let touchStart=null;
interaction.addEventListener('pointerdown',e=>{if(!showCutaway&&e.pointerType==='touch'){photoDepth?.interact();touchStart={x:e.clientX,y:e.clientY,px:pointerTarget.x};interaction.setPointerCapture(e.pointerId)}});
interaction.addEventListener('pointermove',e=>{if(showCutaway||!touchStart||e.pointerType!=='touch'||reduced.matches)return;const dx=e.clientX-touchStart.x,dy=e.clientY-touchStart.y;if(Math.abs(dx)>Math.abs(dy)){pointerTarget.x=clamp(touchStart.px+dx/innerWidth*3,-1.3,1.3);photoDepth?.interact();request()}});
for(const event of ['pointerup','pointercancel'])interaction.addEventListener(event,()=>{touchStart=null});
interaction.addEventListener('keydown',e=>{if(showCutaway)return;const step=.35;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key)){e.preventDefault();if(e.key==='Home')pointerTarget={x:0,y:0};else if(e.key==='ArrowLeft'||e.key==='ArrowRight')pointerTarget.x=clamp(pointerTarget.x+(e.key==='ArrowRight'?step:-step),-1.3,1.3);else pointerTarget.y=clamp(pointerTarget.y+(e.key==='ArrowUp'?step:-step),-1,1);photoDepth?.interact();request()}});

// Direct section routes can prepare synchronously on mobile, so the gallery's
// state must exist before init() calls resize().
boot();
