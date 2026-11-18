(() => {
  const root = document.querySelector('.honours-page');
  if (!root) return;
  const buttons = [...root.querySelectorAll('[data-year]')];
  const panels = [...root.querySelectorAll('[data-honours-year]')];
  const latest = panels[0]?.dataset.honoursYear;
  const pick = year => {
    root.classList.toggle('honours-selected', year !== 'all');
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.year === year)));
    panels.forEach(panel => { panel.hidden = year !== 'all' && panel.dataset.honoursYear !== year; });
  };
  buttons.forEach(button => button.addEventListener('click', () => pick(button.dataset.year)));
  if (latest) pick(latest);
})();
