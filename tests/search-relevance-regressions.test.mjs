import test from 'node:test';
import assert from 'node:assert/strict';
import {buildIndex,searchQuestion} from '../src/search.js';

function span(id,text,heading,page){
  return {id,text,heading,section:'Chapter',segments:[{page:{pdfPage:page,printedLabel:String(page)},ranges:[{runId:id,start:0,end:text.length}],rects:[{x:.1,y:.2,width:.8,height:.05}],method:'pdf-text'}]};
}
function search(spans,text){return searchQuestion(buildIndex(spans),{id:'q',text});}
const flow=span('flow','The flow table is a table apparatus used to measure the spread of concrete. The table is raised and dropped repeatedly.','Flow Table Apparatus',252);

test('an explicit table number selects its source context instead of unrelated flow-table prose',()=>{
  const caption=span('caption','Table 12.27. Mix Proportions of the Trial Concrete Mixes.','Studies at Hong Kong',618);
  const context=span('context','A total of 18 trial mixes were made in the study. The mix proportions are shown in Table 12.27.','Studies at Hong Kong',618);
  const different=span('different','Table 12.270. Other Trial Concrete Mixes.','Different study',50);
  const result=search([flow,different,caption,context],'Explain Table 12.27.');
  assert.ok(result.passages.some(p=>p.text.includes('18 trial mixes')));
  assert.ok(result.passages.every(p=>p.segments[0].page.pdfPage===618));
  assert.equal(result.status,'partial');
});

test('an absent explicit table number cannot fall back to another table topic',()=>{
  const result=search([flow],'Explain Table 99.99.');
  assert.equal(result.status,'no-match');
  assert.deepEqual(result.passages,[]);
});

test('figure and table references with the same number remain distinct in prose retrieval',()=>{
  const spans=[
    span('figure-caption','Fig. 1.7. A rotating apparatus.','Rotation',50),
    span('figure-context','The apparatus rotates the sample and records its angular velocity. The illustration is shown in Fig. 1.7.','Rotation',50),
    span('table-caption','Table 1.7. Material costs for the apparatus.','Costs',400),
    span('table-context','The material costs are given in Table 1.7. The listed values exclude labour and transport.','Costs',400)
  ];
  const result=search(spans,'Explain Figure 1.7.');
  assert.ok(result.passages.some(p=>p.text.includes('angular velocity')));
  assert.ok(result.passages.every(p=>p.segments[0].page.pdfPage===50));
});

test('a comparison of distant explicit tables retains source context for both',()=>{
  const spans=[
    span('a-caption','Table 2.1. Proportions of the first mixture.','First mixture',50),
    span('a-context','The first mixture uses equal quantities of its three ingredients. These proportions are listed in Table 2.1.','First mixture',50),
    span('b-caption','Table 12.27. Proportions of the second mixture.','Second mixture',400),
    span('b-context','The second mixture uses twice as much binder as water. These proportions are listed in Table 12.27.','Second mixture',400),
    flow
  ];
  const result=search(spans,'Compare Tables 2.1 and 12.27.');
  assert.deepEqual(new Set(result.passages.map(p=>p.segments[0].page.pdfPage)),new Set([50,400]));
  assert.equal(result.status,'partial');
});

test('a mixed topic and figure query retains matching measurement sentences',()=>{
  const source=span('source','The illustration is Fig. 4.2. The penetration is 0.5 cm. The density ratio is 0.92.','Penetration test',2);
  const result=search([flow,source],'What is the penetration and density ratio shown in Fig. 4.2?');
  assert.ok(result.passages.some(p=>p.text.includes('0.5 cm.')));
  assert.ok(result.passages.some(p=>p.text.includes('0.92.')));
  assert.ok(result.passages.every(p=>p.segments[0].page.pdfPage===2));
});

test('decimal table fragments cannot anchor a topic away from its complete explanation',()=>{
  const fragment=span('fragment','0.5 0.92 Basalt basalt basalt basalt ratios for the sample','Basalt',627);
  const explanation=span('explanation','Basalt fibres are added to reinforce a mixture and restrict crack formation.','Reinforcement',20);
  const result=search([fragment,explanation],'Explain basalt.');
  assert.ok(result.passages.some(p=>p.text.includes('restrict crack formation')));
  assert.ok(result.passages.every(p=>p.segments[0].page.pdfPage===20));
});

test('basic components retrieves constituent evidence for the requested subject rather than components of costs',()=>{
  const definition=span('definition','The ingredients of mortar are lime, sand and water. The lime binds the sand particles together.','Mortar composition',20);
  const costs=span('costs','Mortar is economical when other components of costs such as labour and transport are considered.','Mortar costs',620);
  const fragment=span('fragment','25.68 66.5 66.5 12.83 Basic mix proportions for 1 m3 of mortar','Ratio',627);
  const result=search([definition,costs,fragment],'What are the basic components of mortar?');
  assert.ok(result.passages.some(p=>p.text.includes('lime, sand and water')));
  assert.ok(result.passages.every(p=>p.segments[0].page.pdfPage===20));
});

