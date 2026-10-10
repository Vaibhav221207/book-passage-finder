/** @typedef {{x:number,y:number,width:number,height:number}} Rect */
/** @typedef {{bookId?:string,bookName?:string,pdfPage:number,printedLabel:string|null}} PageRef */
/** @typedef {{id:string,text:string,bounds:Rect,fontSize?:number}} TextRun */
/** @typedef {{ref:PageRef,runs:TextRun[],width:number,height:number,method:'pdf-text'|'ocr'}} PageData */
/** @typedef {{page:PageRef,ranges:{runId:string,start:number,end:number}[],rects:Rect[],method:'pdf-text'|'ocr'}} SourceSegment */
/** @typedef {{id:string,bookId?:string,bookName?:string,text:string,segments:SourceSegment[],heading:string,isHeading?:boolean,section?:string}} SourceSpan */
export const abortIfNeeded = signal => { if(signal?.aborted) throw new DOMException('Operation cancelled','AbortError'); };
export const tick = () => new Promise(resolve=>setTimeout(resolve,0));
export function pageName(ref) {return `${ref.bookName?`${ref.bookName} · `:''}${ref.printedLabel ? `Book ${ref.printedLabel} · PDF ${ref.pdfPage}` : `PDF ${ref.pdfPage}`}`;}
export const wordCount = text => text.trim() ? text.trim().split(/\s+/).length : 0;
export function resolveResultReferences(context,results){
  const books=Array.isArray(context)?context:context?.books||[context];
  const refs=new Map(books.filter(Boolean).map(book=>[book.id,new Map((book.pages||[]).map(page=>[page.ref.pdfPage,page.ref]))]));
  const resolve=(page,bookId)=>{
    const id=page.bookId||bookId;
    if(id)return refs.get(id)?.get(page.pdfPage)||page;
    if(books.length!==1)return page;
    return refs.get(books[0]?.id)?.get(page.pdfPage)||page;
  };
  for(const result of results){
    for(const passage of result.passages||[])for(const segment of passage.segments||[])segment.page=resolve(segment.page,passage.bookId);
    for(const figure of result.figures||[])figure.page=resolve(figure.page,figure.bookId);
    for(const source of result.explanation?.sources||[])source.pages=(source.pages||[]).map(page=>resolve(page,source.bookId));
  }
  return results;
}
