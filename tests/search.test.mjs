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
test('short table fragments do not masquerade as complete source sentences',()=>{
  const fixture=[...spans,span('table','Medium consistency generally workable','Consistency',1)];const result=api.searchQuestion(api.buildIndex(fixture),{id:'q',text:'Discuss methods of measuring consistency.'});
  assert.equal(result.passages.some(p=>p.text==='Medium consistency generally workable'),false);assert.equal(result.coverageNotes.some(n=>n.includes('discus')),false);
});
test('table of contents heading cannot replace the actual explanatory section',()=>{
  const toc={...span('toc','Measurement of consistency','Measurement of consistency',99),isHeading:true};
  const number=span('tocnum','222','Measurement of consistency',99);
  const result=api.searchQuestion(api.buildIndex([toc,number,...spans]),{id:'q',text:'Discuss methods of measuring consistency.'});
  assert.ok(result.passages.length>=3);assert.ok(result.passages.every(p=>p.segments[0].page.pdfPage<10));
});
