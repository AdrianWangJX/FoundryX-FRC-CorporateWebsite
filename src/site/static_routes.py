"""Directory entry points for hosts without extensionless HTML routing."""
import html
import json
from pathlib import PurePosixPath


def alias_entries(pages):
    for name in sorted(pages):
        page = PurePosixPath(name)
        if page.name == 'index.html':
            continue
        target = '../' + page.name
        document = (
            '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<meta name="robots" content="noindex"><title>FoundryX</title>'
            '<script>location.replace(' + json.dumps(target) + '+location.search+location.hash);</script>'
            '</head><body><p><a href="' + html.escape(target, quote=True) + '">'
            '进入 FoundryX 页面</a></p></body></html>'
        )
        yield (page.with_suffix('') / 'index.html').as_posix(), document
