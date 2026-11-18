from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse,unquote
import json,collections
root=Path(__file__).resolve().parents[2]/'dist/client'
class Page(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.ids=[];self.images=[];self.h1=0;self.base=''
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  if tag=='base':self.base=d.get('href','')
  if 'id' in d:self.ids.append(d['id'])
  if tag=='h1':self.h1+=1
  if tag=='img':self.images.append(d.get('src',''))
  if tag=='video':self.links.extend([d.get('data-src',''),d.get('data-src-mobile',''),d.get('poster','')])
  if 'data-video-src' in d:self.links.extend([d['data-video-src'],d.get('data-video-poster','')])
  if tag in ['a','script','link','img','source','video']:self.links.append(d.get('href') or d.get('src') or '')
pages={p:Page() for p in root.rglob('*.html')}
for p,o in pages.items():o.feed(p.read_text())
errors=[]
for p,o in pages.items():
 if o.h1!=1:errors.append((p.name,'h1',o.h1))
 if len(o.ids)!=len(set(o.ids)):errors.append((p.name,'duplicate IDs'))
 for url in o.links:
  u=urlparse(url)
  if u.scheme or u.netloc or not url:continue
  target=((root/unquote(u.path).lstrip('/')) if u.path.startswith('/') else (p.parent/o.base/unquote(u.path))).resolve() if u.path else p
  if target.is_dir():target=target/'index.html'
  if not target.exists():errors.append((str(p.relative_to(root)),url,'missing file'))
  elif u.fragment and target in pages and u.fragment not in pages[target].ids:errors.append((p.name,url,'missing anchor'))
photos=collections.defaultdict(list)
for p,o in pages.items():
 if p.name=='immersive.html':continue # Same canonical homepage, alternate URL.
 for src in o.images:
  if '/photos/' in src:photos[src].append(str(p.relative_to(root)))
# Responsive alternatives on one document share the same supplied photograph.
repeat={k:sorted(set(v)) for k,v in photos.items() if len(set(v))>1}
report={'pages':len(pages),'articles':len(list((root/'read').glob('*.html'))),'questions':sum(len(a['sections']) for a in json.loads(Path('src/site/knowledge.json').read_text())['articles']),'errors':errors,'repeatedPhotos':repeat}
print(json.dumps(report,ensure_ascii=False,indent=2))
assert not errors and not repeat, 'Page integrity check failed'
photos_on_disk=list((root/'assets/photos').iterdir())
immersive_photos=json.loads(Path('src/immersive/photos.json').read_text())
assert len(photos_on_disk)==26+len(immersive_photos) and all(p.name.startswith(('frc-', 'official-')) for p in photos_on_disk), 'Only the selected official photographs are permitted'
allowed_videos={root/'assets/films'/name for name in [
 'frc-field-film-20260928.mp4','frc-growth-film-20260928.mp4',
 'frc-season-film-20260928.mp4','frc-roles-film-20260928.mp4',
 'frc-library-05-film-20260928.mp4','frc-library-06-film-20260928.mp4',
 'frc-library-07-film-20260928.mp4','frc-library-08-film-20260928.mp4',
 'frc-library-09-film-20260928.mp4',
]}
allowed_videos.update(root/'assets/films-mobile'/f'frc-{key}-960-20261001.mp4' for key in ('field','season','roles','growth'))
allowed_videos.update(root/'assets/films-stream'/f'frc-library-{number:02d}-960-20261008.mp4' for number in range(5,10))
allowed_videos.update(root/'assets/welcome-film'/name for name in (
 'welcome-2s-20261004.mp4', 'welcome-2s-red-x.mp4', 'welcome-2s-red-x-fast.mp4',
))
assert all(p in allowed_videos for p in root.rglob('*.mp4')), 'Only the user-requested FRC videos may be included'

assert report['pages']==29 and report['articles']==6 and report['questions']==28
assert (root/'index.html').read_bytes()==(root/'immersive.html').read_bytes(), 'Site card and immersive entry must open the same version'
for p in root.rglob('*'):
 if p.is_file() and p.suffix in ['.html','.js']:
  assert not __import__('re').search(r'kaggle|数据科学|Leon Li|AI User|AI Builder|AI Competitor', p.read_text(), __import__('re').I), str(p)
