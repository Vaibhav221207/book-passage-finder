import test from 'node:test';
import assert from 'node:assert/strict';
const api = await import('../src/layout.js').catch(() => ({}));
const line = (id,text,x,y,w=.7,h=.02,size=12) => ({id,text,bounds:{x,y,width:w,height:h},fontSize:size});
const page = (n,runs,label=null) => ({ref:{pdfPage:n,printedLabel:label},runs,width:600,height:800,method:'pdf-text'});
test('floating point baseline noise cannot reorder adjacent words',()=>{
  const spans=api.makeSourceSpans([page(1,[line('a','ratio',.16,.612529691211402,.04),line('b','of density after full',.201,.6125296912114014,.4),line('c','compaction.',.16,.63)])]);assert.equal(spans[0].text,'ratio of density after full compaction.');
});
test('small title-case figure captions do not replace a body section heading',()=>{
  const spans=api.makeSourceSpans([page(1,[line('a','Separation',.1,.1,.4,.03,16),line('b','The first form is separation.',.1,.2,.7,.02,12),line('c','Figure Apparatus',.3,.4,.4,.015,8),line('d','The second form is also described.',.1,.5,.7,.02,12)])]);assert.equal(spans.find(s=>s.text.includes('second form')).heading,'Separation');
});
test('column geometry does not merge left and right passages',()=>{
  assert.equal(typeof api.makeSourceSpans,'function','makeSourceSpans missing');
  const spans=api.makeSourceSpans([page(1,[line('a','A left column sentence.',.08,.2,.35),line('b','A right column sentence.',.56,.2,.35)])]);
  assert.equal(spans.length,2); assert.equal(spans[0].text,'A left column sentence.');
  assert.ok(spans.every(s=>s.segments[0].rects.every(r=>r.width<.45)));
});
test('decorative repeated headings are deduplicated without rewriting body text',()=>{
  assert.equal(typeof api.makeSourceSpans,'function','makeSourceSpans missing');
  const spans=api.makeSourceSpans([page(1,[line('a','WORKABILITY',.1,.1,.6,.025,18),line('b','WORKABILITY',.1,.101,.6,.025,18),line('c','The value is 0.5 cm, not 5 cm.',.1,.2)])]);
  assert.equal(spans.filter(s=>s.text==='WORKABILITY').length,1);
  assert.equal(spans.find(s=>s.text.includes('0.5')).text,'The value is 0.5 cm, not 5 cm.');
});
test('printed numbering needs adjacent evidence and never assumes a global offset',()=>{
  assert.equal(typeof api.detectPageLabels,'function','detectPageLabels missing');
  const pages=[page(1,[line('a','17',.47,.965,.03)]),page(2,[line('b','18',.47,.965,.03)]),page(3,[line('c','19',.47,.965,.03)])];
  api.detectPageLabels(pages); assert.equal(pages[0].ref.printedLabel,'17');
  const isolated=[page(1,[line('x','82',.47,.97,.03)])]; api.detectPageLabels(isolated); assert.equal(isolated[0].ref.printedLabel,null);
});
test('PDF coordinates respect viewport rotation and stay normalized',()=>{
  assert.equal(typeof api.itemToRun,'function','itemToRun missing');
  const run=api.itemToRun({str:'Text',transform:[12,0,0,12,20,60],width:40,height:12},0,{width:100,height:200,transform:[0,1,1,0,0,0]});
  assert.ok(run.bounds.x>=0 && run.bounds.x+run.bounds.width<=1);
  assert.ok(run.bounds.y>=0 && run.bounds.y+run.bounds.height<=1);
  assert.equal(run.text,'Text');
});
test('inset headers and short tables do not scramble a full-width body',()=>{
  const pages=[1,2,3].map(n=>page(n,[line('num'+n,String(16+n),.1,.13,.03),line('header'+n,'Textbook header',.2,.13,.3),line('heading'+n,'Measurement of Consistency',.1,.155,.35),
    line('body'+n,'The consistency of a fresh mixture can be measured by several tests.',.14,.19,.72),line('next'+n,'Each method observes a different property of the mixture.',.1,.21,.76),
    ...['A','B','C'].flatMap((t,i)=>[line('left'+n+t,t+' method',.1,.27+i*.02,.2),line('right'+n+t,t+' value',.6,.27+i*.02,.2)])]));
  api.detectPageLabels(pages);assert.equal(pages[0].ref.printedLabel,'17');
  const spans=api.makeSourceSpans(pages);assert.ok(spans.some(s=>s.isHeading&&s.text==='Measurement of Consistency'));
  assert.ok(spans.some(s=>s.text==='The consistency of a fresh mixture can be measured by several tests. Each method observes a different property of the mixture.'));
  assert.equal(spans.some(s=>s.text.includes('Textbook header')),false);
});
