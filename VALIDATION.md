# Verification record

Verified on Windows on 10 October 2026. This is a browser-local source-passage prototype, not a complete-answer or standards-verification service.

## Checks and evidence

- Automated suite: 43 tests pass after the final review fixes and hosted integration repair. Tests cover extraction, rotated pages, layout, retrieval, exact sentence windows, word limits, question parsing, OCR geometry and cancellation, stale jobs, source crops, figure confirmation, Unicode PDF export, unavailable storage and failed password entry.
- A fresh independent whole-branch review reported five Important findings and one Minor. All five Important findings were reproduced by failing tests and fixed in one pass: incomplete question coverage, decimals during shortening, rotated-page reading order, empty OCR overwriting existing text, and stale printed labels after correction. The full suite passed after the fixes.
- The supplied textbook was read locally: 647 pages, 15,082 canonical spans, no missing-text pages. A final Node extraction took 10.53 seconds and about 86 MB of Node heap. These are desktop measurements, not phone measurements or a maximum memory guarantee.
- A private evaluation of 20 questions passed the 200-word limit and internal substring/run-range/page-label/rectangle checks for every case. Three unsupported questions returned no match. All 17 supported, deliberately complex questions returned partial coverage with warnings. This checks provenance and limits; it does not estimate general answer accuracy.
- In the browser, the textbook loaded, a saved local copy reopened, search returned source text, and original pages displayed. Printed page 222 was checked against physical PDF page 245. Original Vee-Bee diagram pixels were manually selected on printed page 233 / PDF page 256.
- Image OCR imported two editable questions correctly. Cancel preserved completed selections and restored the controls. The OCR language asset was already cached for the final privacy audit; a prior browser OCR run completed its first download.
- Six additional synthetic-PDF adapter checks passed: distinct labels 101/102 against physical pages 1/2, unrelated concrete-subject no-match, correct and wrong-then-correct passwords, declined password rejection, blank/scanned-page detection and corrupt-PDF rejection. Known geology questions still append some irrelevant same-subject passages. Selected-page OCR recognized a synthetic scanned page and restored search controls; that tiny fixture's query produced only fragments and correctly showed no reliable match, so it is not evidence of complete scanned-book answer retrieval.
- Passage removal, PNG download, confirmed-diagram inclusion and PDF export were exercised. The final example packet contains 86 selected words and a manually confirmed diagram. All three export pages were rendered and inspected. Paragraph crops include surrounding context; some boundary lines of that context can be clipped.
- A temporary, unpublished request-audit harness instrumented main-thread and worker fetch/XHR calls during saved-book load, search, image OCR and export. It recorded only body-free GETs for PDF/font assets, and no document/question uploads on those exercised paths. The harness was removed by a clean rebuild before packaging. Source inspection found no analytics or document upload endpoint. This is a scoped check, not a blanket audit of browser extensions or dependencies.
- Clean distribution: 250 application/dependency assets, 51.5 MB; no textbook, assignment, private evaluation data, request-audit harness or credentials. The manifest preserves the registered Sites project identity.
- Responsive checks use a 390 × 844 browser viewport. The clean page has no horizontal overflow; physical-device performance remains unmeasured.

## Retrieval limits

Lexical search can miss paraphrases, select an unrelated chapter, omit requested procedures or select a different graph. The 20-question evaluation found each of these limits. A partial label does not make an irrelevant passage useful. Students must inspect, expand and remove suggestions, and choose the appropriate figure from the source page. English OCR and complex PDF extraction can also be wrong. Neither current-standard accuracy nor instructor acceptance is promised.

## Rulings made, in order

1. Use an isolated new app repository and a portable ledger because this projectless chat had no existing product repository and Git Bash failed on this host. Cost: manual task and verification tracking.
2. Use system npm.cmd because the Sites dependency installer selected a nonexistent runtime path; dependency inputs remain pinned. Cost: bypassing its host setup automation.
3. Report desktop and emulated layout checks without claiming physical-phone performance. Cost: uncertain speed and memory use on phones.
4. Assign browser privacy, OCR, storage and hosting integration checks to the parent; the independent reviewer did not repeat them. Cost: narrower independent coverage.
5. Publish verifiable suggestions rather than certify all PDFs, encryption variants or complete answers/figures from a finite fixture. Cost: missed or irrelevant passages and untested PDF variants.
6. Keep current standards, instructor acceptance and book rights outside the tool's claims; references reflect the uploaded edition. Cost: the user must independently meet course and source requirements.
7. Apply an additional integration repair after the final review pass because Codex's embedded browser throws when window.prompt is called, blocking password entry and label correction. Cost: an additional change outside the fresh review's scope; a failing regression, the full 43-test suite and real browser retry/unlock/correction checks verify it instead.

## Hosted integration repair

