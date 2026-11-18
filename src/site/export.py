"""Export self-contained homepage previews and a complete static HTTP archive.

Run after npm run build. Preview HTML embeds its code and visual assets; long
films stream from the official site. The ZIP keeps every built asset unchanged
and is intended for a normal HTTP server, not file:// module loading.
"""
from __future__ import annotations

import argparse
import base64
import html
from html.parser import HTMLParser
import json
import mimetypes
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote, urljoin, urlsplit, urlunsplit
import zipfile

from static_routes import alias_entries

ROOT = Path(__file__).resolve().parents[2]
MEDIA = {'.mp4', '.webm', '.mov', '.mp3', '.ogg', '.wav'}
STORED = MEDIA | {'.jpg', '.jpeg', '.png', '.webp', '.avif', '.gz', '.zip', '.woff2'}
# These expressions handle URL tokens inside CSS and complete JS asset literals;
# HTML structure is handled by HTMLParser, and JS imports by esbuild.
CSS_URL = re.compile(r'url\(\s*([\'"]?)([^)\'"\s]+)\1\s*\)', re.I)
JS_ASSET = re.compile(r'(?P<quote>[\'"`])(?P<url>/?assets/[\w./%-]+(?:\?[^\'"`\\\s]*)?)(?P=quote)')


def tag(name, attrs):
    return '<' + name + ''.join(' ' + key + ('' if value is None else '="' + html.escape(value, quote=True) + '"') for key, value in attrs) + '>'


def safe_script(code):
    return re.sub(r'</script', r'<\\/script', code, flags=re.I)


class Resources:
    def __init__(self, dist: Path, site: str):
        self.dist, self.site = dist, site
        self.embedded = {}
        self.streamed = set()
        self.needs_cad = False
        self.modules = {}

    def local_path(self, url, relative_to='index.html'):
        parts = urlsplit(url)
        if parts.scheme or parts.netloc or not parts.path:
            return None
        path = (self.dist / unquote(parts.path.lstrip('/')) if parts.path.startswith('/') else
                self.dist / Path(relative_to).parent / unquote(parts.path)).resolve()
        if not path.is_relative_to(self.dist):
            raise ValueError(f'Resource leaves build directory: {url}')
        return path

    def asset(self, url, relative_to='index.html'):
        path = self.local_path(url, relative_to)
        if path is None:
            return url
        if not path.is_file():
            raise FileNotFoundError(f'Missing export resource: {url}')
        relative = path.relative_to(self.dist).as_posix()
        # Never read the long films into memory, even if mentioned in JS data.
        if path.suffix.lower() in MEDIA and not relative.startswith('assets/welcome-film/'):
            self.streamed.add(relative)
            return urljoin(self.site, relative)
        if path.stat().st_size > 16 * 1024 * 1024:
            raise ValueError(f'Visual asset too large to embed safely: {relative}')
        if relative not in self.embedded:
            mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
            self.embedded[relative] = 'data:' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode('ascii')
        fragment = urlsplit(url).fragment
        return self.embedded[relative] + ('#' + fragment if fragment else '')

    def css(self, code, relative_to):
        return CSS_URL.sub(lambda match: 'url("' + self.asset(match[2], relative_to) + '")', code)

    def javascript(self, code):
        def replace(match):
            url = match['url']
            if url.endswith('/'):
                if url.lstrip('/') == 'assets/welcome-cad/':
                    self.needs_cad = True
                return match[0]
            return json.dumps(self.asset(url), ensure_ascii=False)
        return JS_ASSET.sub(replace, code)

    def module(self, path):
        if path not in self.modules:
            # Rebundle the published entry, not source: this preserves the exact
            # approved build and folds all split dynamic imports into one module.
            result = subprocess.run([
                str(ROOT / 'node_modules/.bin/esbuild'), str(path), '--bundle',
                '--format=esm', '--platform=browser', '--target=es2020', '--minify',
                '--log-level=warning',
            ], check=True, capture_output=True, text=True)
            self.modules[path] = result.stdout
        return self.modules[path]

    def bootstrap(self):
        cad = {}
        if self.needs_cad:
            for path in sorted((self.dist / 'assets/welcome-cad').iterdir()):
                if path.is_file():
                    cad[path.name] = self.asset(path.relative_to(self.dist).as_posix())
        # Only CAD uses fetch; images/fonts/video point directly to data URLs.
        # Request objects retain their abort signal and fetch options.
        code = '''(()=>{
 const cad=CAD;
 if(Object.keys(cad).length){
  const original=window.fetch.bind(window);
  window.fetch=(input,init)=>{
   const url=new URL(input instanceof Request?input.url:String(input),location.href);
   const name=url.pathname.split('/').pop();
   if(url.pathname.includes('/assets/welcome-cad/')&&Object.hasOwn(cad,name)){
    const options=input instanceof Request?{method:input.method,headers:input.headers,signal:input.signal,...init}:init;
    return original(cad[name],options);
   }
   return original(input,init);
  };
 }
 function localizeLinks(){
  const lang=document.documentElement.lang.startsWith('en')?'en':'zh';
  document.querySelectorAll('a[data-export-page]').forEach(link=>{
   const url=new URL(link.href);url.searchParams.set('lang',lang);link.href=url.href;
  });
 }
 document.addEventListener('DOMContentLoaded',localizeLinks);
 document.addEventListener('fx:languagechange',localizeLinks);
})();'''.replace('CAD', json.dumps(cad, separators=(',', ':')))
        return '<script data-export-bootstrap>' + safe_script(code) + '</script>'


