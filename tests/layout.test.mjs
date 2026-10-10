import test from 'node:test';
import assert from 'node:assert/strict';
const api = await import('../src/layout.js').catch(() => ({}));
const line = (id,text,x,y,w=.7,h=.02,size=12) => ({id,text,bounds:{x,y,width:w,height:h},fontSize:size});
const page = (n,runs,label=null) => ({ref:{pdfPage:n,printedLabel:label},runs,width:600,height:800,method:'pdf-text'});
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
