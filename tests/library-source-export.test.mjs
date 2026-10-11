import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {cropSpan,cropFigure,openSourceDialog} from '../src/source-view.js';
import {suggestFigures} from '../src/figures.js';
import {exportPacket} from '../src/export.js';
import {pdfLibrary} from '../src/book.js';

const box={x:.1,y:.1,width:.5,height:.3};
function book(id,name,color,caption='Fig. 2.3. Vibration apparatus'){
  const ref={bookId:id,bookName:name,pdfPage:1,printedLabel:'17'};
  return {id,filename:name,pageCount:1,pages:[{ref,runs:[{id:`${id}-caption`,text:caption,bounds:{x:.2,y:.7,width:.6,height:.025}}]}],
    async renderPage(){const canvas=createCanvas(100,100),ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,100,100);return canvas;}};
}
const books=()=>[book('red','Red handbook.pdf','#ff0000'),book('blue','Blue handbook.pdf','#0000ff')];
const passage=(session,text='The vibration apparatus is shown in Fig. 2.3.')=>({id:`${session.id}:p1`,bookId:session.id,text,heading:'Vibration',segments:[{page:{...session.pages[0].ref},rects:[box]}]});
const result=passages=>({question:{id:'q1',text:'Explain vibration.'},status:'matched',passages,figures:[],coverageNotes:[]});
async function pixel(blob){const image=await loadImage(Buffer.from(await blob.arrayBuffer())),canvas=createCanvas(image.width,image.height);canvas.getContext('2d').drawImage(image,0,0);return [...canvas.getContext('2d').getImageData(2,2,1,1).data];}
async function pdfText(blob){const loading=(await pdfLibrary()).getDocument({data:new Uint8Array(await blob.arrayBuffer()),useSystemFonts:true}),pdf=await loading.promise;try{let text='';for(let n=1;n<=pdf.numPages;n++)text+=(await(await pdf.getPage(n)).getTextContent()).items.map(i=>i.str).join(' ')+' ';return text;}finally{await loading.destroy();}}

// Selecting physical page 1 from a second book must not render the first book.
test('passage and figure crops route identical page numbers to their own book pixels',async()=>{
  const [red,blue]=books(),context={books:[red,blue]};
  const mixed={bookId:red.id,segments:[...passage(red).segments,...passage(blue).segments]};
  const crops=await cropSpan(context,mixed,{scale:1});
  assert.deepEqual(await pixel(crops[0].blob),[255,0,0,255]);
  assert.deepEqual(await pixel(crops[1].blob),[0,0,255,255]);
  assert.deepEqual(crops.map(c=>c.page.bookId),['red','blue']);
  assert.deepEqual(await pixel(await cropFigure(context,{bookId:blue.id,page:blue.pages[0].ref,bounds:box})),[0,0,255,255]);
});

test('crop routing falls back to the span or figure book identity when page refs omit it',async()=>{
  const [red,blue]=books();
  const crops=await cropSpan([red,blue],{bookId:'blue',segments:[{page:{pdfPage:1},rects:[box]}]});
  assert.deepEqual(await pixel(crops[0].blob),[0,0,255,255]);
  assert.deepEqual(await pixel(await cropFigure([red,blue],{bookId:'red',page:{pdfPage:1},bounds:box})),[255,0,0,255]);
});

