import test from 'node:test';
import assert from 'node:assert/strict';
import {compileBookAnswer} from '../src/book-answer.js';
const api = await import('../src/local-rewrite.js').catch(() => ({}));

const source = (text, id = 'S1', bookId = 'concrete', pdfPage = 7) => ({
  id, text, bookId, bookName: 'Concrete handbook.pdf',
  pages: [{bookId, bookName: 'Concrete handbook.pdf', pdfPage, printedLabel: '5'}]
});
const answer = (text, extra = {}) => ({
  title: 'Answer from your books', mode: 'extractive', targetWords: 300,
  wordCount: 999, sections: [{heading: 'Laboratory procedure', text, sourceIds: ['S1']}],
  sources: [source(text)], missingDetails: ['The requested standard edition was not found.'], ...extra
});
const rewrite = input => {
  assert.equal(typeof api.rewriteBookAnswer, 'function', 'A conservative local editor is available without an AI service');
  return api.rewriteBookAnswer(input);
};

test('local editing makes a real narrow wording change and records the original sentence', () => {
  const draft = rewrite(answer('The specimen is dried in order to remove surface water.'));
  assert.equal(draft.mode, 'local-rewrite');
  assert.equal(draft.title, 'Answer from your books');
  assert.equal(draft.sections[0].text, 'The specimen is dried to remove surface water.');
  assert.equal(draft.wordCount, 8);
  assert.equal(draft.rewrite.changedSentences, 1);
  assert.equal(draft.rewrite.totalSentences, 1);
  assert.deepEqual(draft.rewrite.changes, [{sectionIndex: 0,
    before: 'The specimen is dried in order to remove surface water.',
    after: 'The specimen is dried to remove surface water.', ruleId: 'purpose-to'}]);
});

test('approved phrase rules preserve the rest of each technical sentence literally', () => {
  const examples = [
    ['The temperature increases due to the fact that hydration releases heat.', 'The temperature increases because hydration releases heat.'],
    ['Owing to the fact that hydration releases heat, the temperature increases.', 'Because hydration releases heat, the temperature increases.'],
    ['The aggregate is washed for the purpose of removing dust.', 'The aggregate is washed for removing dust.'],
    ['All samples are tested with the exception of damaged specimens.', 'All samples are tested except for damaged specimens.'],
    ['The reading is lower in comparison with the reference reading.', 'The reading is lower compared with the reference reading.'],
    ['This property is known as workability.', 'This property is called workability.'],
    ['These measurements are referred to as slump readings.', 'These measurements are called slump readings.'],
    ['The mixture is made up of sand.', 'The mixture consists of sand.'],
    ['The particles are composed of calcium carbonate.', 'The particles consist of calcium carbonate.'],
    ['The strength is dependent on curing.', 'The strength depends on curing.'],
    ['The readings are dependent on temperature.', 'The readings depend on temperature.'],
    ['In order to remove dust, wash the aggregate.', 'To remove dust, wash the aggregate.']
  ];
  for (const [before, after] of examples) {
    const draft = rewrite(answer(before));
    assert.equal(draft.sections[0].text, after);
    assert.equal(draft.rewrite.changedSentences, 1, before);
  }
});

test('a recognized laboratory time phrase moves without swapping procedure order', () => {
  const examples = [
    ['The specimen is weighed before immersion.', 'Before immersion, the specimen is weighed.'],
    ['The sample is cooled after heating.', 'After heating, the sample is cooled.'],
    ['The mould is measured before testing.', 'Before testing, the mould is measured.']
  ];
  for (const [before, after] of examples) {
    const draft = rewrite(answer(before));
    assert.equal(draft.sections[0].text, after);
    assert.equal(draft.rewrite.changes[0].ruleId, 'procedure-time-first');
  }
});

test('copula-removing rules decline shared predicates and ambiguous coordination', () => {
  for (const text of [
    'The output is dependent on temperature and proportional to pressure.',
    'The readings are dependent on temperature or proportional to pressure.',
    'The sample is composed of sand and dried before testing.',
    'The samples are made up of sand but stored before testing.',
    'The sample is composed of sand, dried before testing.',
    'The output is dependent on temperature as well as proportional to pressure.',
    'The sample is made up of sand & dried before testing.'
  ]) {
    const draft = rewrite(answer(text));
    assert.equal(draft.sections[0].text, text);
    assert.equal(draft.rewrite.changedSentences, 0);
  }
});

