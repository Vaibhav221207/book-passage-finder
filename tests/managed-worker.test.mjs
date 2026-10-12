import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';

const module = await import('../backend/worker.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const worker = module.default;
const ORIGIN = 'https://vaibhav221207.github.io';
const clientId = 'af539964-147d-4e60-8b7d-62db4a36c3f6';
const body = (extra = {}) => ({question: 'Explain the sustainability of concrete.', sources: [{id: 'S1', text: 'Concrete can contain recycled aggregates. Replacing some cement reduces emissions.'}], targetWords: 300, mode: 'book', clientId, ...extra});
const answer = (extra = {}) => ({title: 'Sustainable concrete', sections: [{heading: 'Materials', text: 'Using recycled aggregate and replacing part of the cement can reduce resource use and emissions.', sourceIds: ['S1']}], missingDetails: [], ...extra});
const request = (data = body(), options = {}) => new Request(options.url || 'https://answers.example.workers.dev/v1/explanations', {
  method: options.method || 'POST',
  headers: {'Origin': ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.1', ...options.headers},
  ...(options.method === 'OPTIONS' || options.method === 'GET' ? {} : {body: typeof data === 'string' ? data : JSON.stringify(data)})
});

function fixture(extra = {}) {
  assert.equal(typeof worker?.fetch, 'function', 'The managed answer endpoint must exist.');
  assert.equal(typeof module.UsageBudget, 'function', 'Daily allowance must have persistent, atomic accounting.');
  const db = new DatabaseSync(':memory:');
  const storage = {
    sql: {exec(query, ...values) { const rows = db.prepare(query).all(...values); return {toArray: () => rows, one: () => rows[0]}; }},
    transactionSync(fn) { db.exec('BEGIN'); try {const value = fn(); db.exec('COMMIT'); return value;} catch(error) {db.exec('ROLLBACK'); throw error;} },
    async setAlarm(value) { this.alarmAt = value; }
  };
  const state = {storage};
  const env = {AI: {async run(model, input, options) { calls.push({model, input, options}); return {response: JSON.stringify(answer()), usage: {prompt_tokens: 50, completion_tokens: 50, total_tokens: 100}};}}, ...extra};
  const calls = [];
  const budget = new module.UsageBudget(state, env);
  env.USAGE_BUDGET = {idFromName: name => name, get: () => ({fetch: request => budget.fetch(request)})};
  return {env, calls, budget, db, storage, close: () => db.close()};
}

test('managed answers use selected text without customer credentials or client-controlled model options', async () => {
  const f = fixture();
  try {
    const result = await worker.fetch(request(), f.env);
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('Access-Control-Allow-Origin'), ORIGIN);
    assert.equal(result.headers.get('Cache-Control'), 'no-store');
    const output = await result.json();
    assert.deepEqual(JSON.parse(output.content), answer());
    assert.equal(output.remaining, 7);
    assert.ok(Date.parse(output.resetAt) > Date.now());
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].model, output.model);
    assert.ok(f.calls[0].model.startsWith('@cf/'));
    assert.equal(f.calls[0].input.stream, false);
    assert.equal(f.calls[0].input.response_format.type, 'json_object');
    assert.equal(f.calls[0].options.rejectIfBusy, true);
    const supplied = JSON.parse(f.calls[0].input.messages[1].content);
    assert.deepEqual(supplied, {question: body().question, targetWords: 300, sources: body().sources});
    assert.ok(!JSON.stringify(f.calls).includes(clientId));
    assert.ok(!JSON.stringify(f.calls).includes('203.0.113.1'));
    assert.match(f.calls[0].input.messages[0].content, /untrusted/i);
  } finally {f.close();}
});

test('JSON-mode direct objects and complete chat-completion envelopes retain the same answer validation',async()=>{
  for(const generated of [JSON.stringify(answer()),answer(),{choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(answer())}}]}]){
    const f=fixture({AI:{run:async()=>generated}});try{const result=await worker.fetch(request(),f.env);assert.equal(result.status,200);assert.deepEqual(JSON.parse((await result.json()).content),answer());}finally{f.close();}
  }
  for(const generated of [{choices:[{finish_reason:'length',message:{role:'assistant',content:JSON.stringify(answer())}}]}, {choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(answer()),tool_calls:[{id:'unsafe'}]}}]}, {...answer(),secret:'do not expose'}]){
    const f=fixture({AI:{run:async()=>generated}});try{const result=await worker.fetch(request(),f.env);assert.equal(result.status,503);assert.ok(!(await result.text()).includes('do not expose'));}finally{f.close();}
  }
});

