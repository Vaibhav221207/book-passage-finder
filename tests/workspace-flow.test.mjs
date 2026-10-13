import test from 'node:test';
import assert from 'node:assert/strict';
const flow=await import('../src/workspace-flow.js').catch(()=>({}));
const choose=(...args)=>{
  assert.equal(typeof flow.chooseWorkspaceView,'function','workspace navigation is available');
  return flow.chooseWorkspaceView(...args);
};

test('questions can be prepared before any textbook is loaded',()=>{
  assert.equal(choose('questions'),'questions');
  assert.equal(choose(undefined,{current:'questions'}),'questions');
  assert.equal(choose('sources',{current:'questions'}),'sources');
});

test('answers require completed results but no-match questions still open for review',()=>{
  assert.equal(choose('answers'),'sources');
  assert.equal(choose('answers',{current:'questions',books:1}),'questions');
  const noMatches=[{status:'no-match'},{status:'no-match'}];
  assert.equal(choose('answers',{current:'questions',books:1,results:noMatches.length}),'answers');
});

test('students can return from answers to edit materials or questions',()=>{
  assert.equal(choose('sources',{current:'answers',books:2,results:3}),'sources');
  assert.equal(choose('questions',{current:'answers',books:2,results:3}),'questions');
  assert.equal(choose('answers',{current:'sources',books:2,results:3}),'answers');
});

test('work in progress keeps the current valid view when a different stage is requested',()=>{
  assert.equal(choose('questions',{current:'sources',busy:true}),'sources');
  assert.equal(choose('answers',{current:'questions',books:1,results:2,busy:true}),'questions');
  assert.equal(choose('sources',{current:'answers',books:1,results:2,busy:true}),'answers');
});

test('invalidated answers return to the remaining inputs even during a job',()=>{
  assert.equal(choose(undefined,{current:'answers',books:1,results:0}),'questions');
  assert.equal(choose(undefined,{current:'answers',books:0,results:0}),'sources');
  assert.equal(choose('answers',{current:'answers',books:1,results:0,busy:true}),'questions');
  assert.equal(choose('questions',{current:'answers',books:0,results:0,busy:true}),'sources');
});

test('unknown navigation requests preserve the current usable view',()=>{
  assert.equal(choose('missing'),'sources');
  assert.equal(choose('missing',{current:'questions'}),'questions');
  assert.equal(choose('missing',{current:'answers',results:1}),'answers');
  assert.equal(choose('missing',{current:'answers',books:1}),'questions');
});
