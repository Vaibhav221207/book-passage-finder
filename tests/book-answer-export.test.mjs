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