test('an evidence-valid verbose completion is shortened using complete sentences across topics without another request',async()=>{
  const sections=Array.from({length:5},(_,i)=>({heading:`Topic ${i+1}`,sourceIds:['S1'],text:Array.from({length:12},(_,j)=>`This complete supported sentence explains material property ${i+1} and consideration ${j+1}.`).join(' ')}));
  let calls=0;const f=fixture({AI:{run:async()=>{calls++;return {response:JSON.stringify(answer({sections}))};}}});
  try {const result=await worker.fetch(request(),f.env);assert.equal(result.status,200);const content=JSON.parse((await result.json()).content);assert.equal(calls,1);assert.equal(content.sections.length,5);assert.ok(content.sections.reduce((sum,s)=>sum+s.text.split(/\s+/).length,0)<=300);for(const section of content.sections){assert.ok(section.text.endsWith('.'));assert.deepEqual(section.sourceIds,['S1']);assert.ok(sections.find(s=>s.heading===section.heading).text.includes(section.text));}}finally{f.close();}
  const invalid=structuredClone(sections);invalid.at(-1).sourceIds=['S999'];const bad=fixture({AI:{run:async()=>({response:JSON.stringify(answer({sections:invalid}))})}});try{assert.equal((await worker.fetch(request(),bad.env)).status,503);}finally{bad.close();}
});

test('shortening preserves short precautions and never splices a source quotation',async()=>{
  const text='Never vibrate. '+Array.from({length:21},()=> 'This complete sentence explains the procedure using ten relevant words.').join(' ');
  const f=fixture({AI:{run:async()=>({response:answer({sections:[{heading:'Procedure',text,sourceIds:['S1']}]})})}});
  try{const result=await worker.fetch(request(body({targetWords:200,sources:[{id:'S1',text}]})),f.env);assert.equal(result.status,200);const section=JSON.parse((await result.json()).content).sections[0];assert.ok(section.text.startsWith('Never vibrate.'));assert.ok(text.startsWith(section.text));assert.ok(section.text.split(/\s+/).length<=200);}finally{f.close();}
  const quote='"The first statement describes a relevant material property. '+Array.from({length:201},()=> 'material').join(' ')+'. The final statement explains the conclusion of this quotation."';
  const quoted=fixture({AI:{run:async()=>({response:answer({sections:[{heading:'Source quotation',text:quote,sourceIds:['S1']}]})})}});
  try{const result=await worker.fetch(request(body({targetWords:200,sources:[{id:'S1',text:quote}]})),quoted.env);assert.equal(result.status,503);}finally{quoted.close();}
});

test('disallowed origins, methods, paths and preflight headers cannot consume the AI allowance', async () => {
  const f = fixture();
  try {
    for (const options of [
      {headers: {Origin: 'https://vaibhav221207.github.io.evil.example'}},
      {headers: {Origin: ''}},
      {method: 'GET'},
      {url: 'https://answers.example.workers.dev/other'},
      {url: 'https://answers.example.workers.dev/v1/explanations?model=other'},
      {method: 'OPTIONS', headers: {'Access-Control-Request-Method': 'DELETE'}},
      {method: 'OPTIONS', headers: {'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type'}}
    ]) assert.ok((await worker.fetch(request(body(), options), f.env)).status >= 400);
    const response = await worker.fetch(request(null, {method: 'OPTIONS', headers: {'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'}}), f.env);
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
    assert.equal(f.calls.length, 0);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM counters').get().n, 0);
  } finally {f.close();}
});

test('localhost is disabled by default and only explicit development configuration enables it', async () => {
  const f = fixture();
  try {
    const local = () => request(body(), {headers: {Origin: 'http://127.0.0.1:4173'}});
    assert.equal((await worker.fetch(local(), f.env)).status, 403);
    assert.equal((await worker.fetch(local(), {...f.env, ALLOW_LOCALHOST: 'true'})).status, 200);
    assert.equal((await worker.fetch(request(body(), {headers: {Origin: 'http://127.0.0.1:4174'}}), {...f.env, ALLOW_LOCALHOST: 'true'})).status, 403);
  } finally {f.close();}
});

