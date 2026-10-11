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
test('a generic measurement heading cannot steal a specific two-method comparison',()=>{
  const fixture=[span('air','Concrete air content is determined with a pressure chamber.','Measurement of Air Content in Concrete',1),span('flow1','The circular flow table records the increase in spread as a percentage.','Circular flow table',25),span('flow2','The hinged flow table records the mean spread in millimetres.','Hinged flow table',26)];
  const r=api.searchQuestion(api.buildIndex(fixture),{id:'q',text:'Compare the two flow table methods described for fresh concrete, including what each reports.'});assert.ok(r.passages.length>0);assert.ok(r.passages.every(p=>p.segments[0].page.pdfPage>=25));
});
test('an absent primary subject cannot be answered by incidental known terms',()=>{
  const fixture=[span('chem','The independent chemical reaction depends on light and heat.','Light reactions',2)];
  const r=api.searchQuestion(api.buildIndex(fixture),{id:'q',text:'Explain photosynthesis and distinguish its light-dependent and light-independent reactions.'});assert.equal(r.status,'no-match');assert.equal(r.passages.length,0);
});
test('an absent compound subject cannot be answered by its first word and a known context',()=>{
  const fixture=[span('concrete','Quantum effects are a feature of cement. Concrete shrinkage develops as moisture is lost from the mixture.','Concrete shrinkage',2)];
  for(const text of ['Explain quantum entanglement in concrete.','Write a note on quantum teleportation in cement.']){
    const r=api.searchQuestion(api.buildIndex(fixture),{id:'q',text});
    assert.equal(r.status,'no-match',text);assert.deepEqual(r.passages,[],text);
  }
});
test('an unknown later requested part or standard leaves a known compound subject partial',()=>{
  const fixture=[span('concrete','Concrete shrinkage develops as moisture is lost from the mixture. Careful curing reduces the loss of moisture from concrete.','Concrete shrinkage',2)];
  for(const text of ['Explain concrete shrinkage and entanglement in cement.','Explain concrete shrinkage, then discuss entanglement in cement.','Explain concrete shrinkage according to spectral standards.']){
    const r=api.searchQuestion(api.buildIndex(fixture),{id:'q',text});
    assert.equal(r.status,'partial',text);assert.ok(r.passages.some(p=>p.text.includes('Concrete shrinkage')),text);
  }
});
test('single-letter sentence fragments cannot fill the remaining word budget',()=>{
  const fixture=[span('f','K. The workability apparatus measures resistance to penetration.','Workability',1)];
  const r=api.searchQuestion(api.buildIndex(fixture),{id:'q',text:'Discuss workability.'},{wordBudget:3});assert.ok(r.passages.every(p=>p.text!=='K.'));
});
test('a named topic includes its lead definition before repeated incidental mentions',()=>{
  const fixture=[span('def','Separation is the division of constituent materials into distinct parts.','Separation',1),span('later','Separation is prevented by careful proportioning. Separation may occur during transport. Separation should be avoided. Separation affects strength.','Separation',2)];
  const r=api.searchQuestion(api.buildIndex(fixture),{id:'q',text:'Define separation and identify its forms described in the book.'},{wordBudget:20});assert.ok(r.passages.some(p=>p.text.includes('division of constituent')));
});

test('expanding a shortened quotation replaces its offsets with the complete source interval',()=>{
  const text='The workability apparatus measures resistance to penetration. The measurement helps interpret the placement of fresh concrete.',original=span('book-a:p1-0',text,'Workability',1);
  original.bookId='book-a';original.segments[0].page.bookId='book-a';
  const passage={...original,id:'book-a:p1-0:0:59',originId:original.id,text:'The workability apparatus measures resistance to penetration.',selectedOffsets:{start:0,end:59}};
  const expanded=api.expandPassage(api.buildIndex([original]),passage);
  Object.assign(passage,expanded);
  assert.equal(passage.text,text);assert.equal(passage.originId,'book-a:p1-0');assert.equal(passage.bookId,'book-a');
  assert.deepEqual(passage.selectedOffsets,{start:0,end:text.length});
  assert.equal(original.text.slice(passage.selectedOffsets.start,passage.selectedOffsets.end),passage.text);
  assert.equal(original.selectedOffsets,undefined);
});