A private diagnostic reproduced the embedded browser error, "prompt() is not supported." Password and page-label entry now use app-owned dialogs. A callback failure also rejects the PDF load rather than leaving it pending. The new regression failed before the change and passed afterwards. The browser checks verified wrong-password retry, successful unlocking, and label correction followed by another search. The diagnostic file was removed by a clean build. A synthetic blank encrypted PDF used by the automated regression contains no user data.

## Deferred minor

Cancellation from the final extraction progress callback can still resolve an internal session. The app rejects the cancelled job before accepting or indexing it. This was deferred after review; the main interface guards against displaying it.

No supplied textbook or private evaluation excerpts are included in this repository or deployment.

## Assignment detection repair

The reported screenshot counted an assignment title as Q1. The PDF importer also joined every page before parsing, which included cover/certificate text and attached later group headings to prior questions. Numeric decimal table cells could be mistaken for question labels.

- Fourteen synthetic regressions cover title/course/footer filtering, repeated headers, wrapped lines and subparts, plain prompts, inline numbering versus decimals, OCR numbers without punctuation, legitimate General/Assignment/Chapter wording, continuation across page breaks, and word ordering with different box heights. Failing cases were observed before their fixes.
- The full suite passes 57/57. A clean build and distribution check pass with 250 assets / 51.5 MB.
- The original 11-page assignment was tested locally, including in the browser. Import returns 99 numbered questions and excludes the cover/certificate and assignment headings. An independent extraction counted 99 numbered starts. PDF extraction can add spacing or vary punctuation; complex tables remain editable context and still require checking.
- An image rendered from the first question page was imported through actual browser OCR. It returns the six questions shown on that page, without the Assignment/Tutorial or General heading.
- A private image-only PDF of that same page also returns the six complete questions. The first scan run exposed small lowercase words being moved to a separate line because their box tops differ from capitals. Baseline grouping reproduced this through a failing mixed-font PDF regression and was fixed; real scan OCR then retained the complete wording in order.
- A separate agent supplied regression cases and made a focused read-only parser check; identified losses involving OCR numbering, Enlist prompts, page headers and chapter-labelled prompts were reproduced and fixed.

Detection uses local text/layout heuristics and English OCR. It cannot guarantee every language, photograph or unusual assignment layout. No user assignment or image is included in the source or distribution.

## Figures, tables and question navigation repair

The reported Table 12.27 crop selected the paragraph above its caption because every crop used a fixed region above the caption. References at printed page 609 / PDF page 632 also entered answer retrieval as prose. Results were rendered as one continuous list of every question.

- The current suite passes 84/84, including 15 new figure/table regressions, nine search/reference regressions and three question-navigation regressions. New cases were observed failing before their corresponding fixes. Clean build and distribution checks pass: 250 assets / 51.5 MB.
- Figure/table suggestions distinguish type and number, join split and multiline captions, reject inline references, and measure table rows below or above their captions. Explicit question references take priority over incidental passage references. Suggestions remain unconfirmed until reviewed on the original page.
- The actual Table 12.27 on printed page 595 / PDF page 618 was rendered and visually checked: its caption, all rows (including 5A/B/C), outer columns and four note lines fit the crop; the preceding paragraph is excluded. Table 6.1 also retains its multiline caption. Raster-only captions, including the Vee-Bee figure on PDF page 256, remain a manual crop or selected-page OCR task. Multi-page tables and unusual layouts still need manual review.
- Bibliography and contents entries are excluded from the answer index. The supplied history question now retrieves Vicat, Aspdin and Johnson from PDF pages 25–26, rather than the Road Note section on PDF page 496. Search still retrieves unrelated SCC prose for the broad components question and unrelated prose for a long trial-mix question; these are unresolved lexical relevance limits. Explicitly requested Table 12.27 is found independently of those passages.
- Results show one question at a time with a picker and Previous/Next buttons. Crops expand on demand. All selections remain in the export state; existing figures remain editable when every passage has been removed. Manual source selection is available even for a question with no matching prose.
- Real browser checks used the supplied 647-page book: history source, direct question selection, Previous/Next, table crop review, confirmation and passage removal. The confirmed Table 12.27 survived switching away and back after all five passages were removed. A downloaded seven-page PDF retained all four test questions, hidden history/workability selections and the table image, while excluding the removed prose. The exported table page was rendered and inspected.
- At a 404 × 668 viewport, the source dialog's outer scroll height equalled its visible height (613px), while the source page scrolled inside it. Close and Include controls remained visible. Touch pages allow vertical panning; mouse/pen dragging changes the crop. This is a viewport/layout check, not a physical-device performance measurement.
- An independent focused review found two UI problems (touch scrolling and hiding included figures after passage removal); both were corrected. No further serious issue was found in the focused review of these repairs.

No supplied book pages, assignment data, browser downloads or private verification fixtures are included in the source or deployment.
