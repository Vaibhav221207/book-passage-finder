import {wordCount} from './model.js';
import {sentenceWindows} from './search.js';

// These are surface edits, not a parser or a claim of semantic equivalence.
// Matches contain no arbitrary technical vocabulary; all other source bytes
// survive unchanged. No model, service, dictionary download or quota is used.
const phraseRules = [
  // A following determiner can describe ordered positions ("in order to the
  // left"). Accept only these reviewed infinitives, not arbitrary words.
  {id: 'purpose-to', pattern: /\bin order to(?= (?:remove|identify|determine|measure|calculate|obtain|prepare|prevent|reduce)\b)/gi, replace: 'to'},
  {id: 'reason-because', pattern: /\b(?:due|owing) to the fact that\b/gi, replace: 'because'},
  {id: 'purpose-for', pattern: /\bfor the purpose of\b/gi, replace: 'for'},
  {id: 'exception-except', pattern: /\bwith the exception of\b/gi, replace: 'except for'},
  {id: 'comparison-with', pattern: /\bin comparison with\b/gi, replace: 'compared with'},
  {id: 'definition-called', pattern: /\b(is|are) (?:known as|referred to as)\b/gi, replace: match => `${match.split(' ')[0]} called`},
  {id: 'composition-consists', pattern: /\bis (?:made up of|composed of)\b/gi, replace: 'consists of', removesCopula: true},
  {id: 'composition-consists', pattern: /\bare (?:made up of|composed of)\b/gi, replace: 'consist of', removesCopula: true},
  {id: 'dependency-depends', pattern: /\bis dependent on\b/gi, replace: 'depends on', removesCopula: true},
  {id: 'dependency-depends', pattern: /\bare dependent on\b/gi, replace: 'depend on', removesCopula: true}
];

// Quoted/code/math blocks can span sentences, so the entire paragraph is
// excluded. Numerals, ordinary hyphenated terms and standard IDs alone do not
// prevent a local phrase edit; no rule replaces their content or attachments.
const protectedParagraph = text => /["“”`{}=<>≤≥±×÷^\\]|[\u0370-\u03ff]|\d\s*[+*/−-]\s*\d|(^|[\s(])['‘]|['’](?=[\s).,!?:;]|$)/u.test(text);
const sensitiveSentence = text => /\b(?:if|unless|until|when|whenever|provided|providing|assuming|except|only|not|no|never|neither|nor|may|might|must|shall|should|can|cannot|could|would|will|without)\b|n['’]t\b|[;:]/i.test(text);
// Without a parser, a conjunction can join either nouns or predicates sharing
// "is/are". Decline both rather than leave an orphaned second predicate.
const coordinatedSentence = text => /\b(?:and|or|but|yet|nor|as well as|rather than)\b|[,&]/i.test(text);
const completeSentence = text => /[.!?]$/.test(text);
const proceduralSentence = /^(The (?:specimen|sample|mould|mold)) (is (?:weighed|dried|cooled|heated|immersed|tested|measured)) (before|after) (immersion|drying|cooling|heating|mixing|curing|testing|weighing)\.$/;

function rewriteSentence(before) {
  if (!completeSentence(before) || sensitiveSentence(before)) return {after: before, ruleId: ''};
  const procedure = before.match(proceduralSentence);
  if (procedure) {
    const [, subject, predicate, relation, phase] = procedure;
    return {after: `${relation[0].toUpperCase()}${relation.slice(1)} ${phase}, the ${subject.slice(4)} ${predicate}.`, ruleId: 'procedure-time-first'};
  }
  let after = before;
  const applied = [];
  for (const rule of phraseRules) {
    if (rule.removesCopula && coordinatedSentence(before)) continue;
    const next = after.replace(rule.pattern, match => {
      // ALL CAPS/mixed-case text can be a named expression or OCR damage.
      // Accept ordinary lower case and a single leading sentence capital.
      if (match !== match.toLowerCase() && match !== match[0].toUpperCase() + match.slice(1).toLowerCase()) return match;
      const replacement = typeof rule.replace === 'function' ? rule.replace(match) : rule.replace;
      return match[0] === match[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
    });
    if (next !== after) {
      after = next;
      if (!applied.includes(rule.id)) applied.push(rule.id);
    }
  }
  return {after, ruleId: applied.join(',')};
}

const nonempty = value => typeof value === 'string' && value.trim().length > 0;
function supportedInput(answer) {
  if (!answer || answer.mode !== 'extractive' || !Array.isArray(answer.sources) || !answer.sources.length
    || !Array.isArray(answer.sections) || !answer.sections.length
    || !Array.isArray(answer.missingDetails) || answer.missingDetails.some(detail => typeof detail !== 'string')) return false;
  const sourceIds = new Set();
  for (const source of answer.sources) {
    if (!source || typeof source.id !== 'string' || !/^S[1-9]\d*$/.test(source.id) || sourceIds.has(source.id) || !nonempty(source.text)
      || !Array.isArray(source.pages) || !source.pages.length || source.pages.some(page => !page
        || !Number.isInteger(page.pdfPage) || page.pdfPage < 1)) return false;
    sourceIds.add(source.id);
  }
  return answer.sections.every(section => section && nonempty(section.heading) && nonempty(section.text)
    && Array.isArray(section.sourceIds) && section.sourceIds.length > 0
    && new Set(section.sourceIds).size === section.sourceIds.length
    && section.sourceIds.every(id => typeof id === 'string' && sourceIds.has(id))
    // The compiler emits exact contiguous source paragraphs. A mode string
    // alone must not authorize rewriting arbitrary prose as book evidence.
    && section.text.split(/\r?\n[ \t]*\r?\n/).filter(nonempty).every(paragraph => answer.sources.some(source =>
      section.sourceIds.includes(source.id) && source.text.includes(paragraph.trim()))));
}

/** Cautiously edit an extractive book draft. The original draft and sources
 * remain available to the caller for comparison/undo. Input from an AI mode or
 * without cited evidence is declined instead of being relabeled as book text.
 * Invariants guard specific failure classes; they do not prove equivalent
 * meaning for arbitrary prose. Unknown sentence structures stay unchanged. */
export function rewriteBookAnswer(bookAnswer) {
  if (!supportedInput(bookAnswer)) return null;
  let answer;
  try { answer = structuredClone(bookAnswer); } catch { return null; }
  const changes = [];
  let totalSentences = 0;
  for (const [sectionIndex, section] of answer.sections.entries()) {
    // Preserve both separator bytes and spacing between sentence intervals.
    section.text = section.text.split(/(\r?\n[ \t]*\r?\n)/).map(paragraph => {
      const sentences = sentenceWindows(paragraph);
      totalSentences += sentences.filter(sentence => completeSentence(sentence.text)).length;
      if (protectedParagraph(paragraph)) return paragraph;
      let edited = '', end = 0;
      for (const sentence of sentences) {
        const {after, ruleId} = rewriteSentence(sentence.text);
        edited += paragraph.slice(end, sentence.start) + after;
        end = sentence.end;
        if (after !== sentence.text) changes.push({sectionIndex, before: sentence.text, after, ruleId});
      }
      return edited + paragraph.slice(end);
    }).join('');
  }
  answer.title = 'Answer from your books';
  answer.mode = 'local-rewrite';
  answer.wordCount = answer.sections.reduce((total, section) => total + wordCount(section.text), 0);
  answer.rewrite = {changes, changedSentences: changes.length, totalSentences};
  return answer;
}
