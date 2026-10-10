import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../src/book.js').catch(()=>({}));
test('bad PDF is rejected with an actionable message',async()=>{
  assert.equal(typeof api.openBook,'function','openBook missing');
  await assert.rejects(api.openBook(new Blob([])),/empty/i);
  await assert.rejects(api.openBook(new Blob(['not a PDF'])),/PDF/i);
});
test('a cancelled load cannot become a successful session',async()=>{
  assert.equal(typeof api.openBook,'function','openBook missing');
  const controller=new AbortController();controller.abort();
  await assert.rejects(api.openBook(new Blob(['%PDF-1.7']),{signal:controller.signal}),{name:'AbortError'});
});
test('actual PDF loading retains physical pages and permits disposal',async()=>{
  const {PDFDocument}=await import('pdf-lib');const doc=await PDFDocument.create();
  for(let i=0;i<3;i++){const p=doc.addPage();p.drawText('This is a genuine source paragraph about concrete workability.',{x:50,y:700,size:12});p.drawText(String(17+i),{x:300,y:20,size:12});}
  const file=new Blob([await doc.save()]);const progress=[];
  const session=await api.openBook(file,{onProgress:p=>progress.push(p.completed)});
  assert.equal(session.pageCount,3);assert.equal(session.pages[0].ref.pdfPage,1);
  assert.equal(session.pages[0].ref.printedLabel,'17');assert.deepEqual(progress,[1,2,3]);
  assert.ok(session.spans.some(s=>s.text.includes('genuine source paragraph')));
  await session.dispose();assert.equal(session.pages.length,0);
});
