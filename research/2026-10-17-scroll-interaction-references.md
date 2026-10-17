# Scroll-driven design research for Book Passage Finder

Researched 17 October 2026. Requested deliverable: references, verified construction methods and a direction to consider before implementation. The production website, dependencies and backend have not been changed for this research.

## Finding

Yes: the current static website can support an expressive scroll-driven experience. The strongest direction is one continuous visual narrative, **a book opening into a source page, a passage being selected, and a cited answer emerging from that page**. This is our proposed adaptation. It should explain the product and make the books feel tangible; upload, reading and source review must stay immediately usable.

A different interaction model and composition will matter more than adding movement to the existing cards. The reference set below separates maker-confirmed technology from our design judgments. Some excellent references are older projects: their interaction principles remain useful, while their historical framework choices are not recommendations to adopt obsolete versions.

## References and how they were made

### 1. Daylight Computer — product presentation and material

[Live website](https://daylightcomputer.com/) · [Maker's development article](https://basement.studio/post/creating-daylight-or-the-devex) · [Maker's shadow article](https://basement.studio/post/creating-daylight-or-the-shadows)

**Verified construction:** basement's 2024 articles describe React, GSAP timelines and its scrollytelling abstraction, canvas image sequences, delayed initialization, and an initial still image. For the soft shadows, the maker explicitly names OGL, react-ogl and custom shaders. This describes that documented build, rather than asserting that every current dependency has been audited.

**Useful idea:** carry one product object through changing scenes, with a consistent sense of paper, light and scale. In our adaptation, a book can become an open source page and then an answer sheet. A DOM/SVG version can express this without copying its shader system or rendered imagery.

**Tradeoff:** sequences and shaders need assets and careful loading. The maker documents stalls and device-dependent effects; visual sophistication does not establish performance on students' phones. Live browser inspection confirmed the current product composition and changing scroll scenes. A media-player error also appeared in the browser's accessibility tree, so this was not a full reliability endorsement.

### 2. The Pudding: Women's Pockets — a shared visual that explains evidence

[Live essay](https://pudding.cool/2018/08/pockets/) · [Publisher's actual scroll code](https://github.com/the-pudding/pockets/blob/master/src/js/scroll.js)

**Verified construction:** the source imports Scrollama, IntersectionObserver support and enter-view. D3 selections connect scroll steps to a shared graphic's state changes, and resize handling updates scene dimensions. The live essay also provides a skip-animation path and interactive object comparisons.

**Useful idea:** keep one original book page visible as successive steps identify the question, relevant paragraph, crop and page citation. The movement can show the relationship between evidence and answer. This is especially relevant to a tool whose source provenance matters.

**Tradeoff:** its older implementation should inform the state model, not become a dependency template. For our tool, a small illustration and three explicit states are enough; there is no need to add D3 solely to move a highlight.

### 3. Scrollbook — reading as an illustrated sequence

[Live reading experiment](https://scrollbook-live.vercel.app/) · [Maker's case study](https://justinlung.com/work/scrollbook)

**Verified construction:** the maker documents Nuxt 2, vanilla JavaScript, ScrollMagic and CSS, with scene triggers controlling transforms, opacity and classes. The linked source repository could not be retrieved during this research, so this stack is maker-declared rather than independently source-checked.

**Observed:** live browser inspection of its Lord of the Rings preview showed distinct title/illustration stages, a chapter preview, layered character imagery and text progressing through vertical keyboard scrolling.

**Useful idea:** give each stage a recognizable visual identity while preserving a continuous reading rhythm. Our books, questions and answers can be connected through one page object instead of feeling like unrelated screens.

**Tradeoff:** cinematic pacing fits a preview better than repeated assignment work. Use original artwork and a short sequence; do not copy its book illustrations, text, or historical framework stack.

### 4. The Silly Bunny — scroll-controlled book imagery with depth

[Live website](https://thesillybunny.co/) · [Noomo's maker case study](https://noomoagency.com/work/the-silly-bunny-immersive-website)

**Verified construction:** Noomo identifies Three.js, mixed 2D/3D illustrations, animations connected to scrolling, remeshed models and compressed textures. Its AR features are a separate part of the experience.

**Useful idea:** a physical-looking book can be an interactive object rather than a decorative thumbnail. We could open a cover, lift a page, and keep the selected citation visibly attached as the page becomes an answer.

**Tradeoff:** custom models, textures and spatial rendering add substantial design and device-testing work. The book metaphor fits; the children's visual style and AR feature set do not automatically fit college students. The maker case was inspected; a full live interaction audit was not performed.

### 5. Bob Ross Virtual Art Gallery — collection to detail

[Live gallery](https://connorrothschild.github.io/bob-ross-art-gallery/) · [Creator's repository](https://github.com/connorrothschild/bob-ross-art-gallery)

**Verified construction:** the creator's README names Svelte, D3 and Scrollama, with gallery, painting, scrubber and visualization components available in source.

**Useful idea:** a collection can become the navigation. Uploaded books could appear as a reading collection; selecting one expands its real cover into a page preview and its tools. This is a proposed adaptation, not a claim that the gallery implements our book transition.

**Tradeoff:** thumbnail generation must stay lazy; animating a library should not render hundreds of PDF pages. Tap and keyboard selection need equal treatment. The live shell and source were retrieved; complete visual playback was not tested.

### 6. SBS: The Boat — the cinematic end of the spectrum

[Live story](https://www.sbs.com.au/theboat/) · [Distil's maker case study](https://www.distil.im/projects/the-boat)

**Verified construction:** Distil describes scanned hand-drawn art placed in Three.js/WebGL scenes, a custom JavaScript animation framework, and sound reacting to scrolling and interaction.

**Useful idea:** layered flat artwork can create a memorable sense of depth. A single page lifting into a highlighted excerpt could be enough for our opening.

**Tradeoff:** an illustrated cinematic narrative demands significant art, asset and testing effort. It is a reference for an optional opening moment, not a proposed interaction system for every answer. No complete live browser walkthrough was performed.

## What “scroll animation” actually means

- **Reveal on entry:** scrolling a heading into view starts a short transition. IntersectionObserver can detect that threshold; the animation then runs over time. [IntersectionObserver documentation](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- **Scroll-driven sequence:** scroll position controls animation progress; reversing direction reverses the scene. Native CSS scroll/view timelines support this model. [MDN scroll-driven animations](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations)
- **Pinned storytelling:** a visual stays in place while the surrounding story progresses. ScrollTrigger provides pinning and scrubbing, with resize handling, while retaining native scrolling. These features need not replace wheel or touch behavior. [ScrollTrigger documentation](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)

For this app, continuous movement belongs in a short introduction. Question selection, text reading, PDF dialogs and repeated exports should remain quick and predictable. That is a product judgment informed by the existing workflow.

## Practical construction choices

**Recommended for the coordinated concept: existing HTML/CSS/SVG plus GSAP core and ScrollTrigger.** Keep one timeline responsible for the book, page, highlight and answer sheet. It can be added to vanilla JavaScript; a React/Vue migration is not required. Use `gsap.matchMedia()` to create and clean up different desktop, phone and reduced-motion treatments. [Installation](https://gsap.com/docs/v3/Installation/) · [matchMedia](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/)

**Smaller alternative:** CSS transforms with IntersectionObserver for a few step changes. Native CSS `animation-timeline` is an attractive enhancement, but MDN currently marks it Limited availability. Preserve an understandable static layout and feature-detect it rather than relying on uniform browser support. [animation-timeline](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline)

**Cost:** GSAP's current Standard No Charge license covers commercial projects, including its formerly paid plugins. It is a custom license, with restrictions concerning competing visual animation builders and required notices; it should not be described as MIT. A normal animated study website does not require a Webflow subscription to use GSAP. [Official license](https://gsap.com/community/standard-license/) · [GSAP pricing](https://gsap.com/pricing/)

**3D is optional:** Three.js is appropriate when a spatial model is central to the chosen design. Flat books can use HTML/SVG transforms instead. Three.js requires explicit GPU-resource cleanup; render-on-demand avoids continuously drawing an unchanged scene. Rive is another option for an authored interactive illustration, but adds its runtime and animation assets. [Three.js cleanup](https://threejs.org/manual/pages/cleanup.html) · [Rendering on demand](https://threejs.org/manual/pages/rendering-on-demand.html) · [Rive web runtime](https://rive.app/docs/runtimes/web/web-js)

**Hosting:** these are browser-side techniques that fit static HTML/CSS/JavaScript hosting. GitHub Pages can stay; presentation work does not require changing the AI Worker or adding an animation server. This does not imply zero development or asset-production cost. [GitHub Pages overview](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

## Proposed direction: the book becomes the answer

This is an original concept for discussion, not an implemented redesign or an existing capability claim.

1. **Opening:** one oversized book and a clearly visible upload action. Small pointer or tap reactions give the cover a sense of weight. It remains usable immediately.
2. **First scroll beat:** the cover opens into a readable example page. A question settles beside it, keeping the scene understandable at any scroll position.
3. **Second beat:** a single relevant paragraph becomes highlighted. Its page number remains attached to it as the passage moves toward the answer area.
4. **Third beat:** an answer sheet resolves beside the source page with a clickable citation. The example is explicitly labeled; the animation must not imply that unsupported answers or general AI are verified book content.
5. **Working state:** the visual story gives way to the actual Books / Questions / Answers workspace. Selecting a citation can connect an answer paragraph to its source with a short spatial transition; reading itself stays still.

An alternative with less scrolling is an **interactive reading desk**: covers expand on selection, a question is placed next to an open page, and clicking a citation reveals the connected source. Optional dragging can add character, with click/tap/keyboard routes always available. A fully rendered 3D library would be a larger separate direction with less direct benefit to the core task.

## Requirements for a useful result

- Keep upload and a direct workspace route available at the start. Returning students should not have to replay an introduction to use their books.
- Use compact stacked states on phones when pinning would crowd the screen; preserve native touch scrolling and text selection. Do not require hover or dragging.
- Respect reduced-motion preferences with readable static states. Avoid large camera moves, forced smooth scrolling and continuous decorative loops. [Reduced-motion documentation](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)
- Prefer transform/opacity motion; measure layout/paint work and use layer hints sparingly. Pause optional effects when off-screen, hidden, or while PDF import/OCR/export work is active. The latter is an engineering recommendation, not a measured bottleneck finding. [Animation performance guidance](https://web.dev/articles/animations-guide)
- Profile actual large-PDF use, low-end phones, fast reverse scrolling, resize, keyboard navigation and source-dialog scrolling. No new animation has been built or benchmarked in this research.
- Prototype one complete book-to-answer sequence before expanding the visual system. Judge it by immediate comprehension, visual character, reachable controls and comfortable repeated use. Animation will not repair the current retrieval or local-rephrasing limitations.

## Research coverage

Primary sources were used for construction claims: maker case studies, publisher source code and official API/license documentation. Live browser inspection covered Scrollbook's reading sequence and Daylight's homepage scroll scenes; other examples were inspected through their published pages and maker/source materials. No external artwork was downloaded or copied into the product. No live-site change, package installation, deployment or performance claim is part of this research.
