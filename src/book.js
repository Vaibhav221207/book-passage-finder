import {abortIfNeeded,tick} from './model.js';
import {itemToRun,detectPageLabels,makeSourceSpans} from './layout.js';
let library;
export async function pdfLibrary() {
  if(!library){
    const inNode=typeof window==='undefined';
    library=await (inNode?import('pdfjs-dist/legacy/build/pdf.mjs'):import('../vendor/pdfjs/pdf.mjs'));
    if(!inNode)library.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
  }return library;
}
export async function openBook(file,{signal,onProgress=()=>{},onPassword}={}) {
  abortIfNeeded(signal);
  if(!file||!file.size)throw new Error('The PDF is empty. Choose a readable textbook PDF.');
  const bytes=new Uint8Array(await file.arrayBuffer());abortIfNeeded(signal);
  if(!new TextDecoder().decode(bytes.subarray(0,1024)).includes('%PDF-'))throw new Error('This file is not a valid PDF.');
  const pdfjs=await pdfLibrary();
  let assets;
  if(typeof window!=='undefined')assets={cMapUrl:new URL('../vendor/pdfjs/cmaps/',import.meta.url).href,cMapPacked:true,standardFontDataUrl:new URL('../vendor/pdfjs/standard_fonts/',import.meta.url).href,wasmUrl:new URL('../vendor/pdfjs/wasm/',import.meta.url).href};
  else {const {fileURLToPath}=await import('node:url');assets={standardFontDataUrl:fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/',import.meta.url)).replaceAll('\\','/')};}
  const loading=pdfjs.getDocument({data:bytes,isEvalSupported:false,...assets});
  const stop=()=>{loading.destroy().catch(()=>{});};signal?.addEventListener('abort',stop,{once:true});
  loading.onPassword=async(update,reason)=>{
    const password=await onPassword?.({reason:reason===1?'need-password':'incorrect-password'});
    if(!password){stop();return;}update(password);
  };
  let pdf;
  try{pdf=await loading.promise;abortIfNeeded(signal);}catch(error){signal?.removeEventListener('abort',stop);abortIfNeeded(signal);throw new Error(`Unable to open this PDF. ${error.message}`);}
  const pages=[],missingTextPages=[];const labels=await pdf.getPageLabels();
  try{
    for(let n=1;n<=pdf.numPages;n++){
      abortIfNeeded(signal);const page=await pdf.getPage(n);const viewport=page.getViewport({scale:1});
      const text=await page.getTextContent();abortIfNeeded(signal);
      const runs=text.items.filter(item=>'str'in item).map((item,i)=>itemToRun(item,`${n}-${i}`,viewport));
      if(runs.map(r=>r.text).join('').trim().length<20)missingTextPages.push(n);
      pages.push({ref:{pdfPage:n,printedLabel:labels?.[n-1]??null},runs,width:viewport.width,height:viewport.height,method:'pdf-text'});
      onProgress({completed:n,total:pdf.numPages,phase:'Reading book'});page.cleanup();await tick();
    }
  }catch(error){await loading.destroy();signal?.removeEventListener('abort',stop);throw error;}
  signal?.removeEventListener('abort',stop);detectPageLabels(pages);
  const session={id:crypto.randomUUID(),filename:file.name||'Textbook.pdf',pageCount:pdf.numPages,pages,missingTextPages,spans:makeSourceSpans(pages),
    async renderPage(pdfPage,scale=1.5,renderSignal){
      abortIfNeeded(renderSignal);const p=await pdf.getPage(pdfPage),viewport=p.getViewport({scale});
      let canvas;
      if(typeof document!=='undefined'){canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);}
      else {const {createCanvas}=await import('@napi-rs/canvas');canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));}
      const render=p.render({canvasContext:canvas.getContext('2d'),viewport});const cancel=()=>render.cancel();renderSignal?.addEventListener('abort',cancel,{once:true});
      try{await render.promise;abortIfNeeded(renderSignal);return canvas;}finally{renderSignal?.removeEventListener('abort',cancel);p.cleanup();}
    },
    async dispose(){await loading.destroy();pages.length=0;session.spans.length=0;}
  };return session;
}
