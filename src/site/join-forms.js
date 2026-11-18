(()=>{'use strict';
 function createRequestId(){
  if(typeof globalThis.crypto?.randomUUID==='function')return crypto.randomUUID();
  // getRandomValues is available on HTTP too; randomUUID requires HTTPS.
  if(typeof globalThis.crypto?.getRandomValues!=='function')throw new Error('当前浏览器无法创建提交标识，请更换浏览器后重试。');
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
 }
 for(const form of document.querySelectorAll('[data-join-form]')){
  const status=form.querySelector('.join-status'),button=form.querySelector('[type="submit"]');
  let pending=false,requestId=null,submitted=false;
  // Browser validation bubbles follow the browser's locale unless we set their text.
  const requiredFields=[...form.querySelectorAll('[required]')];
  function updateValidation(field){
   field.setCustomValidity('');
   if(!field.validity.valueMissing)return;
   const message=field.type==='checkbox'?'请先同意保存信息并联系你。'
    :field.tagName==='SELECT'?'请选择一项。':'请填写此字段。';
   field.setCustomValidity(window.FXLanguage?.translate(message)??message);
  }
  form.addEventListener('invalid',event=>updateValidation(event.target),true);
  form.addEventListener('input',event=>event.target.setCustomValidity?.(''));
  document.addEventListener('fx:languagechange',()=>{
   requiredFields.filter(field=>field.validity.customError).forEach(updateValidation);
  });
  if(location.protocol==='file:'){
   const link=document.createElement('a');link.className='join-submit';link.innerHTML='<span>打开在线表单</span><svg class="fx-arrow fx-arrow--ne" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14"/></svg>';
   function updateOnlineLink(){
    const url=new URL('https://foundryx.xyz/join.html');
    url.searchParams.set('lang',document.documentElement.lang.startsWith('en')?'en':'zh');
    url.hash=form.dataset.joinForm;
    link.href=url.href;
   }
   updateOnlineLink();
   document.addEventListener('fx:languagechange',updateOnlineLink);
   button.replaceWith(link);
   status.textContent='本地文件不接收提交，请打开在线表单填写。';
   form.querySelectorAll('input,select,textarea').forEach(el=>el.disabled=true);continue;
  }
  form.addEventListener('input',()=>{if(!pending&&!submitted){status.textContent='';status.removeAttribute('data-error');requestId=null;}});
  form.addEventListener('submit',async e=>{
   e.preventDefault();if(pending||submitted||!form.reportValidity())return;
   const payload=Object.fromEntries(new FormData(form));payload.consent=payload.consent==='on';
   try{requestId??=createRequestId();payload.requestId=requestId;}
   catch(error){status.dataset.error='true';status.textContent=error.message;return;}
   pending=true;button.disabled=true;form.querySelectorAll('input,select,textarea').forEach(el=>el.disabled=true);button.firstElementChild.textContent='正在提交…';form.setAttribute('aria-busy','true');status.textContent='';status.removeAttribute('data-error');
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
   try{
    const response=await fetch('/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
    const result=await response.json().catch(()=>null);
    if(!response.ok||result?.id!==requestId)throw new Error(result?.error||'暂时未能确认提交，请稍后重试。已填写的内容会保留。');
    submitted=true;button.firstElementChild.textContent='已提交';
    status.textContent='已收到你的申请。FoundryX 会通过你留下的联系方式与你沟通。';
    form.querySelectorAll('input,select,textarea').forEach(el=>el.disabled=true);
   }catch(error){status.dataset.error='true';status.textContent=error.name==='AbortError'?'连接超时，暂时未能确认提交。请重试，系统会避免重复记录。':error instanceof TypeError?'网络连接异常，暂时未能确认提交。请检查网络后重试，已填写的内容会保留。':error.message;button.disabled=false;button.firstElementChild.textContent='重新提交';}
   finally{clearTimeout(timeout);pending=false;if(!submitted)form.querySelectorAll('input,select,textarea').forEach(el=>el.disabled=false);form.removeAttribute('aria-busy');}
  });
 }
})();

// On a phone, choose an application type before filling out one persistent form.
(()=>{'use strict';
 const panels=[...document.querySelectorAll('.join-document [data-page-panel]')];
 const dock=document.querySelector('.join-document .section-dock');
 if(!panels.length||!dock)return;
 const links=[...dock.querySelectorAll('a')],byId=new Map(panels.map(panel=>[panel.id,panel]));
 const viewport=matchMedia('(max-width: 760px)'),roots=[document.documentElement,document.body];
 const defaultId=byId.has('student')?'student':panels[0].id;
 const originalDockMarker=dock.getAttribute('data-page-dock');
 let mobile=false,selectedId=defaultId,desktopId=defaultId,scrollFrame=0;
 const hashId=()=>byId.has(location.hash.slice(1))?location.hash.slice(1):null;
 function scrollToSelection(){
  cancelAnimationFrame(scrollFrame);
  scrollFrame=requestAnimationFrame(()=>{
   if(mobile)window.scrollTo({top:0,left:0,behavior:'instant'});
   else byId.get(selectedId).scrollIntoView({behavior:'instant',block:'start'});
  });
 }
 function select(id,{scroll=true}={}){
  selectedId=byId.has(id)?id:defaultId;
  panels.forEach(panel=>{
   panel.hidden=mobile&&panel.id!==selectedId;
   if(panel.id===selectedId)panel.classList.add('is-visible');
  });
  links.forEach(link=>{
   if(link.hash==='#'+selectedId)link.setAttribute('aria-current','location');
   else link.removeAttribute('aria-current');
  });
  if(scroll)scrollToSelection();
 }
 function visibleDesktopId(){
  // The desktop scroll position can be newer than its last clicked hash.
  const center=innerHeight*.5;
  return panels.find(panel=>{
   const rect=panel.getBoundingClientRect();return rect.top<=center&&rect.bottom>center;
  })?.id||hashId()||selectedId;
 }
 function applyMode(initial=false){
  if(!initial&&mobile===viewport.matches)return;
  // Read the last desktop position before mobile CSS changes the panel heights.
  const id=initial?(hashId()||defaultId):(viewport.matches?desktopId:selectedId);
  mobile=viewport.matches;
  desktopId=id;
  roots.forEach(root=>root.classList.toggle('join-mobile-tabs-enabled',mobile));
  if(mobile){
   // chrome.js owns continuous desktop sections; these links navigate mobile forms.
   dock.setAttribute('data-page-dock','');
   if(!initial&&location.hash!=='#'+id)history.replaceState(history.state,'','#'+id);
  }else if(originalDockMarker===null)dock.removeAttribute('data-page-dock');
  else dock.setAttribute('data-page-dock',originalDockMarker);
  select(id,{scroll:mobile||!initial});
 }
 document.addEventListener('click',event=>{
  if(!mobile||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target.closest?.('.section-dock a');
  if(!link||!dock.contains(link)||!byId.has(link.hash.slice(1)))return;
  event.preventDefault();event.stopPropagation();
  const id=link.hash.slice(1);
  if(location.hash!==link.hash)history.pushState(history.state,'',link.hash);
  link.focus({preventScroll:true});
  select(id);
 },true);
 function restoreHistory(){
  if(!mobile)return;
  // A skip-to-content hash should keep the chosen form; an empty hash means the default.
  const id=hashId()||(!location.hash?defaultId:selectedId);
  select(id);
 }
 addEventListener('hashchange',restoreHistory);
 addEventListener('popstate',restoreHistory);
 addEventListener('scroll',()=>{if(!viewport.matches)desktopId=visibleDesktopId();},{passive:true});
 viewport.addEventListener('change',()=>applyMode());
 applyMode(true);
 // Cancel the browser's initial fragment jump after all deferred scripts have loaded.
 if(document.readyState!=='complete')addEventListener('load',()=>{if(mobile)scrollToSelection();},{once:true});
})();
