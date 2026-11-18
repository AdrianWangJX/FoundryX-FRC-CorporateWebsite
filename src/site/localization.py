"""Add the shared language controls and bundle exact-source translations."""
import json
import re


def bundle_language(source, output):
    catalog = {}
    for name in ('home', 'about', 'library'):
        catalog.update(json.loads((source / 'i18n' / (name + '.json')).read_text()))
    runtime = (source / 'language.js').read_text()
    (output / 'language.js').write_text(runtime.replace(
        '__ENGLISH_CATALOG__', json.dumps(catalog, ensure_ascii=False, separators=(',', ':'))
    ))
    (output / 'language.css').write_bytes((source / 'language.css').read_bytes())


def localize_shell(page):
    page = page.replace('assets/brand-logo.svg', 'assets/brand-logo-stanford-red.png')
    if 'class="fx-header"' not in page:
        return page
    # Place the group after the nav in keyboard order. Mobile CSS places it
    # between the brand and the menu button in the first row.
    assets = '<link rel="stylesheet" href="language.css"><script src="language.js"></script>'
    page = page.replace('</head>', assets + '</head>', 1)
    if 'class="site-language"' in page:
        return page
    control = ('<div class="site-language" role="group" aria-label="语言">'
               '<button type="button" lang="zh-CN" data-site-language="zh" aria-pressed="true">中文</button>'
               '<span class="language-divider" aria-hidden="true">/</span>'
               '<button type="button" lang="en" aria-label="English" data-site-language="en" aria-pressed="false">EN</button>'
               '</div>')
    page = page.replace('</nav></header>', '</nav>' + control + '</header>', 1)
    # Native dialogs make the rest of the page inert. Keep the same controls
    # inside each dialog so the current playback or form can stay open.
    page = page.replace('<button class="video-dialog-close"', control + '<button class="video-dialog-close"', 1)
    page = re.sub(
        r'(<dialog id="(?:consult|detail)-dialog"[^>]*>)(<button class="dialog-close".*?</button>)',
        lambda match: match[1] + '<div class="dialog-toolbar">' + control + match[2] + '</div>',
        page,
    )
    return page
