# Unlimited local rephrasing

Approved by the user on 17 October 2026 after the model-free feasibility research. Extend the existing book-answer flow; retain optional managed AI and its existing allowance. No learned model, new runtime dependency, network inference, student key, or local daily counter for this feature.

## Work and interfaces

1. Add `rewriteBookAnswer(bookAnswer)` as a pure deterministic module. Accept only cited extractive drafts, clone metadata, preserve source text, use narrowly recognized phrasing/procedure patterns, and retain uncertain sentences unchanged. Return `mode: 'local-rewrite'` and sentence edit records/counts. Test real rewrites and adversarial quantities/conditions/negation/technical terms before implementation.
2. Add shared answer labels and Copy formatting. UI and clean PDF must distinguish local rephrasing from exact book excerpts, book-based AI, and unverified general AI. Keep current compact citations, referenced-book identities, screenshots and confirmed figures. Review/edit records remain outside Copy/PDF.
3. Add a primary **Rewrite locally / Free** action when an extractive book answer is available, optional AI action, reversible original view and collapsed edit review. Run rewrites from the original compiled book answer rather than repeatedly transforming generated output. Report unchanged text honestly. Existing source/length edits invalidate the selected rewritten draft through the same controller mechanism as other explanations.
4. Run the complete regression suite, inspect actual textbook transformations and refusal cases, exercise the feature and a fresh PDF download on the published site, and review desktop/phone layout. Independently review the changes before publishing; resolve important findings.

## Review focus

- Never relabel an AI-generated answer as a model-free book rewrite.
- Protect numbers with units, negation/modality, comparison/condition scope, attribution, quotations and mathematical material. Token checks reduce risk but are not a proof of equivalent meaning.
- A rewrite with no supported edits must not claim to have rephrased the answer.
- Repeated calls do not consume the managed allowance or accumulate wording drift.
- Removing/changing passages or changing the answer length discards prior local wording and keeps source links accurate.
- Cited sources retain original text and independent book identities, including identical filenames/page labels.
- No new review text or edit history leaks into PDF output.

This is a conservative first release, not a claim of general paraphrasing accuracy. Record measured coverage and limitations without presenting automatic guards as independent semantic verification.