test('a composition question cannot be answered by cost components without constituent evidence',()=>{
  const costs=span('costs','The main components of costs for mortar are labour and transport. These components determine the price.','Mortar costs',620);
  const result=search([costs],'What are the main components of mortar?');
  assert.equal(result.status,'no-match');
  assert.deepEqual(result.passages,[]);
});

test('manufacture and grade statements cannot substitute for identified constituents',()=>{
  const grading=span('grading','The mortar made from aggregate grading having least surface area will require least water.','Grading',115);
  const grade=span('grade','It is to be noted that deck mortar is made of high strength mortar.','Durability',374);
  const definition=span('definition','The ingredients of mortar are lime, sand and water. The lime binds the sand particles together.','Mortar composition',482);
  const result=search([grading,grade,definition],'What are the fundamental components of mortar?');
  assert.ok(result.passages.length>0);
  assert.ok(result.passages.every(p=>p.segments[0].page.pdfPage===482));
});

test('a direct reference explanation is not padded with incidental same-section prose',()=>{
  const context=span('context','The mix proportions are shown in Table 12.27. Eighteen mixes were made to compare water and binder contents.','Study',618);
  const caption=span('caption','Table 12.27. Trial mix proportions for the study.','Study',618);
  const unrelated=span('unrelated','Financial borrowing rates determine the cost of the construction project.','Study',617);
  const result=search([unrelated,context,caption],'Explain Table 12.27.');
  assert.ok(result.passages.some(p=>p.text.includes('Eighteen mixes')));
  assert.ok(result.passages.every(p=>p.segments[0].page.pdfPage===618));
});

test('explanations beginning with qualified figure or table references remain eligible prose',()=>{
  for(const [text,question] of [
    ['Fig. 1.7 represents the microscopic structure of a hardened paste.','Explain Fig. 1.7.'],
    ['Table 1.7, also shows the measured heat evolution of the four compounds.','Explain Table 1.7.'],
    ['Fig. 1.7 (a) represents the microscopic structure of a hardened paste.','Explain Fig. 1.7.']
  ]){
    const result=search([span('source',text,'Structure',47)],question);
    assert.ok(result.passages.some(p=>p.text===text),text);
  }
});

test('many explicit references cannot exceed the quotation count or word budget',()=>{
  const spans=Array.from({length:8},(_,i)=>span(`s${i}`,`The sample proportions are listed in Table 1.${i+1}. Each sample has equal quantities of binder and water.`,`Study ${i+1}`,50+i*20));
  const result=search(spans,'Compare Tables 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7 and 1.8.');
  assert.ok(result.passages.length>0&&result.passages.length<=7);
  assert.ok(result.passages.map(p=>p.text).join(' ').split(/\s+/).length<=200);
});

test('topic words after a plural reference group still constrain the retrieved context',()=>{
  const a=span('a','The density ratio is measured with a weighing apparatus. This arrangement is shown in Figure 2.1.','Density',50);
  const b=span('b','The angular velocity is measured with a rotating apparatus. This arrangement is shown in Figure 3.2.','Rotation',400);
  const result=search([a,b],'Describe Figures 2.1 and 3.2 in relation to density.');
  assert.ok(result.passages.some(p=>p.text.includes('density ratio')));
  assert.ok(result.passages.every(p=>p.segments[0].page.pdfPage===50));
  assert.equal(result.status,'partial');
});

test('a caption alone cannot make unrelated same-heading prose an explanation',()=>{
  const caption=span('caption','Table 12.27. Trial mix proportions.','Study',618);
  const finance=span('finance','Financial borrowing rates determine the cost of the construction project.','Study',618);
  const result=search([finance,caption],'Explain Table 12.27.');
  assert.equal(result.status,'no-match');
  assert.deepEqual(result.passages,[]);
});

test('trailing instructions do not become part of the composition subject',()=>{
  const definition=span('definition','The ingredients of mortar are lime, sand and water. The lime binds the sand particles together.','Mortar composition',20);
  const result=search([definition],'List the components of mortar and explain their functions.');
  assert.ok(result.passages.some(p=>p.text.includes('lime, sand and water')));
  assert.ok(result.passages.some(p=>p.text.includes('binds the sand')));
  assert.equal(result.status,'partial');
});

test('the subject of a reverse constituent statement must not be a prefix of another subject',()=>{
  for(const text of [
    'Labour and transport are major components of mortar costs. These components determine the price.',
    'Labour and transport are major components of mortar installation costs. These components determine the price.'
  ]){
    const result=search([span('costs',text,'Mortar costs',620)],'What are the main components of mortar?');
    assert.equal(result.status,'no-match',text);
    assert.deepEqual(result.passages,[]);
  }
});

test('reverse constituent statements identifying the complete requested subject remain searchable',()=>{
  const text='Lime and sand are important constituents of mortar.';
  const result=search([span('definition',text,'Mortar composition',20)],'What are the main components of mortar?');
  assert.ok(result.passages.some(p=>p.text===text));
  assert.equal(result.status,'partial');
});
