# Book Passage Finder

Add textbook PDFs, paste numbered assignment questions, and build study answers with book and page references. The browser organizes complete sentences from the selected textbook passages, then lets you inspect original crops, confirm diagrams, and download a PDF or PNG. Book answers are free and need no account, API key, or student model download.

**Rewrite locally** applies a small set of wording and laboratory-procedure rules to the selected book answer on your device. It has no daily quota, AI model, inference request, or new dependency. The answer is labeled **Locally rephrased**; **Review wording changes** shows each edit, and **Use original** restores the exact book answer. Quotes, equations, uncertain structures, negation, modality and conditions are deliberately left alone. Some answers have no supported edits and stay unchanged. These checks reduce specific errors; they do not prove equivalent meaning for arbitrary prose. Optional AI remains a separate service with its existing allowance.

App-managed AI is connected with a shared free daily allowance. Students need no API key, AI account or model download. Click **Use AI explanation** after reviewing the selected passages, or **Try a general AI answer** when the books have no reliable match. The book answer remains available when generation fails. A personal OpenRouter key remains optional under **Advanced AI settings**.

The workspace has three distinct views: **Books**, **Questions** and **Answers**. Add PDFs on the opening screen; their actual cover pages appear in your reading list. Continue to the full-size question editor, then open the dedicated answer reader. You can return to any available stage without losing your entered text. Every open book is searched; selecting a cover chooses its page and scan tools. The answer index supports Up/Down, Left/Right and Home/End keys. **Focus view** hides navigation while retaining question switching and export; **Exit focus** or Escape restores it. Progress and Cancel remain visible during work. Fonts are self-hosted, and reduced-motion preferences are respected.

The reading list keeps full book names beside small cover previews. Compact citation buttons show a source ID and page, with a book number when more than one book is open. Open **Books** for filenames or click a citation to inspect the original page. **Review notes** shows distinct coverage gaps once. Loading counts appear only for operations with measured progress.

The reader uses a single source toolbar: **Passages**, **Figures**, and **Books**. Click a tool to open its contents; click it again, use Close, or press Escape within the tool to return to reading. The selected tool is remembered per question, and confirmed crops open the Figures tool. **Review notes** start expanded so missing details remain visible. Progress stays in a thin workspace line with Cancel. Routine success messages clear after seven seconds; errors remain until dismissed.

## Run locally

