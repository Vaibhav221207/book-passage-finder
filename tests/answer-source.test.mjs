import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('../src/answer-source.js').catch(()=>({}));
test('citation lookup distinguishes identical text in different books and physical pages',()=>{
  const p=(id,bookId,pdfPage)=>({id,bookId,text:'same words',segments:[{page:{bookId,pdfPage}}]});
  const passages=[p('a1','a',1),p('a2','a',2),p('b1','b',1)],result={passages};
  assert.equal(api.findAnswerPassage(result,{bookId:'b',text:'same words',pages:[{bookId:'b',pdfPage:1}]}),passages[2]);
  assert.equal(api.findAnswerPassage(result,{bookId:'a',text:'same words',pages:[{bookId:'a',pdfPage:2}]}),passages[1]);
  assert.equal(api.findAnswerPassage(result,{bookId:'gone',text:'same words',pages:[{bookId:'gone',pdfPage:1}]}),null);
});
