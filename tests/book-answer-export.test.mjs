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

test('the study answer precedes raw evidence in each exported question', async t => {
  for (const mode of ['extractive', 'book', 'general']) await t.test(mode, async () => {
    const result = makeResult();
    result.passages = [{bookId: 'b', text: 'Original evidence supplies the apparatus measurements.', segments: [{page: books()[1].pages[0].ref, rects: []}]}];
    result.coverageNotes = ['Check the original apparatus measurements.'];
    const draft = {...makeDraft(), mode, sections: [{heading: 'Method', text: 'The student answer explains how to measure consistency.', sourceIds: mode === 'general' ? [] : ['S1']}]};
    if (mode === 'extractive') result.bookAnswer = draft;
    else result.explanation = draft;
    const text = await pdfText(await exportPacket({books: books()}, [result], {includeCrops: false}));
    const answerIndex = text.indexOf('The student answer explains'), evidenceIndex = text.indexOf('Original evidence supplies');
    assert.ok(answerIndex >= 0 && evidenceIndex >= 0);
    assert.ok(answerIndex < evidenceIndex, 'Students must reach the answer before the evidence quotations');
    assert.ok(evidenceIndex < text.indexOf('Check the original apparatus measurements.'));
    assert.match(text, /Original evidence supplies.*Handbook\.pdf \[Source 2\].*Book 21.*PDF 1/);
    if (mode === 'general') assert.match(text, /General knowledge.*unverified/);
  });
});

test('each later question starts a fresh PDF page while the first begins with the packet header', async () => {
  const first = makeResult();
  first.bookAnswer.sections[0].text = 'The first answer is short.';
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
  assert.ok(pages[secondPage].text.includes('unverified') && pages[secondPage].text.includes('No reliable match'));
  assert.ok(pages[thirdPage].text.includes('The third selected answer is also included.'));
});

test('PDF book answers use textbook labels and current duplicate-filename source references', async () => {
  const text = await pdfText(await exportPacket({books: books()}, [makeResult()], {includeCrops: false}));
  assert.match(text, /Answer from your books/);
  assert.match(text, /Organized textbook sentences/);
  assert.ok(text.includes('Concrete consistency is measured using the slump test.'));
  assert.ok(!text.includes('Generated explanation draft'));
  assert.match(text, /S1.*Handbook\.pdf \[Source 2\].*Book 21.*PDF 1/);
  assert.ok(!text.includes('Book old'));
  assert.ok(text.includes('apparatus dimensions'));
});

test('an AI explanation replaces the fallback in the packet instead of exporting both answers', async () => {
  const result = makeResult();
  result.explanation = {title: 'AI explanation', mode: 'general', sections: [{heading: 'Overview', text: 'A general explanation has replaced the textbook draft.', sourceIds: []}], missingDetails: [], sources: []};
  const text = await pdfText(await exportPacket({books: books()}, [result], {includeCrops: false}));
  assert.ok(text.includes('A general explanation has replaced the textbook draft.'));
  assert.ok(!text.includes('Concrete consistency is measured using the slump test.'));
  assert.ok(!text.includes('Organized textbook sentences'));
});

test('generated PDF answers retain verification labels without provider model identifiers', async () => {
  const result = makeResult();
  result.explanation = {...makeDraft(), mode: 'book', model: '@cf/provider/internal-model-id'};
  const text = await pdfText(await exportPacket({books: books()}, [result], {includeCrops: false}));
  assert.ok(!text.includes('@cf/provider/internal-model-id'));
  assert.match(text, /Generated explanation draft.*verify against the book sources/);
  assert.match(text, /S1.*Handbook\.pdf \[Source 2\].*Book 21.*PDF 1/);
});
