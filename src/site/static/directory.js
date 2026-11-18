/* Presentation-independent directory query. The roster may grow without layout edits. */
((root)=>{'use strict';
const normalize=value=>String(value??'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
function query(records,{term='',kind='all',page=1,pageSize=12}={}){
 const words=normalize(term).split(' ').filter(Boolean),size=Math.max(1,Math.floor(pageSize)||12);
 const matches=records.filter(t=>(kind==='all'||t.kind===kind)&&words.every(w=>normalize([t.name,t.number,t.organization].join(' ')).includes(w)));
 const pages=Math.max(1,Math.ceil(matches.length/size)),current=Math.min(pages,Math.max(1,Math.floor(page)||1));
 return {items:matches.slice((current-1)*size,current*size),total:matches.length,pages,page:current};
}
root.TeamDirectory={query};
})(typeof window==='undefined'?globalThis:window);
