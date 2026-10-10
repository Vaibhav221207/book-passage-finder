import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('../src/figures.js').catch(()=>({}));
test('an explicitly referenced next-page figure is suggested but not auto-confirmed',()=>{
  assert.equal(typeof api.suggestFigures,'function','suggestFigures missing');
  const session={pages:[{ref:{pdfPage:1,printedLabel:'17'},runs:[]},{ref:{pdfPage:2,printedLabel:'18'},runs:[{id:'a',text:'Fig. 2.3 Vibration apparatus',bounds:{x:.15,y:.7,width:.6,height:.03}}]}]};
  const result={passages:[{text:'The apparatus is shown in Fig. 2.3.',heading:'Vibration test',segments:[{page:{pdfPage:1}}]}]};const figures=api.suggestFigures(session,result);assert.equal(figures.length,1);assert.equal(figures[0].page.pdfPage,2);assert.equal(figures[0].confirmed,false);assert.ok(figures[0].bounds.y>=0);
});
