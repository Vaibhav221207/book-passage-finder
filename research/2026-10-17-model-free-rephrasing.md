# Model-free rephrasing for Book Passage Finder

Researched 17 October 2026. Scope: English textbook answers; no LLM, cloud inference, student API key, or AI model download. This is a feasibility assessment, not a product change or quality benchmark.

## Finding

An unlimited **local writing assistant** is feasible: arrange evidence, remove repetition, apply narrow grammar rules, and generate sentences from explicit templates. It would have no per-request inference charge. Calling it “unlimited AI” would overstate its capability. Template-based NLG predates LLMs and is often classified as symbolic AI; the useful distinction here is **no learned model or remote inference**. A browser still downloads application code and any bundled dictionaries as normal website assets, and device processing, hosting, development, and maintenance are not literally free.

The existing `compileBookAnswer()` in `src/book-answer.js` already selects, deduplicates, and groups exact source sentences, with stable source IDs and a word budget. It explicitly produces `mode: 'extractive'`; it is not a paraphraser. Keep that provenance-preserving baseline available.

## Libraries checked against primary sources

| Candidate | Verified behavior | Fit and limitation |
| --- | --- | --- |
| **Compromise** | Its official concepts documentation describes a rule-based English tokenizer/tagger that runs offline in browsers and Node, without neural/LLM calls. It exposes matching and transformations but has no dependency parse tree; transformations are heuristic. Its project is MIT licensed. [Concepts](https://github.com/spencermountain/compromise/blob/master/docs/concepts.md), [repository](https://github.com/spencermountain/compromise) | Best small starting point for cautious grammar-aware matching and inflection. It does not establish what an arbitrary scientific sentence means or whether a rewrite is equivalent. Use an installed, pinned release and its matching documentation; the source branch changes over time. |
| **SimpleNLG** | The official project is a Java realization library. It produces English from syntactic input supplied by the programmer, supports morphology and simple aggregation, and uses MPL 2.0. The tutorial requires specifying subject, verb, object and other features. [Repository](https://github.com/simplenlg/simplenlg), [tutorial](https://github.com/simplenlg/simplenlg/wiki/Section-I-%E2%80%93-What-is-SimpleNLG) | Useful design precedent; poor direct fit for this static browser app. A grammar realizer does not provide the missing text-to-facts parser. Do not add a Java server solely to obtain rephrasing. |
| **jsRealB** | A JavaScript English/French realizer designed for web pages, with structured/JSON input. Its production bundle includes lexicons and grammar tables. [Repository](https://github.com/rali-udem/jsRealB) Source code is Apache 2.0; lexical data has a separate CC BY 4.0 license. [Source license](https://github.com/rali-udem/jsRealB/blob/master/src/LICENSE.txt), [data license](https://github.com/rali-udem/jsRealB/blob/master/data/LICENSE.txt) | A plausible later realizer for known sentence structures. Dictionaries and grammar tables are linguistic resources, not trained neural weights, but still add download size and licensing notices. It does not turn arbitrary textbook paragraphs into a reliable semantic representation by itself. |
| **RosaeNLG** | Generates text from supplied data and authored Pug-style templates, with browser execution. Its linguistic support uses rules and lists; compiled templates can embed the needed lexical resources. Most code is Apache 2.0, with component-specific licenses. **The official repository declares it deprecated from March 2026 and is archived.** [Repository/status](https://github.com/RosaeNLG/rosaenlg), [resource architecture](https://github.com/RosaeNLG/rosaenlg/blob/master/DEVELOPER_GUIDE.md), [dependencies](https://github.com/RosaeNLG/rosaenlg/blob/master/packages/rosaenlg/package.json) | Demonstrates that non-LLM generation works. Not a recommended new dependency due to project status and its template/compiler/resource stack. No inference service is intrinsic to this architecture; authored templates and linguistic resources remain dependencies. |

Chrome's built-in Rewriter API is a different category: it runs a generative foundation model, requires an initial model download when not already installed, and has hardware/browser availability requirements. It therefore does not meet this task's strict no-model-download requirement, despite avoiding an application-owned cloud inference endpoint. [Chrome documentation](https://developer.chrome.com/docs/ai/rewriter-api)

## Recommended product approach — an engineering proposal

### What earlier research establishes

SimpleNLG's published architecture demonstrates grammatical surface generation from structures supplied by a developer; it leaves meaning-to-structure mapping to the application. It is prior art, not proof that a model-free system can understand and paraphrase arbitrary textbook prose. [Gatt and Reiter, 2009](https://aclanthology.org/W09-0613/)

“Non-neural” must not be confused with “no trained model.” For example, Nassar et al.'s non-neural simplification pipeline uses a trained five-gram language model and Stanford parsing/tagging components. It supports studying rewriting operations, not a claim that its complete pipeline meets our strict constraints. [Nassar et al., 2019, sections 2.1–2.2](https://aclanthology.org/U19-1023.pdf) DisSim likewise uses handwritten rewrite rules but takes input from a pretrained Stanford parser and documents incorrect splits, references and missing material. [Niklaus et al., 2019, footnote 3 and Appendix B](https://aclanthology.org/P19-1333.pdf)

### Proposed local editor

Build a conservative **“Polish from books”** mode, initially with small first-party rules and optional Compromise, rather than promising general-purpose rewriting:

1. Start from cited, complete sentences already selected by `compileBookAnswer()`. Keep their source intervals and original text.
2. Freeze formulas, numbers with units, standard identifiers, technical phrases, names, citations, negation, conditions, comparisons, and modal verbs such as *may*, *must*, and *should*.
3. Apply only a reviewed rule when its complete pattern is recognized. Start with punctuation/spacing cleanup, repetition removal, and short sentence or list templates. Reordering must preserve procedure order and chronology. Avoid automatic synonym spinning, broad passive/active conversion, and unsupported “therefore” transitions.
4. Attach each output sentence to its supporting source spans and record which edit rule was used. Undo an edit when a protected item changes or required structure is ambiguous. Unchanged excerpts are an acceptable outcome.
5. Offer short/standard formats using available evidence; do not pad to 300 words or fill evidence gaps. Retain the original alongside the edited draft for checking.

Integration must use a distinct answer mode, such as `local-rewrite`, because modified sentences are no longer exact excerpts. UI, Copy, and PDF paths must label it consistently, retain citations, and avoid generic non-extractive branches that label every rewritten answer as AI-generated. Inspect those paths before implementation; this research did not change them.

These checks can catch specific edit classes, but **equal numbers or retained keywords do not prove equal meaning**. No cited library supplies a guarantee of semantic equivalence for arbitrary college textbook prose. OCR errors, pronoun references, nested conditions, equations, historical attribution, comparisons, and domain terminology remain hard cases. Missing textbook information remains missing.

## Before making quality claims

Create a human-reviewed set of real course answers and difficult counterexamples. Compare the original compiler and proposed editor for meaning changes, missing qualifications, attribution, readability, and how often rules decline to edit; inspect each rule separately. Measure phone performance and the actual shipped bundle. This research did not run those experiments and supports no numerical accuracy, novelty, or latency claim.

Include adversarial pairs for quantities and negation ("not more than 30%"), modality ("may" versus "will"), quantity–unit–operator attachments, entity/relation direction, condition scope, chronology, and causal versus associative wording. Preserving the same words cannot detect swapped relationships. Use independent human meaning/grammar judgments as well as automated invariants, and report edit coverage alongside errors so that a system which leaves everything unchanged is not presented as a successful paraphraser. Published evaluation research also documents limitations of operation-specific simplification metrics; a readability or lexical-overlap score is not a meaning guarantee. [Alva-Manchego et al., 2021](https://aclanthology.org/2021.cl-4.28/)

Practical recommendation: prototype a narrow, reversible editor and evaluate it first. It can remove a daily quota for **local polishing**, but it is not a replacement for unrestricted model-written explanations or answers absent from the books.
