export function setupFilm(){
 const players=[];
 let active=null;
 const welcomeVisible=()=>['fx-welcome-pending','fx-welcome-active'].some(name=>document.documentElement.classList.contains(name));
 function select(preferred){
  let next=null,best=-1;
  if(!document.hidden&&!welcomeVisible()){
   for(const player of players){const score=player.priority();if(score>best){best=score;next=player;}}
   if(preferred)next=preferred;
  }
  if(active!==next){active?.activate(false);active=next;active?.activate(true)}
  active?.resume();
 }
 for(const film of document.querySelectorAll('.feature-film')){
  const player=setupPlayer(film,select);
  if(player)players.push(player);
 }
 // One observer selects one visible player. Nearby films keep their poster and
 // have no media source, so they cannot compete for downloads or video decoders.
 const byVideo=new Map(players.map(player=>[player.video,player]));
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries)byVideo.get(entry.target)?.intersect(entry);
  select();
 },{threshold:[0,.01,.15,.25,.5,.75,1]});
 players.forEach(player=>observer.observe(player.video));
 document.addEventListener('foundryx:welcome-complete',()=>select());
 document.addEventListener('visibilitychange',()=>{
  select();
  // A previously active panel can still be partly visible and retain its source.
  // Suspend every panel in the background, including those no longer selected.
  if(document.hidden)players.forEach(player=>player.activate(false));
 });
 addEventListener('pageshow',()=>select());
 // A blocked autoplay gets another real user gesture, without restarting media
 // the visitor deliberately paused. Keep play() in this event's call stack.
 const retry=event=>{if(!event.defaultPrevented&&!event.target.closest?.('.film-controls,.film-play'))active?.retryGesture();};
 document.addEventListener('touchend',retry,{passive:true});
 document.addEventListener('click',retry);
 document.addEventListener('keydown',retry);
 return firstArrival=>players.forEach(({film,update},index)=>{
  const top=film.closest('.frc-scene').getBoundingClientRect().top;
  update(index===0?firstArrival:1-Math.max(0,top/Math.max(1,innerHeight)));
 });
}

