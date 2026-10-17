import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {exportPacket} from '../src/export.js';
import {pdfLibrary} from '../src/book.js';

function fixture(){
  const book={id:'b',filename:'Concrete_Handbook.pdf',pageCount:1,pages:[{ref:{bookId:'b',bookName:'Concrete_Handbook.pdf',pdfPage:1,printedLabel:'17'},runs:[]}],async renderPage(){const canvas=createCanvas(100,100),ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,100,100);return canvas;}};
  const original={mode:'extractive',title:'Answer from your books',sections:[{heading:'Measurement',text:'The specimen is weighed before immersion.',sourceIds:['S1']}],sources:[{id:'S1',bookId:'b',bookName:book.filename,pages:[{bookId:'b',pdfPage:1,printedLabel:'stale'}]}],missingDetails:['Internal review note.']};
  const local={...structuredClone(original),mode:'local-rewrite',sections:[{heading:'Measurement',text:'Before immersion, the specimen is weighed.',sourceIds:['S1']}],rewrite:{changes:[{sectionIndex:0,before:original.sections[0].text,after:'Before immersion, the specimen is weighed.',ruleId:'front-clause'}],changedSentences:1,totalSentences:1}};
  const page=book.pages[0].ref,bounds={x:.1,y:.1,width:.5,height:.3};
  return {book,result:{question:{text:'Describe weighing.'},status:'partial',passages:[{bookId:'b',text:'Raw evidence remains a screenshot.',segments:[{page,rects:[bounds]}]}],figures:[{bookId:'b',page,bounds,caption:'Selected diagram',confirmed:true},{bookId:'b',page,bounds,caption:'Unconfirmed diagram',confirmed:false}],bookAnswer:original,explanation:local,coverageNotes:['Review-only warning.']}};
}
async function inspect(blob){const lib=await pdfLibrary(),loading=lib.getDocument({data:new Uint8Array(await blob.arrayBuffer()),useSystemFonts:true}),pdf=await loading.promise;try{let text='',images=0;for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);text+=(await page.getTextContent()).items.map(item=>item.str).join(' ')+' ';const ops=await page.getOperatorList();images+=ops.fnArray.filter(op=>op===lib.OPS.paintImageXObject).length;}return{text,images};}finally{await loading.destroy();}}

test('local rewrite PDF is accurately labelled and prints the selected answer once without its internal audit',async()=>{
  const {book,result}=fixture(),{text,images}=await inspect(await exportPacket({books:[book]},[result]));
  assert.match(text,/Locally rephrased/);
  assert.equal(text.split('Before immersion, the specimen is weighed.').length-1,1);
  assert.match(text,/B1.*p\.\s*17.*PDF\s*1/);
  assert.match(text,/References.*B1.*Concrete Handbook/);
  assert.equal(images,2,'Selected passage screenshots and confirmed diagrams remain');
  for(const clutter of ['AI explanation','General AI','The specimen is weighed before immersion.','front-clause','Internal review note.','Review-only warning.','Raw evidence remains a screenshot.','Unconfirmed diagram','stale','S1','.pdf'])assert.ok(!text.includes(clutter),clutter);
});

test('local rewrite PDF keeps unknown source and removed-book citation guards',async()=>{
  const unknown=fixture();unknown.result.explanation.sections[0].sourceIds=['S999'];
  await assert.rejects(exportPacket({books:[unknown.book]},[unknown.result],{includeCrops:false}),/source|citation|reference/i);
  const removed=fixture();removed.result.explanation.sources[0].bookId='removed';removed.result.explanation.sources[0].pages[0].bookId='removed';
  await assert.rejects(exportPacket({books:[removed.book]},[removed.result],{includeCrops:false}),/book.*(?:available|found|loaded|removed)/i);
});