test('figure crops contain only selected pixels while passage crops retain context padding',async()=>{
  const source=book('edge','Edge handbook.pdf','#0000ff'),bounds={x:.2,y:.2,width:.3,height:.3};source.renderPage=async()=>{const canvas=createCanvas(100,100),ctx=canvas.getContext('2d');ctx.fillStyle='#0000ff';ctx.fillRect(0,0,100,100);ctx.fillStyle='#ff0000';ctx.fillRect(20,20,30,30);return canvas;};
  const selection={bookId:'edge',page:source.pages[0].ref,bounds},figure=await loadImage(Buffer.from(await(await cropFigure(source,selection,{scale:1})).arrayBuffer()));
  assert.equal(figure.width,30);assert.equal(figure.height,30);const figureCanvas=createCanvas(30,30),figureCtx=figureCanvas.getContext('2d');figureCtx.drawImage(figure,0,0);
  for(const [x,y]of [[0,0],[29,0],[0,29],[29,29]])assert.deepEqual([...figureCtx.getImageData(x,y,1,1).data],[255,0,0,255]);
  const [crop]=await cropSpan(source,{bookId:'edge',segments:[{page:source.pages[0].ref,rects:[bounds]}]},{scale:1}),passageImage=await loadImage(Buffer.from(await crop.blob.arrayBuffer()));
  assert.equal(passageImage.width,32);assert.equal(passageImage.height,32);const passageCanvas=createCanvas(32,32),passageCtx=passageCanvas.getContext('2d');passageCtx.drawImage(passageImage,0,0);
  assert.deepEqual([...passageCtx.getImageData(0,0,1,1).data],[0,0,255,255]);assert.deepEqual([...passageCtx.getImageData(1,1,1,1).data],[255,0,0,255]);
});

test('an unknown book reference rejects cropping rather than showing another source',async()=>{
  const context={books:books()},ref={bookId:'removed',pdfPage:1};
  await assert.rejects(cropSpan(context,{segments:[{page:ref,rects:[box]}]}),/book.*(?:found|loaded|unknown|removed)|unknown.*book/i);
  await assert.rejects(cropFigure(context,{page:ref,bounds:box}),/book.*(?:found|loaded|unknown|removed)|unknown.*book/i);
});

test('figure suggestions keep repeated figure and page numbers distinct across books',()=>{
  const [red,blue]=books(),figures=suggestFigures({books:[red,blue]},result([passage(red),passage(blue)]));
  assert.equal(figures.length,2);
  assert.equal(new Set(figures.map(f=>f.id)).size,2);
  assert.deepEqual(figures.map(f=>f.bookId).sort(),['blue','red']);
  for(const figure of figures){assert.equal(figure.page.bookId,figure.bookId);assert.ok(figure.page.bookName.includes('handbook'));assert.equal(figure.confirmed,false);}
});

test('references from one book do not suggest a same-number figure from another book',()=>{
  const [red,blue]=books(),figures=suggestFigures([red,blue],result([passage(red)]));
  assert.deepEqual(figures.map(f=>f.bookId),['red']);
});

test('an explicit question figure reference searches every book without requiring prose',()=>{
  const figures=suggestFigures({books:books()},{question:{text:'Describe Fig. 2.3.'},passages:[]});
  assert.equal(figures.length,2);assert.deepEqual(figures.map(f=>f.bookId).sort(),['blue','red']);
});

test('a library PDF export identifies every loaded book and every repeated-page passage',async()=>{
  const [red,blue]=books(),context={books:[red,blue]},r=result([passage(red,'Red source quotation.'),passage(blue,'Blue source quotation.')]);
  const text=await pdfText(await exportPacket(context,[r],{includeCrops:false}));
  assert.ok(text.includes('Red handbook.pdf'));assert.ok(text.includes('Blue handbook.pdf'));
  assert.match(text,/Red source quotation\.\s+Red handbook\.pdf.*Book 17.*PDF 1/);
  assert.match(text,/Blue source quotation\.\s+Blue handbook\.pdf.*Book 17.*PDF 1/);
});

test('a library export rejects removed-book references even when crop export is disabled',async()=>{
  const [red]=books(),r=result([passage(red)]);r.passages[0].bookId='removed';r.passages[0].segments[0].page.bookId='removed';
  await assert.rejects(exportPacket({books:[red]},[r],{includeCrops:false}),/book.*(?:found|loaded|unknown|removed)|unknown.*book/i);
});

