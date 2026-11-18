import React, {useState, useEffect, useRef, useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import CircularGallery from './components/CircularGallery';
import Threads from './components/Threads';
gsap.registerPlugin(ScrollTrigger);

const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let paused=reduced.matches;
const mm=gsap.matchMedia();
let story;
let storyViewportActive=false,restoringChapter=false,resumeChapter=null;
const pinViewport=matchMedia('(min-width: 768px) and (min-height: 650px)');
const chapters=[...document.querySelectorAll('[data-chapter]')];
const track=document.querySelector('.frc-track');
const setChapter=i=>{chapters.forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));document.querySelector('.frc-pin')?.style.setProperty('--chapter',i);};
function setupMotion(){
  document.body.classList.toggle('motion-paused',paused);
  document.documentElement.classList.toggle('motion-paused',paused);
  document.dispatchEvent(new CustomEvent('foundryx:motion',{detail:{paused}}));
  if(!track)return;
  const prior=Math.max(0,chapters.findIndex(b=>b.getAttribute('aria-pressed')==='true'));
  const pin=document.querySelector('.frc-pin'),box=pin.getBoundingClientRect(),inStory=box.top<=20&&box.bottom>0;
  mm.revert(); story=null;
  if(paused){
    track.scrollLeft=prior*track.clientWidth;setChapter(prior);
    document.querySelector('.route-live').style.strokeDashoffset=1-prior/2;
    if(inStory)pin.scrollIntoView({block:'start',behavior:'instant'});
    return;
  }
  mm.add('(min-width: 768px) and (min-height: 650px)',()=>{
    const currentChapter=resumeChapter??Math.max(0,chapters.findIndex(b=>b.getAttribute('aria-pressed')==='true'));
    const currentBox=pin.getBoundingClientRect(),currentlyInStory=resumeChapter!==null||(currentBox.top<=120&&currentBox.bottom>0);
    resumeChapter=null;
    gsap.to('.hero-signature',{xPercent:-9,ease:'none',scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:.7}});
    gsap.from('.manifesto h2',{xPercent:-4,ease:'none',scrollTrigger:{trigger:'.manifesto',start:'top bottom',end:'center center',scrub:1}});
    track.classList.add('is-pinned');
    track.scrollLeft=0;
    const tween=gsap.to(track,{x:()=>-(track.scrollWidth-innerWidth),ease:'none',scrollTrigger:{
      trigger:'.frc-pin',start:'top top',end:()=>'+='+innerWidth*1.65,pin:true,scrub:.55,
      invalidateOnRefresh:true,onUpdate:s=>{if(!pinViewport.matches)return;setChapter(Math.round(s.progress*2));document.querySelector('.route-live').style.strokeDashoffset=1-s.progress;const r=pin.getBoundingClientRect();storyViewportActive=r.top<=20&&r.bottom>0;}
    }});
    story=tween.scrollTrigger;

    if(currentlyInStory)requestAnimationFrame(()=>{if(story)window.scrollTo({top:story.start+(story.end-story.start)*currentChapter/2,behavior:'instant'});});
    return ()=>{
      const chapter=Math.max(0,chapters.findIndex(b=>b.getAttribute('aria-pressed')==='true'));
      const retainViewport=storyViewportActive;restoringChapter=true;
      resumeChapter=retainViewport?chapter:null;
      track.classList.remove('is-pinned');story=null;
      requestAnimationFrame(()=>{
        restoringChapter=false;if(track.classList.contains('is-pinned'))return;
        track.scrollLeft=chapter*track.clientWidth;setChapter(chapter);
        document.querySelector('.route-live').style.strokeDashoffset=1-chapter/2;
        if(retainViewport)pin.scrollIntoView({block:'start',behavior:'instant'});
      });
    };
  });
}
reduced.addEventListener('change',e=>{paused=e.matches;setupMotion();});
chapters.forEach((b,i)=>b.addEventListener('click',()=>{
  if(story){ScrollTrigger.refresh();window.scrollTo({top:story.start+(story.end-story.start)*i/2,behavior:'instant'});}
  else track.scrollTo({left:i*track.clientWidth,behavior:paused?'instant':'smooth'});
  setChapter(i);
}));
track?.addEventListener('scroll',()=>{if(!story&&!restoringChapter)setChapter(Math.round(track.scrollLeft/track.clientWidth));},{passive:true});
window.addEventListener('scroll',()=>{if(pinViewport.matches||restoringChapter||resumeChapter===null)return;const r=document.querySelector('.frc-pin')?.getBoundingClientRect();if(r&&(r.bottom<=0||r.top>=innerHeight))resumeChapter=null;},{passive:true});
setupMotion();
document.fonts.ready.then(()=>ScrollTrigger.refresh());

