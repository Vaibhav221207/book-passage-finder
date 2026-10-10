import {abortIfNeeded,pageName} from './model.js';import {unionRects} from './layout.js';
let activeRenders=0;const queue=[];
async function withPage(session,page,scale,signal,fn){
  if(activeRenders>=2)await new Promise(resolve=>queue.push(resolve));activeRenders++;let canvas;
  try{abortIfNeeded(signal);canvas=await session.renderPage(page,scale,signal);return await fn(canvas);}
  finally{if(canvas){canvas.width=1;canvas.height=1;}activeRenders--;queue.shift()?.();}
}
export function pixelBounds(rect,width,height,padding=.006){
  const x=Math.max(0,Math.floor((rect.x-padding)*width)),y=Math.max(0,Math.floor((rect.y-padding)*height));
  const right=Math.min(width,Math.ceil((rect.x+rect.width+padding)*width-1e-8)),bottom=Math.min(height,Math.ceil((rect.y+rect.height+padding)*height-1e-8));
  return {x,y,width:Math.max(1,right-x),height:Math.max(1,bottom-y)};
}
export function groupCropRects(rects){
  const groups=[];for(const rect of rects){const group=groups.find(g=>Math.min(g.x+g.width,rect.x+rect.width)-Math.max(g.x,rect.x)>.02);if(group)Object.assign(group,unionRects([group,rect]));else groups.push({...rect});}return groups;
}
async function cropCanvas(canvas,bounds){
  const b=pixelBounds(bounds,canvas.width,canvas.height);let crop;
  if(typeof document!=='undefined'){crop=document.createElement('canvas');crop.width=b.width;crop.height=b.height;}else{const {createCanvas}=await import('@napi-rs/canvas');crop=createCanvas(b.width,b.height);}
  crop.getContext('2d').drawImage(canvas,b.x,b.y,b.width,b.height,0,0,b.width,b.height);
  try{return typeof crop.toBlob==='function'?await new Promise((resolve,reject)=>crop.toBlob(blob=>blob?resolve(blob):reject(new Error('Unable to make this crop.')),'image/png')):new Blob([crop.toBuffer('image/png')],{type:'image/png'});}
  finally{crop.width=1;crop.height=1;}
}
export async function cropSpan(session,span,{scale=1.6,signal}={}){
  const crops=[];for(const segment of span.segments){await withPage(session,segment.page.pdfPage,scale,signal,async canvas=>{for(const bounds of groupCropRects(segment.rects))crops.push({page:segment.page,blob:await cropCanvas(canvas,bounds)});});}return crops;
}
export async function cropFigure(session,selection,{scale=2,signal}={}){return withPage(session,selection.page.pdfPage,scale,signal,canvas=>cropCanvas(canvas,selection.bounds));}
export async function openSourceDialog(session,{passage,figure,onConfirm}){
  const dialog=document.getElementById('source-dialog'),stage=document.getElementById('source-stage'),toolbar=document.getElementById('source-controls'),controls=document.getElementById('crop-controls');let pdfPage=figure?.page.pdfPage||passage.segments[0].page.pdfPage;
  let bounds=figure?{...figure.bounds}:unionRects(passage.segments[0].rects);let previewUrl,renderId=0;
  const element=(tag,text='')=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const button=(text,fn)=>{const b=element('button',text);b.type='button';b.className='secondary';b.onclick=fn;return b;};
  toolbar.replaceChildren();controls.replaceChildren();stage.replaceChildren();stage.className='source-stage';
  const pageInput=element('input');pageInput.type='number';pageInput.min=1;pageInput.max=session.pageCount;pageInput.value=pdfPage;pageInput.setAttribute('aria-label','Physical PDF page');
  toolbar.className='source-toolbar';toolbar.append(element('span','PDF page'),pageInput,button('Go',()=>{const n=Number(pageInput.value);if(Number.isInteger(n)&&n>=1&&n<=session.pageCount){pdfPage=n;bounds={x:.1,y:.15,width:.8,height:.6};render();}}));
  const label=element('p','Adjust the selection in the original page. Use percentage fields, or drag a new rectangle.');label.className='crop-note';const fields=element('div');fields.className='crop-grid';const inputs={};
  for(const [key,title]of Object.entries({x:'Left %',y:'Top %',width:'Width %',height:'Height %'})){const wrap=element('label',title),input=element('input');input.type='number';input.min=0;input.max=100;input.step=.1;input.value=(bounds[key]*100).toFixed(1);input.oninput=()=>{bounds[key]=Number(input.value)/100;bounds.x=Math.max(0,Math.min(.99,bounds.x));bounds.y=Math.max(0,Math.min(.99,bounds.y));bounds.width=Math.max(.01,Math.min(1-bounds.x,bounds.width));bounds.height=Math.max(.01,Math.min(1-bounds.y,bounds.height));drawBox();};inputs[key]=input;wrap.append(input);fields.append(wrap);}
  function drawBox(){const box=stage.querySelector('.selection-box');if(box)Object.assign(box.style,{left:`${bounds.x*100}%`,top:`${bounds.y*100}%`,width:`${bounds.width*100}%`,height:`${bounds.height*100}%`});}
  function sync(){for(const key of Object.keys(inputs))inputs[key].value=(bounds[key]*100).toFixed(1);drawBox();}
  async function render(){const id=++renderId;stage.textContent='Loading original page…';document.getElementById('source-title').textContent=pageName(session.pages[pdfPage-1].ref);
    const blob=await withPage(session,pdfPage,1.6,null,canvas=>cropCanvas(canvas,{x:0,y:0,width:1,height:1}));if(id!==renderId||!dialog.open)return;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(blob);const image=element('img');image.src=previewUrl;image.alt=`Original ${pageName(session.pages[pdfPage-1].ref)}`;const box=element('div');box.className='selection-box';stage.replaceChildren(image,box);sync();
  }
  let start;stage.onpointerdown=e=>{if(e.target.tagName!=='IMG')return;const r=stage.getBoundingClientRect();start={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};stage.setPointerCapture(e.pointerId);e.preventDefault();};stage.onpointermove=e=>{if(!start)return;const r=stage.getBoundingClientRect(),x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));bounds={x:Math.min(start.x,x),y:Math.min(start.y,y),width:Math.abs(x-start.x),height:Math.abs(y-start.y)};sync();};stage.onpointerup=()=>{start=null;};
  const actions=element('div');actions.className='crop-buttons';actions.append(button('Include this diagram',()=>{onConfirm({page:session.pages[pdfPage-1].ref,bounds:{...bounds},caption:figure?.caption||'Selected source diagram'});dialog.close();}),button('Download PNG',async()=>{const {downloadBlob}=await import('./export.js');const blob=await cropFigure(session,{page:session.pages[pdfPage-1].ref,bounds});downloadBlob(blob,`source-pdf-${pdfPage}.png`);}));controls.append(label,fields,actions);
  dialog.addEventListener('close',()=>{renderId++;if(previewUrl)URL.revokeObjectURL(previewUrl);stage.replaceChildren();},{once:true});dialog.showModal();await render();
}
