import {wordCount} from './model.js';
const stop=new Set('a an the and or of to in on at by for with from is are be was were what why how when which who discuss describe explain give state write list compare according per as using used use given answer question show graph graphs diagram diagrams figure figures method methods test tests measure measuring measurement measurements standard standards astm indian british'.split(' '));
const forms={measured:'measure',measures:'measure',measuring:'measure',measurement:'measure',measurements:'measure',workabilities:'workability',compacted:'compact',compacting:'compact',compaction:'compact',densities:'density'};
export function tokens(text){return (text.toLowerCase().match(/[a-z][a-z0-9]+|\d{3,4}/g)||[]).map(t=>forms[t]|| (t.length>4&&t.endsWith('s')?t.slice(0,-1):t));}
const meaningful=text=>tokens(text).filter(t=>!stop.has(t));
export function buildIndex(spans){
  const df=new Map();const docs=spans.map(span=>{
    const terms=tokens(span.text),heading=meaningful(span.heading||'');const tf=new Map();
    for(const t of terms)tf.set(t,(tf.get(t)||0)+1);
    for(const t of new Set([...terms,...heading]))df.set(t,(df.get(t)||0)+1);
    return {span,tf,heading:new Set(heading),length:Math.max(terms.length,1)};
  });
  return {docs,df,average:docs.reduce((s,d)=>s+d.length,0)/Math.max(docs.length,1)};
}
function sentenceWindows(text){
  const protectedText=text.replace(/\b(Fig|Figs|No|Dr|Mr|Mrs|e\.g|i\.e|cm|mm)\./gi,m=>m.slice(0,-1)+'\u0001');
  const parts=[];const re=/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g;let m;
  while((m=re.exec(protectedText))){const raw=text.slice(m.index,m.index+m[0].length),trim=raw.trim();if(trim)parts.push({text:trim,start:m.index+raw.indexOf(trim),end:m.index+raw.indexOf(trim)+trim.length});}
  return parts.length?parts:[{text:text.trim(),start:text.indexOf(text.trim()),end:text.trimEnd().length}];
}
function chooseWindow(span,budget,query){
  if(wordCount(span.text)<=budget)return {...span,originId:span.id,selectedOffsets:{start:0,end:span.text.length}};
  const windows=sentenceWindows(span.text).filter(w=>wordCount(w.text)<=budget&&/[.!?]$/.test(w.text));
  if(!windows.length)return null;
  windows.sort((a,b)=>meaningful(b.text).filter(t=>query.has(t)).length-meaningful(a.text).filter(t=>query.has(t)).length||a.start-b.start);
  const first=windows[0];let end=first.end;
  for(const next of sentenceWindows(span.text).filter(w=>w.start>=end)){
    if(wordCount(span.text.slice(first.start,next.end))>budget)break;end=next.end;
  }
  const selected={...span,id:`${span.id}:${first.start}:${end}`,originId:span.id,text:span.text.slice(first.start,end),selectedOffsets:{start:first.start,end}};
  // A selected-offset interval references the canonical source span. Geometry
  // stays broad enough to retain all supporting pixels and nearby context.
  return selected;
}
export function searchQuestion(index,question,{wordBudget=200}={}){
  const core=[...new Set(meaningful(question.text))];const all=[...new Set(tokens(question.text))];
  const result={question,passages:[],figures:[],status:'no-match',coverageNotes:[]};
  if(!core.length){result.coverageNotes.push('Add the textbook topic to this question.');return result;}
  const known=core.filter(t=>index.df.has(t)),unknown=core.filter(t=>!index.df.has(t));
  if(!known.length){result.coverageNotes.push('No reliable passage found for this topic.');return result;}
  const N=index.docs.length,idf=t=>Math.log(1+(N-(index.df.get(t)||0)+.5)/((index.df.get(t)||0)+.5));
  const query=new Set(known);const score=doc=>known.reduce((s,t)=>{
    const f=doc.tf.get(t)||0;return s+idf(t)*(f*2.2/(f+1.2*(.25+.75*doc.length/index.average))+(doc.heading.has(t)?1.7:0));
  },0);
  const ranked=index.docs.map(d=>({...d,score:score(d)})).filter(d=>d.score>0).sort((a,b)=>b.score-a.score);
  if(!ranked.length)return result;
  const broad=/\b(methods|tests|ways|types|measuring|measurement|discuss)\b/i.test(question.text);
  const anchor=ranked.find(d=>known.some(t=>d.heading.has(t))&&/measurement|methods|types|classification/i.test(d.span.heading))||ranked[0];
  const anchorPage=anchor.span.segments[0].page.pdfPage;
  let candidates=ranked.filter(d=>!d.span.isHeading&&!/^fig(?:ure)?\.?\s*\d/i.test(d.span.text));
  if(broad){
    const overview=index.docs.filter(d=>!d.span.isHeading&&d.span.heading===anchor.span.heading&&Math.abs(d.span.segments[0].page.pdfPage-anchorPage)<=2);
    const vocabulary=new Set(overview.flatMap(d=>meaningful(d.span.text)));
    const expanded=index.docs.filter(d=>!d.span.isHeading&&Math.abs(d.span.segments[0].page.pdfPage-anchorPage)<=14&&[...d.heading].some(t=>vocabulary.has(t)&&!query.has(t)));
    const merged=new Map([...candidates,...expanded.map(d=>({...d,score:score(d)+anchor.score*.12}))].map(d=>[d.span.id,d]));
    candidates=[...merged.values()].sort((a,b)=>b.score-a.score);
  }
  // Topic qualifiers are retrieved too, but cannot replace the topic itself.
  const qualifiers=all.filter(t=>stop.has(t)&&['astm','indian','standard','standards','british'].includes(t));
  const qualifierDocs=index.docs.filter(d=>!d.span.isHeading&&Math.abs(d.span.segments[0].page.pdfPage-anchorPage)<=14&&qualifiers.some(t=>d.tf.has(t)));
  const pool=[...candidates.slice(0,70),...qualifierDocs];const selected=new Set(),headings=new Set();let used=0;
  for(let round=0;round<6&&used<wordBudget;round++){
    let best=null,bestValue=-Infinity;
    for(const doc of pool){
      if(selected.has(doc.span.id))continue;
      const distance=Math.abs(doc.span.segments[0].page.pdfPage-anchorPage);
      if(broad&&distance>14)continue;
      const novelty=headings.has(doc.span.heading)? .25:1;
      const near=1/(1+distance*.04);
      const qualifierBoost=round>0&&qualifiers.length&&qualifiers.some(t=>doc.tf.has(t))&&!result.passages.some(p=>qualifiers.some(t=>tokens(p.text).includes(t)))?anchor.score*.25:0;
      const value=(doc.score||score(doc))*novelty*near+qualifierBoost;
      if(value>bestValue){best=doc;bestValue=value;}
    }
    if(!best)break;selected.add(best.span.id);
    const remaining=wordBudget-used;const allowance=broad?Math.min(remaining,round===0?55:38):Math.min(remaining,round===0?120:80);
    const passage=chooseWindow(best.span,allowance,query);
    if(!passage)continue;
    if(result.passages.some(p=>p.text===passage.text))continue;
    result.passages.push(passage);used+=wordCount(passage.text);headings.add(best.span.heading);
  }
  if(!result.passages.length){result.coverageNotes.push('Matches were found, but no complete short passage fits. Try a more specific question or view a source page.');return result;}
  const found=new Set(result.passages.flatMap(p=>tokens(p.text+' '+p.heading)));
  const uncovered=known.filter(t=>!found.has(t));
  result.status=unknown.length||uncovered.length||qualifiers.some(t=>!found.has(t))?'partial':'matches';
  if(unknown.length)result.coverageNotes.push(`Not found in this book: ${unknown.slice(0,6).join(', ')}.`);
  if(uncovered.length)result.coverageNotes.push(`Short selections may not cover: ${uncovered.slice(0,6).join(', ')}.`);
  if(qualifiers.some(t=>!found.has(t)))result.coverageNotes.push('The selected passages do not establish every requested standard.');
  result.coverageNotes.push('Source matches are suggestions. Check that they cover your question.');
  return result;
}
export function expandPassage(index,passage){return index.docs.find(d=>d.span.id===passage.originId||d.span.id===passage.id)?.span||passage;}
