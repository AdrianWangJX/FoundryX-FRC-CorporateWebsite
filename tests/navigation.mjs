import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const script=readFileSync('src/site/navigation.js','utf8');
const sitesHost='foundryx-lab-2026.adrianwang020913.chatgpt.site';
function run(protocol='https:',connection={},hostname='foundryx.xyz',pathname='/about.html'){
 const origin='https://'+hostname;
 const anchors=[origin+'/index.html#idea',origin+'/about.html#achievements',origin+'/mentors/theo.html?q=1#bio','https://other.test/page.html',origin+pathname+'#main'].map(href=>({href}));
 const events={},links=[];
 const document={baseURI:origin+pathname,querySelectorAll:()=>anchors,addEventListener:(name,fn)=>events[name]=fn,createElement:()=>({}),head:{append:link=>links.push(link)}};
 vm.runInNewContext(script,{location:{protocol,hostname,origin,pathname},document,navigator:{connection},URL,Set});
 return {anchors,events,links};
}
const online=run();
assert.equal(online.anchors[0].href,'https://foundryx.xyz/index.html#idea');
assert.equal(online.anchors[1].href,'https://foundryx.xyz/about.html#achievements');
assert.equal(online.anchors[2].href,'https://foundryx.xyz/mentors/theo.html?q=1#bio');
assert.equal(online.anchors[3].href,'https://other.test/page.html');
assert.equal(run('file:').anchors[0].href,'https://foundryx.xyz/index.html#idea');
const event=anchor=>({target:{closest:()=>anchor}});
online.events.pointerover(event(online.anchors[2]));online.events.focusin(event(online.anchors[2]));
assert.equal(online.links.length,1);assert.equal(online.links[0].href,'https://foundryx.xyz/mentors/theo.html?q=1');
online.events.focusin(event(online.anchors[1]));assert.equal(online.links.length,1);
for(const connection of [{saveData:true},{effectiveType:'2g'}]){const slow=run('https:',connection);slow.events.pointerover(event(slow.anchors[2]));assert.equal(slow.links.length,0);}
const hosted=run('https:',{},sitesHost,'/about');
assert.equal(hosted.anchors[0].href,'https://'+sitesHost+'/#idea');
assert.equal(hosted.anchors[1].href,'https://'+sitesHost+'/about#achievements');
assert.equal(hosted.anchors[2].href,'https://'+sitesHost+'/mentors/theo?q=1#bio');
for(const hostname of ['localhost','preview.example.test','foundryx-lab-2026.adrianwang020913.chatgpt.site.example.test']){
 assert.ok(run('http:',{},hostname).anchors[1].href.endsWith('/about.html#achievements'));
}
// The very first inline bootstrap must not hide internal routes, even if the 3D bundle is unavailable.
const html=readFileSync('dist/client/index.html','utf8');
const boot=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const directSections=['#idea','#about-frc','#frc-season','#frc-roles','#frc-growth','#showcase'];
for(const hash of [...directSections,'','#other']){
 const classes=new Set();vm.runInNewContext(boot,{location:{hash},document:{documentElement:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}}},setTimeout:()=>0});
 assert.equal(classes.has('fx-welcome-pending'),!directSections.includes(hash));
}
// A late split bundle must never hide a page that has already been revealed.
{
  const window = {};
  const events = new EventTarget();
  const root = { classList: { add() {}, remove() {} } };
  const context = {
    window, Event, location: { hash: '' },
    document: { documentElement: root, dispatchEvent: event => events.dispatchEvent(event) },
    setTimeout: callback => callback(),
  };
  let completions = 0;
  events.addEventListener('foundryx:welcome-complete', () => completions++);
  vm.runInNewContext(boot, context);
  assert.equal(window.FoundryWelcome.state, 'complete');
  assert.equal(completions, 1);
  vm.runInNewContext(readFileSync('src/welcome/lifecycle.js', 'utf8'), context);
  assert.equal(completions, 1);
}
const awards=readFileSync('dist/client/about.html','utf8');
const awardSource=JSON.parse(readFileSync('src/site/awards.json','utf8'));
const awardYears=awardSource.seasons.map(season=>season.year);
const yearSections=[...awards.matchAll(/<section\b[^>]*\bdata-honours-year="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)];
const decodeText=value=>value.replace(/<[^>]*>/g,'').replace(/&(?:amp|lt|gt|quot|apos|#x27|#39);/g,entity=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#x27;':"'",'&#39;':"'"}[entity])).trim();
assert.deepEqual(yearSections.map(match=>match[1]),awardYears,'Every editorial season, including ranges, must be rendered in source order');
assert.deepEqual([...awards.matchAll(/<button\b[^>]*\bdata-year="([^"]+)"/g)].map(match=>match[1]),[...awardYears,'all'],'Every season and the complete archive must be selectable');
let renderedAwards=0;
for(const [,year,section]of yearSections){
 const season=awardSource.seasons.find(item=>item.year===year);
 const names=[...section.matchAll(/<span\b[^>]*class="award-name[^"]*"[^>]*>([\s\S]*?)<\/span>/g)].map(([,name])=>decodeText(name));
 assert.deepEqual(names,season.events.flatMap(event=>event.awards),`Awards for ${year} must match the editorial source`);
 const notes=[...section.matchAll(/<p\b[^>]*class="honours-season-note"[^>]*>([\s\S]*?)<\/p>/g)].map(([,note])=>decodeText(note));
 assert.deepEqual(notes,season.note?[season.note]:[],`Season notes for ${year} must match the source`);
 const events=[...section.matchAll(/<p\b[^>]*class="honours-event"[^>]*>([\s\S]*?)<\/p>/g)].map(([,event])=>decodeText(event));
 assert.deepEqual(events,season.events.map(event=>event.event),`Event grouping for ${year} must retain its source labels`);
 renderedAwards+=names.length+notes.length;
}
assert.ok(!awards.includes('历年合作佳绩'));
assert.match(awards,/<main\s+id="main">\s*<section\b[^>]*\bid="achievements"/,'Achievements must be present as main content before enhancement');
assert.ok(!awards.includes('src="app.js'));
assert.ok(!awards.includes('src="immersive.js'));
console.log(`Navigation: canonical URLs, offline preservation, intent prefetch, first-paint content, welcome entry and ${renderedAwards} source-backed awards/season notes across ${awardYears.length} seasons passed.`);

// Direct FRC content is positioned before any external script can load.
const routeBoot=html.match(/<script data-route-bootstrap>([\s\S]*?)<\/script>/)[1];
for(const hash of [...directSections,'']){
 let positioned=null;const stage={style:{}},root={style:{setProperty(){}},dataset:{}};
 const links=['home','frc'].map(section=>({dataset:{section},setAttribute(key,value){this[key]=value},removeAttribute(key){delete this[key]}}));
 const document={documentElement:root,querySelector:selector=>selector==='.stage'?stage:{scrollIntoView(){positioned=selector}},querySelectorAll:()=>links};
 vm.runInNewContext(routeBoot,{location:{hash},document,innerHeight:745});
 assert.equal(positioned,hash||null);
 if(hash){const group=hash==='#idea'?'home':'frc';assert.equal(root.dataset.navSection,group);assert.equal(stage.style.opacity,group==='frc'?'0':'1');assert.equal(links.find(link=>link.dataset.section===group)['aria-current'],'location');}
}
console.log('Direct sections are positioned and visible before the immersive bundle executes.');

// Saved URLs lead to current content, including nested pages and offline exports.
for(const [path,hash,destination]of [
 ['mentors/adrian.html','#biography','about-mentors.html#mentor-adrian'],
 ['frc.html','#roles','index.html#frc-roles'],
 ['stories/first-time-on-field.html','','index.html#showcase'],
 ['contact.html','#sponsorship','join.html#sponsorship'],
 ['results.html','','about.html#achievements'],
]){
 const page=readFileSync('dist/client/'+path,'utf8');
 const redirect=page.match(/<script data-legacy-route>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(redirect,`${path} must keep a working compatibility entry`);
 assert.match(page,/<a\b[^>]*href="[^\"]+"[^>]*>[^<]+<\/a>/,'No-script visitors retain a clickable destination');
 for(const origin of ['https://foundryx.xyz/','file:///site/']){
  const href=origin+path+'?from=bookmark'+hash,base=new URL(path.includes('/')?'../':'./',href).href;
  for(const type of ['navigate','back_forward','reload']){
   let replaced=null;
   vm.runInNewContext(redirect,{performance:{getEntriesByType:()=>[{type}]},location:{hash,search:'?from=bookmark',replace:url=>replaced=url},document:{baseURI:base},URL});
   const target=new URL(destination,origin);target.search='?from=bookmark';
   assert.equal(replaced,target.href,'Saved links must always resolve to current content and preserve their query');
  }
 }
}
const articles=JSON.parse(readFileSync('src/site/knowledge.json','utf8')).articles;
for(const article of articles){
 const page=readFileSync('dist/client/read/'+article.id+'.html','utf8');
 assert.ok(!page.includes('data-legacy-route'),'Complete knowledge articles stay readable');
 assert.match(page,/href="join\.html#student"/);
 assert.match(page,/href="join\.html#partnership"/);
 assert.ok(!/<button\b[^>]*data-consult=/.test(page),'Article calls to action use the current inquiry forms');
}
console.log('Saved routes: current mentor, FRC, gallery, honours and join destinations; offline paths; reload precedence; complete articles and current inquiry links passed.');

// Refreshing a content route keeps its location. Only the homepage replays its welcome.
const refreshSource=readFileSync('src/site/refresh-entry.js','utf8');
function refreshed(href,homePath,type){
 let replaced=null,scrolled=false;
 const location={href,search:new URL(href).search,replace:url=>replaced=url};
 const history={state:{keep:true},replaceState(state,unused,url){this.state=state;location.href=url;}};
 vm.runInNewContext(refreshSource.replace('__HOME_PATH__',JSON.stringify(homePath)),{
  location,history,performance:{getEntriesByType:()=>type?[{type}]:[]},URL,window:{scrollTo(){scrolled=true;}}
 });
 return {replaced,href:location.href,history,scrolled};
}
for(const origin of ['http://foundryx.xyz','https://'+sitesHost]){
 for(const path of ['/about','/about.html','/join','/join.html','/mentors/theo','/mentors/theo.html','/read/frc-start']){
  const home=path.startsWith('/mentors/')||path.startsWith('/read/')?'../index.html':'index.html';
  const result=refreshed(origin+path+'?lang=en&from=menu#details',home,'reload');
  assert.equal(result.replaced,null);assert.equal(result.href,origin+path+'?lang=en&from=menu#details');assert.equal(result.scrolled,false);
  for(const type of ['navigate','back_forward',null])assert.equal(refreshed(origin+path+'#details',home,type).replaced,null);
 }
 for(const path of ['/','/index.html']){
  for(const hash of ['','#idea','#about-frc']){
   const result=refreshed(origin+path+'?from=test'+hash,'index.html','reload');
   assert.equal(result.replaced,null);assert.equal(result.href,origin+'/?from=test');assert.equal(result.history.scrollRestoration,'manual');assert.ok(result.scrolled);
  }
 }
}
assert.equal(refreshed('file:///site/mentors/theo.html?lang=en#biography','../index.html','reload').href,'file:///site/mentors/theo.html?lang=en#biography');
assert.ok(html.indexOf('data-refresh-entry')<html.indexOf('fx-welcome-pending'));
for(const path of ['index.html','about.html','about-mentors.html','mentors/theo.html','read/frc-start.html']){
 const page=readFileSync('dist/client/'+path,'utf8');
 const icon=page.match(/<link\b[^>]*\brel="icon"[^>]*\bhref="([^"]+)"/);
 assert.ok(icon||page.includes('data-legacy-route'),'Every content page must declare its favicon; immediate compatibility redirects may omit it');
 if(icon){
  const base=page.match(/<base\b[^>]*\bhref="([^"]+)"/)?.[1]||'./';
  const iconPath=resolve(dirname(resolve('dist/client',path)),base,icon[1].split(/[?#]/)[0]);
  assert.equal(iconPath,resolve('dist/client/assets/favicon-logo.svg'),'The favicon must resolve to the current FoundryX logo');
  assert.ok(existsSync(iconPath),'The favicon file must exist');
 }
 assert.equal((page.match(/data-refresh-entry/g)||[]).length,1);
}
console.log('Refresh: home and nested routes, both hosts, hashes, history navigation, offline paths and logo references passed.');


// Directory aliases are redirects to the same document on every navigation type.
const aliases=JSON.parse(execFileSync('python3',['-B','-c',
 "import sys,json;sys.path.insert(0,'src/site');from static_routes import alias_entries;print(json.dumps(dict(alias_entries(['about.html','read/frc-start.html','stories/archive/example.html']))))"],{encoding:'utf8'}));
for(const [alias,page]of Object.entries(aliases)){
 const redirect=page.match(/<script>([\s\S]*?)<\/script>/)[1];
 const documentPath=alias.replace(/\/index\.html$/,'.html');
 for(const origin of ['https://static.example/preview/','file:///site/']){
  for(const suffix of ['/index.html','/']){
   const href=origin+alias.replace(/\/index\.html$/,suffix)+'?lang=en&from=saved#question';
   for(const type of ['navigate','reload','back_forward']){
    let replaced;
    vm.runInNewContext(redirect,{performance:{getEntriesByType:()=>[{type}]},location:{search:'?lang=en&from=saved',hash:'#question',replace:url=>replaced=new URL(url,href).href}});
    assert.equal(replaced,origin+documentPath+'?lang=en&from=saved#question');
   }
  }
 }
}
console.log('Static aliases preserve nested document destinations, queries and fragments on reload, history and offline navigation.');
