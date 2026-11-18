// Refreshing the homepage replays its welcome; document pages retain their route.
(()=>{
 const entry=performance.getEntriesByType?.('navigation')[0];
 if(entry?.type!=='reload')return;
 const home=new URL(__HOME_PATH__,location.href);
 home.search=location.search;home.hash='';
 if(/^https?:$/.test(home.protocol))home.pathname=home.pathname.replace(/index\.html$/,'');
 const here=new URL(location.href);
 const atHome=here.pathname===home.pathname||here.pathname===home.pathname+'index.html';
 if(atHome){
  history.replaceState(history.state,'',home.href);
  history.scrollRestoration='manual';
  // CSS enables smooth scrolling; a reload must reset before the first reveal.
  window.scrollTo({top:0,left:0,behavior:'instant'});
 }
})();
