(()=>{
 'use strict';
 const dialog=document.querySelector('#video-player');
 if(!dialog)return;
 const player=dialog.querySelector('video');
 const title=dialog.querySelector('#video-player-title');
 const error=dialog.querySelector('.video-dialog-error');
 const stage=document.createElement('div');stage.className='video-dialog-stage';
 player.replaceWith(stage);stage.append(player);
 // The stage keeps the cropped 16:9 frame intact on portrait and ultrawide screens.
 player.setAttribute('controlslist','nofullscreen');
 const exitFullscreen=document.createElement('button');
 exitFullscreen.type='button';exitFullscreen.className='video-stage-exit';
 exitFullscreen.setAttribute('aria-label','退出全屏');
 exitFullscreen.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h5V3m8 0v5h5M8 21v-5H3m13 5v-5h5"/></svg>';
 stage.append(exitFullscreen);
 const fullscreen=document.createElement('button');
 fullscreen.type='button';fullscreen.className='video-dialog-fullscreen';
 fullscreen.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg><span>全屏播放</span>';
 dialog.querySelector('.video-dialog-header').insertBefore(fullscreen,dialog.querySelector('.video-dialog-close'));
 fullscreen.hidden=!(stage.requestFullscreen||stage.webkitRequestFullscreen||player.webkitEnterFullscreen);
 const isFullscreen=()=>document.fullscreenElement===stage||document.webkitFullscreenElement===stage||player.webkitDisplayingFullscreen===true;
 function updateFullscreen(){
  const active=isFullscreen();
  stage.classList.toggle('is-fullscreen',active);
  fullscreen.setAttribute('aria-pressed',String(active));
  fullscreen.setAttribute('aria-label',active?'退出全屏':'全屏播放');
  fullscreen.querySelector('span').textContent=active?'退出全屏':'全屏播放';
 }
 async function toggleFullscreen(){
  try{
   if(isFullscreen()){
    if(document.fullscreenElement&&document.exitFullscreen)await document.exitFullscreen();
    else if(document.webkitFullscreenElement&&document.webkitExitFullscreen)document.webkitExitFullscreen();
    else player.webkitExitFullscreen?.();
   }else if(stage.requestFullscreen)await stage.requestFullscreen();
   else if(stage.webkitRequestFullscreen)stage.webkitRequestFullscreen();
   else player.webkitEnterFullscreen?.();
   if(!player.error)error.hidden=true;
   updateFullscreen();
  }catch(fullscreenError){
   error.textContent='暂时无法进入全屏，请再次点击全屏按钮。';
   error.hidden=false;
  }
 }
 fullscreen.addEventListener('click',toggleFullscreen);
 exitFullscreen.addEventListener('click',toggleFullscreen);
 document.addEventListener('fullscreenchange',updateFullscreen);
 document.addEventListener('webkitfullscreenchange',updateFullscreen);
 player.addEventListener('webkitbeginfullscreen',updateFullscreen);
 player.addEventListener('webkitendfullscreen',updateFullscreen);
 updateFullscreen();
 let opener=null;
 let backdropPointer=false;
 function syncTitle(){
  if(opener)title.textContent=opener.closest('.video-card').querySelector('h2').textContent;
 }
 document.addEventListener('fx:languagechange',()=>{if(dialog.open)syncTitle();});

 document.querySelectorAll('[data-video-src]').forEach(button=>{
  button.addEventListener('click',()=>{
   opener=button;
   syncTitle();
   error.hidden=true;
   player.muted=true;
   player.poster=button.dataset.videoPoster;
   player.src=button.dataset.videoSrc;
   document.documentElement.classList.add('is-video-open');
   dialog.showModal();
   // Load only the chosen film; native controls also work if autoplay is denied.
   const attempt=player.play();
   attempt?.catch(()=>{});
  });
 });

 dialog.querySelector('.video-dialog-close').addEventListener('click',()=>dialog.close());
 const outside=event=>{
  const rect=dialog.getBoundingClientRect();
  return event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;
 };
 dialog.addEventListener('pointerdown',event=>{backdropPointer=event.target===dialog&&outside(event);});
 dialog.addEventListener('click',event=>{
  if(backdropPointer&&event.target===dialog&&outside(event))dialog.close();
  backdropPointer=false;
 });
 dialog.addEventListener('close',()=>{
  player.pause();
  player.removeAttribute('src');
  player.removeAttribute('poster');
  player.load();
  error.hidden=true;
  document.documentElement.classList.remove('is-video-open');
  opener?.focus({preventScroll:true});
 });
 player.addEventListener('error',()=>{if(dialog.open){error.textContent='视频暂时无法播放，请关闭后重试。';error.hidden=false;}});
 window.addEventListener('pagehide',()=>player.pause());
})();
