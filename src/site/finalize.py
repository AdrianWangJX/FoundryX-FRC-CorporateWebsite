"""Prepare document entry points, resource fingerprints and HTTP cache rules."""
from functools import lru_cache
from hashlib import sha256
import json
from pathlib import Path
import re
import shutil

from icons import normalize_arrow_icons
from localization import bundle_language, localize_shell

SOURCE = Path(__file__).resolve().parent
OUTPUT = SOURCE.parents[1] / 'dist/client'
SCRIPT_OR_STYLE = re.compile(r'((?:src|href)=")([^"#]+\.(?:js|css)(?:\?[^"#]*)?)(")')


@lru_cache(maxsize=None)
def fingerprint(path):
    return sha256(path.read_bytes()).hexdigest()[:12]


def finish_page(page, refresh, icon_hash):
    text = normalize_arrow_icons(page.read_text())
    # Remove head assets owned by this step before reinserting in their cascade order.
    text = re.sub(r'<link[^>]+href="(?:mobile|language)\.css(?:\?[^"]*)?"[^>]*>', '', text)
    text = re.sub(r'<script src="language\.js(?:\?[^"]*)?"></script>', '', text)
    text = re.sub(r'<script data-refresh-entry>.*?</script>', '', text, flags=re.S)
    text = text.replace('</head>', '<link rel="stylesheet" href="mobile.css"></head>', 1)
    home = '../' * (len(page.relative_to(OUTPUT).parts) - 1) + 'index.html'
    bootstrap = refresh.replace('__HOME_PATH__', json.dumps(home))
    text = text.replace('<head>', '<head><script data-refresh-entry>' + bootstrap + '</script>', 1)
    text = re.sub(r'<link\b[^>]*\brel="icon"[^>]*>',
                  f'<link rel="icon" type="image/svg+xml" href="assets/favicon-logo.svg?v={icon_hash}">',
                  text)
    text = localize_shell(text)
    base = re.search(r'<base href="([^"]+)"', text)
    base_dir = page.parent / (base[1] if base else '')

    def version_resource(match):
        prefix, url, suffix = match.groups()
        if '://' in url or url.startswith(('data:', '//')):
            return match[0]
        name = url.split('?')[0]
        resource = (base_dir / name).resolve()
        if not resource.is_file():
            return match[0]
        return f'{prefix}{name}?v={fingerprint(resource)}{suffix}'

    page.write_text(SCRIPT_OR_STYLE.sub(version_resource, text))


def main():
    bundle_language(SOURCE, OUTPUT)
    icon = OUTPUT / 'assets/favicon-logo.svg'
    shutil.copyfile(SOURCE / 'favicon-logo.svg', icon)
    refresh = (SOURCE / 'refresh-entry.js').read_text()
    nav = (SOURCE / 'navigation.js').read_text()
    (OUTPUT / 'chrome.js').write_text(nav + (SOURCE / 'chrome.js').read_text())

    headers = []
    for page in sorted(OUTPUT.rglob('*.html')):
        finish_page(page, refresh, fingerprint(icon))
        path = '/' + page.relative_to(OUTPUT).as_posix()
        for route in sorted({path, path[:-10] if path.endswith('/index.html') else path[:-5]}):
            headers.append(f'{route}\n  Cache-Control: no-cache, max-age=0, must-revalidate\n')
    assert not any(p.suffix in ('.js', '.css') for p in (OUTPUT / 'assets').rglob('*'))
    for pattern in ('/*.js', '/*.css', '/assets/*'):
        headers.append(f'{pattern}\n  Cache-Control: private, max-age=3600\n')
    (OUTPUT / '_headers').write_text(''.join(headers))


if __name__ == '__main__':
    main()
