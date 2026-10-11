import test from 'node:test';
import assert from 'node:assert/strict';
const api = await import('../src/book-answer.js').catch(() => ({}));

const passage = (text, heading = 'Slump test', bookId = 'a', pdfPage = 7) => ({
  id: `${bookId}:${pdfPage}`, bookId, bookName: 'Handbook.pdf', text, heading,
  segments: [{page: {bookId, bookName: 'Handbook.pdf', pdfPage, printedLabel: String(pdfPage - 2)}}]
});
const result = (passages, extra = {}) => ({question: {text: 'Explain the workability tests.'}, status: 'matches', passages, coverageNotes: [], ...extra});
const compile = (input, options) => {
  assert.equal(typeof api.compileBookAnswer, 'function', 'Book answers are compiled without a service');
  return api.compileBookAnswer(input, options);
};
const words = text => text.trim().split(/\s+/).filter(Boolean).length;
const plain = draft => draft.sections.map(section => section.text).join('\n\n');

test('empty selections do not fabricate an answer from question text or missing evidence', () => {
  assert.equal(compile(result([], {question: {text: 'Invent an answer without sources.'}})), null);
  assert.equal(compile(result([passage('')])), null);
});

test('book answers retain complete textbook sentences, exact decimals and independent page identities', () => {
  const a = passage('The water-cement ratio is 0.24.  The test gives a slump of 12.5 mm.', 'Slump test', 'a', 7);
  const b = passage('The compacting factor is the ratio of two measured weights.', 'Compacting factor', 'b', 7);
  const input = result([a, b]), before = structuredClone(input), draft = compile(input);
  assert.equal(draft.mode, 'extractive');
  assert.equal(draft.targetWords, 300);
  assert.equal(draft.sections[0].text, a.text);
  assert.equal(draft.sections[1].text, b.text);
  assert.deepEqual(draft.sections.map(section => section.sourceIds), [['S1'], ['S2']]);
  assert.deepEqual(draft.sources.map(source => [source.id, source.bookId, source.pages[0].pdfPage]), [['S1', 'a', 7], ['S2', 'b', 7]]);
  assert.equal(draft.wordCount, words(a.text) + words(b.text));
  assert.deepEqual(input, before, 'Compiling never changes canonical passages or page metadata');
  draft.sources[0].pages[0].printedLabel = '999';
  assert.equal(input.passages[0].segments[0].page.printedLabel, '5');
});

test('overlapping sentences appear once while retaining the supporting book citations', () => {
  const first = 'The slump test measures the consistency of fresh concrete.';
  const shared = 'The mould is lifted vertically after filling the concrete.';
  const last = 'The decrease in height is recorded as the slump.';
  const draft = compile(result([passage(`${first} ${shared}`), passage(`${shared} ${last}`, 'Slump test', 'b', 10)]));
  assert.equal(draft.sections.length, 1, 'Passages under the same source heading form one readable section');
  assert.equal((plain(draft).match(/The mould is lifted/g) || []).length, 1);
  assert.ok(plain(draft).includes(first));
  assert.ok(plain(draft).includes(last));
  assert.deepEqual(draft.sections[0].sourceIds, ['S1', 'S2']);
  assert.equal(draft.wordCount, 27);
});

test('a selected excerpt with an incomplete final sentence stops at the last complete sentence', () => {
  const complete = 'The mould is filled in three layers before the test.';
  const draft = compile(result([passage(`${complete} Each layer must be`)]));
  assert.equal(plain(draft), complete);
  assert.ok(!plain(draft).includes('Each layer must'));
  assert.equal(draft.sources[0].text, `${complete} Each layer must be`);
});

test('200, 300 and 450 word choices enforce a total budget and preserve fair topic coverage', () => {
  const sentence = (topic, n) => `${topic} reading ${n} requires fresh concrete specimens prepared with the same materials, sampling time, mixing procedure and carefully recorded laboratory conditions.`;
  const a = passage(Array.from({length: 14}, (_, n) => sentence('Slump', n + 1)).join(' '));
  const b = passage(Array.from({length: 14}, (_, n) => sentence('Factor', n + 1)).join(' '), 'Compacting factor', 'b');
  let previous = 0;
  for (const targetWords of [200, 300, 450]) {
    const draft = compile(result([a, b]), {targetWords});
    assert.ok(draft.wordCount <= targetWords);
    assert.equal(draft.wordCount, words(plain(draft)));
    assert.ok(draft.wordCount > previous, 'A longer target can retain more available complete sentences');
    assert.ok(draft.sections.some(section => section.heading === 'Slump test'));
    assert.ok(draft.sections.some(section => section.heading === 'Compacting factor'));
    for (const section of draft.sections) for (const paragraph of section.text.split('\n\n')) {
      assert.ok([a, b].some(source => source.text.includes(paragraph)), 'Each paragraph remains an exact contiguous source substring');
    }
    previous = draft.wordCount;
  }
});

test('limited evidence stays short and carries actual coverage gaps rather than invented filler', () => {
  const text = 'The slump test is an indication of concrete consistency.';
  const draft = compile(result([passage(text)], {status: 'partial', coverageNotes: ['The requested ASTM edition was not found.']}), {targetWords: 450});
  assert.equal(plain(draft), text);
  assert.equal(draft.wordCount, 9);
  assert.ok(draft.missingDetails.includes('The requested ASTM edition was not found.'));
  assert.ok(!plain(draft).includes('ASTM'));
});

test('unsupported lengths and punctuation fragments cannot produce a padded book answer', () => {
  assert.throws(() => compile(result([passage('A complete source sentence appears here.')]), {targetWords: 0}), /word|length|budget/i);
  assert.equal(compile(result([passage('Table 7 14 20 incomplete text')])), null);
});
