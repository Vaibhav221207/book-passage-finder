import {buildIndex,searchQuestion} from './search.js';
import {wordCount} from './model.js';

const booksIn=context=>(Array.isArray(context)?context:context?.books||[context]).filter(Boolean);
const bookName=book=>book.filename||book.name||'Selected textbook';
export function getBook(context,bookId){
  const books=booksIn(context),book=bookId?books.find(candidate=>candidate.id===bookId):books.length===1?books[0]:null;
  if(!book)throw new Error('The source book is not available. Choose a loaded book and search again.');
  return book;
}
export function bookSources(context){return booksIn(context).map(book=>({id:book.id,name:bookName(book),pageCount:book.pageCount}));}
function sourceSpan(span,book){
  const prefix=`${book.id}:`,namespace=id=>id.startsWith(prefix)?id:prefix+id;
  return {...span,id:namespace(span.id),...(span.originId?{originId:namespace(span.originId)}:{}),bookId:book.id,bookName:bookName(book),
    segments:span.segments.map(segment=>({...segment,page:{...segment.page,bookId:book.id,bookName:bookName(book)}}))};
}
export function indexBooks(books){
  const ids=new Set();
  return books.map(book=>{
    if(!book.id||ids.has(book.id))throw new Error('Each loaded book must have a unique identity.');ids.add(book.id);
    return {id:book.id,name:bookName(book),index:buildIndex((book.spans||[]).map(span=>sourceSpan(span,book)))};
  });
}
export function searchLibrary(indexes,question,{wordBudget=300,...options}={}){
  if(!Number.isFinite(wordBudget)||wordBudget<1)throw new Error('Choose a positive passage word budget.');
  const searched=indexes.map(book=>({...book,result:searchQuestion(book.index,question,{...options,wordBudget})}));
  const availableWords=searched.reduce((sum,book)=>sum+book.result.passages.reduce((words,passage)=>words+wordCount(passage.text),0),0);
  const matched=searched.filter(book=>book.result.passages.length);
  if(matched.length>1){
    const allowance=Math.max(1,Math.floor(wordBudget/matched.length));
    for(const book of matched){const balanced=searchQuestion(book.index,question,{...options,wordBudget:allowance});if(balanced.passages.length)book.result=balanced;}
  }
  const result={question,passages:[],figures:[],status:'no-match',coverageNotes:[],bookSummaries:searched.map(book=>({id:book.id,name:book.name,status:book.result.status,coverage:[...book.result.coverageNotes]}))};
  let used=0;
  const rounds=Math.max(0,...searched.map(book=>book.result.passages.length));
  for(let round=0;round<rounds;round++)for(const book of searched){
    const passage=book.result.passages[round];if(!passage)continue;
    const count=wordCount(passage.text);if(used+count>wordBudget)continue;
    result.passages.push(passage);used+=count;
  }
  if(result.passages.length){
    const selectedBooks=searched.filter(book=>result.passages.some(passage=>passage.bookId===book.id));
    result.status=selectedBooks.some(book=>book.result.status==='matches')?'matches':'partial';
    for(const book of selectedBooks)for(const note of book.result.coverageNotes){const labelled=searched.length>1?`${book.name}: ${note}`:note;if(!result.coverageNotes.includes(labelled))result.coverageNotes.push(labelled);}
    if(availableWords>used){result.status='partial';result.coverageNotes.push('Some source matches exceed the selected word budget. Expand a passage or choose a longer answer.');}
  }else result.coverageNotes.push('No reliable source passage was found in the loaded books. Try another topic or add another book.');
  return result;
}
