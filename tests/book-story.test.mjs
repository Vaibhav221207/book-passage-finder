import test from 'node:test';
import assert from 'node:assert/strict';

// Exercise the actual controller at asynchronous library and workspace boundaries.
function environment(reduce = false) {
  class Element {
    style = {}; attrs = {}; listeners = {}; hidden = false;
    classes = new Set();
    classList = {toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name), remove: name => this.classes.delete(name)};
    setAttribute(name, value) { this.attrs[name] = value; }
    removeAttribute(name) { if (name === 'style') this.style = {}; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    remove() {}
  }
  const elements = new Map();
  const get = key => { if (!elements.has(key)) elements.set(key, new Element()); return elements.get(key); };
  const chapters = Array.from({length: 4}, () => new Element());
  const steps = Array.from({length: 4}, () => new Element());
  const root = get('root');
  root.querySelector = get;
  root.querySelectorAll = selector => selector === '[data-story-chapter]' ? chapters : selector === '[data-story-step]' ? steps : [];
  const scripts = [];
  let mediaCalls = 0;
  const document = {getElementById: () => root, querySelector: get, createElement: () => new Element(), head: {append: script => scripts.push(script)}};
  const window = {gsap: {registerPlugin() {}, matchMedia() { mediaCalls++; throw new Error('Hidden story must not initialize motion'); }}, ScrollTrigger: {config() {}}};
  return {root, get, scripts, chapters, steps, document, window, mediaCalls: () => mediaCalls, matchMedia: () => ({matches: reduce, addEventListener() {}})};
}
async function withStory(reduce, run) {
  const env = environment(reduce);
  const old = Object.fromEntries(['document', 'window', 'matchMedia'].map(key => [key, globalThis[key]]));
  Object.assign(globalThis, {document: env.document, window: env.window, matchMedia: env.matchMedia});
  try {
    const {createBookStory} = await import(`../src/book-story.js?test=${Math.random()}`);
    await run(env, createBookStory);
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('reduced motion keeps upload and all four example chapters usable without loading animation code', async () => {
  await withStory(true, async (env, create) => {
    let uploads = 0;
    const story = create({onUpload: () => uploads++, onEnter() {}});
    assert.equal(env.scripts.length, 0);
    env.get('#story-upload').listeners.click();
    assert.equal(uploads, 1);
    env.steps[3].listeners.click({detail: 0});
    assert.equal(env.steps[3].attrs['aria-pressed'], 'true');
    assert.equal(env.get('.story-answer').style.visibility, 'visible');
    assert.equal(env.get('#story-motion').disabled, true);
    story.destroy();
  });
});

test('skipping during library loading never reopens the introduction after workspace changes', async () => {
  await withStory(false, async (env, create) => {
    let entered = 0;
    const story = create({onUpload() {}, onEnter: () => entered++});
    env.get('#story-skip').listeners.click({preventDefault() {}});
    assert.equal(entered, 1);
    assert.equal(env.root.hidden, true);
    env.scripts[0].onload(); await tick();
    env.scripts[1].onload(); await tick();
    story.setEnabled(false); story.setEnabled(true);
    assert.equal(env.mediaCalls(), 0);
    assert.equal(env.root.hidden, true);
    assert.equal(env.root.classes.has('is-scrollable'), false);
    story.destroy();
  });
});

test('a failed motion download leaves chapter selection and direct workspace entry working', async () => {
  await withStory(false, async (env, create) => {
    let entered = 0;
    const story = create({onUpload() {}, onEnter: () => entered++});
    env.scripts[0].onerror(); await tick();
    env.steps[2].listeners.click({detail: 1});
    assert.equal(env.get('.story-highlight').style.transform, 'scaleX(1)');
    env.get('#story-skip').listeners.click({preventDefault() {}});
    assert.equal(entered, 1);
    story.destroy();
  });
});
