# Third-party notices

Pinned versions are recorded in package-lock.json. Dependency licenses remain in node_modules after `npm ci`; redistribution must retain the required upstream notices.

| Dependency | Version | License | Project |
|---|---|---|---|
| PDF.js / pdfjs-dist | 6.4.299 | Apache-2.0 | https://github.com/mozilla/pdf.js |
| pdf-lib | 1.17.1 | MIT | https://github.com/Hopding/pdf-lib |
| @pdf-lib/fontkit | 1.1.1 | MIT | https://github.com/Hopding/fontkit |
| Tesseract.js | 7.0.0 | Apache-2.0 | https://github.com/naptha/tesseract.js |
| GSAP / ScrollTrigger | 3.14.2 | GSAP Standard License (no-charge, custom terms) | https://gsap.com/community/standard-license/ |
| tesseract.js-core | 7.0.0 | Apache-2.0 | https://github.com/naptha/tesseract.js-core |
| @napi-rs/canvas (test only) | 1.0.11 | MIT | https://github.com/Brooooooklyn/canvas |
| Wrangler (owner deployment/dev tool only) | 4.149.0 | MIT OR Apache-2.0 | https://github.com/cloudflare/workers-sdk |
| Noto Sans Regular | bundled font | SIL Open Font License 1.1 | https://github.com/notofonts/noto-fonts |
| Space Grotesk Variable | bundled font | SIL Open Font License 1.1 | https://github.com/google/fonts/tree/main/ofl/spacegrotesk |

The static build retains notices for its bundled PDF, OCR and export libraries in `dist/vendor/licenses/`. Wrangler and the direct test-only canvas dependency are development tools, not student browser downloads. Their transitive dependencies have separate licenses recorded in the lockfile and installed packages; this table lists the main dependencies rather than every transitive package.

The complete font licenses are in assets/NotoSans-LICENSE.txt and assets/SpaceGrotesk-OFL.txt. Both fonts are self-hosted. The application does not distribute any uploaded textbook. Original textbook copyrights remain with their respective rights holders. Optional AI generation uses an external service; it does not bundle or distribute the Cloudflare or OpenRouter model weights.
