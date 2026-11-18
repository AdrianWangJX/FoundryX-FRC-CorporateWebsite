from pathlib import Path
import json,html,re
from chrome import navigation,SITE_TITLE
from join_forms import join_form
from mentor_layout import build_mentor_section

def build_chapters(root,generated):
 src=root/'src/site';out=root/'dist/client'
 def blank(name,kind='wide'):
  return f'<div class="media-slot chapter-media {kind}" role="img" aria-label="{name}"></div>'
 def document(path,title,body,active,dock=''):
  content=f'''<!doctype html><html lang="zh-CN" class="document-route {"about-route" if active=="about" else ""}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#17090e"><title>{title} · {SITE_TITLE}</title><meta name="description" content="FoundryX · FRC 机器人竞赛与工程教育。"><link rel="icon" href="assets/favicon.png"><link rel="preload" href="assets/sora.ttf" as="font" type="font/ttf" crossorigin><link rel="stylesheet" href="styles.css?v=19.0"><link rel="stylesheet" href="immersive.css?v=34.0"><link rel="stylesheet" href="chrome.css?v=34.0"><link rel="stylesheet" href="chapters.css?v=awards-44"></head><body class="fx-document {active}-document"><a class="skip" href="#main">跳到主要内容</a>{navigation(active)}<main id="main">{body}</main>{dock}<script defer src="chrome.js?v=44.0"></script></body></html>'''
  if active=='knowledge':
   content=content.replace('class="document-route ', 'class="document-route video-library-route ').replace('</head>','<link rel="stylesheet" href="video-library.css"></head>').replace('</body>','<script defer src="video-library.js"></script></body>')
  if active=='join':
   content=content.replace('</head>','<link rel="stylesheet" href="join-forms.css?v=36.0"></head>').replace('</body>','<script src="join-forms.js?v=36.0"></script></body>')
  if path=='about-mentors.html':
   content=content.replace('class="fx-document ', 'class="fx-document mentor-team-route ').replace('</head>','<link rel="stylesheet" href="mentor-team.css?v=studio-0926"></head>').replace('</body>','<script defer src="mentor-team.js?v=studio-0926"></script></body>')
  if path=='about-campus.html':
   content=content.replace('class="fx-document ', 'class="fx-document campus-route ').replace('</head>','<link rel="stylesheet" href="campus.css?v=20260930"></head>').replace('</body>','<script defer src="campus.js?v=20260930"></script></body>')
  if path=='about-origin.html':
   content=content.replace('class="fx-document ', 'class="fx-document origin-story-route ').replace('</head>','<link rel="stylesheet" href="origin-story.css"></head>')
  if path=='about.html':
   content=content.replace('src="assets/brand-logo.svg"','src="assets/brand-logo-stanford-red.png"')
   content=content.replace('class="fx-document ', 'class="fx-document honours-route ').replace('</head>','<link rel="stylesheet" href="honours.css"></head>').replace('</body>','<script defer src="honours.js"></script></body>')
  (out/path).write_text(content);generated.add(path)
 def panel(id,body,cls=''):
  return f'<section class="page-panel is-visible {cls}" data-page-panel id="{id}"><div class="page-panel-inner">{body}</div></section>'
 # Named sections are the content hierarchy; no decorative micro-labels or serials.
 awards=json.loads((src/'awards.json').read_text())
 seasons=awards['seasons']
 latest=seasons[0]['year']
 achievements='<section class="honours-page" id="achievements" aria-labelledby="honours-title"><header class="honours-heading"><h1 id="honours-title">优异成绩</h1><nav class="honours-sections" aria-label="优异成绩内容"><a href="#competition-records">历年战绩</a><a href="#alumni">学员去向</a></nav></header>'
 achievements+=f'<section class="honours-archive" id="competition-records" aria-labelledby="records-title"><header class="honours-subheading"><h2 id="records-title">历年战绩</h2><p class="honours-period">{seasons[-1]["year"]} — {latest}</p></header>'
 achievements+='<nav class="honours-years" aria-label="选择成绩年份">'+''.join(f'<button type="button" data-year="{item["year"]}" aria-pressed="false">{item["year"]}</button>' for item in seasons)+'<button type="button" data-year="all" aria-pressed="true">全部</button></nav><div class="honours-collection">'
 for season in seasons:
  year=season['year']
  period_class=' honours-year-range' if '—' in year else ''
  achievements+=f'<section class="honours-year {"honours-latest" if year==latest else ""}{period_class}" data-honours-year="{year}" aria-labelledby="year-{year}"><header class="honours-year-heading"><h3 id="year-{year}">{year}</h3></header><ul class="honours-composition">'
  if season.get('note'):
   achievements+=f'<li class="honour-item"><p class="honours-season-note">{html.escape(season["note"])}</p></li>'
  else:
   for event in season['events']:
    names=event['awards']
    expanded=' honour-awards-expanded' if year==latest and len(names)>2 else ''
    names_html=''.join(f'<span class="award-name{" award-technical" if year==latest and name in ("控制创新奖","最佳程序奖") else ""}">{html.escape(name)}</span>' for name in names)
    achievements+=f'<li class="honour-item"><h4 class="honour-awards{expanded}">'+names_html+f'</h4><div class="honours-context"><p class="honours-event">{html.escape(event["event"])}</p></div></li>'
  achievements+='</ul></section>'
 achievements+='</div></section><section class="honours-alumni" id="alumni" aria-labelledby="alumni-title"><header class="honours-subheading"><h2 id="alumni-title">学员去向</h2></header><dl class="alumni-list">'
 for item in awards['alumni']:
  achievements+=f'<div class="alumni-item"><dt>{html.escape(item["university"])}</dt><dd><span class="alumni-count">{item["count"]}</span><span class="alumni-unit">名</span></dd></div>'
 achievements+='</dl></section></section>'
 origin=(src/'origin-story.html').read_text()
 mentor_items=json.loads((src/'mentor-team.json').read_text())['mentors']
 advisor_items=json.loads((src/'advisors.json').read_text())['advisors']
 mentors=build_mentor_section(mentor_items,advisor_items)
 base=(src/'campus.html').read_text()
 about_pages=[('about-origin.html','beginning','办学初衷',origin,'beginning-panel'),('about-mentors.html','mentors','导师团队',mentors,'mentors-panel'),('about.html','achievements','优异成绩',achievements,'achievements-panel'),('about-campus.html','campus','顶尖基地',base,'campus-panel')]
 for path,id,name,body,cls in about_pages:
  dock='<nav class="section-dock" data-page-dock aria-label="关于 FoundryX 板块">'+''.join(f'<a href="{destination}#{anchor}"'+(' aria-current="page"' if anchor==id else '')+f'>{label}</a>' for destination,anchor,label,_,_ in about_pages)+'</nav>'
  document(path,name,body if path in ('about.html','about-mentors.html','about-origin.html') else panel(id,body,cls),'about',dock)
 # Keep saved links to the former stacked About page useful without rendering it.
 about_file=out/'about.html'
 legacy='<script>(()=>{const routes={beginning:"about-origin.html",mentors:"about-mentors.html",campus:"about-campus.html"};function route(){const path=routes[location.hash.slice(1)];if(!path)return;const target=new URL(path,document.baseURI);target.search=location.search;target.hash=location.hash;location.replace(target.href);}addEventListener("hashchange",route);route();})();</script>'
 about_file.write_text(about_file.read_text().replace('<head>','<head>'+legacy,1))
 videos=json.loads((src/'videos.json').read_text())['videos']
 kb='''<section class="video-library" aria-labelledby="library-title"><h1 class="video-sr-only" id="library-title">知识库</h1><div class="video-grid">'''
 for video in videos:
  title=html.escape(video['title'])
  src_url=html.escape(video['src'],quote=True)
  poster=html.escape(video['poster'],quote=True)
  kb+=f'''<article class="video-card" id="{video['id']}" aria-labelledby="title-{video['id']}"><button class="video-cover" type="button" data-video-src="{src_url}" data-video-poster="{poster}" aria-labelledby="play-{video['id']} title-{video['id']}" aria-haspopup="dialog" aria-controls="video-player"><img src="{poster}" alt="" width="1600" height="900" decoding="async"><span id="play-{video['id']}" class="video-sr-only">播放</span><span class="video-play-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 5 11 7-11 7V5Z"/></svg></span></button><h2 id="title-{video['id']}">{title}</h2></article>'''
 kb+='''</div></section><dialog class="video-dialog" id="video-player" aria-labelledby="video-player-title"><div class="video-dialog-panel"><header class="video-dialog-header"><h2 id="video-player-title"></h2><button class="video-dialog-close" type="button" aria-label="关闭视频" autofocus><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><video class="video-dialog-media" controls playsinline muted preload="none" aria-label="视频播放器"></video><p class="video-dialog-error" role="status" hidden>视频暂时无法播放，请关闭后重试。</p></div></dialog>'''
 document('knowledge.html','知识库',kb,'knowledge')
 student='''<div class="panel-copy"><h1>成为学员，<br><em>让兴趣走进赛场。</em></h1><div class="panel-prose"><p>从设计、编程到团队协作，<br>把想尝试的事，变成一个真实项目。</p></div></div>'''+join_form('student','成为学员')
 join=panel('student',student,'join-panel student-panel')
 partnership='''<div class="panel-copy"><h2>校企合作，<br><em>一起建一支队伍。</em></h2><div class="panel-prose"><p>从校队建设到赛季备赛，<br>连接学校与企业，让工程实践持续发生。</p></div></div>'''+join_form('partnership','校企合作')
 join+=panel('partnership',partnership,'join-panel partnership-panel')
 team='''<div class="panel-copy"><h2>广纳贤士，<br><em>把热爱传递下去。</em></h2><div class="panel-prose"><p>与热爱工程和教育的人同行，<br>陪学生把一个想法，做成看得见的作品。</p></div></div>'''+join_form('team','广纳贤士')
 join+=panel('team',team,'join-panel team-panel')
 sponsorship='''<div class="panel-copy"><h2>赞助战队，<br><em>让创造走得更远。</em></h2><div class="panel-prose"><p>为年轻的创造者添一份支持，<br>让更多想法有机会从工作台走向赛场。</p></div></div>'''+join_form('sponsorship','赞助战队')
 join+=panel('sponsorship',sponsorship,'join-panel sponsorship-panel')
 join_dock='<nav class="section-dock" aria-label="加入我们板块">'+''.join(f'<a href="#{id}"'+(' aria-current="location"' if i==0 else '')+f'>{name}</a>' for i,(id,name) in enumerate([('student','成为学员'),('partnership','校企合作'),('team','广纳贤士'),('sponsorship','赞助战队')]))+'</nav>'
 document('join.html','加入我们',join,'join',join_dock)
 document('contact.html','加入我们',join,'join',join_dock)