class Standalone(HTMLParser):
    def __init__(self, resources, page):
        super().__init__(convert_charrefs=False)
        self.resources, self.page = resources, page
        self.output = []
        self.raw = None
        self.scripts = []

    def handle_starttag(self, name, attributes):
        attrs = dict(attributes)
        if name == 'base' or name == 'link' and attrs.get('rel') in {'preload', 'modulepreload', 'prefetch'}:
            return
        if name == 'link' and attrs.get('rel') == 'stylesheet':
            path = self.resources.local_path(attrs['href'], self.page)
            if path is None:
                raise ValueError('Standalone preview requires local stylesheets')
            css = self.resources.css(path.read_text(encoding='utf-8'), path.relative_to(self.resources.dist).as_posix())
            self.output.append('<style>' + css + '</style>')
            return
        if name in {'script', 'style'}:
            self.raw = (name, attrs, [])
            return
        for key in ('src', 'poster', 'data-src', 'data-src-mobile'):
            if attrs.get(key):
                attrs[key] = self.resources.asset(attrs[key], self.page)
        if attrs.get('srcset') and not attrs['srcset'].startswith('data:'):
            candidates = []
            for candidate in attrs['srcset'].split(','):
                url, *descriptor = candidate.strip().split()
                candidates.append(' '.join([self.resources.asset(url, self.page), *descriptor]))
            attrs['srcset'] = ', '.join(candidates)
        if name == 'link' and attrs.get('href'):
            attrs['href'] = self.resources.asset(attrs['href'], self.page)
        if name == 'a' and attrs.get('href'):
            url = urlsplit(attrs['href'])
            if not url.scheme and not url.netloc and url.path:
                path = self.resources.local_path(attrs['href'], self.page)
                relative = path.relative_to(self.resources.dist).as_posix()
                if relative in {'index.html', 'immersive.html'}:
                    attrs['href'] = urlunsplit(('', '', '', url.query, url.fragment)) or '#'
                elif path.suffix == '.html':
                    if not path.is_file():
                        raise FileNotFoundError(f'Missing linked page: {relative}')
                    attrs['href'] = urljoin(self.resources.site, relative) + ('?' + url.query if url.query else '') + ('#' + url.fragment if url.fragment else '')
                    attrs['data-export-page'] = ''
        if attrs.get('style'):
            attrs['style'] = self.resources.css(attrs['style'], self.page)
        self.output.append(tag(name, attrs.items()))

    def handle_endtag(self, name):
        if name == 'head':
            self.output.append('<!-- export-bootstrap -->')
        if self.raw and self.raw[0] == name:
            _, attrs, pieces = self.raw
            self.raw = None
            code = ''.join(pieces)
            if name == 'script':
                if attrs.get('src'):
                    path = self.resources.local_path(attrs.pop('src'), self.page)
                    if path is None:
                        raise ValueError('Standalone preview requires local scripts')
                    code = self.resources.module(path) if attrs.get('type') == 'module' else path.read_text(encoding='utf-8')
                    # Resource-integrity hashes no longer apply to inline code.
                    for key in ('integrity', 'crossorigin', 'defer', 'async'):
                        attrs.pop(key, None)
                if 'data-refresh-entry' in attrs:
                    # A renamed standalone HTML must never reload index.html.
                    code = """(()=>{if(performance.getEntriesByType?.('navigation')[0]?.type!=='reload')return;
const url=new URL(location.href);url.hash='';history.replaceState(history.state,'',url.href);
history.scrollRestoration='manual';scrollTo({top:0,left:0,behavior:'instant'});})();"""
                code = self.resources.javascript(code)
                if attrs.get('type', '') in {'', 'module', 'text/javascript', 'application/javascript'}:
                    self.scripts.append((attrs.get('type') == 'module', code))
                code = safe_script(code)
            else:
                code = self.resources.css(code, self.page)
            self.output.append(tag(name, attrs.items()) + code + '</' + name + '>')
        else:
            self.output.append('</' + name + '>')

    def handle_data(self, data):
        (self.raw[2] if self.raw else self.output).append(data)

    def handle_entityref(self, name):
        self.handle_data('&' + name + ';')

    def handle_charref(self, name):
        self.handle_data('&#' + name + ';')

    def handle_comment(self, data):
        self.output.append('<!--' + data + '-->')

    def handle_decl(self, decl):
        self.output.append('<!' + decl + '>')

    def render(self):
        self.feed((self.resources.dist / self.page).read_text(encoding='utf-8'))
        self.close()
        for module, code in self.scripts:
            subprocess.run(['node', '--check', '--input-type=' + ('module' if module else 'commonjs')],
                           input=code, text=True, capture_output=True, check=True)
        return ''.join(self.output).replace('<!-- export-bootstrap -->', self.resources.bootstrap(), 1)


