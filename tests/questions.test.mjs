import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('../src/questions.js').catch(()=>({}));
test('numbered questions keep wrapped lines and subparts together',()=>{
  assert.equal(typeof api.parseQuestions,'function','parseQuestions missing');
  const qs=api.parseQuestions('1. Explain workability.\n(a) Discuss slump.\n2) Define segregation\nand describe its types.');
  assert.equal(qs.length,2);assert.ok(qs[0].text.includes('(a) Discuss slump.'));assert.ok(qs[1].text.includes('describe its types.'));
});
test('unnumbered text remains one editable question and empty text stays empty',()=>{
  assert.equal(typeof api.parseQuestions,'function','parseQuestions missing');
  assert.equal(api.parseQuestions('Explain workability.').length,1);assert.equal(api.parseQuestions('  ').length,0);
});