Install Node.js 22 or newer, then run these commands in this folder:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd start
```

Open http://127.0.0.1:4173/. `npm.cmd test` runs the regression suite. `node scripts/verify-dist.mjs` checks the deployable directory.

## Use it

The opening follows an illustrative book-to-answer example as you scroll. **Bring your books** opens the PDF picker immediately; **Open workspace** or any workspace navigation button skips the introduction. The example is not a search result. The four chapter buttons also work by tap and keyboard. Short screens use the chapter buttons without a pinned scroll section; **Motion off** and the system's reduced-motion preference show static states. Beginning work removes the introduction for the current page session. GSAP and ScrollTrigger are self-hosted, and failure to load them does not prevent book search.

1. Add one or more textbook PDFs. Text extraction and search run in your browser. Each book has an independent index; search includes every open book. Select a book, then expand **Page tools & saved books** to save it, correct its page labels or recognize scanned pages. Removing a book clears old results; search again.
2. Paste questions, one numbered question per new line, or import an assignment PDF/image. The importer filters assignment titles, course labels, page numbers and repeated page headers; wrapped lines and lettered subparts stay together. It also recognizes clear prompts when OCR omits numbering punctuation. Check imported text before searching.
3. Choose **Short · about 200 words**, **Standard · about 300 words (default)** or **Detailed · about 450 words**, then click **Find my answers**. The Answers view opens with citation buttons leading to the source pages. The local draft selects complete textbook sentences without rewriting them or adding outside facts; it stays within the chosen word budget and may be shorter when evidence is limited. If no complete selected sentence fits, the app asks you to review the sources instead of filling the gap. Use the question index, **Choose a question**, or the previous/next arrow buttons to review one question at a time.
4. Expand **Passages**, then **Show original page crop**, or use **View in book** to inspect the page. Download each passage screenshot directly. Diagram and table checkboxes open a crop review before inclusion. Drag a new rectangle with a mouse/pen or resize its lower-right corner. Optional percentage fields are under **Precision tools**; on touch screens use the corner handle or those fields. **Selection**, **Whole page** and **Precision tools → Image detail** help keep complete labels and rows. On touch screens, swipe to scroll and use the fields. Choose **Add to answer** or **Save image**. Suggested bounds need checking, especially for scanned graphics or tables that continue onto another page. Exported table images fit the usable PDF page instead of shrinking into a small thumbnail.
5. Remove unwanted passages, or use **More context** to expand one. The local answer updates from the remaining evidence. **Rewrite locally** rephrases recognized wording patterns for free; it always starts from current book evidence, including when an AI answer is selected. Repeated clicks do not accumulate wording drift. Changing source selections or answer length discards the selected rewritten draft. **Copy answer** and **Download PDF** include the chosen answer once, its correct mode label and compact source references. The PDF keeps original screenshots and confirmed figures. Review notes, wording-change history, match-status advice and internal source mappings stay in the app. Cited book names appear once in a final References list; B1/B2 identify separate books even when their filenames match. Every later question starts on a fresh page, including questions currently hidden by the picker. AI explanations remain labeled, and general AI answers remain marked unverified. Original paragraph crops can include surrounding text.
6. When shared AI is connected, click **Use AI explanation** to request a model-written explanation of the selected passages. Students need no AI account, key or model download. This optional action uses the AI allowance; **Rewrite locally** does not. The optional personal-key route is under **Advanced AI settings**: open the linked OpenRouter key page, paste your key and click **Use this key**. No-match questions offer **Try a general AI answer**; those drafts are labelled unverified and contain no book citations. AI text is included in Copy/PDF actions; **Use book answer** restores the original draft. Changing source selections or answer length discards the old AI draft. Add another book or recognize scanned pages when you need more textbook evidence.

For scanned pages, expand **Page tools & saved books → Recognize a scanned PDF** and enter physical PDF pages, such as `20-25`. English OCR downloads a language asset when first used and can take longer on a phone. Recognize up to 30 pages per batch. Check OCR words against the original image.

**Save on this device** is optional. It stores a copy in this browser's IndexedDB. The saved copy can be reopened or deleted. Private browsing, browser cleanup and device storage limits can affect persistence. Ordinary use does not save the book.

## Limits and privacy

- Lexical retrieval is a starting point. It may miss paraphrases, mix nearby topics or omit parts of a broad question. A source match is not a guarantee of a complete answer. Ask a more specific question and inspect the page when a result is weak.
- The local book draft assembles exact selected textbook sentences. It does not invent knowledge to reach 200, 300 or 450 words, and it cannot correct mistakes in the textbook or OCR. Selected evidence may leave requested details unanswered.
- Printed page labels come from PDF metadata or neighboring-page evidence. Ambiguous labels stay blank; physical PDF page numbers remain available. You can correct a label.
- Complex tables, formulas, columns and missing fonts can damage extracted reading order. Original crops preserve the source image and should be checked.
- PDF export supports the bundled Noto Sans character set. For other scripts or unsupported symbols, use PNG downloads.
- Ordinary extraction, search, local answer assembly, crop creation and export stay in the browser. PDF/OCR/export libraries are self-hosted; OCR may fetch English language data from `tessdata.projectnaptha.com`. There is no analytics or full-document upload endpoint. Book fallback works without an AI service; initial app loading and OCR assets can still need a connection.
- **Generating an AI answer sends the question and selected source text to an external provider; the full PDFs stay in the browser.** Managed requests send source IDs/text, extracted section headings, answer options and an anonymous browser ID to the owner’s Cloudflare Worker; book names and page mappings remain local. General mode sends no textbook passages. Cloudflare processes normal request metadata, including the IP used for its daily allowance. The supplied Worker stores only daily counters and hashed allowance keys, with no question, source or answer storage and observability logging disabled. See [backend/README.md](backend/README.md) for data handling and owner setup.
- Managed AI uses the fixed `@cf/zai-org/glm-4.7-flash` model on the owner's confirmed **Workers Free** account, with no paid fallback or automatic retries. Cloudflare [explicitly lists this model as available on Workers Free](https://developers.cloudflare.com/changelog/post/2026-07-28-models-require-workers-paid/). Default limits reserve at most **100 attempted answers per UTC day across the app**, **8 per anonymous browser ID**, and **100 per shared IP**. Failed or cancelled attempts may consume a reservation. Cloudflare’s account-wide free limits can stop generation earlier, so these caps do not guarantee availability. Reset is at 00:00 UTC. The browser ID is not authenticated identity; the global cap bounds total attempts. Service, quota and validation failures keep the local book answer available to read and download. The owner controls the Cloudflare account plan; keep it on Workers Free and review costs before upgrading.
- With a personal key, OpenRouter and its model provider receive selected passage text and its book/page references. The key stays in tab memory, is never saved in browser storage, and is cleared by **Disconnect** or a reload. This route uses `openrouter/free`, zero-price provider bounds, no paid fallback and no automatic retries. Free quota and availability vary; failed requests may count. See [OpenRouter’s free router](https://openrouter.ai/openrouter/free/providers) and [limits](https://openrouter.ai/docs/api_reference/limits). OpenRouter account/API usage is separate from a ChatGPT subscription. Use a restricted personal key; do not publish keys in code, issues or chat.
- Citations link to supplied passages; their presence does not verify that every generated claim follows from them. An exact quotation in a generated section must occur in one of that section's cited passages. This check does not verify paraphrased claims. Check the source. General answers are not verified against books, current standards or external references.
- The uploaded book's edition may describe historical standards. The tool does not verify current standards or promise a professor will accept a submission.

## Deployment

`dist/` contains the static app. It can be served on any static host supporting ES modules, workers and WASM. `.openai/hosting.json` preserves this app's Sites identity. No uploaded book, assignment, saved browser data or private evaluation fixture belongs in the source repository or deployment.

### GitHub Pages

Push this source to the `main` branch of a public GitHub repository. In the repository, choose **Settings → Pages → Source → GitHub Actions**. The included `.github/workflows/pages.yml` installs the pinned dependencies, runs tests, builds and verifies `dist/`, and publishes it. Subsequent pushes to `main` update the site automatically. If Pages is enabled after the initial push, run **Publish Book Passage Finder** from the Actions tab once.

All app assets and workers use relative URLs, so the site supports a repository URL such as `https://YOUR-ACCOUNT.github.io/book-passage-finder/`. Hosting changes the browser origin: books optionally saved in the old site's browser storage must be selected again on the new site.

For another static host, use `npm ci` as the install command, `npm run build` as the build command, and `dist` as the publish directory. Book search, local answers and exports need no server, database, API key or hosted document storage.

### Enable shared AI

The public Worker root origin is configured in `src/service-config.js`. Follow [backend/README.md](backend/README.md) for owner-only Cloudflare deployment, allowance storage and live checks when moving or redeploying the service. Configure only the root origin, without `/v1/explanations`; the client appends the route. Cloudflare credentials belong only in the owner’s setup; no provider key belongs in frontend code and students perform none of these steps.

The supplied backend permits the production browser origin `https://vaibhav221207.github.io`. Hosting the frontend elsewhere requires updating the backend’s allowed origin before deployment. Automated backend tests mock model responses and do not establish live model quality, availability or deployment success.

See `THIRD_PARTY_NOTICES.md` for dependency licenses.

## Documentation update

2026-10-11: Updated the readable student workspace, extractive book answers, connected managed AI service, privacy distinctions and dependency notices. Live book and general AI requests passed before enabling the frontend endpoint. See `VALIDATION.md` for the tested scope and remaining limits.
