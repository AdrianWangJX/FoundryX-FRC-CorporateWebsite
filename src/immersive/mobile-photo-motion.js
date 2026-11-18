// Portrait photographs move independently of the desktop depth renderer. The
// smallest scale still covers every translated edge of the original frame.
const travels=[
 {from:'translate3d(-1.5%, 1.5%, 0) scale(1.04)',to:'translate3d(2.5%, -2.5%, 0) scale(1.24)',duration:8500},
 {from:'translate3d(1.5%, -1.5%, 0) scale(1.04)',to:'translate3d(-3%, 2%, 0) scale(1.23)',duration:9500},
 {from:'translate3d(1.5%, -1.5%, 0) scale(1.04)',to:'translate3d(-2.5%, 2%, 0) scale(1.20)',duration:9000},
 {from:'translate3d(1.5%, 1.5%, 0) scale(1.04)',to:'translate3d(-2.5%, -2%, 0) scale(1.20)',duration:10000},
];

export function createMobilePhotoMotion({small,reduced}){
 let activated=false,modelOpen=false,suspended=false,disposed=false;
 const records=[...document.querySelectorAll('.mobile-scene-photo')].map((photo,index)=>{
  const img=photo.querySelector('img'),rect=photo.getBoundingClientRect();
  return {photo,img,travel:travels[index%travels.length],visible:rect.height>0&&rect.bottom>0&&rect.top<innerHeight,ready:img.complete&&img.naturalWidth>0,motion:null,entrance:null,entered:false};
 });

 function clear(record){
  record.motion?.cancel();record.motion=null;
  record.entrance?.cancel();record.entrance=null;
 }
 function sync(){
  if(disposed)return;
  const enabled=small.matches&&!reduced.matches&&observer;
  const canPlay=enabled&&activated&&!modelOpen&&!suspended&&!document.hidden;
  for(const record of records){
   if(!enabled){clear(record);continue}
   const playing=canPlay&&record.visible&&record.ready;
   if(!playing){record.motion?.pause();record.entrance?.pause();continue}
   if(!record.motion&&typeof record.img.animate==='function'){
    const {from,to,duration}=record.travel;
    record.motion=record.img.animate([{transform:from},{transform:to}],{duration,iterations:Infinity,direction:'alternate',easing:'ease-in-out',fill:'both'});
   }else if(record.motion?.playState==='paused')record.motion.play();
   // Fade the photo layer, not the image: model mode owns the image's opacity.
   if(!record.entered&&typeof record.photo.animate==='function'){
    record.entered=true;
    record.entrance=record.photo.animate([{opacity:.7},{opacity:1}],{duration:950,easing:'ease-out'});
    record.entrance.onfinish=()=>{record.entrance?.cancel();record.entrance=null};
   }else if(record.entrance?.playState==='paused')record.entrance.play();
  }
 }
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
  for(const entry of entries){const record=records.find(item=>item.photo===entry.target);if(record)record.visible=entry.isIntersecting}
  sync();
 },{threshold:0}):null;
 for(const record of records){
  observer?.observe(record.photo);
  record.onLoad=()=>{record.ready=record.img.naturalWidth>0;sync()};
  record.onError=()=>{record.ready=false;clear(record)};
  record.img.addEventListener('load',record.onLoad);record.img.addEventListener('error',record.onError);
 }
 function onPageHide(){suspended=true;sync()}
 function onPageShow(){suspended=false;sync()}
 small.addEventListener('change',sync);reduced.addEventListener('change',sync);
 document.addEventListener('visibilitychange',sync);
 addEventListener('pagehide',onPageHide);addEventListener('pageshow',onPageShow);
 return {
  activate(){activated=true;sync()},
  setModelOpen(value){if(modelOpen===value)return;modelOpen=value;sync()},
  dispose(){
   if(disposed)return;disposed=true;observer?.disconnect();
   small.removeEventListener('change',sync);reduced.removeEventListener('change',sync);
   document.removeEventListener('visibilitychange',sync);
   removeEventListener('pagehide',onPageHide);removeEventListener('pageshow',onPageShow);
   for(const record of records){clear(record);record.img.removeEventListener('load',record.onLoad);record.img.removeEventListener('error',record.onError)}
  },
 };
}
