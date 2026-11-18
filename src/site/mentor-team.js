(() => {
  const directory = document.querySelector('[data-mentor-directory]');
  if (!directory) return;
  const index = directory.querySelector('.mentor-index');
  const selectors = [...directory.querySelectorAll('[data-mentor-target]')];
  const profiles = selectors.map(selector => document.getElementById(selector.dataset.mentorTarget));
  if (!selectors.length || profiles.some(profile => !profile)) return;
  const narrow = window.matchMedia('(max-width: 800px)');
  const phone = window.matchMedia('(max-width: 760px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let selected = -1;

  // Seven people should be discoverable without a second horizontal navigation.
  const picker = document.createElement('label');
  picker.className = 'mentor-mobile-picker';
  const pickerLabel = document.createElement('span');
  pickerLabel.textContent = '选择导师';
  const pickerSelect = document.createElement('select');
  selectors.forEach((selector, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = selector.querySelector('.mentor-selector-name').textContent;
    pickerSelect.append(option);
  });
  picker.append(pickerLabel, pickerSelect);
  index.before(picker);
  function pickerVisibility() {
    picker.hidden = !phone.matches;
    directory.classList.toggle('has-mobile-picker', phone.matches);
    profiles.forEach(profile => profile.setAttribute('role', phone.matches ? 'region' : 'tabpanel'));
  }
  pickerVisibility();
  phone.addEventListener('change', pickerVisibility);

  index.setAttribute('role', 'tablist');
  function orientation() {
    index.setAttribute('aria-orientation', narrow.matches ? 'horizontal' : 'vertical');
  }
  orientation();
  narrow.addEventListener('change', orientation);
  directory.classList.add('is-enhanced');

  selectors.forEach((selector, i) => {
    selector.setAttribute('role', 'tab');
    selector.setAttribute('aria-controls', profiles[i].id);
    profiles[i].setAttribute('role', phone.matches ? 'region' : 'tabpanel');
    profiles[i].setAttribute('aria-labelledby', selector.id);
    profiles[i].tabIndex = 0;
  });

  function select(next, { focus = false, animate = true, updateHash = false } = {}) {
    if (next < 0 || next >= selectors.length) return;
    const changed = next !== selected;
    selected = next;
    pickerSelect.value = String(next);
    pickerSelect.setAttribute('aria-controls', profiles[next].id);
    selectors.forEach((selector, i) => {
      const active = i === next;
      selector.setAttribute('aria-selected', String(active));
      selector.tabIndex = active ? 0 : -1;
      profiles[i].hidden = !active;
      profiles[i].classList.remove('is-entering');
    });
    if (animate && changed && !reducedMotion.matches) profiles[next].classList.add('is-entering');
    if (focus) selectors[next].focus({ preventScroll: true });
    if (narrow.matches && !phone.matches) {
      const active = selectors[next];
      const padding = 12;
      const left = active.offsetLeft - index.offsetLeft;
      if (left < index.scrollLeft + padding) index.scrollTo({ left: Math.max(0, left - padding), behavior: !animate || reducedMotion.matches ? 'instant' : 'smooth' });
      else if (left + active.offsetWidth > index.scrollLeft + index.clientWidth - padding) index.scrollTo({ left: left + active.offsetWidth - index.clientWidth + padding, behavior: !animate || reducedMotion.matches ? 'instant' : 'smooth' });
    }
    if (!narrow.matches && updateHash) {
      const headerBottom = document.querySelector('.fx-header')?.getBoundingClientRect().bottom || 0;
      const profileTop = profiles[next].getBoundingClientRect().top;
      if (profileTop < headerBottom || profileTop > window.innerHeight - 120) {
        profiles[next].scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
      }
    }
    if (updateHash) history.replaceState(null, '', '#' + profiles[next].id);
  }

  pickerSelect.addEventListener('change', () => {
    select(Number(pickerSelect.value), { animate: false, updateHash: true });
  });

  selectors.forEach((selector, i) => {
    selector.addEventListener('click', event => {
      // Preserve normal new-tab/link behaviour for modified clicks.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      select(i, { updateHash: true });
    });
    selector.addEventListener('keydown', event => {
      let next;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = selectors.length - 1;
      else if (event.key === (narrow.matches ? 'ArrowRight' : 'ArrowDown')) next = (i + 1) % selectors.length;
      else if (event.key === (narrow.matches ? 'ArrowLeft' : 'ArrowUp')) next = (i - 1 + selectors.length) % selectors.length;
      else if (event.key === ' ') next = i;
      else return;
      event.preventDefault();
      select(next, { focus: true, updateHash: true });
    });
  });

  function fromHash(animate = false) {
    const target = location.hash.slice(1);
    const match = profiles.findIndex(profile => profile.id === target);
    select(match >= 0 ? match : 0, { animate });
  }
  fromHash();
  window.addEventListener('hashchange', () => fromHash(true));
})();
