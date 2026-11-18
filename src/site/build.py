# -*- coding: utf-8 -*-
from pathlib import Path
import re,json,html,shutil
from media import install_media
from chrome import NAV_ITEMS,navigation,SITE_TITLE
from chapters import build_chapters
from legacy_routes import build_legacy_routes
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'src/site'; OUT=ROOT/'dist/client'
esc=html.escape
generated=set()
shutil.copytree(SRC / 'static', OUT, dirs_exist_ok=True)
for asset in (SRC / 'published-welcome').iterdir():
    if asset.name == '.DS_Store':
        continue
    if asset.is_dir():
        # The media manifest owns the large FRC videos; keep posters in Git.
        exclude = ['.DS_Store', '*.mp4'] if asset.name in {'films', 'films-mobile', 'films-stream'} else ['.DS_Store']
        shutil.copytree(asset, OUT / 'assets' / asset.name, dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns(*exclude))
    else:
        directory = OUT / 'assets' if asset.suffix in {'.svg', '.png'} else OUT
        shutil.copyfile(asset, directory / asset.name)
install_media(SRC, OUT)
for file in ['site.css','site.js','app.js','continuity.css','responsive.css','chrome.css','mobile.css','chrome.js','chapters.css','video-library.css','video-library.js','mentor-team.css','mentor-team.js','campus.css','origin-story.css','honours.css','honours.js','join-forms.css','join-forms.js']: shutil.copyfile(SRC/file,OUT/file)
NAV=[(href,text) for href,text,key in NAV_ITEMS]
def link(href,text,cls='line-link'): return f'<a class="{cls}" href="{href}">{text}<span aria-hidden="true">↗</span></a>'
def consult(text='预约项目评估',mode='student',project='frc'): return f'<button class="button" data-consult="{mode}" data-project="{project}">{text}<span aria-hidden="true">↗</span></button>'
def label(n,text): return f'<p class="eyebrow"><span>{n}</span>{text}</p>'
def section_head(n,title,sub=''): return f'<div class="section-heading">{label(n,sub)}<h2>{title}</h2></div>'
def intro(kicker,title,desc='',extra='',cls=''): return f'<section class="page-intro {cls}">{label("FOUNDRYX",kicker)}<h1>{title}</h1>{f"<p class=lead>{desc}</p>" if desc else ""}{extra}</section>'
def rows(items): return '<div class="editorial-rows">'+''.join(f'<article><h3>{h}</h3><p>{p}</p></article>' for i,(h,p) in enumerate(items))+'</div>'
def faq(items): return '<div class="faq-list">'+''.join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q,a in items)+'</div>'
def cta(title='把下一步，聊具体。'): return f'<section class="closing">{label("LET’S BEGIN","从一次项目交流开始")}<h2>{title}</h2><div class="closing-actions">{link("join.html#student","学生 / 家长 · 加入我们","button")}{link("join.html#partnership","学校 / 企业 · 合作咨询","button")}</div></section>'
def photo(file,alt,caption='',cls=''): return f'<figure class="photo-essay {cls}"><img src="assets/photos/{file}.webp" alt="{alt}" loading="lazy" width="1200" height="800">{f"<figcaption>{caption}</figcaption>" if caption else ""}</figure>'
mentors=[
 {'id':'theo','name':'Theo Tao','initials':'TT','focus':'课程设计 · 学生成长','tag':'FRC / 项目制学习','intro':'围绕学生的长期项目安排，把工程实践、团队协作与成长规划联系起来。','parts':[('教育与职业背景','哥伦比亚大学本科，主修物理与计算机科学；斯坦福大学管理科学与工程硕士。'),('相关项目经验','FRC 中国赛冠军团队经历。'),('在 FoundryX 负责什么','整体发展、课程设计、学生成长规划与科技项目指导。'),('如何指导中学生','让课程围绕真实任务展开，把大目标拆成学生能够持续完成、复盘和表达的小步骤。')]},
 {'id':'steve','name':'Steve Wu','initials':'SW','focus':'机械设计 · 赛季备赛','tag':'FRC / 工程训练','intro':'把机械、电控和现场测试连在一起，帮助学生理解一台机器人如何可靠地工作。','parts':[('教育与职业背景','上海交通大学机械工程硕士。'),('相关项目经验','长期参与 FRC 工程设计与竞赛指导。具备连续多年 FRC 中国赛冠军执教经历。'),('在 FoundryX 负责什么','机械、电控、工程训练与赛季备赛。'),('如何指导中学生','从结构为什么这样设计，到装配与测试中出现的问题，让学生参与判断与修改，而不只照着完成。')]},
 {'id':'adrian','name':'Adrian Wang','initials':'AW','focus':'FoundryX 导师','tag':'导师团队','intro':'','parts':[]},]
# Profile claims remain in editorial source until their wording and attribution are confirmed.
APPROVED_BIOS=True

