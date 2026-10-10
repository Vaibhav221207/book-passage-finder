import {abortIfNeeded,tick} from './model.js';
let loader;
export async function loadOcr(){
  if(typeof document==='undefined')throw new Error('OCR requires a browser.');
  if(globalThis.Tesseract)return globalThis.Tesseract;
  if(!loader)loader=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=new URL('../vendor/tesseract/tesseract.min.js',import.meta.url).href;
    script.onload=()=>resolve(globalThis.Tesseract);script.onerror=()=>{loader=null;script.remove();reject(new Error('OCR assets could not load. Text PDFs still work.'));};document.head.append(script);
  });return loader;
}
export function ocrDataToPage(data,width,height,ref){
  const words=(data.blocks||[]).flatMap(b=>b.paragraphs||[]).flatMap(p=>p.lines||[]).flatMap(l=>l.words||[]);
  const runs=words.filter(w=>w.text?.trim()&&w.bbox).map((w,i)=>({id:`ocr-${ref.pdfPage}-${i}`,text:w.text,bounds:{x:w.bbox.x0/width,y:w.bbox.y0/height,width:(w.bbox.x1-w.bbox.x0)/width,height:(w.bbox.y1-w.bbox.y0)/height},fontSize:(w.bbox.y1-w.bbox.y0)*.5}));
  return {ref,runs,width,height,method:'ocr'};
}
async function startWorker(signal,onProgress){
  abortIfNeeded(signal);const tesseract=await loadOcr();abortIfNeeded(signal);
  const work=tesseract.createWorker('eng',1,{workerPath:new URL('../vendor/tesseract/worker.min.js',import.meta.url).href,corePath:new URL('../vendor/tesseract-core/',import.meta.url).href,
    langPath:'https://tessdata.projectnaptha.com/4.0.0',logger:p=>onProgress?.({completed:Math.round((p.progress||0)*100),total:100,phase:p.status||'Loading OCR'})});
  const abort=new Promise((_,reject)=>{signal?.addEventListener('abort',()=>reject(new DOMException('OCR cancelled','AbortError')),{once:true});});
  work.then(w=>{if(signal?.aborted)w.terminate();}).catch(()=>{});
  try{return await Promise.race([work,abort]);}catch(e){if(signal?.aborted)throw new DOMException('OCR cancelled','AbortError');throw new Error(`OCR could not start. Check your connection for the English language download. ${e.message}`);}
}
export async function ocrPages(session,pageNumbers,{signal,onProgress=()=>{}}={}){
  abortIfNeeded(signal);const worker=await startWorker(signal,onProgress),stop=()=>worker.terminate();signal?.addEventListener('abort',stop,{once:true});const pages=[];
  try{
    for(const pdfPage of pageNumbers){abortIfNeeded(signal);const canvas=await session.renderPage(pdfPage,2,signal);
      try{const {data}=await worker.recognize(canvas,{}, {text:true,blocks:true});abortIfNeeded(signal);
        const ref=session.pages[pdfPage-1].ref;const page=ocrDataToPage(data,canvas.width,canvas.height,ref);pages.push(page);
      }finally{canvas.width=1;canvas.height=1;}
      onProgress({completed:pages.length,total:pageNumbers.length,phase:'Recognizing selected pages'});await tick();
    }return pages;
  }catch(e){abortIfNeeded(signal);throw new Error(`OCR failed. ${e.message}`);}finally{signal?.removeEventListener('abort',stop);await worker.terminate();}
}
export async function ocrImage(file,{signal,onProgress=()=>{}}={}){
  abortIfNeeded(signal);const image=await createImageBitmap(file);const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);image.close();
  const worker=await startWorker(signal,onProgress),stop=()=>worker.terminate();signal?.addEventListener('abort',stop,{once:true});
  try{const {data}=await worker.recognize(canvas,{}, {text:true,blocks:true});abortIfNeeded(signal);if(!data.text?.trim())throw new Error('No readable text was found in this image.');return data.text;}
  finally{signal?.removeEventListener('abort',stop);await worker.terminate();canvas.width=1;canvas.height=1;}
}
