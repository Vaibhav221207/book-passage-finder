import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../src/managed-ai.js').catch(()=>({}));
const source={id:'S1',bookId:'book-a',bookName:'Concrete technology',pages:[{pdfPage:4,printedLabel:'2',bookId:'book-a',bookName:'Concrete technology'}],text:'Slump measures the vertical subsidence of fresh concrete after removing the mould. It indicates consistency.'};
const draft=()=>({title:'Slump test',sections:[{heading:'Meaning',text:'Slump measures the subsidence of fresh concrete and indicates its consistency.',sourceIds:['S1']}],missingDetails:[]});
const clientId='35c8b40f-625e-4f09-a285-065394459d6b';
const response=content=>new Response(JSON.stringify({content:JSON.stringify(content),model:'@cf/ibm-granite/granite-4.0-h-micro',remaining:7,resetAt:'2026-10-11T00:00:00.000Z'}),{headers:{'Content-Type':'application/json'}});
const options=extra=>({endpoint:'https://book-ai.example',question:'Explain the slump test.',sources:[structuredClone(source)],clientId,...extra});
const request=opts=>{assert.equal(typeof api.requestManagedExplanation,'function');return api.requestManagedExplanation(opts);};

test('managed AI sends one keyless request containing only question and selected source text',async()=>{
  let outgoing,calls=0;const result=await request(options({fetchImpl:async(url,init)=>{calls++;outgoing={url,init,body:JSON.parse(init.body)};return response(draft());}}));
  assert.equal(calls,1);assert.equal(outgoing.url,'https://book-ai.example/v1/explanations');assert.equal(outgoing.init.credentials,'omit');assert.equal(outgoing.init.redirect,'error');assert.equal(outgoing.init.referrerPolicy,'no-referrer');
  assert.deepEqual(outgoing.init.headers,{'Content-Type':'application/json'});assert.deepEqual(outgoing.body,{question:'Explain the slump test.',targetWords:300,mode:'book',clientId,sources:[{id:'S1',text:source.text}]});
  assert.deepEqual(result.sources,[source]);assert.equal(result.allowance.remaining,7);assert.equal(result.mode,'book');assert.deepEqual(result.sections,draft().sections);
});

test('section headings reach managed AI without sending book or page metadata',async()=>{
  let supplied;const heading='Flow Test';
  await request(options({sources:[{...source,heading}],fetchImpl:async(_,init)=>{supplied=JSON.parse(init.body);return response(draft());}}));
  assert.deepEqual(supplied.sources,[{id:'S1',text:source.text,heading}]);
});

test('an unconfigured or unsafe endpoint fails before network access',async()=>{
  for(const endpoint of ['', 'http://outside.example','https://name:secret@example.com','https://example.com/?secret=value','https://example.com/unexpected']){
    let calls=0;await assert.rejects(request(options({endpoint,fetchImpl:async()=>{calls++;}})));assert.equal(calls,0);
  }
});

test('invalid inputs and excessive selected text cannot consume allowance',async()=>{
  for(const extra of [{targetWords:900},{question:'x'.repeat(1601)},{sources:[]},{clientId:'invalid'},{sources:[{...source,text:'x'.repeat(12001)}]},{sources:[{...source,pages:[]}]}]){
    let calls=0;await assert.rejects(request(options({...extra,fetchImpl:async()=>{calls++;}})));assert.equal(calls,0);
  }
});

test('general mode sends no book text and cannot accept a source citation',async()=>{
  let outgoing;const general={title:'Concrete',sections:[{heading:'Overview',text:'Concrete is a construction material.',sourceIds:[]}],missingDetails:[]};
  const result=await request(options({mode:'general',fetchImpl:async(_,init)=>{outgoing=JSON.parse(init.body);return response(general);}}));assert.deepEqual(outgoing.sources,[]);assert.deepEqual(result.sources,[]);assert.equal(result.mode,'general');
  await assert.rejects(request(options({mode:'general',fetchImpl:async()=>response(draft())})),e=>e.code==='invalid-answer');
});

test('quota and service failures are safe, are not retried, and do not expose server text',async()=>{
  for(const status of [429,500,403]){let calls=0;await assert.rejects(request(options({fetchImpl:async()=>{calls++;return new Response('secret-token and private source',{status});}})),e=>!e.message.includes('secret-token')&&!e.message.includes('private source'));assert.equal(calls,1);}
});

test('untrusted response citations and overly long prose are rejected',async()=>{
  for(const content of [{...draft(),sections:[{...draft().sections[0],sourceIds:['S999']}]},{...draft(),sections:[{...draft().sections[0],text:Array(451).fill('word').join(' ')}]}])await assert.rejects(request(options({fetchImpl:async()=>response(content)})));
});

test('managed request timeout and cancellation leave the caller able to retry',async()=>{
  await assert.rejects(request(options({timeoutMs:5,fetchImpl:()=>new Promise(()=>{})})),e=>e.code==='timeout');
  const controller=new AbortController();const pending=request(options({signal:controller.signal,fetchImpl:()=>new Promise(()=>{})}));controller.abort();await assert.rejects(pending,e=>e.name==='AbortError');
  const again=await request(options({fetchImpl:async()=>response(draft())}));assert.equal(again.title,'Slump test');
});

test('anonymous allowance identity survives local storage failure and contains no account data',()=>{
  assert.equal(typeof api.getAnonymousClientId,'function');const storage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  const id=api.getAnonymousClientId({storage});assert.match(id,/^[a-f0-9-]{36}$/i);assert.equal(api.getAnonymousClientId({storage}),id);
  const saved={getItem:()=>clientId,setItem(){throw Error('no write needed');}};assert.equal(api.getAnonymousClientId({storage:saved}),clientId);
});
