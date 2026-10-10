# Book Passage Finder

Add textbook PDFs, paste numbered assignment questions, and find source passages with book and page references. Review original crops, confirm diagrams, and download a PDF or PNG. Book search is free and needs no account. Optional college-level AI explanations use each visitor's own OpenRouter key and free models.

## Run locally

Install Node.js 22 or newer, then run these commands in this folder:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd start
```

Open http://127.0.0.1:4173/. `npm.cmd test` runs the regression suite. `node scripts/verify-dist.mjs` checks the deployable directory.

## Use it

1. Add one or more textbook PDFs. Text extraction and search run in your browser. Each book has an independent index; search includes every open book. Select a book to save it, correct its page labels, recognize scanned pages or inspect it. Removing a book clears old results; search again.
2. Paste questions, one numbered question per new line, or import an assignment PDF/image. The importer filters assignment titles, course labels, page numbers and repeated page headers; wrapped lines and lettered subparts stay together. It also recognizes clear prompts when OCR omits numbering punctuation. Check imported text before searching.
3. Choose **Short (200)**, **Standard (300, default)** or **Detailed (450)** words, then click **Find passages**. The source budget applies across all books per question. Evidence may be shorter when it cannot support a complete answer. Use **Review question** or **Previous / Next** to review one question at a time.
4. Expand **Show original page crop** or use **View in book** to inspect the page. Download each passage screenshot directly. Diagram and table checkboxes open a crop review before inclusion. Adjust the percentage fields, drag a new rectangle with a mouse/pen, or resize its lower-right corner. **Reset selection**, **Full page** and **2× / 3× image detail** help keep complete labels and rows. On touch screens, swipe to scroll and use the fields. Choose **Include selected crop** or **Download PNG**. Suggested bounds need checking, especially for scanned graphics or tables that continue onto another page. Exported table images fit the usable PDF page instead of shrinking into a small thumbnail.
5. Remove unwanted passages, or use **More context** to expand one. Download the selected packet: it includes selections from every question, including those currently hidden by the question picker. Original paragraph crops can include surrounding text.
6. For optional AI answers, expand **AI explanations**, open the linked OpenRouter key page and paste your own key into the password field. Click **Use this key**, then **Generate explanation** on a question. The draft uses selected passages, separate citation buttons and undergraduate terminology. No-match questions offer **Generate general AI explanation**; those drafts are labelled unverified and contain no book citations. Add another book or recognize scanned pages when you need textbook evidence. Generated text remains separate from exact quotations and is included in Copy/PDF actions. Changing source selections discards the old draft.

For scanned pages, expand **Recognize selected pages** and enter physical PDF pages, such as `20-25`. English OCR downloads a language asset when first used and can take longer on a phone. Recognize up to 30 pages per batch. Check OCR words against the original image.

**Save on this device** is optional. It stores a copy in this browser's IndexedDB. The saved copy can be reopened or deleted. Private browsing, browser cleanup and device storage limits can affect persistence. Ordinary use does not save the book.

## Limits and privacy

- Lexical retrieval is a starting point. It may miss paraphrases, mix nearby topics or omit parts of a broad question. A source match is not a guarantee of a complete answer. Ask a more specific question and inspect the page when a result is weak.
- Printed page labels come from PDF metadata or neighboring-page evidence. Ambiguous labels stay blank; physical PDF page numbers remain available. You can correct a label.
- Complex tables, formulas, columns and missing fonts can damage extracted reading order. Original crops preserve the source image and should be checked.
- PDF export supports the bundled Noto Sans character set. For other scripts or unsupported symbols, use PNG downloads.
- Ordinary extraction, search, crop creation and export stay in the browser. PDF/OCR/export libraries are self-hosted; OCR may fetch English language data from `tessdata.projectnaptha.com`. There is no analytics or full-document upload endpoint.
- **Generating an AI answer sends the question and selected passages to OpenRouter and its model provider.** General mode sends the question without textbook passages. The key stays in tab memory, is never saved in browser storage, and is cleared by Disconnect or a reload. This static app has no shared key or backend. Use a restricted personal key; do not publish keys in code, issues or chat.
- AI uses `openrouter/free`, zero-price provider bounds, no paid fallback and no automatic retries. Free quota and availability vary; failed requests may count. See [OpenRouter's free router](https://openrouter.ai/openrouter/free/providers) and [limits](https://openrouter.ai/docs/api_reference/limits). OpenRouter account/API usage is separate from a ChatGPT subscription.
- Citations link to supplied passages; their presence does not verify that every generated claim follows from them. Check the source. General answers are not verified against books, current standards or external references.
- The uploaded book's edition may describe historical standards. The tool does not verify current standards or promise a professor will accept a submission.

## Deployment

`dist/` contains the static app. It can be served on any static host supporting ES modules, workers and WASM. `.openai/hosting.json` preserves this app's Sites identity. No uploaded book, assignment, saved browser data or private evaluation fixture belongs in the source repository or deployment.

### GitHub Pages

Push this source to the `main` branch of a public GitHub repository. In the repository, choose **Settings → Pages → Source → GitHub Actions**. The included `.github/workflows/pages.yml` installs the pinned dependencies, runs tests, builds and verifies `dist/`, and publishes it. Subsequent pushes to `main` update the site automatically. If Pages is enabled after the initial push, run **Publish Book Passage Finder** from the Actions tab once.

All app assets and workers use relative URLs, so the site supports a repository URL such as `https://YOUR-ACCOUNT.github.io/book-passage-finder/`. Hosting changes the browser origin: books optionally saved in the old site's browser storage must be selected again on the new site.

For another static host, use `npm ci` as the install command, `npm run build` as the build command, and `dist` as the publish directory. No server, database, API key or hosted document storage is needed.

See `THIRD_PARTY_NOTICES.md` for dependency licenses.
