import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSourceSpans} from '../src/layout.js';
import {resolveResultReferences,wordCount} from '../src/model.js';
import {buildIndex,searchQuestion} from '../src/search.js';
const api=await import('../src/library.js').catch(()=>({}));
const span=(id,text,heading,page=1)=>({id,text,heading,segments:[{page:{pdfPage:page,printedLabel:'1'},ranges:[{runId:id,start:0,end:text.length}],rects:[{x:.1,y:.2,width:.8,height:.1}],method:'pdf-text'}]});
const question={id:'q',text:'Explain concrete workability.'};

test('source routing identifies a book independently of overlapping physical pages',()=>{
  assert.equal(typeof api.getBook,'function');
  const a={id:'a',filename:'First.pdf'},b={id:'b',filename:'Second.pdf'};
  assert.equal(api.getBook({books:[a,b]},'b'),b);
  assert.equal(api.getBook([a,b],'a'),a);
  assert.equal(api.getBook(a,'a'),a);
  assert.equal(api.getBook(a),a);
  assert.throws(()=>api.getBook({books:[a,b]},'missing'),/book.*(?:available|loaded|found)/i);
  assert.throws(()=>api.getBook({books:[a,b]}),/book/i);
  assert.deepEqual(api.bookSources([a,b]).map(book=>[book.id,book.name]),[['a','First.pdf'],['b','Second.pdf']]);
});

test('books with identical local passage ids remain distinct and deterministically interleaved',()=>{
  assert.equal(typeof api.indexBooks,'function');assert.equal(typeof api.searchLibrary,'function');
  const books=[{id:'a',filename:'First.pdf',spans:[span('p1-0','Concrete workability describes how easily fresh concrete is mixed and compacted.','Concrete workability')]},{id:'b',filename:'Second.pdf',spans:[span('p1-0','Concrete workability affects placement around the reinforcement without segregation.','Concrete workability')]}];
  const indexes=api.indexBooks(books),result=api.searchLibrary(indexes,question,{wordBudget:400});
  assert.deepEqual(result.passages.map(p=>p.bookId),['a','b']);
  assert.equal(new Set(result.passages.map(p=>p.id)).size,2);
  assert.deepEqual(result.passages.map(p=>p.segments[0].page.bookName),['First.pdf','Second.pdf']);
  assert.deepEqual(result.passages.map(p=>p.segments[0].page.bookId),['a','b']);
  assert.deepEqual(result.bookSummaries.map(b=>b.id),['a','b']);
  assert.equal(result.passages.reduce((sum,p)=>sum+wordCount(p.text),0)<=400,true);
  assert.deepEqual(api.searchLibrary(indexes,question,{wordBudget:400}),result);
  assert.equal(books[0].spans[0].id,'p1-0');
  const repeated=api.searchLibrary(api.indexBooks([{id:'a',filename:'First.pdf',spans:result.passages.filter(p=>p.bookId==='a')}]),question);
  assert.equal(repeated.passages[0].id,result.passages[0].id);
});

test('an unrelated or empty book does not mask another book’s reliable passages',()=>{
  assert.equal(typeof api.indexBooks,'function');
  const indexes=api.indexBooks([{id:'empty',filename:'Empty.pdf',spans:[]},{id:'unrelated',filename:'Other.pdf',spans:[span('one','Photosynthesis converts light into chemical energy stored by green plants.','Photosynthesis')]},{id:'useful',filename:'Concrete.pdf',spans:[span('one','Concrete workability describes ease of mixing, placing and compacting fresh concrete.','Concrete workability')]}]);
  const result=api.searchLibrary(indexes,question);
  assert.equal(result.status,'matches');
  assert.deepEqual(result.passages.map(p=>p.bookId),['useful']);
  assert.deepEqual(result.bookSummaries.map(b=>b.status),['no-match','no-match','matches']);
  assert.ok(result.bookSummaries[0].coverage.length);
  const none=api.searchLibrary(indexes,{id:'none',text:'Explain lunar geology.'});
  assert.equal(none.status,'no-match');assert.deepEqual(none.passages,[]);
});

test('same numbered figure references never pull explanatory prose from another book',()=>{
  assert.equal(typeof api.indexBooks,'function');
  const books=[{id:'a',filename:'Slump.pdf',spans:[span('caption','Figure 1 Slump measurement.','Slump'),span('prose','The slump measurement indicates the decrease in fresh concrete height.','Slump')]},{id:'b',filename:'Spread.pdf',spans:[span('caption','Figure 1 Spread measurement.','Spread'),span('prose','The spread measurement indicates the diameter of concrete after mould removal.','Spread')]}];
  const result=api.searchLibrary(api.indexBooks(books),{id:'q',text:'Explain Figure 1.'});
  assert.deepEqual(new Set(result.passages.map(p=>p.bookId)),new Set(['a','b']));
  for(const passage of result.passages){assert.ok(passage.segments.every(s=>s.page.bookId===passage.bookId));assert.ok(passage.bookId==='a'?passage.text.includes('slump'):passage.text.includes('spread'));}
});

