(()=>{
 'use strict';
 const root=document.documentElement;
 const panels=[...document.querySelectorAll('[data-page-panel]')];
 const dock=[...document.querySelectorAll('.section-dock a')];
 const header=document.querySelector('.fx-header');
 const nav=header?.querySelector('.top-nav');
 const toggle=header?.querySelector('.fx-nav-toggle');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const mobile=matchMedia('(max-width:760px)');
 let pending=0,lastWidth=innerWidth,activePanel=0;

 if(header&&nav&&toggle){
  const label=toggle.querySelector('.fx-nav-label');
  let isOpen=false,background=[];
  const focusables=()=>[...header.querySelectorAll('a[href],button:not([disabled])')];
  function setMenu(open,restoreFocus=true){
   const next=Boolean(open&&mobile.matches),wasOpen=isOpen;
   if(next&&!wasOpen){
    background=[...document.body.children]
     .filter(element=>element!==header&&!['SCRIPT','STYLE','LINK'].includes(element.tagName))
     .map(element=>[element,element.inert]);
    background.forEach(([element])=>{element.inert=true});
   }else if(!next&&wasOpen){
    background.forEach(([element,inert])=>{element.inert=inert});
    background=[];
   }
   isOpen=next;
   header.classList.toggle('is-menu-open',isOpen);
   root.classList.toggle('fx-nav-open',isOpen);
   nav.inert=mobile.matches&&!isOpen;
   toggle.setAttribute('aria-expanded',String(isOpen));
   toggle.setAttribute('aria-label',isOpen?'关闭主导航':'打开主导航');
   if(label)label.textContent=isOpen?'关闭':'菜单';
   if(wasOpen&&!isOpen&&restoreFocus&&mobile.matches)toggle.focus({preventScroll:true});
  }
  toggle.hidden=false;
  header.classList.add('is-nav-ready');
  setMenu(false,false);
  toggle.addEventListener('click',()=>setMenu(!isOpen));
  header.addEventListener('click',event=>{
   if(!isOpen)return;
   if(event.target.closest('a[href]')||event.target===header)setMenu(false);
  });
  document.addEventListener('keydown',event=>{
   if(!isOpen)return;
   if(event.key==='Escape'){
    event.preventDefault();event.stopPropagation();setMenu(false);return;
   }
   if(event.key!=='Tab')return;
   const items=focusables(),first=items[0],last=items[items.length-1];
   if(event.shiftKey&&(document.activeElement===first||!header.contains(document.activeElement))){
    event.preventDefault();last?.focus({preventScroll:true});
   }else if(!event.shiftKey&&(document.activeElement===last||!header.contains(document.activeElement))){
    event.preventDefault();first?.focus({preventScroll:true});
   }
  });
  mobile.addEventListener('change',()=>{
   const focused=document.activeElement,focusInMenu=nav.contains(focused),wasOpen=isOpen;
   setMenu(false,false);
   if(mobile.matches&&focusInMenu)toggle.focus({preventScroll:true});
   else if(!mobile.matches&&(focused===toggle||wasOpen)){
    (nav.querySelector('[aria-current]')||nav.querySelector('a'))?.focus({preventScroll:true});
   }
  });
  addEventListener('pagehide',()=>setMenu(false,false));
 }

 function update(){
  pending=0;
  const center=scrollY+innerHeight*.5;
  panels.forEach((panel,index)=>{if(!panel.hidden&&center>=panel.offsetTop)activePanel=index});
  if(dock.length&&!document.querySelector('[data-page-dock]')){
   const id=panels[activePanel]?.id;
   dock.forEach(link=>{if(link.hash==='#'+id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current')});
  }
  for(const panel of panels){
   const rect=panel.getBoundingClientRect();
   if(rect.top<innerHeight*.85&&rect.bottom>innerHeight*.12)panel.classList.add('is-visible');
  }
 }
 function schedule(){if(!pending)pending=requestAnimationFrame(update)}
 if(panels.length){
  root.style.setProperty('--screen-height',innerHeight+'px');
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',()=>{
   const previous=panels[activePanel],width=innerWidth;
   root.style.setProperty('--screen-height',innerHeight+'px');
   // Mobile browser chrome and keyboards change height while reading. Never
   // turn those resizes into navigation; only re-align a genuine desktop resize.
   if(width>760&&lastWidth>760&&Math.abs(lastWidth-width)>32&&previous&&panels.length>1&&!document.activeElement?.closest('form')){
    previous.scrollIntoView({behavior:'instant',block:'start'});
   }
   lastWidth=width;
   schedule();
  });
  update();
 }
 document.querySelectorAll('.section-dock a').forEach(link=>link.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  if(link.closest('[data-page-dock]'))return;
  const target=document.getElementById(link.hash.slice(1));
  if(!target)return;
  event.preventDefault();history.replaceState(null,'',link.hash);
  target.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});
 }));
})();