function setupPlayer(film,select){
 const video=film.querySelector('video');
 if(!video)return null;
 const sound=film.querySelector('.film-sound'),play=film.querySelector('.film-play'),toggle=film.querySelector('.film-toggle'),seek=film.querySelector('.film-seek'),time=film.querySelector('.film-time'),status=film.querySelector('.film-status');
 const fullscreen=document.createElement('button');
 fullscreen.type='button';fullscreen.className='film-fullscreen';
 fullscreen.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fullscreen-expand" d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><path class="fullscreen-collapse" d="M3 8h5V3m8 0v5h5M8 21v-5H3m13 5v-5h5"/></svg>';
 film.querySelector('.film-controls').append(fullscreen);
 const supportsFullscreen=Boolean(film.requestFullscreen||film.webkitRequestFullscreen||video.webkitEnterFullscreen);
 fullscreen.hidden=!supportsFullscreen;
 let nativeFullscreen=false,automaticPauseEvents=0;
 const isFullscreen=()=>document.fullscreenElement===film||document.webkitFullscreenElement===film||nativeFullscreen||video.webkitDisplayingFullscreen===true;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),compact=matchMedia('(max-width:760px)');
 let visible=false,inViewport=false,selected=false,ratio=0,loaded=false,userPaused=false,manualPlayback=false,seeking=false,resumeAfterSeek=false,touchSeeking=false,touchTimer=0,lastArrival=-1,playAttempt=0,playPending=false;
 let policyBlocked=false,abortRetries=0,retryTimer=0,releaseTimer=0,source='',savedTime=0,restoreTime=false;
 video.muted=true;video.defaultMuted=true;video.playsInline=true;video.autoplay=false;video.preload='none';
 video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
 const state=value=>{film.dataset.playback=value;};
 const format=value=>{const seconds=Math.max(0,Math.floor(value||0));return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`};
 function updateTime(){
  const duration=Number.isFinite(video.duration)?video.duration:0;
  seek.disabled=!duration;seek.max=String(duration||1);
  if(!seeking)seek.value=String(video.currentTime);
  const value=Number(seek.value);
  seek.style.setProperty('--played',`${duration?value/duration*100:0}%`);
  const separator=document.documentElement.lang==='en'?' of ':'，共 ';
  seek.setAttribute('aria-valuetext',format(value)+separator+format(duration));
  time.textContent=`${format(value)} / ${format(duration)}`;
 }
 document.addEventListener('fx:languagechange',updateTime);
 function updateSound(){
  const audible=!video.muted&&video.volume>0;
  sound.setAttribute('aria-pressed',String(audible));sound.setAttribute('aria-label',audible?'关闭视频声音':'打开视频声音');
 }
 function updatePlayback(){
  toggle.setAttribute('aria-label',video.paused?'播放视频':'暂停视频');
  toggle.setAttribute('aria-pressed',String(!video.paused));
  film.classList.toggle('is-playing',!video.paused);
 }
 function pauseAutomatically(){
  // A pending play promise must not restart a player after it leaves the screen.
  playAttempt++;playPending=false;clearTimeout(retryTimer);
  video.autoplay=false;
  if(video.paused)return;
  // pause events are queued: keep the marker until the corresponding event runs.
  automaticPauseEvents++;video.pause();
 }
 function clearError(){film.classList.remove('has-error');status.textContent='';status.style.display=''}
 function showError(){
  const code=video.error?.code;
  film.classList.add('has-error');
  state('error');status.style.display='';
  status.textContent=code===2?'视频加载失败，请检查网络后重试':code===3?'视频解码失败，请重新加载':code===4?'视频资源未能加载，请重试':'视频暂时无法播放，请重试';
  play.textContent='重新加载';play.setAttribute('aria-label','重新加载视频');play.hidden=false;
 }
 function load(){
  if(loaded)return;
  // Select once. Rotation/fullscreen must not replace a playing source or reset
  // its position; smaller mobile encodes also stay small when made fullscreen.
  source ||= (compact.matches&&video.dataset.srcMobile)||video.dataset.src||video.getAttribute('src');
  if(!source){showError();return false}
  loaded=true;video.preload='auto';video.src=source;video.load();
  return true;
 }
 function release(){
  clearTimeout(releaseTimer);
  if(!loaded||selected||inViewport&&!document.hidden||isFullscreen())return;
  // A second release can happen while a restored source is still loading.
  // Keep the old position until loadedmetadata has actually applied it.
  if(!restoreTime){savedTime=Number.isFinite(video.currentTime)?video.currentTime:0;restoreTime=savedTime>0;}
  loaded=false;video.preload='none';video.removeAttribute('src');video.load();state('idle');
 }
 async function resume(manual=false,gesture=false){
  // A direct click is a playback request, independent of autoplay's visibility threshold.
  if(manual){
   userPaused=false;manualPlayback=true;
   policyBlocked=false;abortRetries=0;
   // A stalled autoplay promise must not consume a later, valid user gesture.
   if(playPending){playAttempt++;playPending=false}
   if(video.error||film.classList.contains('has-error')){if(!restoreTime){savedTime=Number.isFinite(video.currentTime)?video.currentTime:0;restoreTime=savedTime>0}loaded=false}
   select(player);return;
  }
  if(!selected||document.hidden||userPaused||seeking||playPending)return;
  if(video.error&&loaded||policyBlocked&&!gesture)return;
  if(!video.paused&&video.readyState>=3)return;
  clearTimeout(releaseTimer);clearTimeout(retryTimer);
  // Native muted autoplay complements play() when Safari finishes loading later.
  // It is enabled only for the selected player, and removed on every pause.
  video.autoplay=!userPaused;
  clearError();
  load();
  if(!loaded)return;
  const attempt=++playAttempt;playPending=true;
  state('loading');status.textContent='视频加载中…';status.style.display='block';
  try{
   // Keep play() in the click call stack so Safari can use the user's activation.
   await video.play();
   if(attempt!==playAttempt)return;
   if(!selected||document.hidden||userPaused||seeking){pauseAutomatically();return}
   policyBlocked=false;abortRetries=0;play.hidden=true;clearError();state('playing');
  }catch(error){
   if(attempt!==playAttempt)return;
   if(error.name==='AbortError'){
    // An engine can interrupt its initial load/play handoff without issuing a
    // new intersection event. Retry this transition at most twice, never loop.
    if(abortRetries++<2)retryTimer=setTimeout(()=>resume(),180);
    else{play.hidden=false;play.textContent='播放视频';status.textContent='点击播放视频';state('paused')}
    return;
   }
   if(video.error||error.name==='NotSupportedError')showError();
   else if(selected&&!userPaused&&!seeking){policyBlocked=error.name==='NotAllowedError';state(policyBlocked?'blocked':'paused');status.textContent='';status.style.display='';play.hidden=false;play.textContent='播放视频';play.setAttribute('aria-label','播放视频')}
  }finally{if(attempt===playAttempt)playPending=false}
 }
 function revealTouch(){
  film.classList.add('is-touch-controls');clearTimeout(touchTimer);
  touchTimer=setTimeout(()=>{if(!seeking)film.classList.remove('is-touch-controls')},3500);
 }
 function updateFullscreen(){
  const active=isFullscreen();
  film.classList.toggle('is-fullscreen',active);
  fullscreen.setAttribute('aria-pressed',String(active));
  fullscreen.setAttribute('aria-label',active?'退出全屏':'全屏播放');
  fullscreen.title=active?'退出全屏':'全屏播放';
  if(active){revealTouch();select(player)}else select();
 }
 async function toggleFullscreen(){
  load();
  try{
   if(isFullscreen()){
    if(document.fullscreenElement&&document.exitFullscreen)await document.exitFullscreen();
    else if(document.webkitFullscreenElement&&document.webkitExitFullscreen)document.webkitExitFullscreen();
    else video.webkitExitFullscreen?.();
   }else if(film.requestFullscreen)await film.requestFullscreen();
   else if(film.webkitRequestFullscreen)film.webkitRequestFullscreen();
   else video.webkitEnterFullscreen?.();
   film.classList.remove('has-fullscreen-message');
   updateFullscreen();
  }catch(error){
   status.textContent='暂时无法进入全屏，请再次点击全屏按钮';
   film.classList.add('has-fullscreen-message');
   setTimeout(()=>film.classList.remove('has-fullscreen-message'),3500);
  }
 }
 function togglePlayback(){
  // Native play() sets paused=false before its buffering promise settles.
  // The visible pause control must cancel that pending request as well.
  userPaused=!video.paused;
  if(userPaused){manualPlayback=false;pauseAutomatically();state('paused');clearError()}
  else resume(true);
 }
 function finishSeek(){
  if(!seeking)return;
  seeking=false;video.currentTime=Number(seek.value);film.classList.remove('is-seeking');updateTime();
  select();if(resumeAfterSeek)resume();if(touchSeeking)revealTouch();
 }
 sound.addEventListener('click',()=>{if(video.volume===0)video.volume=1;video.muted=!video.muted;updateSound()});
 toggle.addEventListener('click',togglePlayback);
 fullscreen.addEventListener('click',toggleFullscreen);
 document.addEventListener('fullscreenchange',updateFullscreen);
 document.addEventListener('webkitfullscreenchange',updateFullscreen);
 video.addEventListener('webkitbeginfullscreen',()=>{nativeFullscreen=true;updateFullscreen()});
 video.addEventListener('webkitendfullscreen',()=>{nativeFullscreen=false;updateFullscreen()});
 play.addEventListener('click',()=>resume(true));
 seek.addEventListener('pointerdown',event=>{touchSeeking=event.pointerType!=='mouse';seeking=true;resumeAfterSeek=!video.paused;pauseAutomatically();film.classList.add('is-seeking');clearTimeout(touchTimer)});
 seek.addEventListener('input',()=>{video.currentTime=Number(seek.value);updateTime()});
 seek.addEventListener('change',finishSeek);
 addEventListener('pointerup',finishSeek);addEventListener('pointercancel',finishSeek);
 film.addEventListener('pointerup',event=>{if(event.pointerType!=='mouse')revealTouch()});
 film.addEventListener('keydown',event=>{
  if(event.target!==film)return;
  if(event.code==='Space'||event.code==='Enter'){event.preventDefault();togglePlayback()}
 });
 for(const event of ['loadedmetadata','durationchange','timeupdate','seeked'])video.addEventListener(event,updateTime);
 video.addEventListener('loadedmetadata',()=>{
  if(restoreTime&&Number.isFinite(video.duration)){video.currentTime=Math.min(savedTime,Math.max(0,video.duration-.1));restoreTime=false;updateTime()}
 });
 video.addEventListener('canplay',()=>resume());
 video.addEventListener('play',()=>{
  if(nativeFullscreen||video.webkitDisplayingFullscreen){userPaused=false;select(player)}
  if(!selected||document.hidden||userPaused){pauseAutomatically();return}
  updatePlayback();
 });
 video.addEventListener('pause',()=>{
  if(automaticPauseEvents>0)automaticPauseEvents--;
  else if(nativeFullscreen||video.webkitDisplayingFullscreen)userPaused=true;
  updatePlayback();
 });
 video.addEventListener('playing',()=>{
  if(!selected||document.hidden||userPaused||seeking){pauseAutomatically();return}
  policyBlocked=false;abortRetries=0;play.hidden=true;clearError();state('playing');
 });
 video.addEventListener('waiting',()=>{if(selected&&!userPaused){state('loading');status.textContent='视频缓冲中…';status.style.display='block'}});
 video.addEventListener('volumechange',updateSound);
 video.addEventListener('error',()=>{if(!loaded)return;playAttempt++;playPending=false;clearTimeout(retryTimer);showError()});
 addEventListener('pagehide',()=>{pauseAutomatically();clearTimeout(touchTimer)});
 const player={
  film,video,resume,
  priority(){
   if(userPaused)return -1;
   if(seeking)return selected&&inViewport?20:-1;
   if(isFullscreen())return 10;
   if(manualPlayback&&inViewport)return 4+ratio;
   return visible||selected&&ratio>=.15?ratio:-1;
  },
  intersect(entry){
   ratio=entry.isIntersecting?entry.intersectionRatio:0;inViewport=ratio>0;visible=ratio>=.25;
   if(inViewport&&!document.hidden)clearTimeout(releaseTimer);
   else if(!inViewport){manualPlayback=false;film.classList.remove('is-touch-controls');if(loaded){clearTimeout(releaseTimer);releaseTimer=setTimeout(release,1500)}}
  },
  activate(value){
   selected=value;
   if(value){abortRetries=0;policyBlocked=false;clearTimeout(releaseTimer);if(!manualPlayback&&!isFullscreen()){video.muted=true;updateSound()}}
   else{
    pauseAutomatically();video.preload='none';
    if(!video.error){play.hidden=true;status.textContent='';status.style.display='';state('paused')}
    if(!inViewport||document.hidden){clearTimeout(releaseTimer);releaseTimer=setTimeout(release,1500)}
   }
  },
  retryGesture(){if(policyBlocked||video.paused)resume(false,true)},
  update(arrival){
 // Share the existing scene dissolve so the frame unfolds visibly as this screen arrives.
  const progress=reduced.matches||compact.matches?1:Math.min(1,Math.max(0,(arrival-.18)/.78));
  const eased=progress*progress*(3-2*progress);
  if(eased===lastArrival||eased>0&&eased<1&&Math.abs(eased-lastArrival)<.0001)return;lastArrival=eased;
  film.style.transform=`rotateY(${-12*(1-eased)}deg) rotateX(${4*(1-eased)}deg) scale(${.87+.13*eased})`;
  film.style.willChange=eased>0&&eased<1?'transform':'auto';
  film.style.setProperty('--film-edge',String(1-eased));
  }
 };
 updateTime();updateSound();updatePlayback();state('idle');
 // The coordinator is populated after construction; do not select from here.
 fullscreen.setAttribute('aria-pressed','false');fullscreen.setAttribute('aria-label','全屏播放');fullscreen.title='全屏播放';
 return player;
}