def archive_site(dist, output):
    files = sorted(path for path in dist.rglob('*') if path.is_file())
    names = {path.relative_to(dist).as_posix() for path in files}
    pages = [name for name in names if name.endswith('.html')]
    aliases = [(name, content) for name, content in alias_entries(pages) if name not in names]
    instructions = f'''FoundryX 完整网站 · 静态 HTTP 预览包

完整素材：{len(pages)} 个页面和 {len(aliases)} 个兼容入口，包含本地视频、图片、字体及脚本。

本地预览
1. 解压 ZIP，使用终端进入 FoundryX 文件夹。
2. 运行 python3 -m http.server 8000 --bind 127.0.0.1
3. 在浏览器打开 http://127.0.0.1:8000/；用 Ctrl+C 停止服务。
请通过 HTTP 访问，不要双击 index.html；浏览器会限制 file:// 的模块和模型加载。

单文件预览
两个独立 HTML 内嵌欢迎动画、照片、字体、脚本和 CAD；正文大视频从官网流式加载，其他内容页链接也需要联网。
完整 ZIP 的视频和内容页均在本地；外部参考资料仍需联网。

静态部署
将 FoundryX 文件夹内的全部文件放入静态服务器网站根目录，保留子目录结构。
包内的 .html 和目录兼容入口都可由普通静态 HTTP 服务器提供。

报名提交
静态包不含运行中的报名 API 或数据库。本地 HTTP 仅预览页面；报名功能须另行部署同域 /api/inquiries 后端。
'''
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in files:
            relative = path.relative_to(dist).as_posix()
            archive.write(path, 'FoundryX/' + relative,
                          compress_type=zipfile.ZIP_STORED if path.suffix.lower() in STORED else zipfile.ZIP_DEFLATED)
        for name, content in aliases:
            archive.writestr('FoundryX/' + name, content)
        archive.writestr('FoundryX/打开说明.txt', instructions)
    # testzip checks CRC in chunks; it never allocates whole video files.
    with zipfile.ZipFile(output) as archive:
        bad = archive.testzip()
        if bad:
            raise ValueError(f'Archive integrity failure: {bad}')
        assert len(archive.namelist()) == len(files) + len(aliases) + 1
    return {'pages': len(pages), 'aliases': len(aliases), 'files': len(files), 'bytes': output.stat().st_size}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dist', type=Path, default=ROOT / 'dist/client')
    parser.add_argument('--output', type=Path, default=ROOT / 'exports')
    parser.add_argument('--site', default='https://foundryx.xyz/')
    parser.add_argument('--standalone-only', action='store_true', help='Skip the complete static archive')
    args = parser.parse_args()
    dist, output = args.dist.resolve(), args.output.resolve()
    if output.is_relative_to(dist):
        parser.error('--output must be outside --dist')
    if urlsplit(args.site).scheme not in {'http', 'https'} or not urlsplit(args.site).netloc:
        parser.error('--site must be an absolute HTTP(S) URL')
    output.mkdir(parents=True, exist_ok=True)
    resources = Resources(dist, args.site.rstrip('/') + '/')
    report = {'standalone': []}
    for page, name in [('index.html', 'FoundryX-FRC.html'), ('immersive.html', 'FoundryX-FRC-沉浸体验.html')]:
        path = output / name
        path.write_text(Standalone(resources, page).render(), encoding='utf-8')
        report['standalone'].append({'file': name, 'bytes': path.stat().st_size})
    report['embedded_assets'] = len(resources.embedded)
    report['streamed_media'] = sorted(resources.streamed)
    if not args.standalone_only:
        report['archive'] = archive_site(dist, output / 'FoundryX-FRC-完整网站.zip')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
