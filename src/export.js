import {abortIfNeeded,pageName,tick,resolveResultReferences} from './model.js';import {cropSpan,cropFigure} from './source-view.js';
import {bookSources,getBook} from './library.js';
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
  const sources=bookSources(context),nameCounts=new Map();for(const source of sources)nameCounts.set(source.name,(nameCounts.get(source.name)||0)+1);
  const sourceNames=new Map(sources.map((source,i)=>[source.id,nameCounts.get(source.name)>1?`${source.name} [Source ${i+1}]`:source.name]));
  function reference(ref,bookId){const session=getBook(context,ref.bookId??bookId),current=session.pages?.find(p=>p.ref.pdfPage===ref.pdfPage)?.ref||ref;return session.id?{...current,bookId:session.id,bookName:sourceNames.get(session.id)||current.bookName||session.filename||session.name||'Selected textbook'}:current;}
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
    if(!draft)return;const general=draft.mode==='general',extractive=draft.mode==='extractive',sources=new Map();
    if(!general)for(const source of draft.sources||[])sources.set(source.id,{...source,pages:(source.pages||[]).map(ref=>reference(ref,source.bookId))});
    write(extractive?'Answer from your books — Organized textbook sentences':general?'General knowledge (unverified) — generated draft':'Generated explanation draft — verify against the book sources',11,5);
    if(draft.title)write(draft.title,12,6);
    for(const section of draft.sections||[]){const ids=general?[]:(section.sourceIds||[]).filter(id=>sources.has(id));if(section.heading||ids.length)write(`${section.heading||'Explanation'}${ids.length?` [${ids.join(', ')}]`:''}`,10,4);write(section.text,10,8);}
    if(draft.missingDetails?.length){write('Missing details to check',10,4);for(const detail of draft.missingDetails)write(detail,9,5);}
    if(sources.size){write(extractive?'Textbook answer source mappings':'Generated draft source mappings',9,4);for(const source of sources.values())write(`${source.id} · ${source.pages.map(pageName).join(' / ')||source.bookName||'Source page unavailable'}`,8,5);}
    y-=8;
  }
  write('Book Passage Finder',18,6);for(const source of sources)write(sourceNames.get(source.id)||'Selected textbook',9,5);y-=5;
  for(const [i,result]of results.entries()){
    abortIfNeeded(signal);onProgress({phase:'Building PDF',completed:i,total:results.length});if(i>0)newPage();write(`Q${i+1}. ${result.question.text}`,12,8);
    explanation(result.explanation||result.bookAnswer);
    write(result.status==='no-match'?'No reliable match in the loaded books.':result.status==='partial'?'Partial matches — check the remaining details in the books.':'Selected source passages',9,8);
    for(const passage of result.passages||[]){write(passage.text);write(passage.segments.map(s=>pageName(reference(s.page,passage.bookId))).join(' / '),8,10);}
    for(const note of result.coverageNotes||[])write(note,8,5);
    if(includeCrops&&result.passages?.length){write('Original passage crops',11,8);for(const passage of result.passages)for(const crop of await cropSpan(context,passage,{scale:2,signal})){await image(crop.blob,pageName(reference(crop.page,passage.bookId)));await tick();}}
    for(const figure of result.figures||[])if(figure.confirmed)await image(await cropFigure(context,figure,{signal}),`${figure.caption} · ${pageName(reference(figure.page,figure.bookId))}`);
    y-=10;await tick();
  }
  for(const [i,p]of pdf.getPages().entries())p.drawText(`${i+1} / ${pdf.getPageCount()}`,{x:margin,y:25,font,size:8,color:lib.rgb(.4,.4,.4)});
  abortIfNeeded(signal);const bytes=await pdf.save();abortIfNeeded(signal);onProgress({phase:'PDF ready',completed:results.length,total:results.length});const blob=new Blob([bytes],{type:'application/pdf'});blob.pageCount=pdf.getPageCount();return blob;
}
export function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
