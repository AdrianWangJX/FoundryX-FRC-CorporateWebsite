// The build supplies the checked-in English catalog. Keep the original text per
// node so that switching languages never reconstructs forms, players or dialogs.
(() => {
  'use strict';
  const english = __ENGLISH_CATALOG__;
  const root = document.documentElement;
  const storageKey = 'foundryx.language';
  const textSources = new WeakMap();
  const attributeSources = new WeakMap();
  const attributes = ['alt', 'aria-label', 'placeholder', 'title', 'content'];
  const skip = 'script,style,noscript,[contenteditable="true"],[translate="no"],#result-text';
  const valid = value => value === 'zh' || value === 'en';
  let locale;
  let explicitLocale = valid(new URL(location.href).searchParams.get('lang'));

  function storedLanguage() {
    try { return localStorage.getItem(storageKey); } catch { return null; }
  }

  function remember(next) {
    try { localStorage.setItem(storageKey, next); } catch {}
  }

  function readLanguage() {
    const requested = new URL(location.href).searchParams.get('lang');
    const saved = storedLanguage();
    const returning = performance.getEntriesByType('navigation')[0]?.type === 'back_forward';
    if (returning && valid(saved)) return saved;
    if (valid(requested)) {
      remember(requested);
      return requested;
    }
    return valid(saved) ? saved : 'zh';
  }

  function translate(source) {
    if (locale !== 'en' || typeof source !== 'string') return source;
    const key = source.trim();
    if (!Object.hasOwn(english, key)) return source;
    return source.replace(key, () => english[key]);
  }

  function renderValue(records, key, value, write, format) {
    const previous = records.get(key);
    const source = previous && value === previous.rendered ? previous.source : value;
    if (!source || !Object.hasOwn(english, source.trim())) {
      records.delete(key);
      return;
    }
    const translation = translate(source);
    const rendered = format ? format(translation) : translation;
    records.set(key, {source, rendered});
    if (rendered !== value) write(rendered);
  }

  function keepEndingTogether(text) {
    // A nonbreaking space also protects Latin names in otherwise Chinese copy.
    const paired = text.replace(/([\p{L}\p{N}’'-]+) +([\p{Script=Latin}\p{N}][\p{Script=Latin}\p{M}\p{N}’'-]*[.,!?。！？)”’]*)(\s*)$/u,
      (match, first, last, space) => first.length + last.length <= 30
        ? first + '\u00a0' + last + space : match);
    return paired.replace(/(\p{Script=Han})(\p{Script=Han})([。！？，、；：）》」”]*\s*)$/u, '$1\u2060$2$3');
  }

  function renderText(node) {
    if (!node.parentElement || node.parentElement.closest(skip + ',textarea')) return;
    // Keep the last two words of running copy together even in browsers that
    // limit balanced wrapping to a few lines. Only format the end of a text
    // block; accessible labels, form values and source translations stay plain.
    const endsParagraph = !node.nextSibling && node.parentElement.closest('p') &&
      (node.parentElement.matches('p, .mentor-qualification, .mentor-intro-continuation') ||
        !node.parentElement.nextSibling);
    renderValue(textSources, node, node.data, value => { node.data = value; },
      endsParagraph ? keepEndingTogether : null);
  }

  function renderAttribute(element, name) {
    if (!element.hasAttribute(name) || (name === 'content' && !element.matches('meta[name="description"]'))) return;
    let records = attributeSources.get(element);
    if (!records) attributeSources.set(element, records = new Map());
    renderValue(records, name, element.getAttribute(name), value => element.setAttribute(name, value));
  }

  function localizeLink(link) {
    const raw = link.getAttribute('href');
    if (!raw || raw.startsWith('#') || link.hasAttribute('download')) return;
    const url = new URL(raw, document.baseURI);
    if (url.origin !== location.origin || url.protocol !== location.protocol ||
        !/(?:\/|\.html|\/[^/.]+)$/.test(url.pathname)) return;
    // Carry the choice in real links, including new tabs and storage-blocked browsers.
    if (locale === 'en') url.searchParams.set('lang', 'en');
    else if (url.searchParams.has('lang') || explicitLocale) url.searchParams.set('lang', 'zh');
    else return;
    if (link.href !== url.href) link.href = url.href;
  }

  function renderElement(element) {
    if (element.hasAttributes()) {
      for (const name of attributes) renderAttribute(element, name);
      if (element.matches('a[href]')) localizeLink(element);
    }
  }

  function renderTree(node) {
    if (node.nodeType === Node.TEXT_NODE) { renderText(node); return; }
    if (node.nodeType !== Node.ELEMENT_NODE || node.closest(skip)) return;
    renderElement(node);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(child) {
        return child.nodeType === Node.ELEMENT_NODE && child.matches(skip)
          ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    let child;
    while ((child = walker.nextNode())) {
      if (child.nodeType === Node.TEXT_NODE) renderText(child);
      else renderElement(child);
    }
  }

  function updateControls() {
    for (const control of document.querySelectorAll('[data-site-language]')) {
      control.setAttribute('aria-pressed', String(control.dataset.siteLanguage === locale));
    }
  }

  function apply(next) {
    locale = next;
    root.lang = next === 'en' ? 'en' : 'zh-CN';
    renderTree(root);
    updateControls();
    document.dispatchEvent(new CustomEvent('fx:languagechange', {detail: {language: next}}));
  }

  function set(next) {
    if (!valid(next)) return;
    const url = new URL(location.href);
    url.searchParams.set('lang', next);
    try { history.replaceState(history.state, '', url.href); } catch {}
    explicitLocale = true;
    remember(next);
    if (locale !== next) apply(next);
  }

  window.FXLanguage = {set, translate, get current() { return locale; }};
  locale = readLanguage();
  if (explicitLocale && new URL(location.href).searchParams.get('lang') !== locale) set(locale);
  root.lang = locale === 'en' ? 'en' : 'zh-CN';
  // Page scripts can replace nodes or accessible labels when controls change state.
  // Observe copy only. Canvas animation and scrolling mutate classes/styles every frame.
  new MutationObserver(changes => {
    for (const change of changes) {
      if (change.type === 'childList') change.addedNodes.forEach(renderTree);
      else if (change.type === 'characterData') renderText(change.target);
      else if (!change.target.closest(skip)) renderAttribute(change.target, change.attributeName);
    }
  }).observe(root, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:attributes});

  document.addEventListener('click', event => {
    const control = event.target.closest?.('[data-site-language]');
    if (control) set(control.dataset.siteLanguage);
  });
  document.addEventListener('DOMContentLoaded', () => { renderTree(root); updateControls(); });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    const latest = storedLanguage();
    if (valid(latest) && latest !== locale) set(latest);
  });
})();
