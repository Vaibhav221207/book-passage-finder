import test from 'node:test';
import assert from 'node:assert/strict';
import {buildIndex,searchQuestion} from '../src/search.js';

function span(id,text,heading,page,section='Concrete technology'){
  return {id,text,heading,section,segments:[{page:{pdfPage:page,printedLabel:null},ranges:[{runId:id,start:0,end:text.length}],rects:[{x:.1,y:.2,width:.8,height:.1}],method:'pdf-text'}]};
}
function search(spans,text){return searchQuestion(buildIndex(spans),{id:'q',text});}

test('reference book titles cannot provide a concrete answer even when their words match',()=>{
  const refs=[
    span('manual','Manual of concrete Inspection ACI SP-2, 1967 42.','Concrete Hand Book',632,'GENERAL REFERENCE BOOKS'),
    span('quality','Controlling Concrete on the site Cement and Concrete 33. Thursby H','Quality Concrete',632,'GENERAL REFERENCE BOOKS')
  ];
  const result=search(refs,'Explain concrete inspection and quality.');
  assert.equal(result.status,'no-match');
  assert.deepEqual(result.passages,[]);
});

test('spaced reference section labels exclude entries whose own headings look like topics',()=>{
  const result=search([span('ref','A study of partially impregnated polymerised concrete specimens, ACI Publication SP 40, 1973.','Polymer concrete',630,'R E F E R E N C E S')],'Describe polymer concrete.');
  assert.deepEqual(result.passages,[]);
});

test('numbered author and publication entries are excluded when section metadata is absent',()=>{
  const result=search([span('ref','12.11 Malhotra V.M. No-Fines Concrete—Its Properties and Applications, ACI Journal, 1976.','Concrete',630,'')],'Explain no-fines concrete properties.');
  assert.deepEqual(result.passages,[]);
});

test('explanatory prose that cites standards and dates remains searchable',()=>{
  const prose=span('prose','1. Workability is measured by the slump test described in ASTM C143, 2020. The mould is lifted vertically and the decrease in height is recorded.','Workability',50);
  const result=search([prose],'Discuss methods of measuring workability as per ASTM standards.');
  assert.ok(result.passages.some(p=>p.text.includes('mould is lifted vertically')));
});

test('short note instructions do not pull a history question into a road note section',()=>{
  const history=span('history','The early history of modern cement includes the work of John Smeaton. Joseph Aspdin patented Portland cement in 1824.','Early History of Modern Cement',25);
  const later=span('later','The method was first published in Road Note No 4 during 1950. The modern method of cement mix design follows later developments.','Road Note No. 4 Method',496);
  const result=search([history,later],'Write a short note on the early history of modern cement.');
  assert.ok(result.passages.length>0);
  assert.ok(result.passages.every(p=>p.segments[0].page.pdfPage===25));
  assert.ok(result.passages.some(p=>p.text.includes('Joseph Aspdin')));
});

test('a history heading wrapped across two lines keeps its prose ahead of an unrelated early frost topic',()=>{
  const h1={...span('h1','Early History of Modern','Early History of Modern',25),isHeading:true};
  h1.segments[0].rects=[{x:.16,y:.64,width:.22,height:.015}];
  const h2={...span('h2','Cement','Cement',25),isHeading:true};
  h2.segments[0].rects=[{x:.16,y:.658,width:.08,height:.015}];
  const vicat=span('vicat','Vicat prepared an artificial hydraulic lime by calcining limestone and clay. This process led to the manufacture of Portland cement.','Cement',25);
  const aspdin=span('aspdin','Joseph Aspdin took the patent of Portland cement on 21st October 1824. The name referred to its resemblance to natural Portland stone.','Cement',26);
  const frost=span('frost','Early frost damage affects cement hydration in modern construction. Concrete requires protection in the early period.','Early Frost Damage',386);
  const result=search([h1,h2,vicat,aspdin,frost],'Write a short note on the early history of modern cement.');
  assert.ok(result.passages.length>0);
  assert.ok(result.passages.every(p=>[25,26].includes(p.segments[0].page.pdfPage)));
  assert.ok(result.passages.some(p=>p.text.includes('Joseph Aspdin')));
});

test('chapter contents listed with bullet punctuation cannot count as an explanation',()=>{
  const contents=span('contents','! General ! Early History of Modern Cement ! Manufacture of Portland Cement ! Wet Process ! Dry Process !','Modern Cement Factory',24);
  const history=span('history','Joseph Aspdin took the patent of Portland cement on 21st October 1824. The name referred to natural stone at Portland in England.','Early History of Modern Cement',26);
  const result=search([contents,history],'Explain the early history of modern cement.');
  assert.ok(result.passages.some(p=>p.text.includes('Joseph Aspdin')));
  assert.ok(result.passages.every(p=>p.segments[0].page.pdfPage===26));
});

test('an exact named history topic retains the earlier invention before repeated topic words in later prose',()=>{
  const heading='Early History of Modern Cement';
  const spans=[
    span('lead','Vicat prepared an artificial hydraulic lime by burning limestone and clay. This process led to the manufacture of Portland cement.',heading,25),
    span('aspdin','Joseph Aspdin patented Portland cement in 1824. Isaac Charles Johnson later improved the manufacture by burning the mixture to clinker.',heading,26),
    span('later','The early history of modern cement includes many other developments. The history of modern cement includes changes in mortar construction.',heading,27)
  ];
  const result=searchQuestion(buildIndex(spans),{id:'q',text:'Write a short note on the early history of modern cement.'},{wordBudget:45});
  assert.ok(result.passages.some(p=>p.text.includes('Joseph Aspdin')));
});

test('author initials in the history paragraph cannot split a quotation halfway through its sentence',()=>{
  const history=span('vicat','The investigations of L.J. Vicat led him to prepare an artificial hydraulic lime by calcining limestone and clay. James Frost also patented a cement of this kind','Early History of Modern Cement',25);
  const result=search([history],'Write a short note on the early history of modern cement.');
  assert.ok(result.passages.some(p=>p.text.startsWith('The investigations of L.J. Vicat')));
});