test('label refresh after worker cloning uses book identity as well as PDF page',()=>{
  const books=[{id:'a',pages:[{ref:{bookId:'a',bookName:'A.pdf',pdfPage:1,printedLabel:'A-1'}}]},{id:'b',pages:[{ref:{bookId:'b',bookName:'B.pdf',pdfPage:1,printedLabel:'B-corrected'}}]}];
  const results=[{passages:[{bookId:'a',segments:[{page:{bookId:'a',pdfPage:1,printedLabel:'old'}}]},{bookId:'b',segments:[{page:{bookId:'b',pdfPage:1,printedLabel:'old'}}]}],figures:[{page:{bookId:'b',pdfPage:1,printedLabel:'old'}}]}];
  resolveResultReferences({books},results);
  assert.deepEqual(results[0].passages.map(p=>p.segments[0].page.printedLabel),['A-1','B-corrected']);
  assert.equal(results[0].figures[0].page.printedLabel,'B-corrected');
});

test('AI explanation citations refresh their own source book’s labels',()=>{
  const books=[{id:'a',pages:[{ref:{bookId:'a',pdfPage:1,printedLabel:'first'}}]},{id:'b',pages:[{ref:{bookId:'b',pdfPage:1,printedLabel:'corrected'}}]}];
  const results=[{passages:[],figures:[],explanation:{sources:[{id:'S1',bookId:'b',pages:[{bookId:'b',pdfPage:1,printedLabel:'old'}]}]}}];
  resolveResultReferences({books},results);
  assert.equal(results[0].explanation.sources[0].pages[0].printedLabel,'corrected');
});

test('a long explanation in the first book leaves evidence room for the second relevant book',()=>{
  const text='Concrete workability describes how easily fresh concrete can be mixed and placed. '+Array.from({length:17},(_,i)=>`A concrete mixture detail ${i+1} explains an additional placement and compaction consideration.`).join(' ');
  const indexes=api.indexBooks([{id:'a',filename:'A.pdf',spans:[span('one',text,'Concrete workability')]},{id:'b',filename:'B.pdf',spans:[span('one',text.replace('mixture detail','placement detail'),'Concrete workability')]}]);
  for(const wordBudget of [200,300,450]){
    const result=api.searchLibrary(indexes,question,{wordBudget});
    assert.deepEqual(new Set(result.passages.map(p=>p.bookId)),new Set(['a','b']));
    assert.ok(result.passages.reduce((sum,p)=>sum+wordCount(p.text),0)<=wordBudget);
    for(const passage of result.passages)assert.ok(passage.text.endsWith('.'));
  }
});

test('OCR-style span reconstruction preserves book identity and local source geometry',()=>{
  const page={ref:{bookId:'a',bookName:'OCR.pdf',pdfPage:1,printedLabel:null},method:'ocr',runs:[{id:'ocr-1-0',text:'Concrete workability helps with placement and compaction of a fresh mixture.',fontSize:12,bounds:{x:.1,y:.2,width:.8,height:.03}}]};
  const spans=makeSourceSpans([page]);
  assert.equal(spans[0].bookId,'a');assert.equal(spans[0].id,'a:p1-0');
  assert.equal(spans[0].segments[0].page,page.ref);
  assert.deepEqual(spans[0].segments[0].rects,[{x:.1,y:.2,width:.8,height:.03}]);
});

test('a larger evidence budget keeps a complete longer explanation without loosening topic relevance',()=>{
  const text='Concrete workability describes how easily fresh concrete can be mixed and placed. '+Array.from({length:17},(_,i)=>`A concrete mixture detail ${i+1} explains an additional placement and compaction consideration.`).join(' ');
  const indexes=buildIndex([span('topic',text,'Concrete workability'),span('unrelated','Photosynthesis describes how green plants convert light into stored chemical energy.','Photosynthesis')]);
  const short=searchQuestion(indexes,question,{wordBudget:200}),long=searchQuestion(indexes,question,{wordBudget:400});
  assert.ok(wordCount(long.passages.map(p=>p.text).join(' '))>wordCount(short.passages.map(p=>p.text).join(' ')));
  assert.equal(long.passages[0].text,text);
  assert.ok(long.passages.every(p=>p.heading==='Concrete workability'));
  assert.ok(long.passages.every(p=>text.slice(p.selectedOffsets.start,p.selectedOffsets.end)===p.text));
});