test('ordering positions and unknown infinitives cannot trigger the purpose-to edit', () => {
  for (const text of [
    'The specimens are arranged in order to the left of the mould.',
    'The steps are listed in order to the right of the diagram.',
    'The tests are shown in order to their importance.',
    'The method is used in order to characterize surface properties.'
  ]) {
    const draft = rewrite(answer(text));
    assert.equal(draft.sections[0].text, text);
    assert.equal(draft.rewrite.changedSentences, 0);
  }
});

test('unrecognized subjects, passive clauses and added time qualifications are left intact', () => {
  for (const text of [
    'The IS specimen is weighed before immersion.',
    'Portland Cement is weighed before immersion.',
    'The specimen is weighed before immersion in water.',
    'The specimen was weighed before immersion.',
    'The specimen is weighed by the operator before immersion.',
    'The specimen is weighed before the aggregate is dried.',
    'The load is applied after the support is fixed.'
  ]) {
    const draft = rewrite(answer(text));
    assert.equal(draft.sections[0].text, text);
    assert.equal(draft.rewrite.changedSentences, 0);
  }
});

test('negation, modality, exclusivity and conditional scope cause the local editor to decline changes', () => {
  for (const text of [
    'The specimen may be dried in order to remove surface water.',
    'The specimen must be dried in order to remove surface water.',
    'The specimen is not dried in order to remove surface water.',
    'The specimen is dried only in order to remove surface water.',
    'The specimen is dried in order to remove surface water if the mass is stable.',
    'Unless the mass is stable, the specimen is dried in order to remove surface water.',
    'The specimen is weighed before immersion except when the coating is damaged.',
    'The specimen cannot be dried in order to remove surface water.',
    "The specimen isn't dried in order to remove surface water.",
    'No sample is dried in order to remove surface water.'
  ]) assert.equal(rewrite(answer(text)).sections[0].text, text);
});

test('quoted text, code and mathematics are never treated as prose rewrite candidates', () => {
  for (const text of [
    'The book says "The sample is composed of sand."',
    '“The specimen is dried in order to remove water. The mixture is made up of sand.”',
    '`The mixture is made up of sand.`',
    'const specimen = "is made up of sand";',
    'The result x = 2 is dependent on temperature.',
    'The reading ≤ 30% is dependent on moisture.',
    'The result 2 + 3 is dependent on temperature.',
    'The value α is dependent on temperature.'
  ]) assert.equal(rewrite(answer(text)).sections[0].text, text);
});

test('quantity-unit attachments, standards, technical names and decimal punctuation remain exact', () => {
  const text = 'The ASTM C143 reading of 12.5 mm is dependent on the water–cement ratio of 0.24–0.30. '
    + 'The C-S-H gel is made up of 30% material at 27 °C. '
    + 'The IS 1199:1959 range is 10–30 mm.';
  const draft = rewrite(answer(text));
  assert.equal(draft.sections[0].text, 'The ASTM C143 reading of 12.5 mm depends on the water–cement ratio of 0.24–0.30. '
    + 'The C-S-H gel consists of 30% material at 27 °C. The IS 1199:1959 range is 10–30 mm.');
  assert.equal(draft.rewrite.changedSentences, 2);
  assert.equal(draft.rewrite.totalSentences, 3);
});

test('multiple approved edits in one sentence produce one before-and-after record', () => {
  const draft = rewrite(answer('The test is known as a slump test in order to identify workability.'));
  assert.equal(draft.sections[0].text, 'The test is called a slump test to identify workability.');
  assert.equal(draft.rewrite.changedSentences, 1);
  assert.equal(draft.rewrite.changes.length, 1);
  assert.ok(draft.rewrite.changes[0].ruleId.includes('purpose-to'));
  assert.ok(draft.rewrite.changes[0].ruleId.includes('definition-called'));
});

test('paragraph breaks, unchanged whitespace and headings survive local editing', () => {
  const text = 'The mixture is made up of cement and water.  The mould remains rigid.\r\n\r\n'
    + 'The specimen is weighed before immersion.\n\nThe final reading is stable.';
  const draft = rewrite(answer(text));
  assert.equal(draft.sections[0].text, 'The mixture is made up of cement and water.  The mould remains rigid.\r\n\r\n'
    + 'Before immersion, the specimen is weighed.\n\nThe final reading is stable.');
  assert.equal(draft.sections[0].heading, 'Laboratory procedure');
  assert.equal(draft.rewrite.changedSentences, 1);
  assert.equal(draft.rewrite.totalSentences, 4);
  const untouched = '  The water–cement ratio remains 0.24.\n\nThe mass remains 12.5 kg.  ';
  assert.equal(rewrite(answer(untouched)).sections[0].text, untouched);
});

