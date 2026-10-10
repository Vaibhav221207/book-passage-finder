# Book Passage Finder

Choose your textbook PDF, paste numbered assignment questions, and find short source passages with page references. Review the original crops, confirm diagrams, and download a PDF or an individual PNG. No account, paid API or API key is required by the app.

## Run locally

Install Node.js 22 or newer, then run these commands in this folder:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd start
```

Open http://127.0.0.1:4173/. `npm.cmd test` runs the regression suite. `node scripts/verify-dist.mjs` checks the deployable directory.

## Use it

1. Choose a textbook PDF. Text extraction and search run in your browser.
2. Paste questions, one numbered question per new line, or import an assignment PDF/image. The importer filters assignment titles, course labels, page numbers and repeated page headers; wrapped lines and lettered subparts stay together. It also recognizes clear prompts when OCR omits numbering punctuation. Check imported text before searching.
3. Click **Find passages**. Quotes are short by default, around 200 words per question. Use **Review question** or **Previous / Next** to review one answer at a time. Search uses book text and headings; it does not write new answers.
4. Expand **Show original page crop** or use **View in book** to inspect the page. Diagram and table checkboxes open a crop review before inclusion. Adjust the percentage fields, or drag with a mouse/pen, then choose **Include selected crop**. On touch screens, swipe to scroll the page and use the fields to adjust the crop. Suggested bounds need checking, especially for scanned graphics or tables that continue onto another page.
5. Remove unwanted passages, or use **More context** to expand one. Download the selected packet: it includes selections from every question, including those currently hidden by the question picker. Original paragraph crops can include surrounding text.

For scanned pages, expand **Recognize selected pages** and enter physical PDF pages, such as `20-25`. English OCR downloads a language asset when first used and can take longer on a phone. Recognize up to 30 pages per batch. Check OCR words against the original image.

**Save on this device** is optional. It stores a copy in this browser's IndexedDB. The saved copy can be reopened or deleted. Private browsing, browser cleanup and device storage limits can affect persistence. Ordinary use does not save the book.

## Limits and privacy

- Lexical retrieval is a starting point. It may miss paraphrases, mix nearby topics or omit parts of a broad question. A source match is not a guarantee of a complete answer. Ask a more specific question and inspect the page when a result is weak.
- Printed page labels come from PDF metadata or neighboring-page evidence. Ambiguous labels stay blank; physical PDF page numbers remain available. You can correct a label.
- Complex tables, formulas, columns and missing fonts can damage extracted reading order. Original crops preserve the source image and should be checked.
- PDF export supports the bundled Noto Sans character set. For other scripts or unsupported symbols, use PNG downloads.
- The app sends no textbook or question contents to a server. PDF/OCR/export libraries are self-hosted; OCR may fetch English language data from `tessdata.projectnaptha.com`. There is no analytics or document upload endpoint in the app.
- The uploaded book's edition may describe historical standards. The tool does not verify current standards or promise a professor will accept a submission.

## Deployment

`dist/` contains the static app. It can be served on any static host supporting ES modules, workers and WASM. `.openai/hosting.json` preserves this app's Sites identity. No uploaded book, assignment, saved browser data or private evaluation fixture belongs in the source repository or deployment.

### GitHub Pages

Push this source to the `main` branch of a public GitHub repository. In the repository, choose **Settings → Pages → Source → GitHub Actions**. The included `.github/workflows/pages.yml` installs the pinned dependencies, runs tests, builds and verifies `dist/`, and publishes it. Subsequent pushes to `main` update the site automatically. If Pages is enabled after the initial push, run **Publish Book Passage Finder** from the Actions tab once.

All app assets and workers use relative URLs, so the site supports a repository URL such as `https://YOUR-ACCOUNT.github.io/book-passage-finder/`. Hosting changes the browser origin: books optionally saved in the old site's browser storage must be selected again on the new site.

For another static host, use `npm ci` as the install command, `npm run build` as the build command, and `dist` as the publish directory. No server, database, API key or hosted document storage is needed.

See `THIRD_PARTY_NOTICES.md` for dependency licenses.
