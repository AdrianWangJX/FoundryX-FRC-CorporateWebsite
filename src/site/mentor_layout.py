"""The mentor directory, rendered from the supplied biographies without portraits."""
from html import escape


def build_mentor_section(items, advisor_items):
    def esc(value):
        return escape(str(value), quote=True)

    def biography(item):
        lead, separator, remainder = item['intro'].partition('，')
        # The first comma becomes a line break; every supplied claim is retained.
        intro = f'<span class="mentor-qualification">{esc(lead)}</span>'
        if separator:
            intro += f'<span class="mentor-intro-continuation">{esc(remainder)}</span>'
        return '<p class="mentor-profile-intro">' + intro + '</p><div class="mentor-biography">' + ''.join(
            f'<p>{esc(detail)}</p>' for detail in item['details']
        ) + '</div>'

    def profile_name(item):
        native = f'<span class="mentor-native-name">{esc(item["native_name"])}</span>' if item.get('native_name') else ''
        return esc(item['name']) + native

    index = ''.join(
        f'''<a class="mentor-selector" id="mentor-tab-{esc(item['id'])}" href="#mentor-{esc(item['id'])}"
          data-mentor-target="mentor-{esc(item['id'])}"><span class="mentor-selector-count" aria-hidden="true">{number:02d}</span>
          <span class="mentor-selector-copy"><span class="mentor-selector-name">{esc(item['name'])}</span><span class="mentor-selector-focus">{esc(item['focus'])}</span></span>
          <svg class="mentor-selector-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg></a>'''
        for number, item in enumerate(items, 1)
    )
    profiles = ''.join(
        f'''<article class="mentor-profile" id="mentor-{esc(item['id'])}" aria-labelledby="mentor-name-{esc(item['id'])}">
          <div class="mentor-profile-topline"><p>{esc(item['focus'])}</p><span aria-hidden="true">{number:02d} / {len(items):02d}</span></div>
          <h2 id="mentor-name-{esc(item['id'])}">{profile_name(item)}</h2>
          {biography(item)}
        </article>'''
        for number, item in enumerate(items, 1)
    )
    advisors = ''
    for number, advisor in enumerate(advisor_items, 1):
        english = f'<span>{esc(advisor["english_name"])}</span>' if advisor.get('english_name') else ''
        sources = ''.join(
            f'<a href="{esc(source["url"])}" target="_blank" rel="noopener noreferrer">{esc(source["label"])} <span aria-hidden="true">↗</span></a>'
            for source in advisor['links']
        )
        advisors += f'''<details class="advisor-dossier" id="advisor-{esc(advisor['id'])}">
          <summary><span class="advisor-slot-number" aria-hidden="true">{number:02d}</span><span class="advisor-person"><strong>{esc(advisor['name'])}</strong>{english}</span><span class="advisor-discipline">{esc(advisor['focus'])}</span><span class="advisor-expand" aria-hidden="true"></span></summary>
          <div class="advisor-dossier-body">{biography(advisor)}<div class="advisor-profile-links">{sources}</div></div>
        </details>'''
    return f'''<section class="mentor-team" id="mentors" aria-labelledby="mentor-team-title">
      <header class="mentor-page-heading"><h1 id="mentor-team-title">导师团队</h1><p>从科研、工程，<br>到产品与商业。</p></header>
      <div class="mentor-directory" data-mentor-directory>
        <nav class="mentor-index" aria-label="认识导师">{index}</nav>
        <div class="mentor-stage">{profiles}</div>
      </div>
      <section class="advisor-section" aria-labelledby="advisor-heading">
        <header class="advisor-heading"><h2 id="advisor-heading">专家顾问</h2></header>
        <div class="advisor-register">{advisors}</div>
      </section>
    </section>'''
