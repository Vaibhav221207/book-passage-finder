import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('../src/session.js').catch(()=>({}));
test('late response cannot overwrite a replaced job',()=>{
  assert.equal(typeof api.createController,'function','createController missing');const c=api.createController();
  const old=c.start(),newJob=c.start();assert.equal(c.finish(old,{results:['old']}),false);assert.equal(c.state.activeJob,newJob);assert.equal(c.finish(newJob,{results:['new']}),true);assert.deepEqual(c.state.results,['new']);
});
test('removing a selection changes the real export state',()=>{
  assert.equal(typeof api.createController,'function','createController missing');const c=api.createController();c.state.results=[{question:{id:'q1'},passages:[{id:'a'},{id:'b'}],figures:[]}];c.removePassage('q1','a');assert.deepEqual(c.state.results[0].passages.map(p=>p.id),['b']);
});
test('cancellation leaves state usable for a fresh job',()=>{
  assert.equal(typeof api.createController,'function','createController missing');const c=api.createController();const id=c.start();c.cancel();assert.equal(c.state.activeJob,null);assert.equal(c.finish(id,{results:['late']}),false);const fresh=c.start();assert.ok(fresh);assert.equal(c.finish(fresh,{results:[]}),true);
});
test('library selection and removal preserve unrelated books and invalidate old results',()=>{
  const c=api.createController(),a={id:'a'},b={id:'b'};
  c.setBooks([a,b],'b');assert.equal(c.state.session,b);assert.equal(c.state.activeBookId,'b');
  c.state.results=[{question:{id:'q'},passages:[],figures:[]}];c.selectBook('a');
  assert.equal(c.state.session,a);assert.equal(c.state.results.length,1);
  c.setBooks([b]);assert.equal(c.state.session,b);assert.deepEqual(c.state.results,[]);
  assert.throws(()=>c.selectBook('missing'),/book/i);
});
test('an AI response cannot attach after its source passages change or results are replaced',()=>{
  const c=api.createController(),r={question:{id:'q'},passages:[{id:'a',text:'original'}],figures:[]};
  c.state.results=[r];const ticket=c.explanationTicket(r);
  c.removePassage('q','a');assert.equal(c.attachExplanation(ticket,{title:'late'}),false);
  r.passages=[{id:'b',text:'new'}];const valid=c.explanationTicket(r);
  assert.equal(c.attachExplanation(valid,{title:'ready'}),true);assert.equal(r.explanation.title,'ready');
  const replaced=c.explanationTicket(r);c.state.results=[{...r}];assert.equal(c.attachExplanation(replaced,{title:'late'}),false);
});
test('removing a source discards the explanation based on that source',()=>{
  const c=api.createController(),r={question:{id:'q'},passages:[{id:'a'}],explanation:{title:'draft'}};
  c.state.results=[r];c.removePassage('q','a');assert.equal(r.explanation,undefined);
});
