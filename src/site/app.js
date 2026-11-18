(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const teams=Array.isArray(window.FOUNDRYX_TEAMS)?window.FOUNDRYX_TEAMS:[];
const detail=$('#detail-dialog'),consult=$('#consult-dialog'),menu=$('#menu-dialog');let detailOpener=null,consultOpener=null,currentMode='student';const consultDrafts={student:{},school:{}};
function restoreFocus(opener){
 const visibleOpener=opener?.isConnected&&!opener.closest('dialog')&&opener.tabIndex>=0&&opener.getClientRects().length;
 const target=visibleOpener?opener:$$('.fx-brand,.header-contact,.menu-toggle').find(element=>element.getClientRects().length);
 target?.focus({preventScroll:true});
}
function closeDialogs(){[detail,consult,menu].forEach(d=>{if(d.open)d.close();});}
function showDetail(id,opener){const t=teams.find(t=>t.id===id);if(!t)return;detailOpener=opener||document.activeElement;closeDialogs();const c=$('#detail-content');c.innerHTML=`${t.logo?`<img class="team-detail-logo" src="${safe(t.logo)}" alt="${safe(t.name)}${t.logoPlaceholder?' 临时标识':' 队徽'}" width="150" height="150">`:''}<div class="team-detail-number">${safe(t.number)}</div><h2 id="detail-title">${safe(t.name)}</h2><div class="detail-specs"><div class="detail-spec"><strong>学校 / 机构</strong><p>${safe(t.organization)}</p></div><div class="detail-spec"><strong>参与安排</strong><p>${t.kind==='club'?'具体训练时间与参与方式，请在项目咨询时了解。':'校队的参与安排以所在学校为准。'}</p></div></div><button class="solid-button" data-consult="student" data-project="frc">项目咨询 <span aria-hidden="true"><svg class="fx-arrow fx-arrow--ne" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14"/></svg></span></button>`;detail.setAttribute('aria-labelledby','detail-title');detail.showModal();history.replaceState(null,'',`#view-${encodeURIComponent(id)}`);}
$$('[data-detail]').forEach(b=>b.addEventListener('click',()=>showDetail(b.dataset.detail,b)));
detail.addEventListener('close',()=>{
 if(location.hash.startsWith('#view-')){
  const section=detailOpener?.closest('#teams')||$('#programs')||$('main[id]');
  history.replaceState(null,'',location.pathname+location.search+(section?'#'+section.id:''));
 }
 if(!consult.open)restoreFocus(detailOpener);
});
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)d.close();}}));
$('.menu-toggle')?.addEventListener('click',()=>menu.showModal());$$('#menu-dialog a').forEach(a=>a.addEventListener('click',()=>menu.close()));
if($('#team-list')){
let teamState={term:'',kind:'all',page:1,pageSize:12};
function renderTeams(){const result=TeamDirectory.query(teams,teamState);teamState.page=result.page;const fragment=document.createDocumentFragment();result.items.forEach(t=>{const b=document.createElement('button');b.type='button';b.className='team-card';b.dataset.teamId=t.id;b.setAttribute('aria-label',`${t.number} ${t.name} ${t.organization}`);b.innerHTML=`<span class="team-card-top"><span class="team-card-number">${safe(t.number)}</span><span class="team-card-kind">${t.kind==='club'?'俱乐部':'学校队伍'}</span></span><span class="team-card-mark"><span class="team-ghost-number" aria-hidden="true">${safe(t.number)}</span>${t.logo?`<img src="${safe(t.logo)}" alt="" loading="lazy" width="240" height="240">`:`<span class="team-monogram">${safe(t.name.slice(0,2).toUpperCase())}</span>`}</span><span class="team-card-name">${safe(t.name)}</span><span class="team-card-school">${safe(t.organization)}</span><span class="team-card-arrow" aria-hidden="true"><svg class="fx-arrow fx-arrow--ne" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14"/></svg></span>`;b.addEventListener('click',()=>showDetail(t.id,b));fragment.append(b);});$('#team-list').replaceChildren(fragment);$('#team-empty').hidden=result.total!==0;$('#team-pagination').hidden=result.pages<=1;$('#team-page').textContent=`${result.page} / ${result.pages}`;$('#teams-prev').disabled=result.page===1;$('#teams-next').disabled=result.page===result.pages;}
$('#team-search').addEventListener('input',e=>{teamState.term=e.target.value;teamState.page=1;renderTeams();});$$('[data-team-kind]').forEach(b=>b.addEventListener('click',()=>{teamState.kind=b.dataset.teamKind;teamState.page=1;$$('[data-team-kind]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));renderTeams();}));$('#clear-team-search').addEventListener('click',()=>{teamState={...teamState,term:'',kind:'all',page:1};$('#team-search').value='';$$('[data-team-kind]').forEach(v=>v.setAttribute('aria-pressed',String(v.dataset.teamKind==='all')));renderTeams();$('#team-search').focus();});$('#teams-prev').addEventListener('click',()=>{teamState.page--;renderTeams();});$('#teams-next').addEventListener('click',()=>{teamState.page++;renderTeams();});renderTeams();
}
const field=(label,name,options,required=false)=>`<label>${label}${required?' *':''}<select name="${name}" ${required?'required':''}><option value="">请选择</option>${options.map(x=>`<option value="${safe(x)}">${safe(x)}</option>`).join('')}</select></label>`;
function setConsultMode(mode){if($('#consult-fields').children.length)consultDrafts[currentMode]=Object.fromEntries(new FormData($('#consult-form')));currentMode=mode;const school=mode==='school';$('#consult-title').textContent=school?'学校合作咨询':'项目咨询';$$('[data-consult-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.consultMode===mode)));$('#consult-fields').innerHTML=school?field('学校现有项目','学校现有项目',['计划新建校队','已有 FRC 校队','已有其他机器人项目','计划开展校内项目'],true)+field('希望讨论的方向','希望讨论的方向',['建队与训练安排','工程技术指导','校内项目合作','其他具体需求'],true)+'<label>学生规模<input name="学生规模" placeholder="例如：约 15 位学生"></label><label>时间与场地条件<input name="时间与场地条件" placeholder="例如：每周两次，有校内场地"></label><label class="full">补充说明<textarea name="补充说明" placeholder="目前最需要解决的具体问题"></textarea></label>':field('关注项目','关注项目',['FRC 机器人'],true)+field('当前年级','当前年级',['8 年级及以下','9 年级','10 年级','11 年级','12 年级'],true)+'<label>已有基础<input name="已有基础" placeholder="例如：学过 Python，做过机器人项目"></label><label>每周可投入时间<input name="每周可投入时间" placeholder="例如：每周 4 小时"></label><label class="full">想了解的问题<textarea name="希望了解的问题" placeholder="项目内容、基础要求或时间安排"></textarea></label>';$$('#consult-fields [name]').forEach(el=>{if(Object.hasOwn(consultDrafts[mode],el.name))el.value=consultDrafts[mode][el.name];});$('#consult-form').hidden=false;$('#consult-result').hidden=true;$('#copy-status').textContent='';}
function showConsult(mode,project,opener){consultOpener=opener||document.activeElement;closeDialogs();setConsultMode(mode);if(project){const s=$('#consult-fields select[name="关注项目"]');if(s)s.value='FRC 机器人';}consult.setAttribute('aria-labelledby','consult-title');consult.showModal();}
document.addEventListener('click',e=>{const b=e.target.closest('[data-consult]');if(b){showConsult(b.dataset.consult,b.dataset.project,b);if(b.dataset.schoolStage){const stage=$('#consult-fields select[name="学校现有项目"]');if(stage)stage.value=b.dataset.schoolStage;}}});$$('[data-consult-mode]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.consultMode!==currentMode)setConsultMode(b.dataset.consultMode);}));consult.addEventListener('close',()=>{const origin=consultOpener?.closest('#detail-dialog')?detailOpener:consultOpener;restoreFocus(origin);});
function renderInquiryDraft(){
 const form=$('#consult-form');
 const translate=source=>window.FXLanguage?.translate(source) ?? source;
 const english=document.documentElement.lang.startsWith('en');
 const title=translate(currentMode==='school'?'学校合作咨询':'项目咨询');
 const lines=[...new FormData(form)].map(([name,value])=>{
  const control=form.elements.namedItem(name);
  const entered=String(value).trim();
  const answer=entered?(control instanceof HTMLSelectElement?translate(entered):entered):translate('待确认');
  return translate(name)+(english?': ':'：')+answer;
 });
 $('#result-text').textContent=['FoundryX'+(english?' | ':'｜')+title,'',...lines].join('\n');
}
$('#consult-form').addEventListener('submit',event=>{
 event.preventDefault();
 renderInquiryDraft();
 $('#consult-form').hidden=true;
 $('#consult-result').hidden=false;
 $('#result-text').focus();
});
document.addEventListener('fx:languagechange',()=>{
 if(!$('#consult-result').hidden)renderInquiryDraft();
});
$('#edit-result').addEventListener('click',()=>{$('#consult-form').hidden=false;$('#consult-result').hidden=true;$('#consult-fields select').focus();});$('#copy-result').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#result-text').textContent);$('#copy-status').textContent='已复制';}catch{$('#copy-status').textContent='未能自动复制，请选中文字后手动复制。';const sel=window.getSelection(),range=document.createRange();range.selectNodeContents($('#result-text'));sel.removeAllRanges();sel.addRange(range);}});
if(location.hash==='#view-frc'){history.replaceState(null,'','#frc');document.querySelector('#frc')?.scrollIntoView({block:'start'});}
let id;try{id=decodeURIComponent(location.hash.replace('#view-',''));}catch{id='';}if(teams.some(t=>t.id===id))showDetail(id);
})();