def mentor_cards(ids=None):
 selected=[m for m in mentors if not ids or m['id'] in ids]
 return '<div class="mentor-grid">'+''.join(f'<a class="mentor-card" href="mentors/{m["id"]}.html"><span class="mentor-discipline">{m["tag"]}</span><h3>{m["name"]}</h3><p>{m["focus"]}</p><p class="mentor-summary">{m["intro"]}</p><span class="mentor-arrow" aria-hidden="true">↗</span></a>' for i,m in enumerate(selected))+'</div>'

def compose_page(path,body):
 if path=='index.html': return body
 key=Path(path).stem
 photos_file=SRC/'external-photos.json'
 external=json.loads(photos_file.read_text()) if photos_file.exists() else {}
 match=re.match(r'<section class="page-intro[^\"]*">(.*?)</section>',body,re.S)
 if match:
  inner=match.group(1)
  kicker=re.search(r'<p class="eyebrow">.*?</p>',inner,re.S).group()
  heading=re.search(r'<h1>(.*?)</h1>',inner,re.S).group(1)
  heading=heading.replace('<em>','').replace('</em>','')
  lines=heading.split('<br>')
  heading=''.join('<span>'+line+'</span>' for line in lines)
  rest=re.sub(r'^.*?</h1>','',inner,flags=re.S).replace('class=lead','class="hero-description"').replace('class="lead"','class="hero-description"')
  photo=external.get(key)
  media=f'<div class="hero-photo"><img src="{photo["src"]}" alt="{photo["alt"]}" width="{photo["width"]}" height="{photo["height"]}" fetchpriority="high"></div>' if photo else ''
  head=f'<section class="hero document-hero {"has-photograph" if photo else "without-photograph"}"><div id="hero-field" class="page-flow" aria-hidden="true"></div>{media}<div class="hero-veil" aria-hidden="true"></div><div class="hero-copy">{kicker}<h1>{heading}</h1>{rest}</div><div class="hero-signature" aria-hidden="true">FOUNDRY<span>X</span></div></section>'
  body=head+body[match.end():]
 return body

def clean_interface(body):
 for tag,cls in [('p','eyebrow'),('p','source-note'),('p','content-section profile-source'),('p','small-note'),('section','article-sources'),('section','contact-note content-section')]:
  body=re.sub(r'<'+tag+r' class="'+re.escape(cls)+r'"[^>]*>.*?</'+tag+'>','',body,flags=re.S)
 body=re.sub(r'<div><dt>FoundryX 参与角色</dt><dd>.*?</dd></div>','',body,flags=re.S)
 body=re.sub(r'<article class="result-case empty-case"[^>]*>.*?</article>',lambda m: re.sub(r'<p>.*?</p>|<span>.*?</span>','',m.group(),flags=re.S).replace('>—<','><'),body,flags=re.S)
 body=re.sub(r'<a [^>]*>[^<]*(?:FIRST 官方|官方比赛记录)[^<]*(?:<span[^>]*>.*?</span>)?</a>','',body,flags=re.S)
 body=re.sub(r'<p(?: class="(?:lead|mentor-summary)")?></p>','',body)
 return body

