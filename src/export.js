import {abortIfNeeded,tick,resolveResultReferences} from './model.js';import {cropSpan,cropFigure} from './source-view.js';
import {bookSources,getBook} from './library.js';
import {answerLabel} from './answer-output.js';
let libraries;
async function loadLibraries(){
  if(!libraries)libraries=(async()=>{if(typeof window==='undefined')return {pdf:await import('pdf-lib'),fontkit:(await import('@pdf-lib/fontkit')).default};
    for(const file of ['pdf-lib.min.js','fontkit.umd.min.js'])await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL(`../vendor/${file}`,import.meta.url).href;script.onload=resolve;script.onerror=()=>reject(new Error('Unable to load PDF export. Check your connection and try again.'));document.head.append(script);});
    return {pdf:window.PDFLib,fontkit:window.fontkit};})();
  try{return await libraries;}catch(e){libraries=null;throw e;}
}
async function fontBytes(){const url=new URL('../assets/NotoSans-Regular.ttf',import.meta.url);if(typeof window==='undefined'){return (await import('node:fs/promises')).readFile(url);}const response=await fetch(url);if(!response.ok)throw new Error('Unable to load the export font.');return new Uint8Array(await response.arrayBuffer());}
export async function exportPacket(context,results,{signal,onProgress=()=>{},includeCrops=true}={}){
  abortIfNeeded(signal);const {pdf:lib,fontkit}=await loadLibraries();abortIfNeeded(signal);const pdf=await lib.PDFDocument.create();pdf.registerFontkit(fontkit);const font=await pdf.embedFont(await fontBytes(),{subset:true});abortIfNeeded(signal);
  resolveResultReferences(context,results);
  const sources=bookSources(context),usedBooks=new Set();
  const sourceNames=new Map(sources.map((source,i)=>[source.id,{label:`B${i+1}`,name:source.name.replace(/\.pdf$/i,'').replace(/_/g,' ').replace(/\s+/g,' ').trim()||'Selected textbook'}]));
  function reference(ref,bookId){const session=getBook(context,ref.bookId??bookId),current=session.pages?.find(p=>p.ref.pdfPage===ref.pdfPage)?.ref||ref;return {...current,bookId:session.id};}
  function citation(ref,bookId){
    const current=reference(ref,bookId),source=sourceNames.get(current.bookId);usedBooks.add(current.bookId);
    return `${source.label} · ${current.printedLabel?`p. ${current.printedLabel} · `:''}PDF ${current.pdfPage}`;
  }
  function citations(refs){return [...new Set(refs.map(({page,bookId})=>citation(page,bookId)))].join('; ');}
  const supported=new Set(font.getCharacterSet()),width=595.28,height=841.89,margin=40,usable=width-2*margin;let page,y;
  const newPage=()=>{page=pdf.addPage([width,height]);y=height-margin;};newPage();
  function rowsOf(raw,size){
    const text=String(raw||'').replace(/\r/g,'');for(const c of text)if(c!=='\n'&&c!=='\t'&&!supported.has(c.codePointAt(0)))throw new Error('This passage contains characters the export font cannot display. Download the original PNG instead.');
    const rows=[];for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){
      if(font.widthOfTextAtSize(word,size)>usable){if(line){rows.push(line);line='';}let fragment='';for(const c of word){if(font.widthOfTextAtSize(fragment+c,size)>usable){rows.push(fragment);fragment='';}fragment+=c;}line=fragment;continue;}
      if(line&&font.widthOfTextAtSize(`${line} ${word}`,size)>usable){rows.push(line);line=word;}else line+=(line?' ':'')+word;
    }rows.push(line);}
    return rows;
  }
  function write(raw,size=10,gap=5){for(const line of rowsOf(raw,size)){abortIfNeeded(signal);if(y-size<margin+18)newPage();y-=size;page.drawText(line,{x:margin,y,size,font,color:lib.rgb(.12,.15,.14)});y-=size*.45;}y-=gap;}
  async function image(blob,label){
    abortIfNeeded(signal);const png=await pdf.embedPng(await blob.arrayBuffer()),labelHeight=rowsOf(label,8).length*8*1.45+3;
    const maxHeight=Math.max(1,Math.min(height-2*margin-70,height-2*margin-18-labelHeight-12)),scale=Math.min(usable/png.width,maxHeight/png.height),w=png.width*scale,h=png.height*scale;
    if(y-h-labelHeight<margin+18)newPage();write(label,8,3);y-=h;page.drawImage(png,{x:margin,y,width:w,height:h});y-=12;
  }
  function explanation(draft){
    const general=draft.mode==='general',sourceMap=new Map((draft.sources||[]).map(source=>[source.id,source]));
    if(general)write('General AI answer (unverified)',9,6);
    else if(draft.mode!=='extractive')write(answerLabel(draft),9,6);
    for(const section of draft.sections||[]){
      if(!section.text?.trim())continue;
      if(section.heading)write(section.heading,11,5);write(section.text,11,6);
      if(!general){
        const refs=[];
        for(const id of section.sourceIds||[]){const source=sourceMap.get(id);if(!source)throw new Error('An answer citation no longer has its source. Search the books again before exporting.');for(const page of source.pages||[])refs.push({page,bookId:source.bookId});}
        if(refs.length)write(citations(refs),8,8);
      }
    }
    y-=8;
  }
  write('Book Passage Finder',18,6);y-=5;
  for(const [i,result]of results.entries()){
    abortIfNeeded(signal);onProgress({phase:'Building PDF',completed:i,total:results.length});if(i>0)newPage();write(`Q${i+1}. ${result.question.text}`,12,8);
    const passages=result.passages||[],draft=result.explanation||result.bookAnswer,hasDraft=draft?.sections?.some(section=>section.text?.trim());
    // Validate selected evidence even when its prose is replaced by the chosen answer.
    for(const passage of passages)for(const segment of passage.segments||[])reference(segment.page,passage.bookId);
    if(hasDraft)explanation(draft);
    else if(passages.length)for(const passage of passages){write(passage.text,11,6);write(citations((passage.segments||[]).map(segment=>({page:segment.page,bookId:passage.bookId}))),8,10);}
    else write('No answer found in the selected books.',10,8);
    // Review diagnostics belong in the app; the packet contains the chosen answer and images.
    if(includeCrops)for(const passage of passages)for(const crop of await cropSpan(context,passage,{scale:2,signal})){await image(crop.blob,citation(crop.page,passage.bookId));await tick();}
    for(const figure of result.figures||[])if(figure.confirmed)await image(await cropFigure(context,figure,{signal}),`${figure.caption} · ${citation(figure.page,figure.bookId)}`);
    y-=10;await tick();
  }
  if(usedBooks.size){
    const names=sources.filter(source=>usedBooks.has(source.id)).map(source=>sourceNames.get(source.id));
    const first=`${names[0].label} · ${names[0].name}`,required=11*1.45+6+rowsOf(first,9).length*9*1.45+5;
    if(y-required<margin+18)newPage();
    write('References',11,6);for(const name of names)write(`${name.label} · ${name.name}`,9,5);
  }
  for(const [i,p]of pdf.getPages().entries())p.drawText(`${i+1} / ${pdf.getPageCount()}`,{x:margin,y:25,font,size:8,color:lib.rgb(.4,.4,.4)});
  abortIfNeeded(signal);const bytes=await pdf.save();abortIfNeeded(signal);onProgress({phase:'PDF ready',completed:results.length,total:results.length});const blob=new Blob([bytes],{type:'application/pdf'});blob.pageCount=pdf.getPageCount();return blob;
}
export function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
