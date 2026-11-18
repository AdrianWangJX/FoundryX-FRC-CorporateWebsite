(()=>{'use strict';
 const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
 let track='all';
 const search=$('#knowledge-search');
 function filterKnowledge(){
  const query=(search?.value||'').normalize('NFKC').trim().toLocaleLowerCase();let count=0;
  $$('[data-track]').forEach(card=>{const matches=(track==='all'||card.dataset.track===track)&&(!query||card.dataset.search.normalize('NFKC').toLocaleLowerCase().includes(query));card.hidden=!matches;if(matches)count++;});
  if($('#knowledge-count'))$('#knowledge-count').textContent=`${count} 篇指南 · 按问题查找答案`;
  if($('#knowledge-empty'))$('#knowledge-empty').hidden=count!==0;
 }
 $$('[data-knowledge-track]').forEach(button=>button.addEventListener('click',()=>{track=button.dataset.knowledgeTrack;$$('[data-knowledge-track]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));filterKnowledge();}));
 search?.addEventListener('input',filterKnowledge);if(search)filterKnowledge();
 [['result','[data-result-category]'],['story','[data-story-category]']].forEach(([type,selector])=>{
  $$(`[data-${type}-filter]`).forEach(button=>button.addEventListener('click',()=>{
   const value=button.dataset[type+'Filter'];$$(`[data-${type}-filter]`).forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
   $$(selector).forEach(card=>card.hidden=value!=='all'&&card.dataset[type+'Category']!==value);
  }));
 });
})();