test('exported citations distinguish separate books that share a filename and page label',async()=>{
  const red=book('red','Handbook.pdf','#ff0000'),blue=book('blue','Handbook.pdf','#0000ff'),r=result([passage(red,'Red source quotation.'),passage(blue,'Blue source quotation.')]);
  const text=await pdfText(await exportPacket({books:[red,blue]},[r],{includeCrops:false}));
  assert.match(text,/Red source quotation\.\s+Handbook\.pdf \[Source 1\].*Book 17.*PDF 1/);
  assert.match(text,/Blue source quotation\.\s+Handbook\.pdf \[Source 2\].*Book 17.*PDF 1/);
});

test('a tall confirmed table uses a readable page-sized image without crossing page margins',async()=>{
  const source=book('table','Table handbook.pdf','#fff');source.renderPage=async()=>{const canvas=createCanvas(600,1200),ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,600,1200);ctx.fillStyle='#000';for(let n=0;n<30;n++){ctx.fillText(`Row ${n+1}: measured value`,25,35+n*38);ctx.fillRect(20,42+n*38,560,1);}return canvas;};
  const r=result([]);r.figures=[{bookId:'table',page:source.pages[0].ref,bounds:{x:0,y:0,width:1,height:1},caption:'Table 12.27. Complete trial values and notes',confirmed:true}];
  const blob=await exportPacket({books:[source]},[r]),lib=await pdfLibrary(),loading=lib.getDocument({data:new Uint8Array(await blob.arrayBuffer()),useSystemFonts:true}),pdf=await loading.promise;
  const images=[];try{for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),ops=await page.getOperatorList(),stack=[];let matrix=[1,0,0,1,0,0];
    for(let i=0;i<ops.fnArray.length;i++){const fn=ops.fnArray[i],args=ops.argsArray[i];if(fn===lib.OPS.save)stack.push([...matrix]);else if(fn===lib.OPS.restore)matrix=stack.pop();else if(fn===lib.OPS.transform){const [a,b,c,d,e,f]=matrix,[g,h,j,k,l,m]=args;matrix=[a*g+c*h,b*g+d*h,a*j+c*k,b*j+d*k,a*l+c*m+e,b*l+d*m+f];}else if(fn===lib.OPS.paintImageXObject)images.push({x:matrix[4],y:matrix[5],width:Math.hypot(matrix[0],matrix[1]),height:Math.hypot(matrix[2],matrix[3]),pageWidth:page.view[2],pageHeight:page.view[3]});}
  }}finally{await loading.destroy();}
  assert.equal(images.length,1);const image=images[0];assert.ok(image.height>400,'Long table rows must remain readable in the exported PDF');assert.ok(image.x>=40&&image.y>=40);assert.ok(image.x+image.width<=image.pageWidth-39);assert.ok(image.y+image.height<=image.pageHeight-40);
});

test('book-grounded generated drafts export section source maps separately from quotations',async()=>{
  const [red,blue]=books(),r=result([]);r.explanation={title:'Why the apparatus works',mode:'book',model:'test-model',sections:[{heading:'Mechanism',text:'A generated explanation of the experiment.',sourceIds:['S2']}],missingDetails:['The speed is absent.'],sources:[{id:'S2',bookId:blue.id,bookName:blue.filename,pages:[blue.pages[0].ref],text:'The original source passage.'}]};
  const text=await pdfText(await exportPacket({books:[red,blue]},[r],{includeCrops:false}));
  assert.match(text,/Generated.*(?:draft|explanation)/i);assert.ok(text.includes('A generated explanation of the experiment.'));
  assert.match(text,/Mechanism.*S2/);assert.match(text,/S2.*Blue handbook\.pdf.*Book 17.*PDF 1/);assert.ok(text.includes('The speed is absent.'));
});

