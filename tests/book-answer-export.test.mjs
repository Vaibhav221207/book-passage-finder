import test from 'node:test';
import assert from 'node:assert/strict';
import {exportPacket} from '../src/export.js';
import {pdfLibrary} from '../src/book.js';

const books = () => ['a', 'b'].map((id, index) => ({id, filename: 'Handbook.pdf', pageCount: 1, pages: [{ref: {bookId: id, bookName: 'Handbook.pdf', pdfPage: 1, printedLabel: index ? '21' : '17'}, runs: []}]}));
const makeDraft = () => ({title: 'Answer from your books', mode: 'extractive', sections: [{heading: 'Slump', text: 'Concrete consistency is measured using the slump test.', sourceIds: ['S1']}], missingDetails: ['The selected source does not give apparatus dimensions.'], sources: [{id: 'S1', bookId: 'b', bookName: 'Handbook.pdf', pages: [{bookId: 'b', bookName: 'Handbook.pdf', pdfPage: 1, printedLabel: 'old'}], text: 'Concrete consistency is measured using the slump test.'}]});
const makeResult = () => ({question: {text: 'Explain the slump test.'}, status: 'matches', passages: [], figures: [], coverageNotes: [], bookAnswer: makeDraft()});
async function pdfText(blob) {
  const loading = (await pdfLibrary()).getDocument({data: new Uint8Array(await blob.arrayBuffer()), useSystemFonts: true}), pdf = await loading.promise;
  try {let text = ''; for (let n = 1; n <= pdf.numPages; n++) text += (await (await pdf.getPage(n)).getTextContent()).items.map(item => item.str).join(' ') + ' '; return text;}
  finally {await loading.destroy();}
}

async function pdfPages(blob) {
  const loading = (await pdfLibrary()).getDocument({data: new Uint8Array(await blob.arrayBuffer()), useSystemFonts: true}), pdf = await loading.promise;
  try {
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n), items = (await page.getTextContent()).items;
      pages.push({text: items.map(item => item.str).join(' '), items, height: page.view[3]});
    }
    return pages;
  } finally {await loading.destroy();}
}

test('the chosen study answer exports once without repeating raw evidence or review notes', async t => {
  for (const mode of ['extractive', 'book', 'general']) await t.test(mode, async () => {
    const result = makeResult();
    result.passages = [{bookId: 'b', text: 'Original evidence supplies the apparatus measurements.', segments: [{page: books()[1].pages[0].ref, rects: []}]}];
    result.coverageNotes = ['Check the original apparatus measurements.'];
    const draft = {...makeDraft(), mode, sections: [{heading: 'Method', text: 'The student answer explains how to measure consistency.', sourceIds: mode === 'general' ? [] : ['S1']}]};
    if (mode === 'extractive') result.bookAnswer = draft;
    else result.explanation = draft;
    const text = await pdfText(await exportPacket({books: books()}, [result], {includeCrops: false}));
    assert.equal(text.split('The student answer explains how to measure consistency.').length - 1, 1);
    assert.ok(!text.includes('Original evidence supplies'), 'The evidence screenshot can remain without repeating its prose');
    assert.ok(!text.includes('Check the original apparatus measurements.'));
    assert.ok(!text.includes('apparatus dimensions'));
    for (const clutter of ['Missing details to check', 'Partial matches', 'Selected source passages', 'source mappings', 'Original passage crops', 'S1']) assert.ok(!text.includes(clutter), clutter);
    if (mode === 'general') {
      assert.match(text, /General AI answer \(unverified\)/);
      assert.ok(!text.includes('B2'), 'No unused draft or raw passage source should become a general answer citation');
    } else assert.match(text, /B2.*p\.\s*21.*PDF\s*1/);
  });
});

