import test from 'node:test';import assert from 'node:assert/strict';import {createCanvas} from '@napi-rs/canvas';
const api=await import('../src/source-view.js').catch(()=>({}));
test('crop bounds are clipped safely without losing page provenance',()=>{
  assert.equal(typeof api.pixelBounds,'function','pixelBounds missing');const b=api.pixelBounds({x:-.02,y:.95,width:.3,height:.2},100,200,0);assert.deepEqual(b,{x:0,y:190,width:28,height:10});
});
test('a two-page span gives separate original crops',async()=>{
  assert.equal(typeof api.cropSpan,'function','cropSpan missing');
  const session={id:'synthetic',async renderPage(){const c=createCanvas(100,200);c.getContext('2d').fillRect(10,20,80,20);return c;}};
  const span={segments:[1,2].map(n=>({page:{pdfPage:n,printedLabel:null},rects:[{x:.1,y:.1,width:.8,height:.1}]}))};
  const crops=await api.cropSpan(session,span,{scale:1});assert.equal(crops.length,2);assert.deepEqual(crops.map(c=>c.page.pdfPage),[1,2]);assert.ok(crops.every(c=>c.blob.size>20));
});
test('separate columns do not become one unrelated broad crop',()=>{
  assert.equal(typeof api.groupCropRects,'function','groupCropRects missing');
  assert.equal(api.groupCropRects([{x:.1,y:.2,width:.3,height:.05},{x:.6,y:.2,width:.3,height:.05}]).length,2);
});
