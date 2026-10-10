import {abortIfNeeded,pageName,tick,resolveResultReferences} from './model.js';import {cropSpan,cropFigure} from './source-view.js';
let libraries;
async function loadLibraries(){
  if(!libraries)libraries=(async()=>{if(typeof window==='undefined')return {pdf:await import('pdf-lib'),fontkit:(await import('@pdf-lib/fontkit')).default};
    for(const file of ['pdf-lib.min.js','fontkit.umd.min.js'])await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL(`../vendor/${file}`,import.meta.url).href;script.onload=resolve;script.onerror=()=>reject(new Error('Unable to load PDF export. Check your connection and try again.'));document.head.append(script);});
    return {pdf:window.PDFLib,fontkit:window.fontkit};})();
  try{return await libraries;}catch(e){libraries=null;throw e;}
}
async function fontBytes(){const url=new URL('../assets/NotoSans-Regular.ttf',import.meta.url);if(typeof window==='undefined'){return (await import('node:fs/promises')).readFile(url);}const response=await fetch(url);if(!response.ok)throw new Error('Unable to load the export font.');return new Uint8Array(await response.arrayBuffer());}
export async function exportPacket(session,results,{signal,onProgress=()=>{},includeCrops=true}={}){
  abortIfNeeded(signal);const {pdf:lib,fontkit}=await loadLibraries();abortIfNeeded(signal);const pdf=await lib.PDFDocument.create();pdf.registerFontkit(fontkit);const font=await pdf.embedFont(await fontBytes(),{subset:true});abortIfNeeded(signal);
  resolveResultReferences(session,results);
  const supported=new Set(font.getCharacterSet()),width=595.28,height=841.89,margin=40,usable=width-2*margin;let page,y;
  const newPage=()=>{page=pdf.addPage([width,height]);y=height-margin;};newPage();
  function write(raw,size=10,gap=5){
    const text=String(raw||'').replace(/\r/g,'');for(const c of text)if(c!=='\n'&&c!=='\t'&&!supported.has(c.codePointAt(0)))throw new Error('This passage contains characters the export font cannot display. Download the original PNG instead.');
    const rows=[];for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){
      if(font.widthOfTextAtSize(word,size)>usable){if(line){rows.push(line);line='';}let fragment='';for(const c of word){if(font.widthOfTextAtSize(fragment+c,size)>usable){rows.push(fragment);fragment='';}fragment+=c;}line=fragment;continue;}
      if(line&&font.widthOfTextAtSize(`${line} ${word}`,size)>usable){rows.push(line);line=word;}else line+=(line?' ':'')+word;
    }rows.push(line);}
    for(const line of rows){abortIfNeeded(signal);if(y-size<margin+18)newPage();y-=size;page.drawText(line,{x:margin,y,size,font,color:lib.rgb(.12,.15,.14)});y-=size*.45;}y-=gap;
  }
  async function image(blob,label){abortIfNeeded(signal);const png=await pdf.embedPng(await blob.arrayBuffer()),scale=Math.min(usable/png.width,220/png.height),w=png.width*scale,h=png.height*scale;if(y-h-35<margin+18)newPage();write(label,8,3);y-=h;page.drawImage(png,{x:margin,y,width:w,height:h});y-=12;}
  write('Book Passage Finder',18,6);write(session.filename||session.name||'Selected textbook',9,10);
  for(const [i,result]of results.entries()){
    abortIfNeeded(signal);onProgress({phase:'Building PDF',completed:i,total:results.length});write(`Q${i+1}. ${result.question.text}`,12,8);
    write(result.status==='no-match'?'No reliable match in this book.':result.status==='partial'?'Partial matches — check the remaining details in the book.':'Selected source passages',9,8);
    for(const passage of result.passages){write(passage.text);write(passage.segments.map(s=>pageName(s.page)).join(' / '),8,10);}
    for(const note of result.coverageNotes||[])write(note,8,5);
    if(includeCrops&&result.passages.length){write('Original passage crops',11,8);for(const passage of result.passages)for(const crop of await cropSpan(session,passage,{scale:1.5,signal})){await image(crop.blob,pageName(crop.page));await tick();}}
    for(const figure of result.figures||[])if(figure.confirmed)await image(await cropFigure(session,figure,{signal}),`${figure.caption} · ${pageName(figure.page)}`);
    y-=10;await tick();
  }
  for(const [i,p]of pdf.getPages().entries())p.drawText(`${i+1} / ${pdf.getPageCount()}`,{x:margin,y:25,font,size:8,color:lib.rgb(.4,.4,.4)});
  abortIfNeeded(signal);const bytes=await pdf.save();abortIfNeeded(signal);onProgress({phase:'PDF ready',completed:results.length,total:results.length});const blob=new Blob([bytes],{type:'application/pdf'});blob.pageCount=pdf.getPageCount();return blob;
}
export function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