test('each later question starts a fresh PDF page while the first begins with the packet header', async () => {
  const first = makeResult();
  first.bookAnswer.sections[0].text = 'The first answer continues over several pages. '.repeat(250);
  first.passages = [{bookId: 'a', text: 'Long evidence from the first question continues over several pages. '.repeat(180), segments: [{page: books()[0].pages[0].ref, rects: []}]}];
  const second = makeResult();
  second.question.text = 'Explain sustainability.';
  second.status = 'no-match';
  delete second.bookAnswer;
  second.explanation = {title: 'General explanation', mode: 'general', sections: [{heading: 'Overview', text: 'The second answer needs verification outside the books.', sourceIds: []}], missingDetails: [], sources: []};
  const third = makeResult();
  third.question.text = 'Explain compaction.';
  third.bookAnswer.sections[0].text = 'The third selected answer is also included.';
  const pages = await pdfPages(await exportPacket({books: books()}, [first, second, third], {includeCrops: false}));
  assert.ok(pages[0].text.includes('Book Passage Finder') && pages[0].text.includes('Q1. Explain the slump test.'), 'No cover-only or blank page should precede the first question');
  const secondPage = pages.findIndex(page => page.text.includes('Q2. Explain sustainability.'));
  const thirdPage = pages.findIndex(page => page.text.includes('Q3. Explain compaction.'));
  assert.ok(secondPage > 0 && thirdPage > secondPage, 'Every question must have a distinct starting page');
  for (const [index, prefix] of [[secondPage, 'Q2.'], [thirdPage, 'Q3.']]) {
    const heading = pages[index].items.find(item => item.str.startsWith(prefix));
    assert.ok(heading.transform[5] >= pages[index].height - 60, 'Later questions must begin at the top of a fresh page');
  }
  assert.ok(!pages[secondPage].text.includes('Long evidence from the first question'));
  assert.ok(pages[secondPage].text.includes('unverified'));
  assert.ok(!pages[secondPage].text.includes('No reliable match') && !pages[secondPage].text.includes('No answer found'), 'A chosen general answer is not followed by a no-match placeholder');
  assert.ok(pages[thirdPage].text.includes('The third selected answer is also included.'));
});

test('PDF book answers omit verbose labels and use current compact source references', async () => {
  const text = await pdfText(await exportPacket({books: books()}, [makeResult()], {includeCrops: false}));
  assert.ok(text.includes('Concrete consistency is measured using the slump test.'));
  assert.ok(!text.includes('Answer from your books'), 'Generic draft titles are not additional PDF headings');
  assert.ok(!text.includes('Organized textbook sentences'));
  assert.ok(!text.includes('Generated explanation draft'));
  assert.match(text, /B2.*p\.\s*21.*PDF\s*1/);
  assert.ok(!text.includes('S1'));
  assert.ok(!text.includes('old'));
  assert.ok(!text.includes('apparatus dimensions'));
  assert.match(text, /References.*B2.*Handbook/);
  assert.ok(!text.includes('B1'), 'An unused same-filename library book is not included');
  assert.equal(text.split('Handbook').length - 1, 1, 'Book title appears once in the final reference list');
  assert.ok(!text.includes('Handbook.pdf'));
});

test('an AI explanation replaces the fallback in the packet instead of exporting both answers', async () => {
  const result = makeResult();
  result.explanation = {title: 'AI explanation', mode: 'general', sections: [{heading: 'Overview', text: 'A general explanation has replaced the textbook draft.', sourceIds: []}], missingDetails: [], sources: []};
  const text = await pdfText(await exportPacket({books: books()}, [result], {includeCrops: false}));
  assert.ok(text.includes('A general explanation has replaced the textbook draft.'));
  assert.ok(!text.includes('Concrete consistency is measured using the slump test.'));
  assert.ok(!text.includes('Organized textbook sentences'));
});

test('generated PDF answers use a clean AI label without provider identifiers or mapping tokens', async () => {
  const result = makeResult();
  result.explanation = {...makeDraft(), mode: 'book', model: '@cf/provider/internal-model-id'};
  const text = await pdfText(await exportPacket({books: books()}, [result], {includeCrops: false}));
  assert.ok(!text.includes('@cf/provider/internal-model-id'));
  assert.match(text, /AI explanation/);
  assert.ok(!text.includes('verify against the book sources'));
  assert.ok(!text.includes('S1'));
  assert.match(text, /B2.*p\.\s*21.*PDF\s*1/);
});

