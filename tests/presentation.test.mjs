import test from 'node:test';
import assert from 'node:assert/strict';
const presentation=await import('../src/presentation.js').catch(()=>({}));
const call=(name,...args)=>{
  assert.equal(typeof presentation[name],'function',`${name} is available`);
  return presentation[name](...args);
};
const book={id:'concrete',filename:'Concrete_Technology_MS_Shetty.pdf'};
const page={bookId:book.id,bookName:book.filename,pdfPage:141,printedLabel:'118'};
const source={id:'S1',bookId:book.id,bookName:book.filename,pages:[page]};

test('a citation stays compact while its accessible description preserves both page labels and filename',()=>{
  const result=call('citationPresentation',source,[book]);
  assert.equal(result.label,'[S1] · p. 118');
  assert.match(result.description,/S1/);
  assert.match(result.description,/Concrete_Technology_MS_Shetty\.pdf/);
  assert.match(result.description,/Book 118 · PDF 141/);
});

test('sources on the same page retain their own citation identities',()=>{
  const first=call('citationPresentation',source,[book]);
  const second=call('citationPresentation',{...source,id:'S6'},[book]);
  assert.notEqual(first.label,second.label);
  assert.match(second.description,/S6/);
});

test('a multi-book citation uses the matching library ordinal rather than the source number',()=>{
  const result=call('citationPresentation',{...source,id:'S7'},[{id:'notes'},book]);
  assert.equal(result.label,'[S7] · B2 · p. 118');
});

test('citation page labels support roman numerals and explicit PDF fallback',()=>{
  assert.equal(call('citationPresentation',{...source,pages:[{...page,printedLabel:'xii'}]},[book]).label,'[S1] · p. xii');
  const fallback=call('citationPresentation',{...source,pages:[{...page,printedLabel:null}]},[book]);
  assert.equal(fallback.label,'[S1] · PDF p. 141');
  assert.match(fallback.description,/PDF 141/);
});

test('multi-page citations abbreviate visually but describe every original page',()=>{
  const result=call('citationPresentation',{...source,pages:[page,{...page,pdfPage:143,printedLabel:'120'},{...page,pdfPage:144,printedLabel:null}]},[book]);
  assert.equal(result.label,'[S1] · p. 118 +2');
  assert.match(result.description,/Book 118 · PDF 141/);
  assert.match(result.description,/Book 120 · PDF 143/);
  assert.match(result.description,/PDF 144/);
});

test('descriptions recover the source filename when page refs omit it, without fabricating an unknown ordinal',()=>{
  const result=call('citationPresentation',{...source,pages:[{pdfPage:141,printedLabel:'118'}]},[{id:'other'},{id:'notes'}]);
  assert.equal(result.label,'[S1] · p. 118');
  assert.match(result.description,/Concrete_Technology_MS_Shetty\.pdf/);
  const missing=call('citationPresentation',{...source,pages:[]},[book]);
  assert.equal(missing.label,'[S1] · Source');
  assert.doesNotMatch(missing.description,/undefined/);
});

test('coverage notes combine AI gaps and search gaps once in their original order',()=>{
  const answer={missingDetails:[' Missing history. ','','Check source.']};
  const result={coverageNotes:['Missing history.',' Check source. ','Missing dates.']};
  assert.deepEqual(call('coverageNotes',answer,result),['Missing history.','Check source.','Missing dates.']);
  assert.deepEqual(answer.missingDetails,[' Missing history. ','','Check source.']);
  assert.deepEqual(call('coverageNotes',undefined,{coverageNotes:['Only search warning.']}),['Only search warning.']);
  assert.deepEqual(call('coverageNotes',undefined,undefined),[]);
});

test('phases without incremental reports never suggest a measurable fraction',()=>{
  for(const phase of ['Preparing book search','Finding passages','Making your answer clearer']){
    assert.deepEqual(call('progressPresentation',{phase,completed:0,total:1}),{label:phase,detail:'',total:null,value:null});
  }
});

test('reading, OCR, and export progress preserve real counts without inventing percentages',()=>{
  for(const phase of ['Reading book','Recognizing selected pages','Building PDF']){
    assert.deepEqual(call('progressPresentation',{phase,completed:3,total:12}),{label:phase,detail:'3 of 12',total:12,value:3});
  }
});

test('progress clamps counts to actual bounds',()=>{
  assert.deepEqual(call('progressPresentation',{phase:'Reading book',completed:-2,total:12}),{label:'Reading book',detail:'0 of 12',total:12,value:0});
  assert.deepEqual(call('progressPresentation',{phase:'PDF ready',completed:14,total:12}),{label:'PDF ready',detail:'12 of 12',total:12,value:12});
});

test('unknown or invalid work totals remain indeterminate with a useful default phase',()=>{
  for(const total of [undefined,null,0,-1,NaN,Infinity,'12']){
    assert.deepEqual(call('progressPresentation',{phase:'Reading book',completed:2,total}),{label:'Reading book',detail:'',total:null,value:null});
  }
  assert.deepEqual(call('progressPresentation',{phase:' ',completed:NaN,total:12}),{label:'Getting things ready',detail:'',total:null,value:null});
  assert.deepEqual(call('progressPresentation'),{label:'Getting things ready',detail:'',total:null,value:null});
});
