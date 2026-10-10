import test from 'node:test';
import assert from 'node:assert/strict';
import {createController} from '../src/session.js';
const results=()=>[1,2,3].map(n=>({question:{id:`q${n}`,text:`Question ${n}`},passages:[{id:`p${n}`}],figures:[{id:`f${n}`,confirmed:n===2}]}));
test('reviewing one question retains passages and included figures for every question',()=>{
  const c=createController(),all=results();c.finish(c.start(),{results:all});
  c.selectQuestion(1);assert.equal(c.currentResult(),all[1]);
  c.removePassage('q2','p2');c.moveQuestion(1);
  assert.equal(c.currentResult(),all[2]);assert.equal(c.state.results.length,3);
  assert.deepEqual(c.state.results[0].passages,[{id:'p1'}]);
  assert.deepEqual(c.state.results[1].passages,[]);
  assert.equal(c.state.results[1].figures[0].confirmed,true);
  c.moveQuestion(-1);assert.equal(c.currentResult(),all[1]);
});
test('question navigation stays within the result set and a new search starts at question one',()=>{
  const c=createController();assert.equal(c.currentResult(),null);
  c.finish(c.start(),{results:results()});c.moveQuestion(-1);assert.equal(c.state.activeQuestionIndex,0);
  c.selectQuestion(100);assert.equal(c.state.activeQuestionIndex,2);
  c.moveQuestion(1);assert.equal(c.state.activeQuestionIndex,2);
  c.finish(c.start(),{results:results().slice(0,1)});assert.equal(c.state.activeQuestionIndex,0);
  assert.equal(c.currentResult().question.id,'q1');
  c.finish(c.start(),{results:[]});assert.equal(c.currentResult(),null);
});
test('cancelled search does not change the question currently under review',()=>{
  const c=createController();c.finish(c.start(),{results:results()});c.selectQuestion(2);
  const job=c.start();c.cancel();assert.equal(c.finish(job,{results:results().slice(0,1)}),false);
  assert.equal(c.currentResult().question.id,'q3');
});
