import {buildAnswerSources} from './ai.js';
import {wordCount} from './model.js';
import {sentenceWindows} from './search.js';

const terminalSentence = sentence => /[.!?][\s"”')\]]*$/.test(sentence.text) && wordCount(sentence.text) >= 3;
const sentenceKey = text => text.replace(/\s+/g, ' ').trim();
const sourceHeading = passage => typeof passage?.heading === 'string' && passage.heading.trim()
  ? passage.heading.trim() : 'Textbook explanation';

/** Organize selected evidence without rewriting it or invoking a model.
 * Every paragraph is a contiguous source substring. Missing evidence stays
 * missing: this compiler never extends an answer with question text or facts. */
export function compileBookAnswer(result, {targetWords = 300} = {}) {
  if (!Number.isInteger(targetWords) || targetWords < 1 || targetWords > 700) throw new Error('Choose a positive answer word budget, up to 700 words.');
  const sources = buildAnswerSources(result);
  if (!sources.length) return null;
  // buildAnswerSources filters empty/invalid passage text; keep headings in the
  // same source order without changing the stable S1, S2 citation identities.
  const passages = (result?.passages || []).filter(passage => typeof passage?.text === 'string' && passage.text.trim() && passage.text.length <= 60000);
  const unique = new Map(), unitsBySource = [];
  for (const [sourceIndex, source] of sources.entries()) {
    const owned = [];
    for (const sentence of sentenceWindows(source.text).filter(terminalSentence)) {
      const key = sentenceKey(sentence.text), existing = unique.get(key);
      if (existing) {
        if (!existing.sourceIds.includes(source.id)) existing.sourceIds.push(source.id);
      } else {
        const unit = {...sentence, sourceIndex, sourceIds: [source.id], heading: sourceHeading(passages[sourceIndex]), words: wordCount(sentence.text)};
        unique.set(key, unit); owned.push(unit);
      }
    }
    unitsBySource.push(owned);
  }
  // One sentence from each source per round preserves topic coverage when a
  // user expands passages beyond the chosen budget. Original source order is
  // restored below, so procedures remain readable rather than interleaved.
  const selected = new Set(); let used = 0;
  const rounds = Math.max(0, ...unitsBySource.map(units => units.length));
  for (let round = 0; round < rounds; round++) for (const units of unitsBySource) {
    const unit = units[round];
    if (unit && used + unit.words <= targetWords) {selected.add(unit); used += unit.words;}
  }
  if (!selected.size) return null;
  const groups = new Map(), usedIds = new Set();
  for (const [sourceIndex, units] of unitsBySource.entries()) {
    let paragraph = null;
    for (const unit of units) {
      if (!selected.has(unit)) {paragraph = null; continue;}
      if (!groups.has(unit.heading)) groups.set(unit.heading, {heading: unit.heading, paragraphs: [], sourceIds: []});
      const group = groups.get(unit.heading);
      for (const id of unit.sourceIds) {usedIds.add(id); if (!group.sourceIds.includes(id)) group.sourceIds.push(id);}
      // Only combine adjacent sentence intervals from the same selected source.
      // A removed duplicate or skipped sentence starts a new exact paragraph.
      const source = sources[sourceIndex];
      if (paragraph && !source.text.slice(paragraph.end, unit.start).trim()) paragraph.end = unit.end;
      else {paragraph = {sourceIndex, start: unit.start, end: unit.end}; group.paragraphs.push(paragraph);}
    }
  }
  const sections = [...groups.values()].map(group => ({
    heading: group.heading,
    text: group.paragraphs.map(paragraph => sources[paragraph.sourceIndex].text.slice(paragraph.start, paragraph.end)).join('\n\n'),
    sourceIds: group.sourceIds.sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  }));
  const missingDetails = [...new Set((result?.coverageNotes || []).filter(note => typeof note === 'string' && note.trim()))];
  if (used < [...unique.values()].reduce((total, unit) => total + unit.words, 0)) missingDetails.push('Some selected textbook sentences exceed this answer length. Choose a longer answer to include more evidence.');
  return {title: 'Answer from your books', sections, missingDetails, mode: 'extractive', sources: sources.filter(source => usedIds.has(source.id)), targetWords, wordCount: used};
}
