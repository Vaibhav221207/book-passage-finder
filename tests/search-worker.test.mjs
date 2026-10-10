import test from 'node:test';
import assert from 'node:assert/strict';
const span=text=>({id:'p1-0',text,heading:'Concrete workability',segments:[{page:{pdfPage:1,printedLabel:null},ranges:[{runId:'r',start:0,end:text.length}],rects:[{x:.1,y:.2,width:.8,height:.03}],method:'pdf-text'}]});

test('worker searches only the indexed library revision and preserves book identity across messages',async()=>{
  const messages=[];globalThis.self={postMessage:value=>messages.push(structuredClone(value))};
  try{
    await import('../src/search-worker.js');
    self.onmessage({data:{jobId:'index',type:'index',payload:{libraryId:'revision-1',books:[{id:'a',filename:'A.pdf',spans:[span('Concrete workability describes mixing and placing a fresh concrete mixture.')]},{id:'b',filename:'B.pdf',spans:[span('Concrete workability affects compaction of freshly placed concrete around reinforcement.')] }]}}});
    assert.equal(messages.at(-1).type,'indexed');assert.equal(messages.at(-1).libraryId,'revision-1');
    self.onmessage({data:{jobId:'old',type:'search',payload:{libraryId:'obsolete',questions:[{id:'q',text:'Explain concrete workability.'}]}}});
    assert.equal(messages.at(-1).type,'error');assert.equal(messages.at(-1).jobId,'old');
    self.onmessage({data:{jobId:'search',type:'search',payload:{libraryId:'revision-1',questions:[{id:'q',text:'Explain concrete workability.'}],options:{wordBudget:300}}}});
    assert.equal(messages.at(-1).type,'results');assert.equal(messages.at(-1).jobId,'search');
    assert.deepEqual(messages.at(-1).payload[0].passages.map(p=>p.segments[0].page.bookId),['a','b']);
    self.onmessage({data:{jobId:'cancel',type:'cancel'}});
    self.onmessage({data:{jobId:'late',type:'search',payload:{libraryId:'revision-1',questions:[]}}});
    assert.equal(messages.at(-1).type,'error');
    self.onmessage({data:{jobId:'legacy',type:'index',payload:{sessionId:'legacy-session',spans:[span('Concrete workability describes placing concrete before the mixture hardens.')]}}});
    self.onmessage({data:{jobId:'legacy-search',type:'search',payload:{sessionId:'legacy-session',questions:[{id:'q',text:'Explain concrete workability.'}]}}});
    assert.equal(messages.at(-1).type,'results');assert.equal(messages.at(-1).sessionId,'legacy-session');assert.equal(messages.at(-1).payload[0].passages[0].bookId,'legacy-session');
  }finally{delete globalThis.self;}
});
