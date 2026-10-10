import test from 'node:test';import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
const api=await import('../src/questions.js').catch(()=>({}));
test('numbered questions keep wrapped lines and subparts together',()=>{
  assert.equal(typeof api.parseQuestions,'function','parseQuestions missing');
  const qs=api.parseQuestions('1. Explain workability.\n(a) Discuss slump.\n2) Define segregation\nand describe its types.');
  assert.equal(qs.length,2);assert.ok(qs[0].text.includes('(a) Discuss slump.'));assert.ok(qs[1].text.includes('describe its types.'));
});
test('an assignment PDF preserves separate numbered questions and wrapped lines on the same page',async()=>{
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),page=pdf.addPage();
  ['1. Explain workability.','Include the relevant diagram.','2. Define segregation.'].forEach((text,i)=>page.drawText(text,{x:40,y:750-i*20,font,size:12}));
  const qs=await api.readAssignment(new File([await pdf.save()],'assignment.pdf',{type:'application/pdf'}));
  assert.equal(qs.length,2);assert.ok(qs[0].text.includes('relevant diagram'));assert.equal(qs[1].text,'Define segregation.');
});
test('unnumbered text remains one editable question and empty text stays empty',()=>{
  assert.equal(typeof api.parseQuestions,'function','parseQuestions missing');
  assert.equal(api.parseQuestions('Explain workability.').length,1);assert.equal(api.parseQuestions('  ').length,0);
});
