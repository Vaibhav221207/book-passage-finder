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
