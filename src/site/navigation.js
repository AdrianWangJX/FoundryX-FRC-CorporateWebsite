// Preserve ordinary multi-page navigation and offline HTML exports.
(()=>{
 'use strict';
 if(!/^https?:$/.test(location.protocol))return;
 // Only this host is known to serve extensionless HTML routes. Static hosts need filenames.
 const cleanRoutes=location.hostname==='foundryx-lab-2026.adrianwang020913.chatgpt.site';
 const canonical=href=>{const url=new URL(href,document.baseURI);if(url.origin!==location.origin)return null;if(cleanRoutes&&url.pathname.endsWith('/index.html'))url.pathname=url.pathname.slice(0,-10);else if(cleanRoutes&&url.pathname.endsWith('.html'))url.pathname=url.pathname.slice(0,-5);return url;};
 for(const a of document.querySelectorAll('a[href]')){const url=canonical(a.href);if(url)a.href=url.href;}
 const prefetched=new Set();
 function prefetch(event){
  const a=event.target.closest?.('.top-nav a,.section-dock a');
  if(!a||navigator.connection?.saveData||/2g/.test(navigator.connection?.effectiveType||''))return;
  const url=canonical(a.href);if(!url||url.pathname===location.pathname)return;url.hash='';
  if(prefetched.has(url.href))return;prefetched.add(url.href);
  const link=document.createElement('link');link.rel='prefetch';link.as='document';link.href=url.href;document.head.append(link);
 }
 document.addEventListener('pointerover',prefetch,{passive:true});
 document.addEventListener('focusin',prefetch);
 document.addEventListener('touchstart',prefetch,{passive:true});
})();
