(() => {
  'use strict';
  const root = document.documentElement;
  if (window.FoundryWelcome?.state === 'complete' || document.getElementById('fx-welcome')) return;
  // The approved 120-frame film owns playback. Limits below only protect
  // entry from a slow or failed network; no CAD renderer is loaded here.
  const DURATION = 2000, LOGO_HOLD = 200, ENTRY_FADE = 120, INACTIVITY_LIMIT = 3400, PROGRESS_CHECK = 100;
  const scale = DURATION / 5100;
  const timeline = {gold:1000*scale,formed:3000*scale,turnStart:3500*scale,rotated:4000*scale,settled:4500*scale,logoFormed:DURATION,logoHold:LOGO_HOLD,complete:DURATION+LOGO_HOLD,entryFade:ENTRY_FADE,inactivityLimit:INACTIVITY_LIMIT};
  const assets = {
    film: '/assets/welcome-film/welcome-2s-red-x-fast.mp4',
    wire: '/assets/welcome-film/wire-20261004.png',
    logo: '/assets/brand-logo-stanford-red.png'
  };
  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = (a,b,x) => {const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const overlay = document.createElement('dialog');
  overlay.id = 'fx-welcome';
  overlay.setAttribute('aria-label', '选择语言 / Choose a language');
  overlay.innerHTML = `
    <div class="fx-welcome-art" aria-hidden="true">
      <video class="fx-welcome-film" muted playsinline preload="auto" disablepictureinpicture disableremoteplayback></video>
      <img class="fx-welcome-poster" src="${assets.wire}" alt="" decoding="async" fetchpriority="high">
      <img class="fx-welcome-logo" width="1640" height="512" src="${assets.logo}" alt="">
    </div>
    <div class="fx-welcome-choices" translate="no">
      <button type="button" lang="zh-CN" data-entry-language="zh" aria-label="进入中文版"><span>中文</span></button>
      <span class="fx-welcome-divider" aria-hidden="true">/</span>
      <button type="button" lang="en" data-entry-language="en" aria-label="Enter in English"><span>English</span></button>
    </div>
    <span class="fx-welcome-loading" role="status"></span>`;
  const blocked = [...document.body.children].filter(el=>!['SCRIPT','STYLE','LINK'].includes(el.tagName)).map(el=>[el,el.inert]);
  document.body.append(overlay);
  const video = overlay.querySelector('video');
  const poster = overlay.querySelector('.fx-welcome-poster');
  const logo = overlay.querySelector('.fx-welcome-logo');
  const choices = overlay.querySelector('.fx-welcome-choices');
  const buttons = [...choices.querySelectorAll('button')];
  const loading = overlay.querySelector('.fx-welcome-loading');
  video.muted=true;video.defaultMuted=true;video.playsInline=true;
  let state='loading',ended=false,started=null,frame=0,deadline=0,progressTimer=0;
  let lastMediaTime=0,lastProgressAt=0;
  let logoHeldAt=0;
  let elapsed=0,failed=false,logoAnnounced=false,mediaShown=false;
  window.FoundryWelcome={state,duration:DURATION,inactivityLimit:INACTIVITY_LIMIT};
  function setState(next){state=next;window.FoundryWelcome.state=next;root.dataset.welcomeState=next;overlay.dataset.state=next;}
  function resetPageStart(){window.scrollTo({top:0,left:0,behavior:'instant'});}
  function announceLogo(){if(logoAnnounced)return;logoAnnounced=true;document.dispatchEvent(new CustomEvent('foundryx:welcome-logo'));}
  function stopMedia(){
    cancelAnimationFrame(frame);clearTimeout(progressTimer);clearTimeout(deadline);video.pause();
  }
  function finish(){
    if(ended)return;ended=true;setState('complete');clearTimeout(deadline);stopMedia();
    if(started!==null)root.dataset.welcomeTotalElapsed=String(Math.round(performance.now()-started));
    blocked.forEach(([el,inert])=>{el.inert=inert;});
    root.classList.remove('fx-welcome-pending','fx-welcome-active','fx-welcome-revealing');
    overlay.remove();document.removeEventListener('keydown',onKey,true);document.removeEventListener('visibilitychange',onVisibility);
    video.removeAttribute('src');video.load();
    const target=document.querySelector('dialog[open] button')||document.querySelector('.fx-brand, .brand-logo')||document.querySelector('main');
    target?.focus({preventScroll:true});resetPageStart();
    announceLogo();document.dispatchEvent(new CustomEvent('foundryx:welcome-complete'));
  }
  function holdLogo(){
    if(ended||state!=='playing')return;
    elapsed=DURATION;setState('logo-hold');stopMedia();
    // Freeze the completed logo at full opacity before the homepage fade.
    logoHeldAt=performance.now();overlay.dataset.phase='logo-hold';
    root.dataset.welcomeLogoHoldMs=String(LOGO_HOLD);
    deadline=setTimeout(()=>enter(true),LOGO_HOLD);
  }
  function enter(fromFilm=false){
    if(ended||state==='entering')return;
    setState('entering');stopMedia();
    root.dataset.welcomeElapsed=String(Math.round(elapsed));
    root.dataset.welcomeEntryWaitMs='0';
    if(fromFilm){
      root.dataset.welcomeLogoHoldElapsed=String(Math.round(performance.now()-logoHeldAt));
      // The film's final logo stays in place during entry, avoiding a size or
      // position jump when it meets the responsive homepage underneath.
      video.classList.add('is-ready');poster.style.opacity='0';logo.style.opacity='0';
      const quality=video.getVideoPlaybackQuality?.();
      root.dataset.welcomePerformance=JSON.stringify({renderer:'film-60fps',mediaElapsed:elapsed,decodedFrames:quality?.totalVideoFrames,droppedFrames:quality?.droppedVideoFrames});
    }else{video.classList.remove('is-ready');poster.style.opacity='0';logo.style.opacity='1';}
    overlay.dataset.phase='enter';root.classList.add('fx-welcome-revealing');resetPageStart();announceLogo();
    const began=performance.now(),duration=reduced.matches?100:ENTRY_FADE;
    deadline=setTimeout(finish,duration+100);
    const fade=now=>{if(ended)return;const ms=now-began;overlay.style.opacity=String(1-smooth(0,duration,ms));if(ms>=duration)finish();else frame=requestAnimationFrame(fade);};
    frame=requestAnimationFrame(fade);
  }
  function fallback(reason){
    if(ended||state==='logo-hold'||state==='entering'||state==='fallback')return;
    failed=true;stopMedia();overlay.dataset.renderer=reduced.matches?'reduced-motion':'fallback';
    if(reason){overlay.dataset.renderError=reason;root.dataset.welcomeError=reason;}
    video.classList.remove('is-ready');
    if(started===null){setState('ready');return;}
    setState('fallback');overlay.dataset.phase='fallback';
    const began=performance.now(),duration=reduced.matches?100:260;
    deadline=setTimeout(finish,duration+ENTRY_FADE+100);
    const fade=now=>{if(ended||state!=='fallback')return;const progress=clamp((now-began)/duration);poster.style.opacity=String(1-smooth(0,.8,progress));logo.style.opacity=String(smooth(.1,.9,progress));if(progress>=1)enter();else frame=requestAnimationFrame(fade);};
    frame=requestAnimationFrame(fade);
  }
  function updateMediaTime(){
    if(state!=='playing'||ended)return;
    elapsed=Math.min(DURATION,Math.max(0,video.currentTime*1000));
    overlay.dataset.phase=elapsed<timeline.gold?'gold':elapsed<timeline.formed?'materialize':elapsed<timeline.turnStart?'hold-before':elapsed<timeline.rotated?'metal':elapsed<timeline.settled?'hold-after':elapsed<DURATION?'dissolve':'logo';
    root.dataset.welcomeMediaElapsed=String(Math.round(elapsed));
    if(video.ended||elapsed>=DURATION){holdLogo();}else frame=requestAnimationFrame(updateMediaTime);
  }
  function checkProgress(){
    if(ended||!['waiting','playing'].includes(state))return;
    const now=performance.now(),mediaTime=video.currentTime;
    // Only actual playback time counts. Repeated canplay/playing/progress events
    // cannot keep a frozen movie blocking entry. Timers also work without rAF.
    if(mediaTime>lastMediaTime+.001){lastMediaTime=mediaTime;lastProgressAt=now;}
    if(now-lastProgressAt>=INACTIVITY_LIMIT){
      fallback(state==='waiting'?'Welcome video load timed out':'Welcome video playback stalled');return;
    }
    progressTimer=setTimeout(checkProgress,PROGRESS_CHECK);
  }
  function showFilm(){
    if(ended||!['waiting','playing'].includes(state))return;
    if(!mediaShown){
      setState('playing');mediaShown=true;
      root.dataset.welcomeMediaWaitMs=String(Math.round(performance.now()-started));
      // No wall-clock playback deadline: a movie that is advancing keeps its
      // entire two-second timeline, even when the first frame arrived late.
      frame=requestAnimationFrame(updateMediaTime);
    }
    video.classList.add('is-ready');poster.style.opacity='0';logo.style.opacity='0';
  }
  function playFilm(){
    if(ended||state!=='waiting'||failed)return;
    overlay.dataset.renderer='film-60fps';
    // Call in the click gesture, even while buffering. Native MP4 loading can
    // start at the fast-start header instead of waiting for a complete Blob.
    try{
      const request=video.play();
      request?.then(showFilm).catch(error=>fallback(error.message||'Video playback failed'));
    }catch(error){fallback(error.message||'Video playback failed');}
  }
  function start(language){
    if(started !== null || !['loading','ready'].includes(state)) return;
    started = performance.now();
    window.FXLanguage?.set(language);
    const english = language === 'en';
    overlay.setAttribute('aria-label', english ? 'Entering FoundryX' : '正在进入 FoundryX 网站');
    loading.textContent = english ? 'Loading animation…' : '动画加载中…';
    overlay.classList.add('is-playing');
    choices.inert = true;
    overlay.focus({preventScroll:true});
    root.dataset.welcomeTimeline=JSON.stringify(timeline);
    if(reduced.matches||failed){fallback();return;}
    setState('waiting');overlay.dataset.phase='loading';
    lastMediaTime=video.currentTime;lastProgressAt=performance.now();
    progressTimer=setTimeout(checkProgress,PROGRESS_CHECK);
    playFilm();
  }
  function onKey(event){
    if(event.key === 'Escape'){
      event.preventDefault();
      if(started !== null && !event.repeat) finish();
    } else if(event.key === 'Tab'){
      // Keep both choices reachable in either direction inside the modal.
      event.preventDefault();
      if(started !== null) return;
      const index = buttons.indexOf(document.activeElement);
      const next = index === -1 ? (event.shiftKey ? 1 : 0) : 1 - index;
      buttons[next].focus({preventScroll:true});
    }
  }
  function onVisibility(){if(document.hidden&&started!==null)finish();}
  video.addEventListener('canplay',()=>{
    if(ended||failed)return;
    if(state==='loading')setState('ready');
  });
  video.addEventListener('playing',showFilm);
  video.addEventListener('ended',holdLogo);
  video.addEventListener('error',()=>fallback('Welcome video unavailable'));
  poster.addEventListener('load',()=>{if(!ended)poster.classList.add('is-ready');});
  poster.addEventListener('error',()=>{if(!ended&&!mediaShown)logo.style.opacity='1';});
  if(poster.complete&&poster.naturalWidth)poster.classList.add('is-ready');
  buttons.forEach(button => button.addEventListener('click', () => start(button.dataset.entryLanguage)));
  overlay.addEventListener('cancel',event=>{event.preventDefault();if(started !== null)finish();});
  document.addEventListener('keydown',onKey,true);document.addEventListener('visibilitychange',onVisibility);
  blocked.forEach(([el])=>{el.inert=true;});
  root.classList.replace('fx-welcome-pending','fx-welcome-active');root.classList.add('fx-welcome-active');
  overlay.showModal();overlay.focus({preventScroll:true});resetPageStart();
  function load(){
    if(reduced.matches){setState('ready');overlay.dataset.renderer='reduced-motion';return;}
    video.src=assets.film;video.load();
  }
  load();
})();
