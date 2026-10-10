import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('../src/ocr.js').catch(()=>({}));
test('OCR word boxes map to original normalized geometry',()=>{
  assert.equal(typeof api.ocrDataToPage,'function','ocrDataToPage missing');
  const p=api.ocrDataToPage({blocks:[{paragraphs:[{lines:[{words:[{text:'Concrete',bbox:{x0:100,y0:200,x1:300,y1:250}}]}]}]}]},1000,2000,{pdfPage:9,printedLabel:null});
  assert.equal(p.runs[0].text,'Concrete');assert.deepEqual(p.runs[0].bounds,{x:.1,y:.1,width:.2,height:.025});assert.equal(p.method,'ocr');
});
test('empty OCR cannot silently become successful invented text',()=>{
  assert.equal(typeof api.ocrDataToPage,'function','ocrDataToPage missing');
  assert.equal(api.ocrDataToPage({blocks:null},100,100,{pdfPage:1,printedLabel:null}).runs.length,0);
});
test('cancelled OCR does not load assets or process pages',async()=>{
  assert.equal(typeof api.ocrPages,'function','ocrPages missing');const c=new AbortController();c.abort();
  await assert.rejects(api.ocrPages({},[1],{signal:c.signal}),{name:'AbortError'});
});
test('unavailable OCR produces an actionable failure',async()=>{
  assert.equal(typeof api.loadOcr,'function','loadOcr missing');
  await assert.rejects(api.loadOcr(),/browser|OCR/i);
});
