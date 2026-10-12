# Managed answers for Book Passage Finder

Students click one answer button. They do not need an API key, an AI account, or a model download. The app owner deploys this small Cloudflare Worker once. Generation is an external Cloudflare service; the textbook search and its fallback still run on the student's device.

## Free operation and limits

Keep the Cloudflare account on **Workers Free**, with no paid AI Gateway or fallback provider. [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) currently includes 10,000 neurons each UTC day on Workers Free; exceeding that allowance fails requests instead of charging for overage. The application cannot determine or change the owner's account plan. An owner upgrading to Workers Paid changes the billing protection and must review costs first.

The Worker has one fixed model: [`@cf/zai-org/glm-4.7-flash`](https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/), which Cloudflare [explicitly supports on Workers Free](https://developers.cloudflare.com/changelog/post/2026-07-28-models-require-workers-paid/). JSON mode and non-thinking generation are requested; responses are independently validated before being returned. There is no model override, paid fallback, automatic retry, streaming, tools, or AI Gateway integration.

The app additionally reserves at most **100 attempted answers per day globally**, **8 per anonymous browser ID**, and **100 per shared IP**. The IP allowance deliberately accommodates campus/mobile networks. Failed generation attempts remain counted because provider work may already have occurred. These are conservative application limits, not a promise that 100 answers always fit the account-wide neuron allowance. Other apps on the same account can also consume that allowance. Quota errors leave textbook passages available.

Daily reservations use one [SQLite-backed Durable Object](https://developers.cloudflare.com/durable-objects/platform/pricing/), which is supported on Workers Free. The global, browser, and IP counters are read and updated in one synchronous SQLite transaction before inference. Optional `GLOBAL_DAILY_LIMIT`, `CLIENT_DAILY_LIMIT` and `IP_DAILY_LIMIT` settings can lower the defaults; they cannot raise the compiled ceilings. Reset is 00:00 UTC. An alarm and the next reservation remove prior-day rows. Stored row count is bounded by successful reservations, even if users rotate IDs.

The anonymous browser ID is an allowance mechanism, not authenticated identity: clearing browser storage or sending fabricated IDs can bypass its individual cap. CORS is a browser access policy, not authentication. The global cap is the protection against anonymous abuse. A determined attacker can exhaust the day's free availability, but cannot make this code select a paid model or bypass the application cap. Cloudflare's own account/Worker/DO free limits still apply.

## Owner setup

Use a Cloudflare account with **Workers Free** selected. Do not put Cloudflare credentials in frontend files, GitHub, or chat. Wrangler's account login is an owner-only action; students never perform it.

From the repository directory, with Node 22 or later:

```powershell
npx wrangler login
npx wrangler deploy --config backend/wrangler.jsonc
```

Wrangler creates the `AI` binding and migrates the `UsageBudget` Durable Object using `new_sqlite_classes`. It prints the public URL, typically `https://book-passage-finder-answers.<owner-subdomain>.workers.dev`. Set `MANAGED_AI_ENDPOINT` in `src/service-config.js` to this root origin, without `/v1/explanations`; the client appends the route. Rebuild and publish the static app after a successful live test. Only this public origin belongs in the frontend. No secret is needed in browser code.

Test with a short question and a small selected passage. Confirm one success, the remaining allowance display, and the textbook fallback after a controlled service/quota failure before enabling it for students. Review the Cloudflare dashboard's actual account plan and neuron use. This repository's automated tests mock inference; they do not verify live model quality, quota, latency, or owner deployment.

For an owner-side packaging/configuration check without deployment:

```powershell
npx wrangler deploy --dry-run --config backend/wrangler.jsonc
```

The exact production browser origin is `https://vaibhav221207.github.io`. Production configuration rejects localhost by default. For deliberate local development, set `ALLOW_LOCALHOST` to `"true"`; this enables only `http://localhost:4173` and `http://127.0.0.1:4173`. Keep it `"false"` for production.

## HTTP contract

Only `POST /v1/explanations` and its `OPTIONS` preflight are accepted. No query parameters are accepted. `Content-Type` must be `application/json` (optional UTF-8 charset). The complete JSON body is limited to 48,000 UTF-8 bytes. The request contains exactly:

```json
{
  "question": "Explain the sustainability of concrete.",
  "sources": [{"id": "S1", "text": "A small selected textbook passage."}],
  "targetWords": 300,
  "mode": "book",
  "clientId": "af539964-147d-4e60-8b7d-62db4a36c3f6"
}
```

Question: at most 1,600 characters. Sources: at most 12, no duplicate IDs, at most 12,000 combined text/heading characters. Source objects contain `id` and `text`, with an optional extracted `heading` of at most 160 characters so unnamed procedures retain their section context. PDF bytes, filenames, page mappings, other metadata, model selection, user-supplied prompts, and provider keys are rejected. Length is one of 200, 300 or 450. Book mode requires selected sources. General mode requires an empty source array and is explicitly unverified against the textbook.

Success returns `{content, model, remaining, resetAt}`. `content` is a JSON string with exactly `title`, `sections` and `missingDetails`; sections have exactly `heading`, `text` and `sourceIds`. Every book section needs at least one known source ID; general sections have no IDs. Prose cannot invent page locators or source labels. The adapter accepts complete chat-completion envelopes as well as legacy response objects and direct JSON-mode outputs; truncated/tool completions are rejected. Shape, citation and quotation checks run on the entire answer before shortening. A section's exact quotation must occur in one of that section's cited passages; its presence in another selected passage is insufficient. Verbose valid prose is limited to the selected target using complete sentences from each section in turn, retaining contiguous prefixes, short precautions, original section order and citation IDs. Quoted sections are atomic. Shortening adds a length note; oversized or unsplittable responses fail safely. The transformed answer is validated again, and the frontend independently validates the final result. These checks do not prove that every generated claim is semantically supported.

Errors return safe `{code, message}` with optional allowance fields on quota responses. Codes are `invalid`, `quota`, `busy` and `service_unavailable`. Underlying provider error messages are never exposed. The binding uses documented [`rejectIfBusy`](https://developers.cloudflare.com/workers-ai/features/reject-if-busy/) behavior and [provider error codes](https://developers.cloudflare.com/workers-ai/platform/errors/), with no retry. Requests use `Cache-Control: no-store` and never allow credentialed CORS.

## Data handling

Only the question and selected source text are sent to Workers AI. Book/page metadata stays in the browser. The Worker never writes question, source, response, raw IP or provider credentials to storage or logs. Observability logging is disabled in the provided configuration. The allowance object stores daily counts keyed by SHA-256 hashes of the anonymous ID/IP and the day; hashes are pseudonymous allowance keys, not authenticated users or a guarantee against guessing an IP.

Cloudflare still processes requests and normal platform metadata as an external provider. Refer to its [Workers AI data usage policy](https://developers.cloudflare.com/workers-ai/platform/data-usage/). Do not describe managed generation as wholly local or independent of external services.

## Verification

```powershell
node --test tests/managed-worker.test.mjs
```

Tests use actual SQLite for the allowance transactions and controlled AI binding responses for success/failure cases. They cover concurrent reservation limits, UTC reset/cleanup, request size/schema, CORS/preflight, source/identity isolation, provider error redaction, no retry and output bounds. Node's built-in SQLite module may emit an experimental-feature warning.
