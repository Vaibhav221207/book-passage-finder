import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('../src/search.js').catch(()=>({}));
const span=(id,text,heading,page)=>({id,text,heading,section:'Fresh mixture',segments:[{page:{pdfPage:page,printedLabel:null},ranges:[{runId:id,start:0,end:text.length}],rects:[{x:.1,y:.2,width:.8,height:.1}],method:'pdf-text'}]});
const spans=[
  span('a','Consistency can be measured by several methods: penetration, spread, and vibration.','Measurement of consistency',1),
  span('b','Penetration measures resistance of fresh mixture using a loaded needle.','Penetration test',2),
  span('c','Spread measures the diameter of the fresh mixture after lifting the mould.','Spread test',3),
  span('d','Vibration measures the time required to remould the fresh mixture.','Vibration test',4),
  span('e','ASTM is a standards organization. This note does not explain a measurement method.','Standards',8),
  span('f','The illustration is Fig. 4.2. The penetration is 0.5 cm. The density ratio is 0.92.','Penetration test',2)
];
function search(text,options){assert.equal(typeof api.buildIndex,'function','buildIndex missing');assert.equal(typeof api.searchQuestion,'function','searchQuestion missing');return api.searchQuestion(api.buildIndex(spans),{id:'q',text},options);}
test('topic retrieval covers distinct methods before overvaluing a rare standard qualifier',()=>{
  const result=search('Discuss methods of measuring consistency according to ASTM standards.');
  assert.ok(result.passages.some(p=>p.segments[0].page.pdfPage<5));
  assert.ok(new Set(result.passages.filter(p=>p.segments[0].page.pdfPage<5).map(p=>p.heading)).size>=3);
  assert.ok(result.passages.map(p=>p.text).join(' ').split(/\s+/).length<=200);
});
test('selected quotations retain source text and exact decimals',()=>{
  const result=search('What is the penetration and density ratio shown in Fig. 4.2?');
  assert.ok(result.passages.some(p=>p.text.includes('0.5 cm.')));
  assert.ok(result.passages.some(p=>p.text.includes('0.92.')));
  for(const p of result.passages){const original=spans.find(s=>s.id===p.originId||s.id===p.id);assert.ok(original.text.includes(p.text));}
});
test('topic-adjacent unsupported requirement remains visibly partial',()=>{
  const result=search('Explain smartphone-only penetration measurement.');assert.notEqual(result.status,'matches');
  assert.ok(result.coverageNotes.length>0);
});
test('unrelated subject returns no invented answer',()=>{
  const result=search('Explain photosynthesis and chlorophyll.');assert.equal(result.status,'no-match');assert.equal(result.passages.length,0);
});
