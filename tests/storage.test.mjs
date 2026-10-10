import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('../src/storage.js').catch(()=>({}));
test('local persistence reports unavailable storage instead of silently retaining a book',async()=>{
  assert.equal(typeof api.saveBook,'function','saveBook missing');await assert.rejects(()=>api.saveBook(new File(['%PDF-1.7'],'book.pdf',{type:'application/pdf'})),/storage.*unavailable/i);
});
