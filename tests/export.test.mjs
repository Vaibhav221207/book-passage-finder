import test from 'node:test';import assert from 'node:assert/strict';import {createCanvas} from '@napi-rs/canvas';import {pdfLibrary} from '../src/book.js';
const api=await import('../src/export.js').catch(()=>({}));
const session={name:'My textbook.pdf',async renderPage(){const c=createCanvas(300,400);c.getContext('2d').fillText('Original source',30,50);return c;}};
function result(text){return {question:{id:'q1',text:'Explain φ and the ratio.'},status:'partial',coverageNotes:['Check the remaining details in the source.'],passages:[{text,segments:[{page:{pdfPage:7,printedLabel:'iv'},rects:[{x:.1,y:.1,width:.7,height:.2}]}]}],figures:[{confirmed:false,page:{pdfPage:999},bounds:{}}]};}
test('PDF export embeds Unicode text, page references and only confirmed selections',async()=>{
  assert.equal(typeof api.exportPacket,'function','exportPacket missing');
  const blob=await api.exportPacket(session,[result('φ = ½; density ρ = 2400 kg/m³.')]);
  const loading=(await pdfLibrary()).getDocument({data:new Uint8Array(await blob.arrayBuffer()),useSystemFonts:true}),pdf=await loading.promise;
  let text='';for(let n=1;n<=pdf.numPages;n++)text+=(await(await pdf.getPage(n)).getTextContent()).items.map(i=>i.str).join(' ');
  assert.ok(text.includes('φ = ½'));assert.ok(text.includes('kg/m³'));assert.match(text,/B1.*p\.\s*iv.*PDF\s*7/);assert.ok(!text.includes('999'));assert.ok(!text.includes('Partial'));assert.ok(!text.includes('Check the remaining details in the source.'));assert.ok(!text.includes('Selected source passages'));assert.ok(!text.includes('Original passage crops'));assert.ok(text.includes('References'));assert.equal(text.split('My textbook').length-1,1);assert.ok(!text.includes('My textbook.pdf'));await loading.destroy();
});
test('long exports paginate without drawing text outside margins and cancellation stops output',async()=>{
  assert.equal(typeof api.exportPacket,'function','exportPacket missing');
  const blob=await api.exportPacket(session,[result('The concrete has a measurable property. '.repeat(300))],{includeCrops:false});
  const loading=(await pdfLibrary()).getDocument({data:new Uint8Array(await blob.arrayBuffer()),useSystemFonts:true}),pdf=await loading.promise;assert.ok(pdf.numPages>2);
  for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);for(const item of(await page.getTextContent()).items){if(!item.str.trim())continue;if(/^\d+ \/ \d+$/.test(item.str)){assert.equal(item.transform[5],25);continue;}assert.ok(item.transform[5]>=30&&item.transform[5]<=page.view[3]-25,`text overflow page ${n}`);}}await loading.destroy();
  const controller=new AbortController();controller.abort();await assert.rejects(()=>api.exportPacket(session,[],{signal:controller.signal}),{name:'AbortError'});
});
