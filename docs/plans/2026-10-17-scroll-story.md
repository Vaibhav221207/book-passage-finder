# Book-to-answer scroll story

Approved direction: research/2026-10-17-scroll-interaction-references.md, followed by the user's request for smooth motion and mobile support.

## Implementation

- [x] Add an isolated opening scene in index.html and src/book-story.css: a physical book opens, a sample question arrives, a passage highlights, and a cited answer sheet emerges. Clearly mark example material.
- [x] Add src/book-story.js with a self-hosted GSAP/ScrollTrigger timeline. Native scrolling, no snap or smooth-scroll replacement. Use short-screen tap controls and a static reduced-motion alternative. Clean up triggers when hidden or during work.
- [x] Integrate with main.js at workspace navigation and upload boundaries. Upload remains available immediately; skip goes directly to the existing workspace. Never rerun the introduction after starting work in the current session.
- [x] Add pinned dependency and build/license handling. The study engine and AI service stay independent of motion loading failures.
- [ ] Run the regression suite, build, distribution and syntax checks. Inspect desktop and 390/320px phone layouts, every scene, skip, upload, question navigation and reduced-motion controls on the published site. Review changes, publish, and verify deployment.

## Review focus

- Delayed animation loading after the user has entered the workspace must not reinsert a long scrolling region.
- Responsive changes must revert old inline transforms and scroll triggers.
- No scene clips or creates horizontal overflow at narrow widths.
- Keyboard actions and reduced motion must not force scrolling animation.
- Cancellation, upload failure and book removal must leave the real workspace usable.

Use DOM/CSS objects and transform/opacity animation, not a canvas or video sequence. The example is authored demonstration content, not an uploaded textbook or a claim about retrieval quality.

Automated checks: 270 tests pass, JavaScript syntax and CSS parsing pass, built distribution verified. First deployment ea3e88a succeeded. Browser visual checks remain pending because local browser use is disabled in Work settings; the user said they would enable it. No physical-phone smoothness claim has been verified.