test('invalid and excessive input is rejected before reservations or inference', async () => {
  const f = fixture();
  try {
    const invalid = [body({question: ''}), body({question: 'x'.repeat(1601)}), body({targetWords: 301}), body({mode: 'custom'}), body({clientId: 'anonymous'}), body({sources: []}), body({sources: [{id: 'S1', text: ''}]}), body({sources: [{id: 'S1', text: 'x'.repeat(12001)}]}), body({sources: Array.from({length: 13}, (_, index) => ({id: `S${index + 1}`, text: 'Some text.'}))}), body({sources: [{id: 'S1', text: 'One.'}, {id: 'S1', text: 'Two.'}]}), body({model: '@cf/paid/model'}), body({messages: []}), body({sources: [{id: 'S1', text: 'Valid text.', bookName: 'Must stay on device'}]}), body({mode: 'general'})];
    for (const input of invalid) {
      const result = await worker.fetch(request(input), f.env);
      assert.equal(result.status, 400);
      assert.equal((await result.json()).code, 'invalid');
    }
    for (const req of [request('{broken'), request(body(), {headers: {'Content-Type': 'text/plain'}}), request(' '.repeat(48001)), request(body(), {headers: {'Content-Length': '48001'}})]) assert.ok((await worker.fetch(req, f.env)).status >= 400);
    assert.equal(f.calls.length, 0);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM counters').get().n, 0);
  } finally {f.close();}
});

test('exact quotations require support from a section citation before and after shortening',async()=>{
  const quote='The flow test measures the spread of concrete after jolting.';
  const sources=[...body().sources,{id:'S2',text:quote}];
  for(const field of ['heading','text']){
    const draft=answer();draft.sections[0][field]=`The book describes: “${quote}”`;
    const f=fixture({AI:{run:async()=>({response:draft})}});
    try{assert.equal((await worker.fetch(request(body({sources})),f.env)).status,503);draft.sections[0].sourceIds=['S1','S2'];assert.equal((await worker.fetch(request(body({sources})),f.env)).status,200);}finally{f.close();}
  }
  const verbose=answer({sections:[{heading:'Materials',text:'This source supports a brief explanation of material use.',sourceIds:['S1']},{heading:'Flow',text:`“${quote}” `+Array.from({length:40},()=> 'This complete sentence describes a procedure in the textbook.').join(' '),sourceIds:['S1']}]});
  const f=fixture({AI:{run:async()=>({response:verbose})}});try{assert.equal((await worker.fetch(request(body({sources,targetWords:200})),f.env)).status,503);}finally{f.close();}
});

test('source headings preserve method context and stay inside the validated input bound',async()=>{
  const sources=[{...body().sources[0],heading:'Flow Test'}];
  const f=fixture();try{const result=await worker.fetch(request(body({sources})),f.env);assert.equal(result.status,200);assert.deepEqual(JSON.parse(f.calls[0].input.messages[1].content).sources,sources);assert.equal((await worker.fetch(request(body({sources:[{...sources[0],heading:'x'.repeat(161)}]})),f.env)).status,400);}finally{f.close();}
});

test('general explanations send no textbook text and cannot return false textbook citations', async () => {
  const f = fixture({AI: {async run(model, input) { const payload = JSON.parse(input.messages[1].content); assert.deepEqual(payload.sources, []); return {response: answer({sections: [{heading: 'Overview', text: 'Concrete can have several environmental effects.', sourceIds: []}]})}; }} });
  try {
    const result = await worker.fetch(request(body({mode: 'general', sources: []})), f.env);
    assert.equal(result.status, 200);
    assert.deepEqual(JSON.parse((await result.json()).content).sections[0].sourceIds, []);
    const bad = {...f.env, AI: {async run() {return {response: JSON.stringify(answer())};}}};
    assert.equal((await worker.fetch(request(body({mode: 'general', sources: []})), bad)).status, 503);
  } finally {f.close();}
});

test('concurrent requests cannot exceed one client daily allowance and retain no raw identity or question', async () => {
  const f = fixture();
  try {
    const responses = await Promise.all(Array.from({length: 12}, () => worker.fetch(request(), f.env)));
    assert.equal(responses.filter(result => result.status === 200).length, 8);
    assert.equal(responses.filter(result => result.status === 429).length, 4);
    assert.equal(f.calls.length, 8);
    const denied = await responses.find(result => result.status === 429).json();
    assert.equal(denied.code, 'quota');
    assert.equal(denied.remaining, 0);
    const stored = JSON.stringify(f.db.prepare('SELECT * FROM counters').all());
    assert.ok(!stored.includes(clientId));
    assert.ok(!stored.includes('203.0.113.1'));
    assert.ok(!stored.includes(body().question));
    assert.ok(!stored.includes(body().sources[0].text));
  } finally {f.close();}
});

