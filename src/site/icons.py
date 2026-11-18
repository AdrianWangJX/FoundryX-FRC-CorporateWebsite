"""Render decorative control arrows consistently, without changing HTML attributes."""
from html import unescape
from html.parser import HTMLParser
import re

# Every direction shares the same 24-unit geometry, line weight, and currentColor.
_ARROW_PATHS = {
    '↗': ('ne', 'M5 19 19 5M5 5h14v14'),
    '↖': ('nw', 'M19 19 5 5M5 19V5h14'),
    '↘': ('se', 'M5 5 19 19M5 19h14V5'),
    '↙': ('sw', 'M19 5 5 19M5 5v14h14'),
    '→': ('right', 'M4 12h16M13 5l7 7-7 7'),
    '←': ('left', 'M20 12H4M11 5l-7 7 7 7'),
    '↑': ('up', 'M12 20V4M5 11l7-7 7 7'),
    '↓': ('down', 'M12 4v16M5 13l7 7 7-7'),
}
_VARIATION = r'(?:[\ufe0e\ufe0f]|&#(?:65038|65039|[xX][fF][eE]0[eEfF]);)?'
_TEXT_TOKEN = re.compile(r'(?:[↗↖↘↙→←↑↓]|&(?:#\d+|#[xX][\da-fA-F]+|[A-Za-z]+);)' + _VARIATION)


def arrow_svg(direction='↗'):
    name, path = _ARROW_PATHS[direction]
    return (f'<svg class="fx-arrow fx-arrow--{name}" viewBox="0 0 24 24" '
            'width="1em" height="1em" fill="none" stroke="currentColor" '
            'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" '
            f'aria-hidden="true" focusable="false"><path d="{path}"/></svg>')


class _ControlTextRanges(HTMLParser):
    """Locate only control text; retain the original source markup byte for byte."""
    _void = frozenset('area base br col embed hr img input link meta param source track wbr'.split())
    _excluded = frozenset('script style textarea title pre code svg math'.split())

    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.source = source
        self.stack = []
        self.ranges = []
        self.lines = [0]
        self.lines.extend(match.end() for match in re.finditer('\n', source))
        self.feed(source)
        self.close()

    def handle_starttag(self, tag, attrs):
        if tag not in self._void:
            attr = dict(attrs)
            editable = 'contenteditable' in attr and attr['contenteditable'] != 'false'
            self.stack.append((tag, editable))

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break

    def _text(self, data):
        if (not any(tag in ('a', 'button') for tag, _ in self.stack)
                or any(tag in self._excluded or editable for tag, editable in self.stack)):
            return
        line, column = self.getpos()
        start = self.lines[line - 1] + column
        end = start + len(data)
        if self.ranges and self.ranges[-1][1] == start:
            self.ranges[-1] = (self.ranges[-1][0], end)
        else:
            self.ranges.append((start, end))

    handle_data = _text

    def _reference(self, prefix, name):
        line, column = self.getpos()
        end = self.lines[line - 1] + column + len(prefix) + len(name)
        suffix = ';' if self.source[end:end + 1] == ';' else ''
        self._text(prefix + name + suffix)

    def handle_entityref(self, name):
        self._reference('&', name)

    def handle_charref(self, name):
        self._reference('&#', name)


def normalize_arrow_icons(source):
    """Replace visible arrow tokens in links/buttons, including emoji variants."""
    def replace(match):
        direction = unescape(match.group()).rstrip('\ufe0e\ufe0f')
        return arrow_svg(direction) if direction in _ARROW_PATHS else match.group()

    ranges = _ControlTextRanges(source).ranges
    for start, end in reversed(ranges):
        source = source[:start] + _TEXT_TOKEN.sub(replace, source[start:end]) + source[end:]
    return source
