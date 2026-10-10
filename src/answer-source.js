/** A citation opens only the selected quotation with the same source identity. */
export function findAnswerPassage(result,source){
  const pageKey=ref=>`${ref.bookId||source.bookId||''}:${ref.pdfPage}`;
  const wanted=new Set(source.pages.map(pageKey));
  return result.passages.find(p=>{
    if(p.text!==source.text||(p.bookId||p.segments[0]?.page.bookId||'')!==source.bookId)return false;
    const actual=new Set(p.segments.map(s=>pageKey(s.page)));
    return actual.size===wanted.size&&[...wanted].every(key=>actual.has(key));
  })||null;
}