test('section citations deduplicate distinct passage IDs on one page while preserving every distinct page and book', async () => {
  const [first, second] = books();
  first.pages.push({ref: {bookId: 'a', bookName: first.filename, pdfPage: 2, printedLabel: '18'}, runs: []});
  first.pageCount = 2;
  const unused = {id: 'c', filename: 'Unused_Source.pdf', pages: [{ref: {bookId: 'c', pdfPage: 1, printedLabel: '88'}, runs: []}]};
  const result = makeResult();
  result.bookAnswer = {
    mode: 'extractive',
    title: 'Answer from your books',
    sections: [{heading: 'Method', text: 'A complete explanation combines the measured procedures.', sourceIds: ['S1', 'S2', 'S3', 'S4']}],
    missingDetails: ['Review-only missing detail.'],
    sources: [
      {id: 'S1', bookId: 'a', pages: [{...first.pages[0].ref, printedLabel: 'stale'}]},
      {id: 'S2', bookId: 'a', pages: [first.pages[0].ref]},
      {id: 'S3', bookId: 'a', pages: [first.pages[1].ref]},
      {id: 'S4', bookId: 'b', pages: [second.pages[0].ref]},
      {id: 'S5', bookId: 'c', pages: [unused.pages[0].ref]}
    ]
  };
  const text = await pdfText(await exportPacket({books: [first, second, unused]}, [result], {includeCrops: false}));
  assert.equal((text.match(/B1\s*·\s*p\.\s*17\s*·\s*PDF\s*1/g) || []).length, 1, 'S1 and S2 on the same physical page share one citation');
  assert.match(text, /B1.*p\.\s*18.*PDF\s*2/);
  assert.match(text, /B2.*p\.\s*21.*PDF\s*1/);
  assert.ok(!text.includes('stale') && !text.includes('B3') && !text.includes('Unused'));
  assert.ok(!/\bS[1-5]\b/.test(text));
  const references = text.slice(text.lastIndexOf('References'));
  assert.match(references, /B1.*Handbook/);
  assert.match(references, /B2.*Handbook/);
  assert.equal(text.split('Handbook').length - 1, 2, 'Same-filename books retain separate final references');
});

test('a chosen draft rejects a missing book or unknown cited source ID', async () => {
  const removedBook = makeResult();
  removedBook.bookAnswer.sources[0].bookId = 'removed';
  removedBook.bookAnswer.sources[0].pages[0].bookId = 'removed';
  await assert.rejects(exportPacket({books: books()}, [removedBook], {includeCrops: false}), /book.*(?:found|loaded|unknown|removed|available)|unknown.*book/i);
  const missingSource = makeResult();
  missingSource.bookAnswer.sections[0].sourceIds = ['S999'];
  await assert.rejects(exportPacket({books: books()}, [missingSource], {includeCrops: false}), /source|reference|citation/i);
});

test('a question without a chosen answer or source passage exports one clean no-answer message', async () => {
  const result = makeResult();
  delete result.bookAnswer;
  result.status = 'no-match';
  result.coverageNotes = ['No reliable source passage was found in the loaded books.'];
  const text = await pdfText(await exportPacket({books: books()}, [result], {includeCrops: false}));
  assert.equal(text.split('No answer found in the selected books.').length - 1, 1);
  assert.ok(!text.includes('No reliable source passage'));
  assert.ok(!text.includes('References') && !text.includes('Handbook'));
});

test('an empty draft does not hide selected source prose or invent an answer label', async () => {
  const result = makeResult();
  result.bookAnswer = {...makeDraft(), sections: [{heading: 'Method', text: '   ', sourceIds: ['S1']}]};
  result.passages = [{bookId: 'b', text: 'The available source still explains the slump measurement.', segments: [{page: books()[1].pages[0].ref, rects: []}]}];
  const text = await pdfText(await exportPacket({books: books()}, [result], {includeCrops: false}));
  assert.equal(text.split('The available source still explains the slump measurement.').length - 1, 1);
  assert.match(text, /B2.*p\.\s*21.*PDF\s*1/);
  assert.ok(!text.includes('Answer from your books') && !text.includes('Organized textbook sentences') && !text.includes('No answer found'));
});

test('the References heading stays on the same page as its first book entry', async () => {
  const result = makeResult();
  result.bookAnswer.sections[0].text = Array.from({length: 37}, (_, i) => `Answer line ${i + 1}.`).join('\n');
  const pages = await pdfPages(await exportPacket({books: books()}, [result], {includeCrops: false}));
  const referencesPage = pages.find(page => page.text.includes('References'));
  assert.ok(referencesPage?.text.includes('B2 · Handbook'), 'A reference heading must not be stranded above a page break');
});
