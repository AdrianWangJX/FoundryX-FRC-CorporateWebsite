'use strict';
// Lifecycle only: native-like media promises and a deterministic clock, no browser driver.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const lifecyclePath=process.env.WELCOME_LIFECYCLE_PATH||path.resolve(__dirname,'../src/welcome/lifecycle.js');
assert(path.isAbsolute(lifecyclePath));
const source=fs.readFileSync(lifecyclePath,'utf8');
assert(!/^import\s/m.test(source),'The welcome film must not import the CAD renderer or its loaders');
const flush=()=>new Promise(setImmediate);
function fixture(options={}){
  let now=0,nextId=0,overlay,fetches=0,playIntent=false,resolvePlay,rejectPlay,stalled=!!options.stalled;
  const timers=new Map(),events=new Map(),emitted=[];
  const media={matches:!!options.reduced};
  const event=(type,extra={})=>({type,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},...extra});
  const classes=()=>{const s=new Set();return {add:(...xs)=>xs.forEach(x=>s.add(x)),remove:(...xs)=>xs.forEach(x=>s.delete(x)),contains:x=>s.has(x),replace(a,b){if(!s.delete(a))return false;s.add(b);return true;}};};
  class Element{
    constructor(tag='SPAN'){this.tagName=tag;this.inert=false;this.style={};this.attrs={};this.dataset={};this.listeners=new Map();this.classList=classes();this.complete=true;this.naturalWidth=tag==='IMG'?1280:0;}
    setAttribute(k,v){this.attrs[k]=v;}
    removeAttribute(k){delete this.attrs[k];if(k==='src')this.src='';}
    addEventListener(type,fn,config){const list=this.listeners.get(type)||[];list.push({fn,once:!!config?.once});this.listeners.set(type,list);}
    removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(x=>x.fn!==fn));}
    emit(type,extra={}){const e=event(type,extra);for(const item of [...(this.listeners.get(type)||[])]){item.fn(e);if(item.once)this.removeEventListener(type,item.fn);}return e;}
    focus(){document.activeElement=this;}
    remove(){this.removed=true;}
    showModal(){this.open=true;}
  }
  const video=new Element('VIDEO'),poster=new Element('IMG'),logo=new Element('IMG');
  const choices=new Element('DIV'),loading=new Element('SPAN'),languages=[];
  const buttons=['zh','en'].map(lang=>{
    const button=new Element('BUTTON');button.dataset.entryLanguage=lang;return button;
  });
  choices.querySelectorAll=()=>buttons;
  if(options.delayedPoster){poster.complete=false;poster.naturalWidth=0;}
  Object.assign(video,{currentTime:0,duration:2,readyState:0,paused:true,ended:false,plays:0,loads:0});
  function startMedia(){
    if(!playIntent||video.readyState<3||options.playPending)return;
    video.paused=false;video.ended=false;
    const resolve=resolvePlay;resolvePlay=rejectPlay=undefined;
    if(options.playingEvent!==false)video.emit('playing');
    resolve?.();
  }
  function ready(){video.readyState=4;video.emit('canplay');startMedia();}
  video.load=()=>{video.loads++;if(video.src&&!options.delayedCanplay)ready();else if(!video.src)video.readyState=0;};
  video.play=()=>{
    video.plays++;
    if(options.playThrow)throw Error('Play failed synchronously');
    if(options.playReject)return Promise.reject(Error('Playback rejected'));
    playIntent=true;
    const pending=new Promise((resolve,reject)=>{resolvePlay=resolve;rejectPlay=reject;});
    // Native play() before readiness remains pending and cannot advance the film.
    startMedia();return pending;
  };
  video.pause=()=>{
    video.paused=true;playIntent=false;
    const reject=rejectPlay;resolvePlay=rejectPlay=undefined;
    if(reject){const error=Error('Playback interrupted by pause');error.name='AbortError';reject(error);}
  };
  video.getVideoPlaybackQuality=()=>({totalVideoFrames:120,droppedVideoFrames:0});
  const nav=new Element('HEADER'),main=new Element('MAIN'),previousInert=new Element('ASIDE');previousInert.inert=true;
  const root=new Element('HTML');root.classList.add('fx-welcome-pending');
  const document={documentElement:root,hidden:false,body:{children:[nav,main,previousInert],append(el){overlay=el;this.children.push(el);}},
    getElementById:()=>null,createElement(tag){const el=new Element(tag.toUpperCase());el.querySelector=s=>({video,'.fx-welcome-poster':poster,'.fx-welcome-logo':logo,'.fx-welcome-choices':choices,'.fx-welcome-loading':loading})[s];return el;},
    querySelector:s=>s==='dialog[open] button'?null:s==='.fx-brand, .brand-logo'?nav:main,
    addEventListener:(t,fn)=>events.set(t,fn),removeEventListener:t=>events.delete(t),dispatchEvent(e){emitted.push(e.type);events.get(e.type)?.(e);}};
  const window={FXLanguage:{set(language){languages.push(language);}},scrolls:0,scrollTo(){this.scrolls++;}};
  const context={window,document,console,matchMedia:()=>media,
    fetch(){fetches++;throw Error('Native playback must not wait for a whole-file fetch');},
    URL:{createObjectURL(){throw Error('Native playback must not wait for a Blob');}},
    requestAnimationFrame(fn){const id=++nextId;if(options.frames!==false)timers.set(id,{at:now+16,fn:()=>fn(now)});return id;},cancelAnimationFrame:id=>timers.delete(id),
    setTimeout(fn,ms){const id=++nextId;timers.set(id,{at:now+ms,fn});return id;},clearTimeout:id=>timers.delete(id),performance:{now:()=>now},CustomEvent:class{constructor(type){this.type=type;}}};
  vm.runInNewContext(source,context,{filename:lifecyclePath});
  function clock(to){if(!video.paused&&!stalled&&video.readyState>=3)video.currentTime=Math.min(2,video.currentTime+(to-now)/1000);now=to;}
  function end(){video.currentTime=2;video.ended=true;video.paused=true;playIntent=false;if(options.endedEvent!==false)video.emit('ended');}
  return {root,window,document,overlay,video,poster,logo,buttons,choices,languages,loading,main,nav,previousInert,media,timers,events,emitted,
    get state(){return window.FoundryWelcome.state;},get fetches(){return fetches;},get now(){return now;},
    click:(lang='zh')=>buttons.find(button=>button.dataset.entryLanguage===lang).emit('click'),
    key(key,repeat=false,shiftKey=false){
      const e=event('keydown',{key,repeat,shiftKey});events.get('keydown')?.(e);
      if(!repeat&&!e.defaultPrevented&&['Enter',' '].includes(key)&&buttons.includes(document.activeElement))document.activeElement.emit('click');
    },
    hidden(){document.hidden=true;events.get('visibilitychange')?.();},ready,end,stall(value=true){stalled=value;},
    advance(to){
      assert(to>=now);
      while(true){
        const next=[...timers].filter(([,t])=>t.at<=to).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
        // Media completion is a native event, independent of animation frames.
        const mediaEnd=!video.paused&&!stalled&&!video.ended&&video.readyState>=3?now+(2-video.currentTime)*1000:Infinity;
        if(mediaEnd<=to&&mediaEnd<=(next?.[1].at??Infinity)){clock(mediaEnd);end();continue;}
        if(!next)break;
        clock(next[1].at);timers.delete(next[0]);next[1].fn();
      }
      clock(to);
    }};
}
function complete(f){
  assert.equal(f.state,'complete');assert.equal(f.overlay.removed,true);assert.equal(f.main.inert,false);assert.equal(f.previousInert.inert,true);
  assert(!f.root.classList.contains('fx-welcome-active'));assert(!f.root.classList.contains('fx-welcome-revealing'));
  assert.equal(f.document.activeElement,f.nav);assert.equal(f.events.size,0);assert.equal(f.timers.size,0);
  assert.deepEqual(f.emitted,['foundryx:welcome-logo','foundryx:welcome-complete']);
  assert.equal(f.fetches,0);assert.equal(f.video.paused,true);assert.equal(f.video.src,'');
}
const tests=[];const test=(name,run)=>tests.push({name,run});
test('Native MP4 preload shows the poster and remains idle until a click',async()=>{
  const f=fixture();await flush();assert.equal(f.state,'ready');assert.equal(f.fetches,0);assert.equal(f.video.src,'/assets/welcome-film/welcome-2s-red-x-fast.mp4');assert.equal(f.video.plays,0);assert.equal(f.video.muted,true);assert.equal(f.video.playsInline,true);assert(f.poster.classList.contains('is-ready'));assert.equal(f.main.inert,true);assert.equal(f.document.activeElement,f.overlay);assert(f.overlay.innerHTML.includes('/assets/welcome-film/wire-20261004.png'));f.advance(60000);assert.equal(f.state,'ready');assert.equal(f.timers.size,0);
});
test('One click plays the complete two-second film and automatically enters',async()=>{
  const f=fixture();f.click();await flush();assert.equal(f.state,'playing');assert.equal(f.video.plays,1);assert(f.video.classList.contains('is-ready'));assert.equal(f.poster.style.opacity,'0');
  f.advance(1000);assert.equal(f.overlay.dataset.phase,'materialize');f.click();assert.equal(f.video.plays,1);f.advance(1999);assert.equal(f.state,'playing');f.advance(2350);complete(f);assert.equal(f.root.dataset.welcomeElapsed,'2000');assert.equal(JSON.parse(f.root.dataset.welcomePerformance).decodedFrames,120);assert.equal(f.logo.style.opacity,'0');
});
test('The completed logo stays fully visible for 200ms before revealing the homepage',async()=>{
  // Cover both the native ended event and the media-time rAF fallback.
  for(const endedEvent of [true,false]){
    const f=fixture({endedEvent});f.click();await flush();f.advance(2000);
    assert.equal(f.state,'logo-hold');assert.equal(f.overlay.dataset.phase,'logo-hold');assert.equal(f.video.currentTime,2);assert.equal(f.video.paused,true);
    assert(f.video.classList.contains('is-ready'));assert.equal(f.poster.style.opacity,'0');assert.equal(f.logo.style.opacity,'0');
    assert.equal(f.overlay.style.opacity??'1','1');assert(!f.root.classList.contains('fx-welcome-revealing'));assert.equal(f.main.inert,true);assert.deepEqual(f.emitted,[]);
    const timeline=JSON.parse(f.root.dataset.welcomeTimeline);assert.equal(timeline.logoHold,200);assert.equal(timeline.complete,2200);assert.equal(f.root.dataset.welcomeLogoHoldMs,'200');
    f.advance(2100);f.video.emit('ended');f.click();f.video.emit('playing');f.video.emit('error');
    f.advance(2199);assert.equal(f.state,'logo-hold');assert.equal(f.overlay.style.opacity??'1','1');assert(!f.root.classList.contains('fx-welcome-revealing'));assert.deepEqual(f.emitted,[]);assert.equal(f.video.plays,1);
    f.advance(2200);assert.equal(f.state,'entering');assert(f.root.classList.contains('fx-welcome-revealing'));assert.equal(f.root.dataset.welcomeLogoHoldElapsed,'200');assert.deepEqual(f.emitted,['foundryx:welcome-logo']);
    f.advance(2350);complete(f);assert.equal(f.root.dataset.welcomeElapsed,'2000');
  }
});
test('Escape during the logo hold clears its timer and cannot reveal the homepage twice',async()=>{
  const f=fixture();f.click();await flush();f.advance(2100);assert.equal(f.state,'logo-hold');f.key('Escape');complete(f);assert.equal(f.root.dataset.welcomeLogoHoldElapsed,undefined);f.advance(3000);f.video.emit('ended');await flush();complete(f);
});
test('An early click calls play immediately; first-frame loading does not consume the film',async()=>{
  const f=fixture({delayedCanplay:true});f.click();f.click();assert.equal(f.state,'waiting');assert.equal(f.video.plays,1);assert.equal(f.video.paused,true);
  for(const time of [1200,2500,3200]){f.advance(time);await flush();assert.equal(f.state,'waiting');assert.equal(f.video.currentTime,0);assert(!f.video.classList.contains('is-ready'));assert.equal(f.main.inert,true);}
  f.ready();await flush();assert.equal(f.state,'playing');assert.equal(f.root.dataset.welcomeMediaWaitMs,'3200');f.advance(5199);assert.equal(f.state,'playing');f.advance(5600);complete(f);assert.equal(f.root.dataset.welcomeElapsed,'2000');
});
test('A long idle preload has no deadline until the first language click',async()=>{
  const f=fixture({delayedCanplay:true});f.advance(60000);assert.equal(f.state,'loading');assert.equal(f.video.plays,0);assert.equal(f.timers.size,0);f.click();f.advance(63000);assert.equal(f.state,'waiting');f.ready();await flush();f.advance(64999);assert.equal(f.state,'playing');f.advance(65400);complete(f);
});
test('Playback beginning just before the inactivity boundary retains its full timeline',async()=>{
  const f=fixture({delayedCanplay:true});f.click();f.advance(3390);f.ready();await flush();f.advance(3400);assert.equal(f.state,'playing');f.advance(5389);assert.equal(f.state,'playing');f.advance(5900);complete(f);assert.equal(f.root.dataset.welcomeElapsed,'2000');assert.equal(f.root.dataset.welcomeError,undefined);
});
test('A recoverable pause shorter than the inactivity limit retains all media time',async()=>{
  const f=fixture();f.click();await flush();f.advance(500);f.stall();f.advance(3800);assert.equal(f.state,'playing');f.stall(false);f.advance(5299);assert.equal(f.state,'playing');f.advance(5700);complete(f);assert.equal(f.root.dataset.welcomeElapsed,'2000');assert.equal(f.root.dataset.welcomeError,undefined);
});
test('A permanent playback stall releases the page within four seconds without progress',async()=>{
  const f=fixture();f.click();await flush();f.advance(500);f.stall();f.advance(3899);assert.equal(f.state,'playing');f.advance(3900);assert.equal(f.state,'fallback');assert.equal(f.root.dataset.welcomeError,'Welcome video playback stalled');f.advance(4500);complete(f);assert(Number(f.root.dataset.welcomeTotalElapsed)-500<=4000);
});
test('Repeated readiness events cannot extend the frozen-playback safeguard',async()=>{
  const f=fixture({stalled:true});f.click();await flush();f.advance(3300);for(const event of ['playing','canplay','progress','waiting','stalled'])f.video.emit(event);f.advance(3400);assert.equal(f.state,'fallback');f.advance(4000);complete(f);
});
test('A pending play promise retains the poster and releases the page within four seconds',async()=>{
  const f=fixture({playPending:true});f.click();await flush();f.advance(3399);assert.equal(f.state,'waiting');assert(!f.video.classList.contains('is-ready'));assert(f.poster.classList.contains('is-ready'));assert.equal(f.video.currentTime,0);f.advance(3400);assert.equal(f.state,'fallback');await flush();f.advance(4000);complete(f);assert.equal(f.root.dataset.welcomeError,'Welcome video load timed out');
});
test('A no-frame waiting state and a false playing event share the same inactivity budget',async()=>{
  const f=fixture({delayedCanplay:true,stalled:true});f.click();f.advance(3200);f.ready();await flush();assert.equal(f.state,'playing');f.advance(3400);assert.equal(f.state,'fallback');f.advance(4000);complete(f);
});
test('A timeout ignores late canplay, playing, and ended events',async()=>{
  const f=fixture({delayedCanplay:true});f.click();f.advance(3400);assert.equal(f.state,'fallback');f.ready();f.video.emit('playing');f.video.emit('ended');await flush();assert.equal(f.state,'fallback');assert.equal(f.video.paused,true);f.advance(4000);complete(f);f.video.emit('playing');f.video.emit('ended');await flush();complete(f);
});
test('Native load failure before a click provides a one-click fallback',async()=>{
  const f=fixture({delayedCanplay:true});f.video.emit('error');assert.equal(f.state,'ready');assert.equal(f.overlay.dataset.renderer,'fallback');f.advance(30000);assert.equal(f.state,'ready');f.click();f.advance(30500);complete(f);assert.equal(f.video.plays,0);assert.equal(f.root.dataset.welcomeError,'Welcome video unavailable');
});
test('Video errors while loading or playing never require a second click',async()=>{
  for(const delayedCanplay of [true,false]){const f=fixture({delayedCanplay});f.click();await flush();f.advance(700);f.video.emit('error');await flush();assert.equal(f.state,'fallback');f.advance(1200);complete(f);assert.equal(f.root.dataset.welcomeError,'Welcome video unavailable');}
});
test('Synchronous play failure and rejected play promises safely release the page',async()=>{
  for(const options of [{playThrow:true},{playReject:true}]){const f=fixture(options);f.click();await flush();assert.equal(f.state,'fallback');f.advance(500);complete(f);assert(f.root.dataset.welcomeError);}
});
test('A resolved play promise can reveal playback even if the playing event is absent',async()=>{
  const f=fixture({delayedCanplay:true,playingEvent:false});f.click();f.advance(3000);f.ready();assert.equal(f.state,'waiting');await flush();assert.equal(f.state,'playing');f.advance(5400);complete(f);
});
test('Reduced motion loads no film and still takes one Enter press',async()=>{
  const f=fixture({reduced:true});assert.equal(f.state,'ready');assert.equal(f.video.src,undefined);assert.equal(f.video.loads,0);f.key('Tab');f.key('Enter');f.advance(250);complete(f);assert.equal(f.video.plays,0);
});
test('Reduced motion enabled after preload uses the short fallback on click',async()=>{
  const f=fixture();f.media.matches=true;f.click();f.advance(250);complete(f);assert.equal(f.video.plays,0);
});
test('Background clicks, Escape and dialog cancel cannot bypass language selection',async()=>{
  const f=fixture({delayedCanplay:true});
  f.overlay.emit('click');f.key('Escape');f.key('Enter');f.overlay.emit('cancel');
  assert.equal(f.state,'loading');assert.equal(f.video.plays,0);assert.deepEqual(f.languages,[]);
  f.click('en');assert.deepEqual(f.languages,['en']);assert.equal(f.loading.textContent,'Loading animation…');
  f.key('Escape');complete(f);f.ready();f.video.emit('playing');await flush();complete(f);
});
test('Escape during playback immediately releases inert state without duplicate events',async()=>{
  const f=fixture();f.click();await flush();f.advance(500);f.key('Escape');complete(f);f.video.emit('ended');f.overlay.emit('cancel');complete(f);
});
test('Keyboard users can cycle both languages in either direction and choose exactly once',async()=>{
  const f=fixture();f.key('Tab',false,true);assert.equal(f.document.activeElement,f.buttons[1]);
  f.key('Tab');assert.equal(f.document.activeElement,f.buttons[0]);
  f.key('Tab');assert.equal(f.document.activeElement,f.buttons[1]);
  f.key(' ');f.click('zh');await flush();
  assert.deepEqual(f.languages,['en']);assert(f.choices.inert);assert.equal(f.video.plays,1);f.advance(2400);complete(f);
});
test('Hidden playback and native dialog cancel cannot leave the site blocked',async()=>{
  const f=fixture();f.click();await flush();f.hidden();complete(f);
  const g=fixture({delayedCanplay:true});g.click();const e=g.overlay.emit('cancel');assert(e.defaultPrevented);await flush();complete(g);
});
test('Native ended plus the fade safeguard enters even when no animation frames run',async()=>{
  const f=fixture({frames:false});f.click();await flush();f.advance(1999);assert.equal(f.state,'playing');f.advance(2000);assert.equal(f.state,'logo-hold');f.advance(2199);assert.equal(f.state,'logo-hold');f.advance(2200);assert.equal(f.state,'entering');f.advance(2420);complete(f);assert.equal(f.root.dataset.welcomeElapsed,'2000');assert.equal(f.root.dataset.welcomeLogoHoldElapsed,'200');
});
test('Loading, stalled playback, and media errors all finish even without animation frames',async()=>{
  for(const options of [{frames:false,delayedCanplay:true},{frames:false,stalled:true},{frames:false,playReject:true}]){const f=fixture(options);f.click();await flush();f.advance(4000);await flush();complete(f);assert(f.root.dataset.welcomeError);}
});
test('A late poster load cannot cover an already playing film',async()=>{
  const f=fixture({delayedPoster:true});f.click();await flush();f.poster.emit('load');assert.equal(f.poster.style.opacity,'0');assert(f.video.classList.contains('is-ready'));f.advance(2400);complete(f);
});
(async()=>{let failed=0;for(const {name,run}of tests){try{await run();console.log('PASS: '+name);}catch(error){failed++;console.error('FAIL: '+name+'\n'+error.stack);}}console.log(`${tests.length-failed}/${tests.length} lifecycle scenarios passed (${lifecyclePath}).`);if(failed)process.exitCode=1;})().catch(error=>{console.error(error);process.exitCode=1;});
