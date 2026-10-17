/** Keep local wording, source excerpts and model-generated answers distinct. */
export function answerLabel(answer){
  if(answer?.mode==='general')return 'General AI · unverified';
  if(answer?.mode==='local-rewrite')return 'Locally rephrased';
  return answer?.mode==='extractive'?'Book excerpts':'AI explanation';
}

const cleanBookName=name=>String(name||'Selected textbook').replace(/\.pdf$/i,'').replace(/_/g,' ').replace(/\s+/g,' ').trim()||'Selected textbook';

/** Serialize only the chosen answer, with current source references when a
 * loaded library is supplied. The reversible rewrite audit and review notes
 * stay in the app rather than becoming assignment content. */
export function copyAnswerText(answer,books=[]){
  const sections=(answer?.sections||[]).filter(section=>section.text?.trim());
  if(!sections.length)return '';
  const label=answerLabel(answer),parts=[label],general=answer.mode==='general';
  if(answer.title?.trim()&&answer.title!=='Answer from your books'&&answer.title!==label)parts.push(answer.title.trim());
  const sourceMap=new Map((answer.sources||[]).map(source=>[source.id,source]));
  const catalog=books.length?books.map(book=>({id:book.id,name:cleanBookName(book.filename||book.name),pages:book.pages||[]})):[];
  if(!books.length)for(const source of answer.sources||[])for(const page of source.pages||[]){
    const id=page.bookId??source.bookId??source.bookName??source.id;
    if(!catalog.some(book=>book.id===id))catalog.push({id,name:cleanBookName(page.bookName||source.bookName),pages:[]});
  }
  const used=new Set();
  function citation(source,page){
    const id=page.bookId??source.bookId??(books.length===1?books[0].id:source.bookName??source.id),index=catalog.findIndex(book=>book.id===id),book=catalog[index];
    if(!book)throw new Error('The source book is not available. Choose a loaded book and search again.');
    const current=book.pages.find(candidate=>candidate.ref?.pdfPage===page.pdfPage)?.ref||page;
    if(!Number.isInteger(current.pdfPage)||current.pdfPage<1)throw new Error('An answer citation no longer has a valid source page. Search the books again before copying.');
    used.add(id);
    return `B${index+1} · ${current.printedLabel?`p. ${current.printedLabel} · `:''}PDF ${current.pdfPage}`;
  }
  for(const section of sections){
    const lines=[...(section.heading?.trim()?[section.heading.trim()]:[]),section.text];
    if(!general){
      const references=[];
      for(const id of section.sourceIds||[]){
        const source=sourceMap.get(id);
        if(!source)throw new Error('An answer citation no longer has its source. Search the books again before copying.');
        for(const page of source.pages||[])references.push(citation(source,page));
      }
      if(references.length)lines.push([...new Set(references)].join('; '));
    }
    parts.push(lines.join('\n'));
  }
  if(!general&&used.size)parts.push(['References',...catalog.flatMap((book,index)=>used.has(book.id)?[`B${index+1} · ${book.name}`]:[])].join('\n'));
  return parts.join('\n\n');
}