test('incomplete sentences are retained literally instead of being rewritten or padded', () => {
  const text = 'The mixture is made up of sand';
  const draft = rewrite(answer(text));
  assert.equal(draft.sections[0].text, text);
  assert.equal(draft.rewrite.changedSentences, 0);
  assert.equal(draft.rewrite.totalSentences, 0);
});

test('all sections keep their independent source IDs and deep-cloned original evidence', () => {
  const first = 'The mixture is composed of cement and water.';
  const second = 'The specimen is weighed before immersion.';
  const input = answer(first, {
    targetWords: 450, sections: [
      {heading: 'Composition', text: first, sourceIds: ['S1']},
      {heading: 'Measurement', text: second, sourceIds: ['S2', 'S3']}
    ], sources: [source(first), source(second, 'S2', 'second-book'), source(second, 'S3', 'third-book')]
  });
  const original = structuredClone(input), draft = rewrite(input);
  assert.deepEqual(input, original);
  assert.equal(draft.targetWords, 450);
  assert.deepEqual(draft.sections.map(section => section.sourceIds), [['S1'], ['S2', 'S3']]);
  assert.deepEqual(draft.sources, original.sources);
  assert.deepEqual(draft.missingDetails, original.missingDetails);
  assert.deepEqual(draft.rewrite.changes.map(change => change.sectionIndex), [1]);
  draft.sources[0].pages[0].printedLabel = '999';
  draft.sections[0].sourceIds.push('S9');
  draft.missingDetails.push('Changed');
  assert.deepEqual(input, original, 'Neither evidence pages nor citation and gap arrays share mutable references');
});

test('real source-compiler output remains supported without merging book identities or adding facts', () => {
  const first = 'The mixture is composed of cement and water.';
  const second = 'The specimen is weighed before immersion.';
  const result = {coverageNotes: ['An ASTM edition is missing.'], passages: [first, second].map((text, index) => ({
    text, heading: index ? 'Measurement' : 'Composition', bookId: `book-${index}`, bookName: 'Handbook.pdf',
    segments: [{page: {bookId: `book-${index}`, bookName: 'Handbook.pdf', pdfPage: 7, printedLabel: '5'}}]
  }))};
  const base = compileBookAnswer(result, {targetWords: 200}), draft = rewrite(base);
  assert.equal(draft.wordCount, 14);
  assert.equal(draft.targetWords, 200);
  assert.deepEqual(draft.sources.map(item => item.bookId), ['book-0', 'book-1']);
  assert.deepEqual(draft.sections.map(item => item.sourceIds), [['S1'], ['S2']]);
  assert.deepEqual(draft.missingDetails, ['An ASTM edition is missing.']);
  assert.equal(draft.sections[0].text, 'The mixture is composed of cement and water.');
  assert.equal(draft.sections[1].text, 'Before immersion, the specimen is weighed.');
});

test('unsupported modes and absent or malformed cited evidence cannot be relabeled as local book writing', () => {
  for (const input of [null, undefined, {}, answer('Text.', {mode: 'book'}), answer('Text.', {mode: 'general'}),
    answer('Text.', {mode: 'local-rewrite'}), answer('Text.', {sources: []}), answer('Text.', {sections: []}),
    answer('Text.', {sections: [{heading: 'Topic', text: '', sourceIds: ['S1']}]}),
    answer('Text.', {sections: [{heading: 'Topic', text: 'Text.', sourceIds: ['S2']}]}),
    answer('Text.', {sections: [{heading: 'Topic', text: 'Text.', sourceIds: []}]}),
    answer('Text.', {sources: [{...source('Text.'), pages: []}]}),
    answer('Text.', {sources: [source('Text.'), source('Duplicate.')]})]) {
    assert.equal(rewrite(input), null);
  }
});

test('an extractive mode label cannot attach unsupported prose to an unrelated source', () => {
  const input = answer('The specimen is weighed before immersion.', {
    sources: [source('The mixture consists of cement and water.')]
  });
  assert.equal(rewrite(input), null);
});

test('repeated calls are deterministic, quota-free and operate without browser or network facilities', () => {
  const input = answer('The specimen is weighed before immersion.');
  const originalFetch = globalThis.fetch, originalRandom = Math.random;
  globalThis.fetch = () => { throw new Error('Local editing must not make a request.'); };
  Math.random = () => { throw new Error('Local editing must not depend on randomness.'); };
  try {
    const first = rewrite(input);
    for (let index = 0; index < 1000; index++) assert.deepEqual(rewrite(input), first);
    assert.equal(first.sections[0].text, 'Before immersion, the specimen is weighed.');
    assert.equal(input.sections[0].text, 'The specimen is weighed before immersion.');
  } finally {
    globalThis.fetch = originalFetch;
    Math.random = originalRandom;
  }
});