def shell(path,title,body,active='index.html',scripts='',welcome=False):
 body=clean_interface(compose_page(path,body))
 body=re.sub(r'<div class="hero-signature"[^>]*>.*?</div>',"",body,flags=re.S)
 menu=''.join(f'<a href="{h}"'+(' aria-current="page"' if h==active else '')+f'>{t}</a>' for h,t in NAV)
 head=''
 if welcome:
  current=(SRC/'home-original.html').read_text()
  found=re.search(r'<!-- FoundryX welcome:.*?</head>',current,re.S)
  if found: head=found.group().replace('</head>','')
  else: raise RuntimeError('Preserve welcome bootstrap: not found')
 welcome_script=''
 if welcome:
  welcome_script='<script src="welcome.js?v=cad-2s-20260927"></script>'
 dialogs=(SRC/'dialogs.html').read_text()
 dialogs=re.sub(r'<nav aria-label="移动导航">.*?</nav>',f'<nav aria-label="移动导航">{menu}</nav>',dialogs,flags=re.S)
 dialogs=dialogs.replace('<p id="consult-intro"></p>','<p id="consult-intro">填写后可生成咨询清单，便于向 FoundryX 说明需求。此表单不会发送信息或确认预约。</p>')
 footer='<footer class="site-footer"><a href="index.html" aria-label="FoundryX 首页"><img src="assets/brand-logo.svg" alt="FoundryX" width="194" height="63"></a><div><p>FRC 机器人竞赛</p><p>从真实问题，走向真实创造。</p></div><div class="footer-links"><a href="about-mentors.html#mentors">导师团队</a><a href="index.html#showcase">我们的队伍</a></div><p class="copyright">© 2026 FoundryX</p></footer>'
 page=f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="{'../' if '/' in path else './'}"><meta name="theme-color" content="#100e10"><meta name="description" content="{esc(title)} · FoundryX FRC 机器人竞赛项目。"><title>{esc(title)} · {SITE_TITLE}</title><link rel="preload" href="assets/sora.ttf" as="font" type="font/ttf" crossorigin><link rel="icon" href="assets/favicon.png"><link rel="stylesheet" href="styles.css?v=19.0"><link rel="stylesheet" href="experience.css?v=19.0"><link rel="stylesheet" href="tech.css?v=19.0"><link rel="stylesheet" href="spaces.css?v=19.0"><link rel="stylesheet" href="teams.css?v=19.0"><link rel="stylesheet" href="site.css?v=31.0"><link rel="stylesheet" href="copy-refinement.css?v=19.1"><link rel="stylesheet" href="continuity.css?v=frc-24.0">{head}<link rel="stylesheet" href="responsive.css?v=25.0"></head><body class="{'site-home' if welcome else 'site-document'} page-{Path(path).stem}"><a class="skip" href="{path}#main">跳到主要内容</a><header class="header"><a class="brand-logo" href="index.html" aria-label="FoundryX 首页"><img src="assets/brand-logo.svg" alt="FoundryX" width="155" height="50"></a><nav aria-label="主导航">{menu}</nav><button class="menu-toggle" aria-controls="menu-dialog" aria-label="打开菜单">菜单 ＋</button></header><main id="main">{body}</main>{footer}{dialogs}<script src="data/teams.js?v=19.0"></script><script src="directory.js?v=19.0"></script><script src="app.js?v=31.0"></script><script src="site.js?v=frc-24.0"></script>{scripts}<script src="page-motion.js?v=frc-24.0"></script>{welcome_script}</body></html>'''
 nav_key='knowledge' if active=='knowledge.html' else 'join' if active=='contact.html' else 'frc' if active=='programs.html' else 'about' if active in ('about.html','results.html','stories.html') else 'home'
 page=re.sub(r'<header class="header">.*?</header>',navigation(nav_key),page,flags=re.S)
 page=page.replace('</head>','<link rel="stylesheet" href="chrome.css?v=34.0"></head>').replace('</body>','<script src="chrome.js?v=37.0"></script></body>').replace('app.js?v=31.0','app.js?v=34.0')
 generated.add(path)
 dest=OUT/path;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(page)

# HOME: a clear sequence from understanding to trust to a conversation.
paths=f'''<section class="content-section path-section" id="programs">{section_head('01','FRC，<br><em>面向真实挑战。</em>','CORE PROGRAMS')}<div class="path-duo"><a href="frc.html" class="path-panel"><span class="path-code">FRC</span><div><p class="eyebrow">BUILD THE FUTURE</p><h3>从一台机器人开始，<br>学习工程、协作与领导。</h3><p>机械设计 · 电控编程 · 团队运营 · 全球赛场</p><span class="line-link">探索机器人项目 <span>↗</span></span></div></a></div></section>'''

results=f'''<section class="content-section results-home">{section_head('02','成果，回到每一次真实投入。','SEASONS & OUTCOMES')}<div class="results-preview"><div class="result-year">2026<span>FRC 中国季后赛 · 三亚</span></div><div class="result-line"><span>冠军联盟</span><strong>8810</strong><p>与 8214、9996 共同组成冠军联盟</p></div><div class="result-line"><span>亚军联盟</span><strong>9997</strong><p>与 11118、7002 共同组成亚军联盟</p></div></div><p class="source-note">队伍赛事成绩，非 FoundryX 机构奖项。FoundryX 的项目参与角色另行归档。<a href="https://frc-events.firstinspires.org/2026/OTSAN/playoffs" target="_blank" rel="noopener">FIRST 官方赛果 ↗</a></p>{link('results.html','查看战绩')}</section>'''
why=f'''<section class="content-section">{section_head('03','把学习，放进真实项目里。','WHY FOUNDRYX')}{rows([('真实竞赛','面对公开规则、真实对手和会失败的测试。学生需要解释自己的选择，并在结果中找出下一步。'),('长期项目','一个机器人不会在一次体验中完成。持续练习、迭代与复盘，才让知识逐渐成为能力。'),('导师直接指导','围绕正在发生的工程问题交流。导师帮助学生找到思路，也为学生保留亲手尝试和承担责任的空间。'),('留下自己的作品','机器人、代码、GitHub、实验记录与团队经历，都能记录做过什么、为什么这样做，以及后来如何改进。')])}</section>'''

homementors=f'<section class="content-section">{section_head("05","与你一起，把问题做明白。","MENTORS")}{mentor_cards()}{link("about-mentors.html#mentors","认识导师团队")}</section>'
questions=[('frc-start', 'FRC 到底是什么？'), ('frc-roles', '零基础学生如何加入 FRC？'), ('frc-season', 'FRC 一个完整赛季是怎样的？'), ('frc-growth', 'FRC 经历如何形成申请材料？')]
knowledgehome=f'<section class="content-section knowledge-home">{section_head("06","先了解，再选择。","FIELD NOTES")}<div class="question-links">'+''.join(link('knowledge.html#'+i,q) for i,q in questions)+f'</div>{link("knowledge.html","进入 FRC 知识库")}</section>'
original=(SRC/'home-original.html').read_text()
original_main=re.search(r'<main>(.*?)</main>',original,re.S).group(1)
original_main=original_main.replace('href="#frc"','href="frc.html"')
original_main=original_main.replace('<section class="moments-section"','<section id="moments" class="moments-section"')
original_main=original_main.replace('<div class="frc-intro-links">','<div class="frc-intro-links">'+link('frc.html','完整了解 FRC'))
results=results.replace('<div class="results-preview">','<div class="achievement-orbit" aria-hidden="true"><span></span><span></span><span></span></div><div class="results-preview">')
results=results.replace('</div><p class="source-note">','</div><div class="outcome-more"><p><b>FRC 中国赛冠军</b><span>2026 上海区域赛 · 6941 所在冠军联盟</span></p><p><b>美国 Top 20 大学</b><span>学生录取成果</span></p><p><b>国际学校校队</b><span>平和 · 惠立 · 光华剑桥 · 苏州外国语等队伍项目</span></p></div><p class="source-note">',1)
home_story=f'<section class="content-section"><div class="section-heading"><h2>学生自己的故事。</h2></div><p class="lead">从设计图到机器人、第一次上场、独立项目。</p>{link("stories.html","探索六个学生故事专题")}</section>'
additions=results+why+home_story+homementors+knowledgehome
home=original_main.replace('<section class="join-section"',additions+'<section class="join-section"')
home=home.replace('<span>预约项目评估</span>','<span>学生 / 家长<br>预约项目评估</span>')
home=home.replace('</button></section>', '</button></section>')
shell('index.html','在真实赛场，锻造下一代科技领袖',home,scripts='<script src="experience.js?v=25.0"></script>',welcome=True)

about=intro('ABOUT FOUNDRYX','让知识，<br><em>走向真实创造。</em>','编程、机器人和人工智能，应该成为学生理解世界、参与创造的工具。')
about+=f'<section class="content-section split-editorial">{section_head("01","为什么成立 FoundryX","OUR BEGINNING")}<div class="prose"><p>许多学生学习了编程、机器人和人工智能，却很少有机会面对一个复杂、开放、没有标准答案的科技项目。</p><p>我们希望把硅谷和顶尖大学所重视的项目制学习、工程协作和创新文化带给更多中国学生。让他们从提出问题开始，亲手创造、参与竞争、解决问题，也在长期投入中发现自己的兴趣与方向。</p><p>从一张图纸走到一台机器人，这中间的讨论、失败和修改，就是学习发生的地方。</p></div></section>'

about+=f'<section class="content-section">{section_head("02","我们在做什么","OUR PROGRAMS")}{rows([("FRC 机器人竞赛项目","学校校队建设与长期运营、俱乐部队、赛季备赛与工程集训、校内课程及教师支持、寒暑假工程营。具体项目安排在交流后确定。")])}<div class="actions">{link("frc.html","FRC 项目")}</div></section>'
about+=f'<section class="content-section values">{section_head("03","我们相信什么","OUR VALUES")}{rows([("真项目","真实的限制、数据与测试，让学生知道知识在什么时候有用。"),("长期投入","把时间留给反复尝试，重视连续的积累与复盘。"),("团队协作","技术和协作同样重要。把想法说明白，也让队友的工作能够接上。"),("发现天赋","帮助学生在实践中认识自己，逐渐找到愿意持续投入的方向。")])}</section>'
about+=f'<section class="content-section" id="mentors">{section_head("04","导师团队","PEOPLE OF FOUNDRYX")}{mentor_cards()}</section>'+cta()
shell('about.html','关于 FoundryX',about,'about.html')
for m in mentors:
 body=intro(m['tag'],m['name'],m['focus'],link('about-mentors.html#mentors','返回导师团队'))
 if APPROVED_BIOS:
  body+=f'<section class="content-section split-editorial"><div class="mentor-profile-initials" aria-hidden="true">{m["initials"]}</div><div class="prose"><p class="lead">{m["intro"]}</p>'+''.join(f'<h2>{h}</h2><p>{p}</p>' for h,p in m['parts'])+'</div></section>'
 else:
  public_parts=[('教育与职业背景','完整履历正在核对，确认后更新。'),('相关项目经验','FRC 的个人历史项目将按赛季与参与角色补充。')]
  if m['parts']:
   public_parts+=m['parts'][2:]
  else:
   public_parts += [('在 FoundryX 负责什么','具体项目分工将随导师介绍更新。'),('与中学生一起做项目','教学方式与学生项目记录将在导师专访中展开。')]
  body+=f'<section class="content-section split-editorial"><div class="mentor-profile-initials" aria-hidden="true">{m["initials"]}</div><div class="prose"><p class="lead">{m["intro"]}</p>'+''.join(f'<h2>{h}</h2><p>{p}</p>' for h,p in public_parts)+'</div></section>'
 body+='<p class="content-section profile-source">背景信息依据 FoundryX 提供的介绍整理；涉及任职、排名与历史赛绩的具体日期及公开记录将随档案更新。</p>'
 body+=cta('从你的兴趣，<br>聊到具体的项目。')
 shell('mentors/'+m['id']+'.html',m['name']+' · 导师团队',body,'about.html')

programs=intro('PROGRAMS','选择一条路径，<br><em>开始一个真实项目。</em>','从兴趣、基础和可投入时间出发，找到适合长期参与的方向。')+paths
programs+=f'<section class="content-section">{section_head("02","从哪里开始","FIND YOUR START")}<div class="comparison"><div><p class="eyebrow">FRC ROBOTICS</p><h2>想把东西造出来。</h2><p>喜欢机械、编程、动手制作或团队活动，希望参与一个长期协作的工程项目。</p><ul><li>面向高中阶段学生</li><li>需要现场制作、测试与团队协作</li><li>机械、电控、编程、策略与运营都有角色</li></ul>{link("frc.html","了解 FRC")}</div></div></section>'+cta()
shell('programs.html','项目',programs,'programs.html')

frc=intro('FRC ROBOTICS','一支队伍。<br><em>一整个赛季的创造。</em>','FRC，即 FIRST Robotics Competition，是高中阶段学生在导师支持下，围绕每年发布的挑战设计、制造和编程大型机器人，并以联盟形式参加比赛的项目。',consult(project='frc'))
frc+='<nav class="section-nav" aria-label="FRC 页内导航">'+''.join(f'<a href="frc.html#{i}">{t}</a>' for i,t in [('frc','学生做什么'),('roles','角色分工'),('season','赛季时间线'),('services','项目支持'),('teams','我们的队伍'),('frc-faq','常见问题')])+'</nav>'
frc+='<section class="video-feature" id="competition-video"><p class="eyebrow">FRC ON THE FIELD</p><h2>走进一场真正的机器人比赛。</h2><p>2026 FIRST Championship · Einstein Final 1。观看机器人、驾驶组与联盟在真实赛场中的配合。</p><iframe src="https://www.youtube-nocookie.com/embed/EjF9we707DA" title="Einstein Final 1 - 2026 FIRST Championship 官方比赛录像" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe><a class="line-link" href="https://www.youtube.com/watch?v=EjF9we707DA" target="_blank" rel="noopener">在 YouTube 观看 ↗</a> <a class="line-link" href="https://frc-events.firstinspires.org/2026/CMPTX/playoffs/14" target="_blank" rel="noopener">官方比赛记录 ↗</a></section>'
frc+='<section class="content-section" id="frc">'+section_head('01','学生到底要完成什么','BUILD / TEST / COMPETE')+rows([('先读懂比赛，再决定造什么','从规则、场地与得分任务开始，判断什么值得优先完成。把目标变成设计要求，用原型验证可行性，在时间、资源与可靠性之间做取舍。'),('让结构、电路与程序一起工作','使用 CAD、加工装配、连接电控与传感器，再编写和调试控制代码。测试中的偏差和失败，需要团队回到机械、电气与软件中共同排查。'),('上场靠配合，场外也有分工','三支队伍组成联盟，协商策略、观察对手、维修机器人。队伍还要管理预算、寻找支持者、记录工程进展，开展传播和社区活动。')])+link('index.html#frc','探索 FRC 的三个现场章节')+'</section>'
frc+=f'<section class="content-section" id="roles">{section_head("02","每一种能力，<br>都能在队伍里找到位置。","TEAM ROLES")}{rows([("机械与制造","读规则、画草图、使用 CAD、做原型、加工装配和机构测试。好的结构要能完成任务，也要便于维修。"),("电控与编程","整理电路与通信，连接控制器、传感器和电机，编写控制程序；从日志和测试中找到机器人动作失常的原因。"),("驾驶与赛场策略","驾驶组练习操作与配合；策略和 Scouting 成员观察比赛、整理信息，帮助联盟做出更有依据的选择。"),("运营与传播","制定预算、联系支持者、记录工程进度、设计队伍形象与组织社区活动。写作、视觉设计和组织能力同样有价值。")])}</section>'
season=[('赛前准备','熟悉工具与团队','练习基础制作、CAD、电控和程序；整理设备与预算，确定分工，也为新成员安排可以上手的小任务。'),('每年一月','Kickoff：读懂新挑战','一起看发布活动、读规则和场地图，讨论得分方式与限制。目标不是立刻做出复杂方案，而是找到可完成的优先任务。'),('赛季制作','原型、装配与迭代','把机械、电控和程序接起来。记录测试结果，修改不稳定的部分，让机器人能够重复完成任务。'),('正赛阶段','检录、比赛与复盘','完成赛事要求，在赛场与联盟沟通，在维修区解决问题。比赛之间继续观察、调整和练习。'),('赛后与季后赛','把经验留给下一季','整理图纸、代码和工作记录；用季后赛和训练帮助新队员接手，也检验新的方案。')]
frc+=f'<section class="content-section season-section" id="season">{section_head("03","一个完整赛季，<br>怎样发生。","SEASON TIMELINE")}<div class="season-timeline">'+''.join(f'<article><span>{n}</span><h3>{h}</h3><p>{p}</p></article>' for n,h,p in season)+'</div><p class="source-note">具体正赛、季后赛和晋级安排以当季 FIRST 规则及主办方日程为准。</p></section>'
frc+=f'<section class="content-section" id="services">{section_head("04","FoundryX 如何参与","PROGRAM SUPPORT")}{rows([("我想加入俱乐部队","从现有基础、兴趣和时间安排出发，讨论适合的训练任务和队内角色，逐步参与工程与赛季协作。"),("学校已经有校队","围绕现有团队提供工程技术、赛季备赛和长期训练支持，与学校老师共同明确分工与目标。"),("学校希望从零建队","讨论场地、设备、预算、招募、课程和教师支持，建立能够持续运营的校队机制。")])}<div class="service-strip"><span>学校校队建设与运营</span><span>赛季备赛与工程集训</span><span>校内课程与教师支持</span><span>寒暑假工程营</span></div><div class="actions">{consult(project="frc")}{consult("咨询校队合作","school")}</div></section>'
frc+=f'<section class="content-section">{section_head("05","工程问题，和导师一起拆解。","MENTORS")}{mentor_cards(["theo","steve","adrian"])}</section>'
frc+=(SRC/'teams.html').read_text()
frc+=f'<section class="content-section compact-section">{section_head("07","赛季结束，经验留下。","RESULTS & RECORDS")}<p class="lead">查看队伍赛果、参与角色与项目记录。每条成绩都标明赛季和归属。</p>{link("results.html","查看历史战绩")}{link("stories.html","阅读赛场与工程故事")}</section>'
frc+=f'<section class="content-section" id="frc-faq">{section_head("08","先把这些问题聊清楚。","FAQ")}{faq([("没有编程基础，也可以参加吗？","可以从适合当前能力的任务开始。FRC 包含机械、电控、编程、策略、传播和运营，不要求每个人入队前都会所有技术。更重要的是愿意持续学习、配合团队并遵守安全要求。"),("一个赛季要投入多少时间？","安排会随队伍、角色和赛季阶段变化。报名交流时应明确常规训练、集中制作、赛事出行和考试周安排，再判断能否长期投入。"),("如何平衡比赛与学校学习？","提前把校内考试和赛事节点放进同一份日历。工作拆成可交接的任务，保持记录，避免把关键知识集中在一个人手里。"),("参加 FRC 就能获得奖项或录取优势吗？","比赛结果取决于项目质量、协作、投入和具体赛制，不能保证。持续完成项目、说明自己的实际贡献与反思，比简单列出参与名称更有意义。")])}{link("knowledge.html#frc-start","更多 FRC 问题")}</section>'+cta()
shell('frc.html','FRC 机器人竞赛',frc,'programs.html',scripts='')

resultpage=intro('RESULTS & RECORDS','每一份成果，<br><em>都有自己的来处。</em>','按赛季、队伍与参与角色记录结果。机构项目、辅导队伍、导师历史经历和学生个人成绩分别呈现。')
resultpage+='<section class="content-section"><div class="filter-tabs" aria-label="战绩分类">'+''.join(f'<button data-result-filter="{i}" aria-pressed="{str(i=="all").lower()}">{t}</button>' for i,t in [('all','全部'),('frc','FRC'),('growth','学生成长'),('schools','学校项目')])+'</div><div class="result-archive">'
resultpage+='''<article class="result-case" data-result-category="frc"><div class="case-year">2026<span>FRC / 季后赛</span></div><div><p class="eyebrow">队伍赛事成绩</p><h2>中国季后赛 · 三亚</h2><p>8810 所在联盟获得冠军，9997 所在联盟获得亚军。</p><dl class="result-details"><div><dt>冠军联盟</dt><dd>8214 · 8810 · 9996</dd></div><div><dt>亚军联盟</dt><dd>9997 · 11118 · 7002</dd></div><div><dt>赛事标识</dt><dd>2026 OTSAN</dd></div><div><dt>FoundryX 参与角色</dt><dd>项目关系与具体支持范围整理中</dd></div></dl><a class="line-link" href="https://frc-events.firstinspires.org/2026/OTSAN/playoffs" target="_blank" rel="noopener">查看 FIRST 官方结果 <span>↗</span></a></div></article>'''
for year,team,title,event,url in [('2026','6941 IronPulse','上海区域赛 · 冠军联盟','2026 CNSH','https://frc-events.firstinspires.org/2026/CNSH/awards'),('2026','8810 The Alphabots','Creativity Award','2026 上海区域赛 · Rockwell Automation 赞助','https://frc-events.firstinspires.org/2026/CNSH/awards'),('2025','8810 The Alphabots','Rising All-Star Award','2025 上海区域赛','https://frc-events.firstinspires.org/team/8810')]:
 resultpage+=f'<article class="result-case" data-result-category="frc"><div class="case-year">{year}<span>FRC / 队伍历史成绩</span></div><div><p class="eyebrow">{team}</p><h2>{title}</h2><p>{event}</p><dl class="result-details"><div><dt>成绩主体</dt><dd>{team}</dd></div><div><dt>FoundryX 参与角色</dt><dd>该赛季具体支持关系待补充</dd></div></dl>{link(url,"FIRST 官方记录")}</div></article>'
for cat,name,desc in [('growth','辅导学生进入美国 Top 20 大学','来自 FoundryX 提供的成果方向。具体学生、录取年份、学校、榜单口径与项目贡献待补充；个人案例在确认资料与展示授权后更新。'),('schools','合作学校与项目','逐项记录学校、合作年份、项目内容与 FoundryX 承担的角色。学校项目名单可在 FRC 队伍页面查看。')]:
 resultpage+=f'<article class="result-case empty-case" data-result-category="{cat}"><div class="case-year">—<span>档案整理中</span></div><div><h2>{name}</h2><p>{desc}</p>{link("frc.html#teams","查看我们的队伍") if cat=="schools" else ""}</div></article>'
resultpage+='<article class="result-case empty-case" data-result-category="frc"><div class="case-year">2026<span>补充核对</span></div><div><h2>TIMKEN FRC 中国赛季总冠军</h2><p>该称谓来自提供的内容方案。赛事名称、获奖队伍、奖项口径与 FoundryX 角色核对后，将与官方赛果对应呈现，避免重复统计。</p></div></article></div></section>'+cta()
shell('results.html','历史战绩',resultpage,'results.html')

stories=intro('STORIES & JOURNAL','把过程留下，<br><em>把经历讲清楚。</em>','设计、测试、比赛与复盘。用具体的工作记录一段项目经历。')
stories+='<section class="content-section"><div class="section-heading"><h2>让作品与经历，<br>由学生自己讲述。</h2></div><p class="lead">训练、加工、编程、比赛与复盘。</p>'+link('index.html#moments','浏览 FIRST 赛事影像')+'</section>'
topics=json.loads((SRC/'story-topics.json').read_text())
topic_cards='<section class="content-section"><div class="section-heading">'+label('02','STUDENT CHAPTERS')+'<h2>六个专题，<br><em>记录创造的过程。</em></h2></div><div class="story-topics">'
for i,topic in enumerate(topics):
 topic_cards+=f'<article class="story-topic">{label(f"{i+1:02}","专题 · 记录整理中")}<h3>{topic["title"]}</h3><p>{topic["summary"].replace("专题素材待补。", "")}</p>{link("stories/"+topic["id"]+".html","查看专题")}</article>'
 topic_body=intro('STUDENT CHAPTERS',topic['title'],topic['summary'].replace('专题素材待补。',''))
 topic_body+='<section class="content-section split-editorial"><div>'+label('COMING SOON','记录整理中')+'<h2>把经历，留给亲历者讲述。</h2></div><div class="prose">'+link('stories.html','返回故事与动态')+'</div></section>'
 shell('stories/'+topic['id']+'.html',topic['title'],topic_body,'stories.html')
topic_cards+='</div></section><section class="content-section"><p class="eyebrow">NEWS & INTERVIEWS</p><h2>故事与动态，持续更新。</h2><p class="lead"></p></section>'
shell('stories.html','故事与动态',stories+topic_cards+cta(),'stories.html')

contact=intro('CONTACT','从兴趣，<br><em>聊到下一步。</em>','告诉我们你现在的基础、期待与可投入时间。让一次交流从具体问题开始。')
contact+=f'<section class="content-section contact-choices"><article>{label("01","学生 / 家长")}<h2>预约项目评估</h2><p>一起了解兴趣、基础和学习节奏，讨论 FRC 是否适合当前阶段。</p><ul><li>当前年级与已有经验</li><li>最想尝试的项目或方向</li><li>每周可投入时间与近期目标</li></ul>{consult()}</article><article>{label("02","学校合作")}<h2>一起建一支队伍</h2><p>围绕已有团队或新建校队，讨论课程、场地、设备、教师支持和赛季安排。</p><ul><li>学校当前项目与学生规模</li><li>可用场地、设备和训练安排</li><li>希望获得的具体支持</li></ul>{consult("咨询校队合作","school")}</article></section>'
contact+='<section class="contact-note content-section"><p class="eyebrow">联系方式</p><h2>正式咨询渠道即将更新。</h2><p>你可以先整理咨询清单并保存。当前表单不会发送个人信息，也不会自动完成预约。</p></section>'
shell('contact.html','联系我们',contact,'contact.html')

# Knowledge has complete static article pages. Search is progressive enhancement.
knowledge_file=SRC/'knowledge.json'
if knowledge_file.exists():
 data=json.loads(knowledge_file.read_text());articles=data['articles'] if isinstance(data,dict) else data
else: articles=[]
# Preserve stable home anchors regardless of researchers' article ids.
aliases={'frc':['frc-start','frc-season','frc-roles','frc-parents','frc-growth','frc-technology']}
counts={'frc':0}
for a in articles:
 a['anchor']=aliases[a['track']][counts[a['track']]];counts[a['track']]+=1
kb=intro('KNOWLEDGE BASE','把问题，<br><em>问明白。</em>','FRC 的入门、赛季、技术和家长指南。先理解项目，再决定如何参与。')
kb+='<section class="content-section knowledge-directory"><div class="knowledge-tools"><div class="filter-tabs" aria-label="知识库项目"><button data-knowledge-track="all" aria-pressed="true">全部</button><button data-knowledge-track="frc" aria-pressed="false">FRC</button></div><label class="knowledge-search">搜索问题<input id="knowledge-search" type="search" placeholder="例如：零基础"></label></div><p id="knowledge-count" class="source-note" aria-live="polite"></p><p id="knowledge-empty" hidden>没有找到相关问题。试试缩短关键词，或切换到全部。</p><div class="knowledge-list">'
for a in articles:
 questions=' '.join(s['heading'] for s in a['sections'])
 kb+=f'<article class="knowledge-card" id="{a["anchor"]}" data-track="{a["track"]}" data-search="{esc(a["title"]+" "+a["category"]+" "+questions,quote=True)}"><p class="eyebrow">{a["track"].upper()} / {a["category"]}</p><h2><a href="read/{a["id"]}.html">{a["title"]}</a></h2><p>{a["summary"]}</p><ul>'+''.join(f'<li><a href="read/{a["id"]}.html#q{i}">{s["heading"]}</a></li>' for i,s in enumerate(a['sections']))+f'</ul>{link("read/"+a["id"]+".html","阅读全文")}</article>'
 article=intro(a['track'].upper()+' / '+a['category'],a['title'],a['summary'],link('knowledge.html','返回知识库'))
 article+='<div class="article-layout"><aside class="article-toc"><p class="eyebrow">本文目录</p>'+''.join(f'<a href="read/{a["id"]}.html#q{i}">{s["heading"]}</a>' for i,s in enumerate(a['sections']))+'</aside><article class="article-body">'
 for i,s in enumerate(a['sections']):
  article+=f'<section id="q{i}"><h2>{s["heading"]}</h2>'+''.join(f'<p>{p}</p>' for p in s['paragraphs'])+'</section>'
 article+='<section class="article-sources"><h2>参考资料</h2><p>编辑于 2026 年 9 月。具体规则以当季赛事与平台官方说明为准。</p><ul>'+''.join(f'<li><a href="{s["url"]}" target="_blank" rel="noopener">{s["label"]} ↗</a></li>' for s in a['sources'])+'</ul></section></article></div>'+cta('还有更具体的问题？')
 shell('read/'+a['id']+'.html',a['title'],article,'knowledge.html')
kb+='</div></section>'+cta('把你的问题，带来聊聊。')
shell('knowledge.html','FRC 知识库',kb,'knowledge.html')
# Independent, reviewable FRC scroll concept. Existing pages retain their content.
shutil.copyfile(ROOT/'src/immersive/index.html',OUT/'immersive.html')
shutil.copyfile(ROOT/'src/immersive/style.css',OUT/'immersive.css')
generated.add('immersive.html')
# The Site card opens /: serve the current experience at that entry point too.
shutil.copyfile(OUT/'index.html',OUT/'overview.html')
generated.add('overview.html')
for route in generated-{'immersive.html'}:
 p=OUT/route
 p.write_text(re.sub(r'href="index.html#(frc|moments|teams|join|programs|schools|top|main)(?=")',r'href="overview.html#\1',p.read_text()))
shutil.copyfile(OUT/'immersive.html',OUT/'index.html')
build_chapters(ROOT,generated)
build_legacy_routes(ROOT,generated)
# Reconcile generated routes so removed programs cannot remain directly accessible.
for old in OUT.rglob('*.html'):
 if old.relative_to(OUT).as_posix() not in generated: old.unlink()
print('Generated',len(list(OUT.rglob('*.html'))),'HTML pages;',len(articles),'knowledge articles.')