const scenes=[
  ['assets/photos/frc-260502jef2663.webp','2026 FIRST Championship 赛场全景'],
  ['assets/photos/frc-260430ben00185.webp','2026 FIRST Championship 机器人比赛'],
  ['assets/photos/frc-260430ben00375.webp','2026 FIRST Championship 学生携控制台走向赛场']
];
const hero=document.querySelector('.hero'),photo=document.querySelector('#hero-image');
if(photo&&hero){
const alternate=photo.cloneNode();alternate.removeAttribute('id');alternate.alt='';alternate.setAttribute('aria-hidden','true');alternate.classList.add('hero-image-next');photo.after(alternate);
let sceneIndex=0,sceneTimer=0,sceneRequest=0,heroVisible=true;
function scheduleScene(){clearTimeout(sceneTimer);if(!paused&&!document.hidden&&heroVisible&&!hero.contains(document.activeElement))sceneTimer=setTimeout(nextScene,3000);}
function stopScene(){clearTimeout(sceneTimer);sceneRequest++;gsap.killTweensOf(alternate);gsap.set(alternate,{opacity:0});}
async function nextScene(){
  const request=++sceneRequest,next=(sceneIndex+1)%scenes.length,[src,alt]=scenes[next];
  const preload=new Image();preload.src=src;try{await preload.decode();}catch{scheduleScene();return;}
  if(request!==sceneRequest||paused||document.hidden||!heroVisible)return;
  alternate.src=src;
  gsap.fromTo(alternate,{opacity:0},{opacity:1,duration:.65,ease:'power1.inOut',onComplete:()=>{photo.src=src;photo.alt=alt;sceneIndex=next;gsap.set(alternate,{opacity:0});scheduleScene();}});
}
new IntersectionObserver(([entry])=>{heroVisible=entry.isIntersecting;stopScene();scheduleScene();},{threshold:.15}).observe(hero);
document.addEventListener('visibilitychange',()=>{stopScene();scheduleScene();});
document.addEventListener('foundryx:motion',()=>{stopScene();scheduleScene();});
hero.addEventListener('focusin',stopScene);hero.addEventListener('focusout',()=>queueMicrotask(scheduleScene));

}
const items=[
  {image:'assets/photos/frc-260501ben00279.webp',alt:'赛场边专注的队员'},
  {image:'assets/photos/frc-260501dan1761.webp',alt:'挥舞旗帜的队伍'},
  {image:'assets/photos/frc-260430dan0642.webp',alt:'围绕电脑协作的队员与导师'},
  {image:'assets/photos/frc-260502dan1512.webp',alt:'队伍旗帜与场馆灯光'},
  {image:'assets/photos/frc-260502dan2231.webp',alt:'场边的队员与空中的黄色比赛球'},
  {image:'assets/photos/frc-260501ben00110.webp',alt:'维修区的队员检查机器人'},
  {image:'assets/photos/frc-260502dan1685.webp',alt:'比赛中的机器人和黄色比赛球'},
  {image:'assets/photos/frc-260430ben00164.webp',alt:'驾驶站的队员'},
  {image:'assets/photos/frc-260430ben00629.webp',alt:'队员合作调试电脑程序'},
  {image:'assets/photos/frc-260430ben00495.webp',alt:'机器人维修区的协作'},
  {image:'assets/photos/frc-260430ben00321.webp',alt:'驾驶站的队员专注于控制系统'},
  {image:'assets/photos/frc-260430dan0441.webp',alt:'检查机器人机构的队员'}
].map(x=>({...x,text:''}));
function Gallery(){
  const ref=useRef(null), [visible,setVisible]=useState(false), [motion,setMotion]=useState(!paused), [ready,setReady]=useState(false),[failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false);
  const onReady=useCallback(()=>setReady(true),[]),onFailure=useCallback(()=>setFailed(true),[]);
  useEffect(()=>{
    const observer=new IntersectionObserver(([e])=>setVisible(e.isIntersecting),{rootMargin:'200px'});observer.observe(ref.current);
    const listener=e=>setMotion(!e.detail.paused);document.addEventListener('foundryx:motion',listener);
    const hidden=()=>setVisible(!document.hidden && ref.current.getBoundingClientRect().bottom>0 && ref.current.getBoundingClientRect().top<innerHeight+200);
    document.addEventListener('visibilitychange',hidden);
    return()=>{observer.disconnect();document.removeEventListener('foundryx:motion',listener);document.removeEventListener('visibilitychange',hidden);};
  },[]);
  useEffect(()=>{if(!visible||loaded)return;let alive=true;Promise.all(items.map(({image})=>new Promise(resolve=>{const i=new Image();i.onload=resolve;i.onerror=resolve;i.src=image;}))).then(()=>{if(alive)setLoaded(true);});return()=>{alive=false;};},[visible,loaded]);
  const live=visible&&motion&&loaded&&!failed;
  useEffect(()=>{if(!live)setReady(false);},[live]);
  return <div ref={ref} className={'gallery-shell'+(live&&ready?' live':'')}>
    <div className="gallery-fallback" tabIndex={live&&ready?-1:0} aria-label="FRC 赛事照片">
      {items.map(x=><figure key={x.image}><img src={x.image} alt={x.alt} loading="lazy" width="1200" height="800"/></figure>)}
    </div>
    {live&&<CircularGallery items={items} bend={1.3} borderRadius={0} font="14px Sora" scrollSpeed={1.6} scrollEase={.07} onReady={onReady} onFailure={onFailure}/>}
  </div>;
}
if(document.querySelector('#moments-root'))createRoot(document.querySelector('#moments-root')).render(<Gallery/>);
['prev','next'].forEach((name,i)=>document.querySelector('#gallery-'+name)?.addEventListener('click',()=>{
  const shell=document.querySelector('.gallery-shell'),live=shell.querySelector('.circular-gallery'),direction=i?1:-1;
  if(live)live.dispatchEvent(new CustomEvent('gallery:navigate',{detail:direction}));
  else {const list=shell.querySelector('.gallery-fallback');list.scrollBy({left:direction*(list.querySelector('figure').offsetWidth+24),behavior:paused?'instant':'smooth'});}
}));

if(document.querySelector('#hero-field'))createRoot(document.querySelector('#hero-field')).render(<Threads/>);
