import {pageName} from './model.js';

/** Compact visible citations keep the full provenance in their accessible description. */
export function citationPresentation(source,books=[]){
  const pages=source.pages||[],first=pages[0],bookId=source.bookId||first?.bookId;
  const ordinal=books.findIndex(book=>book.id===bookId)+1;
  const bookLabel=books.length>1&&ordinal>0?`B${ordinal}`:'';
  const pageLabel=first?(first.printedLabel?`p. ${first.printedLabel}`:`PDF p. ${first.pdfPage}`):'Source';
  const label=[`[${source.id}]`,bookLabel,`${pageLabel}${pages.length>1?` +${pages.length-1}`:''}`].filter(Boolean).join(' · ');
  const references=pages.map(page=>pageName({...page,bookName:page.bookName||source.bookName}));
  const description=[`Source ${source.id}`,bookLabel?`Book ${ordinal}`:'',...(references.length?references:[source.bookName||'Source'])].filter(Boolean).join(' · ');
  return {label,description};
}

export function coverageNotes(answer,result){
  return [...new Set([...(answer?.missingDetails||[]),...(result?.coverageNotes||[])].filter(note=>typeof note==='string').map(note=>note.trim()).filter(Boolean))];
}

export function displayCoverageNotes(answer,result,books=[]){
  const generic='Source matches are suggestions. Check that they cover your question.';
  const boilerplate=new Set([generic,...books.map(book=>`${book.filename}: ${generic}`)]);
  return coverageNotes(answer,result).filter(note=>!boilerplate.has(note));
}

const unmeasuredPhases=new Set(['Preparing book search','Finding passages','Making your answer clearer']);

/** Only report a fraction when the operation supplies meaningful measured progress. */
export function progressPresentation(p={}){
  const label=typeof p.phase==='string'&&p.phase.trim()?p.phase.trim():'Getting things ready';
  if(unmeasuredPhases.has(label)||!Number.isFinite(p.total)||p.total<=0||!Number.isFinite(p.completed))return {label,detail:'',total:null,value:null};
  const value=Math.min(p.total,Math.max(0,p.completed));
  return {label,detail:`${value} of ${p.total}`,total:p.total,value};
}
