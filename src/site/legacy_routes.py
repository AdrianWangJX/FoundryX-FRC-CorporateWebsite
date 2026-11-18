"""Keep saved URLs useful after their content moves to the current site."""
import html
import json


def legacy_routes(stories):
    routes = {
        'overview.html': ('index.html#idea', {
            '#frc': 'index.html#about-frc', '#programs': 'index.html#about-frc',
            '#moments': 'index.html#showcase', '#teams': 'index.html#showcase',
            '#join': 'join.html#student', '#schools': 'join.html#partnership',
        }),
        'programs.html': ('index.html#about-frc', {}),
        'frc.html': ('index.html#about-frc', {
            '#roles': 'index.html#frc-roles', '#season': 'index.html#frc-season',
            '#teams': 'index.html#showcase', '#services': 'join.html#partnership',
            '#frc-faq': 'read/frc-start.html',
        }),
        'results.html': ('about.html#achievements', {}),
        'stories.html': ('index.html#showcase', {}),
        'contact.html': ('join.html#student', {
            '#' + section: 'join.html#' + section
            for section in ('student', 'partnership', 'team', 'sponsorship')
        }),
    }
    routes.update({
        'mentors/' + person + '.html': ('about-mentors.html#mentor-' + person, {})
        for person in ('theo', 'steve', 'adrian')
    })
    routes.update({
        'stories/' + story['id'] + '.html': ('index.html#showcase', {})
        for story in stories
    })
    return routes


def build_legacy_routes(root, generated):
    stories = json.loads((root / 'src/site/story-topics.json').read_text())
    for path, (destination, fragments) in legacy_routes(stories).items():
        base = '../' if '/' in path else './'
        # Saved URLs resolve to their current content on ordinary visits and
        # reloads, preserving the query string and mapped section.
        script = (
            '(()=>{'
            'const routes=' + json.dumps(fragments, ensure_ascii=False) + ';'
            'const target=new URL(routes[location.hash]||' + json.dumps(destination) + ',document.baseURI);'
            'target.search=location.search;location.replace(target.href);})();'
        )
        content = (
            '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<meta name="robots" content="noindex"><base href="' + base + '">'
            '<title>页面已更新 · FoundryX</title><script data-legacy-route>' + script + '</script>'
            '</head><body><main id="main"><h1>页面已更新</h1>'
            '<p><a href="' + html.escape(destination, quote=True) + '">前往 FoundryX 当前页面</a></p>'
            '</main></body></html>'
        )
        (root / 'dist/client' / path).write_text(content)
        generated.add(path)
