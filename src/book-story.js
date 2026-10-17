// The opening is optional. Its library loading and lifecycle never gate the study workspace.
let motionLibraries;
function loadScript(file) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(`../vendor/gsap/${file}`, import.meta.url).href;
    script.onload = resolve;
    script.onerror = () => { script.remove(); reject(new Error('Motion unavailable')); };
    document.head.append(script);
  });
}
function loadMotion() {
  return motionLibraries ||= (async () => {
    await loadScript('gsap.min.js');
    await loadScript('ScrollTrigger.min.js');
    const {gsap, ScrollTrigger} = window;
    gsap.registerPlugin(ScrollTrigger);
    // Browser chrome appearing on touch devices must not rebuild the scene mid-swipe.
    ScrollTrigger.config({ignoreMobileResize: true});
    return {gsap, ScrollTrigger};
  })();
}

export function createBookStory({onUpload, onEnter}) {
  const root = document.getElementById('book-story');
  if (!root) return {setEnabled() {}, dismiss() {}, destroy() {}};
  const query = selector => root.querySelector(selector);
  const chapters = [...root.querySelectorAll('[data-story-chapter]')];
  const steps = [...root.querySelectorAll('[data-story-step]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motionButton = query('#story-motion');
  const lifetime = new AbortController();
  let enabled = true, dismissed = false, destroyed = false, motionOff = reduced.matches;
  let media, timeline, trigger, libraries, generation = 0, activeChapter = -1;
  const positions = [0, .33, .59, 1];

  function chapter(index) {
    if (index === activeChapter) return;
    activeChapter = index;
    chapters.forEach((el, i) => {
      el.classList.toggle('is-current', i === index);
      el.setAttribute('aria-hidden', String(i !== index));
    });
    steps.forEach((el, i) => el.setAttribute('aria-pressed', String(i === index)));
  }
  // Used for reduced motion and a failed/blocked library request. Every example remains available.
  function staticScene(index) {
    chapter(index);
    const set = (selector, values) => Object.assign(query(selector).style, values);
    chapters.forEach(el => { el.style.opacity = ''; el.style.visibility = ''; el.style.transform = ''; });
    set('.story-book', {transform: index ? 'translateX(6%) rotate(0deg)' : '', opacity: '1'});
    set('.story-cover', {visibility: index ? 'hidden' : 'visible'});
    set('.story-left-page', {opacity: index ? '1' : '0'});
    set('.story-question', {visibility: index === 1 || index === 2 ? 'visible' : 'hidden', opacity: '1'});
    set('.story-highlight', {transform: `scaleX(${index >= 2 ? 1 : 0})`});
    set('.story-answer', {visibility: index === 3 ? 'visible' : 'hidden', opacity: '1'});
  }
  function resetMotion() {
    generation++;
    gsapStop();
    media?.revert();
    media = timeline = trigger = null;
    root.classList.remove('is-scrollable');
    for (const el of root.querySelectorAll('.story-art [style], .story-chapter[style]')) el.removeAttribute('style');
  }
  function setMotionLabel() {
    motionButton.textContent = reduced.matches ? 'Reduced motion' : motionOff ? 'Motion on' : 'Motion off';
    motionButton.disabled = reduced.matches;
    motionButton.setAttribute('aria-pressed', String(motionOff));
    motionButton.setAttribute('aria-label', motionOff ? 'Turn on example animation' : 'Turn off example animation');
  }
  async function setup() {
    resetMotion();
    if (!enabled || dismissed || destroyed) return;
    setMotionLabel();
    staticScene(activeChapter < 0 ? 0 : activeChapter);
    if (motionOff) return;
    const request = generation;
    try { libraries = await loadMotion(); } catch { return; }
    // Upload/skip/resize can finish while the two local scripts are loading.
    if (request !== generation || !enabled || dismissed || destroyed || motionOff) return;
    const {gsap, ScrollTrigger} = libraries;
    media = gsap.matchMedia();
    // `all` also initializes tap-driven motion on short, narrow phones.
    media.add({all: 'all', tall: '(min-height: 720px)', reduce: '(prefers-reduced-motion: reduce)'}, context => {
      if (context.conditions.reduce) { staticScene(3); return; }
      const scrollable = context.conditions.tall;
      root.classList.toggle('is-scrollable', scrollable);
      for (const el of root.querySelectorAll('.story-art [style], .story-chapter[style]')) el.removeAttribute('style');
      chapter(0);
      const book = query('.story-book');
      gsap.set(book, {x: 0, y: 0, xPercent: -18, rotation: 9});
      gsap.set(query('.story-cover'), {rotationY: 0, autoAlpha: 1});
      gsap.set(query('.story-left-page'), {opacity: 0});
      gsap.set(query('.story-question'), {autoAlpha: 0, y: 35, rotation: -4});
      gsap.set(query('.story-answer'), {autoAlpha: 0, y: 45, x: 30, rotation: 6, scale: .94});
      gsap.set(query('.story-highlight'), {scaleX: 0});
      gsap.set(chapters, {autoAlpha: 0, y: 0});
      gsap.set(chapters[0], {autoAlpha: 1});
      timeline = gsap.timeline({paused: true, defaults: {ease: 'none'}, onUpdate() {
        const p = this.progress();
        chapter(p < .23 ? 0 : p < .47 ? 1 : p < .77 ? 2 : 3);
      }});
      timeline.to(book, {xPercent: 6, rotation: 0, duration: .28}, .03)
        .to(query('.story-cover'), {rotationY: -168, duration: .26}, .04)
        .to(query('.story-left-page'), {opacity: 1, duration: .12}, .12)
        .to(query('.story-question'), {autoAlpha: 1, y: 0, duration: .10}, .24)
        .to(query('.story-highlight'), {scaleX: 1, duration: .14}, .44)
        .to(query('.story-question'), {autoAlpha: 0, y: -15, duration: .10}, .66)
        .to(book, {xPercent: -6, rotation: -4, scale: .90, duration: .20}, .67)
        .to(query('.story-answer'), {autoAlpha: 1, y: 0, x: 0, rotation: -4, scale: 1, duration: .21}, .69)
        .to({}, {duration: .10}, .90);
      [.20, .44, .74].forEach((at, index) => {
        timeline.to(chapters[index], {autoAlpha: 0, y: -9, duration: .045}, at)
          .fromTo(chapters[index + 1], {autoAlpha: 0, y: 12}, {autoAlpha: 1, y: 0, duration: .055}, at + .045);
      });
      if (scrollable) {
        trigger = ScrollTrigger.create({trigger: root, start: 'top top', end: 'bottom bottom', animation: timeline, scrub: .35, invalidateOnRefresh: true});
      }
      return () => { trigger = timeline = null; root.classList.remove('is-scrollable'); };
    });
    document.fonts?.ready.then(() => {
      if (request === generation && enabled && !dismissed && !destroyed) ScrollTrigger.refresh();
    });
  }
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    resetMotion();
    root.hidden = true;
  }
  function enter(event) {
    event?.preventDefault();
    dismiss();
    onEnter();
  }
  query('#story-upload').addEventListener('click', () => onUpload(), {signal: lifetime.signal});
  query('#story-skip').addEventListener('click', enter, {signal: lifetime.signal});
  document.querySelector('.skip-link')?.addEventListener('click', enter, {signal: lifetime.signal});
  steps.forEach((button, index) => button.addEventListener('click', event => {
    if (!timeline) { staticScene(index); return; }
    if (trigger) {
      const target = trigger.start + (trigger.end - trigger.start) * positions[index];
      // Tap targets advance chapters. Keyboard activation is immediate.
      if (event.detail === 0) { trigger.getTween()?.progress(1); timeline.progress(positions[index]); }
      window.scrollTo({top: target, behavior: 'instant'});
      trigger.update();
    } else if (event.detail === 0) timeline.progress(positions[index]);
    else { gsapStop(); timeline.tweenTo(positions[index], {duration: .45, ease: 'power2.out'}); }
  }, {signal: lifetime.signal}));
  function gsapStop() { if (timeline && libraries) libraries.gsap.killTweensOf(timeline); }
  motionButton.addEventListener('click', () => {
    const top = root.getBoundingClientRect().top + window.scrollY;
    motionOff = !motionOff;
    setup();
    if (window.scrollY > top) window.scrollTo({top, behavior: 'instant'});
  }, {signal: lifetime.signal});
  reduced.addEventListener('change', event => { motionOff = event.matches; setup(); }, {signal: lifetime.signal});
  setup();
  return {
    dismiss,
    setEnabled(value) {
      if (enabled === value) return;
      enabled = value;
      root.hidden = !value || dismissed;
      if (value) setup(); else resetMotion();
    },
    destroy() { destroyed = true; lifetime.abort(); resetMotion(); }
  };
}