test('general-knowledge drafts export as unverified without fabricated source mappings',async()=>{
  const r=result([]);r.explanation={title:'General explanation',mode:'general',model:'test-model',sections:[{heading:'Overview',text:'A general explanation without textbook evidence.',sourceIds:['S999']}],missingDetails:[],sources:[{id:'S999',bookId:'removed',bookName:'Invented handbook.pdf',pages:[{bookId:'removed',pdfPage:999}],text:'Fabricated source.'}]};
  const text=await pdfText(await exportPacket({books:books()},[r],{includeCrops:false}));
  assert.match(text,/General knowledge.*unverified/i);assert.ok(text.includes('A general explanation without textbook evidence.'));
  assert.ok(!text.includes('Invented'));assert.ok(!text.includes('S999'));assert.ok(!text.includes('PDF 999'));assert.ok(!text.includes('Fabricated source'));
});

// The dialog runs against a small DOM boundary; real canvases still generate its PNG.
function dialogDom(t){
  class Element{
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.attrs={};this.listeners=new Map();this.clientHeight=100;this.open=false;}
    set textContent(value){this.text=value;this.children=[];}get textContent(){return this.text||'';}
    append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;this.text='';}
    setAttribute(key,value){this.attrs[key]=value;}
    addEventListener(event,fn){this.listeners.set(event,fn);}
    showModal(){this.open=true;}close(){this.open=false;this.listeners.get('close')?.();}
    querySelector(selector){return this.children.flatMap(n=>[n,...n.descendants()]).find(n=>selector.startsWith('.')?n.className===selector.slice(1):n.tagName===selector.toUpperCase());}
    descendants(){return this.children.flatMap(n=>[n,...n.descendants()]);}
    getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}setPointerCapture(){}
  }
  const ids=new Map(['source-dialog','source-stage','source-controls','crop-controls','source-scroll','source-title'].map(id=>[id,new Element('div')])),previous=globalThis.document;
  globalThis.document={getElementById:id=>ids.get(id),createElement:tag=>tag==='canvas'?createCanvas(1,1):new Element(tag)};
  t.after(()=>{ids.get('source-dialog').close();if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
  const nodes=()=>[...ids.values()].flatMap(n=>[n,...n.descendants()]);
  return {get:id=>ids.get(id),label:name=>nodes().find(n=>n.attrs?.['aria-label']===name),button:text=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===text),load(){ids.get('source-stage').querySelector('img')?.onload?.();}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('manual source selection switches book identity and valid page range before confirming',async t=>{
  const ui=dialogDom(t),[red,blue]=books();blue.pageCount=2;blue.pages.push({...blue.pages[0],ref:{...blue.pages[0].ref,pdfPage:2,printedLabel:'18'}});let selected;
  await openSourceDialog({books:[red,blue]},{onConfirm:value=>{selected=value;}});ui.load();
  const selector=ui.label('Source book');assert.ok(selector,'Manual cropping needs a labelled book selector');
  assert.deepEqual(selector.children.map(n=>n.textContent),['Red handbook.pdf','Blue handbook.pdf']);
  selector.value='blue';await selector.onchange();ui.load();
  const pageInput=ui.label('Physical PDF page');assert.equal(Number(pageInput.max),2);pageInput.value='2';await ui.button('Go').onclick();ui.load();
  ui.button('Full page').onclick();ui.button('Include selected crop').onclick();
  assert.equal(selected.bookId,'blue');assert.equal(selected.page.pdfPage,2);assert.equal(selected.page.bookName,'Blue handbook.pdf');assert.deepEqual(selected.bounds,{x:0,y:0,width:1,height:1});
});

test('source crop reset and corner resize preserve the selected book and complete rectangle',async t=>{
  const ui=dialogDom(t),[,blue]=books();let selected;
  await openSourceDialog(blue,{figure:{bookId:'blue',page:blue.pages[0].ref,bounds:box,caption:'Vibration diagram'},onConfirm:value=>{selected=value;}});ui.load();
  ui.button('Full page').onclick();ui.button('Reset selection').onclick();
  const stage=ui.get('source-stage'),handle=ui.label('Resize selected crop');assert.ok(handle,'Crop needs a usable resize corner');
  stage.onpointerdown({target:handle,pointerId:1,clientX:60,clientY:40,preventDefault(){}});stage.onpointermove({clientX:90,clientY:80});stage.onpointerup();ui.button('Include selected crop').onclick();
  assert.equal(selected.bookId,'blue');assert.equal(selected.caption,'Vibration diagram');assert.deepEqual(selected.bounds,{x:.1,y:.1,width:.8,height:.7000000000000001});
});

test('a stale original-book render cannot replace a newly selected book preview',async t=>{
  const ui=dialogDom(t),[red,blue]=books(),original=red.renderPage;let release;red.renderPage=async()=>{await new Promise(resolve=>{release=resolve;});return original();};let selected;
  const opening=openSourceDialog({books:[red,blue]},{onConfirm:value=>{selected=value;}});await settle();
  const selector=ui.label('Source book');assert.ok(selector);selector.value='blue';await selector.onchange();ui.load();
  const image=ui.get('source-stage').querySelector('img');assert.ok(image.alt.includes('Blue handbook.pdf'));assert.deepEqual(await pixel(await(await fetch(image.src)).blob()),[0,0,255,255]);
  release();await opening;assert.equal(ui.get('source-stage').querySelector('img'),image);
  ui.button('Include selected crop').onclick();assert.equal(selected.bookId,'blue');
});

test('a concurrent source-dialog open is rejected before changing the original pending book view',async t=>{
  const ui=dialogDom(t),[red,blue]=books(),context={books:[red,blue]},original=red.renderPage;let release,selected,secondSelection,error;
  red.renderPage=async()=>{await new Promise(resolve=>{release=resolve;});return original();};
  const opening=openSourceDialog(context,{bookId:'red',onConfirm:value=>{selected=value;}});await settle();
  try{await openSourceDialog(context,{bookId:'blue',onConfirm:value=>{secondSelection=value;}});}catch(e){error=e;}finally{release();await opening;}
  assert.ok(error,'Opening a second dialog while the first is rendering must reject');assert.match(error.message,/close.*current.*source.*before.*opening.*another/i);
  ui.load();const image=ui.get('source-stage').querySelector('img');assert.ok(image.alt.includes('Red handbook.pdf'));assert.ok(ui.get('source-title').textContent.includes('Red handbook.pdf'));
  assert.deepEqual(await pixel(await(await fetch(image.src)).blob()),[255,0,0,255]);ui.button('Include selected crop').onclick();assert.equal(selected.bookId,'red');assert.equal(secondSelection,undefined);
});

test('choosing a removed book prevents an older pending preview from re-enabling inclusion',async t=>{
  const ui=dialogDom(t),[red,blue]=books(),context={books:[red,blue]},original=red.renderPage;let release;
  red.renderPage=async()=>{await new Promise(resolve=>{release=resolve;});return original();};
  const opening=openSourceDialog(context,{});await settle();context.books.pop();const selector=ui.label('Source book');selector.value='blue';await selector.onchange();release();await opening;
  assert.equal(ui.get('source-stage').querySelector('img'),undefined);assert.equal(ui.button('Include selected crop').disabled,true);assert.match(ui.get('source-stage').textContent,/source.*(?:not available|no longer|loaded)/i);
});

test('a removed book or cancelled dialog cannot confirm a stale crop',async t=>{
  const ui=dialogDom(t),[,blue]=books(),context={books:[blue]};let selected;
  await openSourceDialog(context,{onConfirm:value=>{selected=value;}});ui.load();context.books.length=0;ui.button('Include selected crop').onclick();
  assert.equal(selected,undefined);assert.equal(ui.button('Include selected crop').disabled,true);assert.match(ui.get('source-stage').textContent,/source.*(?:not available|no longer|loaded)/i);
  ui.get('source-dialog').close();const abort=new AbortController();context.books.push(blue);await openSourceDialog(context,{signal:abort.signal,onConfirm:value=>{selected=value;}});ui.load();abort.abort();ui.button('Include selected crop').onclick();
  assert.equal(selected,undefined);assert.equal(ui.get('source-dialog').open,false);
});
