import test from 'node:test';
import assert from 'node:assert/strict';
import {createController} from '../src/session.js';
const api=await import('../src/local-rewrite-action.js').catch(()=>({}));
function setup(text='The specimen is weighed before immersion.'){
  const controller=createController(),result={question:{id:'q1',text:'Describe the laboratory procedure.'},status:'matches',coverageNotes:[],figures:[],passages:[{id:'a:7',bookId:'a',bookName:'Handbook.pdf',heading:'Procedure',text,segments:[{page:{bookId:'a',bookName:'Handbook.pdf',pdfPage:7,printedLabel:'5'}}]}]};
  controller.state.results=[result];return {controller,result};
}
function apply(controller,result,options){assert.equal(typeof api.applyLocalRewrite,'function','Local rewrite action missing');return api.applyLocalRewrite(controller,result,options);}
test('the local action attaches rephrased book text and keeps the original available',()=>{
  const {controller,result}=setup(),before=structuredClone(result.passages);
  const action=apply(controller,result);
  assert.equal(action.status,'changed');assert.equal(result.explanation.mode,'local-rewrite');
  assert.equal(result.explanation.sections[0].text,'Before immersion, the specimen is weighed.');
  assert.equal(result.bookAnswer.sections[0].text,'The specimen is weighed before immersion.');
  assert.deepEqual(result.passages,before);assert.equal(result.explanation.sources[0].pages[0].pdfPage,7);
});
test('local rewriting always starts from the book even when an AI answer is selected',()=>{
  const {controller,result}=setup();result.explanation={mode:'book',sections:[{text:'Unsupported AI-only wording is composed of inventions.'}]};
  apply(controller,result);
  assert.equal(result.explanation.sections[0].text,'Before immersion, the specimen is weighed.');
  assert.ok(!JSON.stringify(result.explanation).includes('AI-only'));
});
test('busy or replaced results cannot be rewritten',()=>{
  const {controller,result}=setup();controller.start();
  assert.equal(apply(controller,result).status,'blocked');assert.equal(result.explanation,undefined);
  controller.cancel();controller.state.results=[];
  assert.equal(apply(controller,result).status,'blocked');assert.equal(result.explanation,undefined);
});
test('no evidence or no recognized edits keeps the selected answer unchanged',()=>{
  const {controller,result}=setup('Concrete contains cement, water and aggregates.');
  const selected=result.explanation={mode:'book',title:'The selected explanation'};
  assert.equal(apply(controller,result).status,'unchanged');assert.equal(result.explanation,selected);
  result.passages=[];
  assert.equal(apply(controller,result).status,'unavailable');assert.equal(result.explanation,selected);
});
test('repeated local requests have no quota or network inference and do not accumulate edits',t=>{
  const previous=globalThis.fetch;globalThis.fetch=()=>{assert.fail('A local rewrite must not make network requests');};t.after(()=>{globalThis.fetch=previous;});
  const {controller,result}=setup();
  for(let n=0;n<100;n++){
    assert.equal(apply(controller,result).status,'changed');
    assert.equal(result.explanation.sections[0].text,'Before immersion, the specimen is weighed.');
    assert.equal(result.explanation.rewrite.changedSentences,1);
    assert.equal(controller.state.activeJob,null);
  }
});
test('removing evidence clears local wording and prevents stale regeneration',()=>{
  const {controller,result}=setup();apply(controller,result);controller.removePassage('q1','a:7');
  assert.equal(result.explanation,undefined);assert.equal(apply(controller,result).status,'unavailable');
  assert.equal(result.bookAnswer,null);
});
