import test from 'node:test';
import assert from 'node:assert/strict';
import {answerLabel,copyAnswerText} from '../src/answer-output.js';

const books=()=>['first','second'].map((id,index)=>({id,filename:'Concrete_Handbook.pdf',pages:[{ref:{bookId:id,bookName:'Concrete_Handbook.pdf',pdfPage:1,printedLabel:index?'21':'17'}}]}));
const draft=()=>({mode:'local-rewrite',title:'Answer from your books',sections:[{heading:'Measurement',text:'Before immersion, the specimen is weighed.',sourceIds:['S2']}],sources:[{id:'S1',bookId:'first',bookName:'Concrete_Handbook.pdf',pages:[{bookId:'first',pdfPage:1,printedLabel:'old'}]},{id:'S2',bookId:'second',bookName:'Concrete_Handbook.pdf',pages:[{bookId:'second',pdfPage:1,printedLabel:'old'}]}],missingDetails:['The source omits immersion time.'],rewrite:{changes:[{sectionIndex:0,before:'The specimen is weighed before immersion.',after:'Before immersion, the specimen is weighed.',ruleId:'clause-order'}],changedSentences:1,totalSentences:1}});

test('answer labels distinguish local wording from exact excerpts and generated AI',()=>{
  assert.equal(answerLabel({mode:'extractive'}),'Book excerpts');
  assert.equal(answerLabel({mode:'local-rewrite'}),'Locally rephrased');
  assert.equal(answerLabel({mode:'book'}),'AI explanation');
  assert.equal(answerLabel({mode:'general'}),'General AI · unverified');
});

test('copy uses the selected local wording once with current compact citations and no review history',()=>{
  const answer=draft(),before=structuredClone(answer),text=copyAnswerText(answer,books());
  assert.match(text,/^Locally rephrased\n/);
  assert.equal(text.split('Before immersion, the specimen is weighed.').length-1,1);
  assert.match(text,/Measurement\nBefore immersion, the specimen is weighed\.\nB2 · p\. 21 · PDF 1/);
  assert.match(text,/References\nB2 · Concrete Handbook$/);
  for(const clutter of ['AI explanation','Book excerpts','The specimen is weighed before immersion.','The source omits immersion time.','clause-order','S1','S2','old','.pdf'])assert.ok(!text.includes(clutter),clutter);
  assert.equal(text.split('Concrete Handbook').length-1,1);
  assert.deepEqual(answer,before,'Copying must not mutate source references or the reversible rewrite audit');
});

test('copy deduplicates same-page evidence while keeping different books and pages distinct',()=>{
  const library=books();library[1].pages.push({ref:{bookId:'second',pdfPage:2,printedLabel:'22'}});
  const answer=draft();answer.sections[0].sourceIds=['S1','S2','S3'];answer.sources.push({id:'S3',bookId:'second',pages:[{bookId:'second',pdfPage:1,printedLabel:'stale'},{bookId:'second',pdfPage:2,printedLabel:'stale'}]});
  const text=copyAnswerText(answer,library);
  assert.equal(text.split('B2 · p. 21 · PDF 1').length-1,1);
  assert.match(text,/B1 · p\. 17 · PDF 1; B2 · p\. 21 · PDF 1; B2 · p\. 22 · PDF 2/);
  assert.match(text,/References\nB1 · Concrete Handbook\nB2 · Concrete Handbook$/);
});

test('copy without a loaded library retains distinct source book identities rather than merging same filenames',()=>{
  const answer=draft();answer.sections[0].sourceIds=['S1','S2'];
  const text=copyAnswerText(answer);
  assert.match(text,/B1 · p\. old · PDF 1; B2 · p\. old · PDF 1/);
  assert.match(text,/References\nB1 · Concrete Handbook\nB2 · Concrete Handbook$/);
});

test('copy rejects an unknown citation or removed book rather than silently losing evidence',()=>{
  const unknown=draft();unknown.sections[0].sourceIds=['S999'];
  assert.throws(()=>copyAnswerText(unknown,books()),/source|citation/i);
  const removed=draft();removed.sources[1].bookId='removed';removed.sources[1].pages[0].bookId='removed';
  assert.throws(()=>copyAnswerText(removed,books()),/book.*(?:available|loaded|removed|found)/i);
});

test('general copy remains explicitly unverified and never attaches fabricated textbook references',()=>{
  const answer=draft();answer.mode='general';answer.title='General explanation';answer.sections[0].sourceIds=['S999'];answer.sources[0].bookId='removed';
  const text=copyAnswerText(answer,books());
  assert.match(text,/^General AI · unverified\n/);
  assert.ok(text.includes('Before immersion, the specimen is weighed.'));
  for(const clutter of ['References','B1','B2','S999','Concrete','old','omits immersion'])assert.ok(!text.includes(clutter),clutter);
});