test('a global allowance protects against anonymous IDs being rotated and failed calls stay reserved', async () => {
  const f = fixture({GLOBAL_DAILY_LIMIT: '3', AI: {async run() {throw new Error('secret request body and bearer token');}}});
  try {
    const result = await worker.fetch(request(), f.env);
    assert.equal(result.status, 503);
    assert.ok(!(await result.text()).includes('secret'));
    const goodEnv = {...f.env, AI: {async run() {return {response: JSON.stringify(answer())};}}};
    const different = n => body({clientId: `af539964-147d-4e60-8b7d-${String(n).padStart(12, '0')}`});
    assert.equal((await worker.fetch(request(different(1)), goodEnv)).status, 200);
    assert.equal((await worker.fetch(request(different(2)), goodEnv)).status, 200);
    const denied = await worker.fetch(request(different(3)), goodEnv);
    assert.equal(denied.status, 429);
    assert.equal((await denied.json()).code, 'quota');
  } finally {f.close();}
});

test('UTC rollover clears old counters while atomic reservations bound retained storage', async () => {
  const f = fixture();
  try {
    const keys = {clientKey: 'a'.repeat(64), ipKey: 'b'.repeat(64)};
    const before = Date.parse('2026-10-10T23:59:59Z');
    for (let i = 0; i < 8; i++) assert.equal(f.budget.reserve(keys, before).allowed, true);
    assert.equal(f.budget.reserve(keys, before).allowed, false);
    const after = f.budget.reserve(keys, Date.parse('2026-10-11T00:00:00Z'));
    assert.equal(after.allowed, true);
    assert.equal(after.remaining, 7);
    assert.equal(after.resetAt, '2026-10-12T00:00:00.000Z');
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM counters').get().n, 3);
    assert.equal(f.db.prepare('SELECT MIN(day) AS day FROM counters').get().day, '2026-10-11');
  } finally {f.close();}
});

test('a high shared-IP ceiling and a global ceiling still apply when anonymous client IDs rotate', async () => {
  const f = fixture({IP_DAILY_LIMIT: '2'});
  try {
    const responses = await Promise.all(Array.from({length: 5}, (_, n) => worker.fetch(request(body({clientId: `af539964-147d-4e60-8b7d-${String(n).padStart(12, '0')}`})), f.env)));
    assert.equal(responses.filter(result => result.status === 200).length, 2);
    assert.equal(responses.filter(result => result.status === 429).length, 3);
    assert.equal(f.calls.length, 2);
    assert.equal(f.db.prepare("SELECT count FROM counters WHERE key = 'global'").get().count, 2);
  } finally {f.close();}
});

test('missing managed bindings fail closed before inference, and midnight identity hashes cannot reserve today twice', async () => {
  const f = fixture();
  try {
    assert.equal((await worker.fetch(request(), {...f.env, USAGE_BUDGET: undefined})).status, 503);
    assert.equal(f.calls.length, 0);
    const old = await f.budget.fetch(new Request('https://budget.internal/reserve', {method: 'POST', body: JSON.stringify({clientKey: 'a'.repeat(64), ipKey: 'b'.repeat(64), day: '2000-01-01'})}));
    assert.equal(old.status, 400);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM counters').get().n, 0);
  } finally {f.close();}
});

test('upstream quota and capacity failures are redacted and never automatically retried', async () => {
  const f = fixture();
  try {
    for (const [code, expected, status] of [[3036, 'quota', 429], [3040, 'busy', 429], [5035, 'service_unavailable', 503]]) {
      let attempts = 0;
      const env = {...f.env, AI: {async run() {attempts++; const error = new Error('private prompt user secret key'); error.code = code; throw error;}}};
      const result = await worker.fetch(request(), env);
      assert.equal(result.status, status);
      const response = await result.json();
      assert.equal(response.code, expected);
      assert.ok(!JSON.stringify(response).includes('private'));
      assert.equal(attempts, 1);
    }
  } finally {f.close();}
});

test('unvalidated or overlong provider text never becomes a successful explanation', async () => {
  const f = fixture();
  try {
    for (const generated of [
      'plain answer instead of JSON',
      answer({sections: [{heading: 'Materials', text: 'An invented fact.', sourceIds: ['S9']}]}),
      answer({sections: [{heading: 'Materials', text: 'According to page 17, this is true.', sourceIds: ['S1']}]}),
      answer({sections: [{heading: 'Materials', text: 'word '.repeat(451), sourceIds: ['S1']}]}),
      answer({extra: 'not in our schema'})
    ]) {
      const env = {...f.env, AI: {async run() {return {response: typeof generated === 'string' ? generated : JSON.stringify(generated)};}}};
      const result = await worker.fetch(request(), env);
      assert.equal(result.status, 503);
      assert.equal((await result.json()).code, 'service_unavailable');
    }
  } finally {f.close();}
});
