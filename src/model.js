/** @typedef {{x:number,y:number,width:number,height:number}} Rect */
/** @typedef {{pdfPage:number,printedLabel:string|null}} PageRef */
/** @typedef {{id:string,text:string,bounds:Rect,fontSize?:number}} TextRun */
/** @typedef {{ref:PageRef,runs:TextRun[],width:number,height:number,method:'pdf-text'|'ocr'}} PageData */
/** @typedef {{page:PageRef,ranges:{runId:string,start:number,end:number}[],rects:Rect[],method:'pdf-text'|'ocr'}} SourceSegment */
/** @typedef {{id:string,text:string,segments:SourceSegment[],heading:string,isHeading?:boolean,section?:string}} SourceSpan */
export const abortIfNeeded = signal => { if(signal?.aborted) throw new DOMException('Operation cancelled','AbortError'); };
export const tick = () => new Promise(resolve=>setTimeout(resolve,0));
export function pageName(ref) {return ref.printedLabel ? `Book ${ref.printedLabel} · PDF ${ref.pdfPage}` : `PDF ${ref.pdfPage}`;}
export const wordCount = text => text.trim() ? text.trim().split(/\s+/).length : 0;
