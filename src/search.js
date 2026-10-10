import {wordCount} from './model.js';
const stop=new Set('a an the and or of to in on at by for with from is are be was were what why how when which who discuss describe explain give state write list compare according per as using used use given answer question show graph graphs diagram diagrams figure figures method methods test tests measure measuring measurement measurements standard standards astm indian british'.split(' '));
const forms={measured:'measure',measures:'measure',measuring:'measure',measurement:'measure',measurements:'measure',workabilities:'workability',compacted:'compact',compacting:'compact',compaction:'compact',densities:'density'};
for(const term of 'book textbook this that it they them we you he she do does did has have had can could should would will shall must into about such also some any other all its their these those two three each both needed relevant explanation described including include report reports reports determining determine laboratory chapter edition distinguish definition define identify introduced changes change approved procedure only same amount achieved obtain records recorded compares compare advantages limitations forms form give shown difference differences differ relating relation degree suitable'.split(' '))stop.add(term);
export function tokens(text){return (text.toLowerCase().match(/[a-z][a-z0-9]+|\d{3,4}/g)||[]).map(t=>forms[t]|| (t.length>4&&t.endsWith('s')&&!t.endsWith('ss')?t.slice(0,-1):t));}
const meaningful=text=>tokens(text).filter(t=>!stop.has(t));
export function buildIndex(spans){
  const df=new Map();const headingTerms=new Set();const docs=spans.map(span=>{
    const embedded=span.text.match(/^([A-Z][A-Za-z -]{2,45}(?:Test|Method|Apparatus))\s+(?:The|This|A|An)\b/);
    const terms=tokens(span.text),heading=meaningful(embedded?.[1]||span.heading||'');const tf=new Map();if(span.isHeading||embedded)for(const t of heading)headingTerms.add(t);
    for(const t of terms)tf.set(t,(tf.get(t)||0)+1);
    for(const t of new Set([...terms,...heading]))df.set(t,(df.get(t)||0)+1);
    return {span,tf,heading:new Set(heading),headingPhrase:` ${heading.join(' ')} `,phraseText:` ${meaningful(span.text).join(' ')} `,length:Math.max(terms.length,1)};
  });
  return {docs,df,headingTerms,average:docs.reduce((s,d)=>s+d.length,0)/Math.max(docs.length,1)};
}
function sentenceWindows(text){
  const protectedText=text.replace(/\b(Fig|Figs|No|Dr|Mr|Mrs|e\.g|i\.e|cm|mm)\./gi,m=>m.slice(0,-1)+'\u0001');
  const parts=[];const re=/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g;let m;
  while((m=re.exec(protectedText))){const raw=text.slice(m.index,m.index+m[0].length),trim=raw.trim();if(trim)parts.push({text:trim,start:m.index+raw.indexOf(trim),end:m.index+raw.indexOf(trim)+trim.length});}
  return parts.length?parts:[{text:text.trim(),start:text.indexOf(text.trim()),end:text.trimEnd().length}];
}
function chooseWindow(span,budget,query,preferLead=false){
  if(wordCount(span.text)>=5&&wordCount(span.text)<=budget&&/[.!?]$/.test(span.text)&&/^[A-Z“"(]/.test(span.text))return {...span,originId:span.id,selectedOffsets:{start:0,end:span.text.length}};
  const windows=sentenceWindows(span.text).filter(w=>wordCount(w.text)>=5&&wordCount(w.text)<=budget&&/[.!?]$/.test(w.text)&&/^[A-Z“"(]/.test(w.text));
  if(!windows.length)return null;
  windows.sort((a,b)=>(preferLead?0:meaningful(b.text).filter(t=>query.has(t)).length-meaningful(a.text).filter(t=>query.has(t)).length)||a.start-b.start);
  const first=windows[0];let end=first.end;
  for(const next of sentenceWindows(span.text).filter(w=>w.start>=end)){
    if(!/[.!?]$/.test(next.text)||wordCount(span.text.slice(first.start,next.end))>budget)break;end=next.end;
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
  if(!known.length||unknown.includes(core[0])||unknown.some(t=>/^\d{4}$/.test(t))||(unknown.length&&/\b(only|without|approved)\b/i.test(question.text))||(unknown.length>=known.length&&known.length<=1)){result.coverageNotes.push('No reliable passage found for this topic or requested edition.');return result;}
  const N=index.docs.length,idf=t=>Math.log(1+(N-(index.df.get(t)||0)+.5)/((index.df.get(t)||0)+.5));
  const query=new Set(known),pairs=core.slice(0,-1).map((t,i)=>[t,core[i+1]]);const score=doc=>known.reduce((s,t,i)=>{
    const f=doc.tf.get(t)||0;return s+idf(t)*(i<2?1.4:1)*(f*2.2/(f+1.2*(.25+.75*doc.length/index.average))+(doc.heading.has(t)?1.7:0));
  },0)+pairs.reduce((s,[a,b],i)=>{const phrase=` ${a} ${b} `;return s+(doc.headingPhrase.includes(phrase)?4:doc.phraseText.includes(phrase)?2:0)*(idf(a)+idf(b))*(i===0?1.5:1);},0);
  const ranked=index.docs.map(d=>({...d,score:score(d)})).filter(d=>d.score>0).sort((a,b)=>b.score-a.score);
  if(!ranked.length)return result;
  let broad=/\b(methods|tests|ways|types|discuss)\b/i.test(question.text);
  const hasProse=d=>!d.span.isHeading&&wordCount(d.span.text)>=8&&/[.!?]/.test(d.span.text);
  const narrativeNear=d=>index.docs.some(n=>hasProse(n)&&n.span.heading===d.span.heading&&Math.abs(n.span.segments[0].page.pdfPage-d.span.segments[0].page.pdfPage)<=1);
  const strongest=ranked.find(d=>hasProse(d)||narrativeNear(d));
  const primary=known.find(t=>index.headingTerms.has(t)&&(index.df.get(t)||0)<N*.07)||known[0],firstPair=` ${core.slice(0,2).join(' ')} `;
  const qualifiers=all.filter(t=>['astm','indian','standard','standards','british'].includes(t));
  const primaryDocs=ranked.filter(d=>hasProse(d)&&d.heading.has(primary));
  const qualified=qualifiers.length?primaryDocs.find(d=>index.docs.some(n=>Math.abs(n.span.segments[0].page.pdfPage-d.span.segments[0].page.pdfPage)<=2&&qualifiers.some(t=>n.tf.has(t)))):null;
  const anchor=(broad?ranked.find(d=>d.score>=(strongest?.score??Infinity)*.7&&d.heading.has(primary)&&/measurement|methods|types|classification/i.test(d.span.heading)&&narrativeNear(d)):null)||qualified||primaryDocs[0]||ranked.find(d=>hasProse(d)&&d.tf.has(primary)&&d.phraseText.includes(firstPair))||ranked.find(d=>hasProse(d)&&d.tf.has(primary));
  if(!anchor){result.coverageNotes.push('Only headings or fragments matched. Try a more specific topic.');return result;}
  const anchorPage=anchor.span.segments[0].page.pdfPage;
  const topicOverview=index.docs.filter(d=>!d.span.isHeading&&d.span.heading===anchor.span.heading&&Math.abs(d.span.segments[0].page.pdfPage-anchorPage)<=2);
  broad=broad&&topicOverview.some(d=>/^\s*\(?\s*(?:[a-z]|\d+)\s*\)/i.test(d.span.text)||/following.*(?:methods|tests)|(?:tested|measured|determined).*?(?:ways|methods)|(?:several|different|various).*?(?:methods|tests)/i.test(d.span.text));
  const lead=index.docs.find(d=>hasProse(d)&&d.span.heading===anchor.span.heading&&Math.abs(d.span.segments[0].page.pdfPage-anchorPage)<=2);
  let candidates=ranked.filter(d=>!d.span.isHeading&&!/^fig(?:ure)?\.?\s*\d/i.test(d.span.text)&&Math.abs(d.span.segments[0].page.pdfPage-anchorPage)<=14);
  if(broad){
    const overview=index.docs.filter(d=>!d.span.isHeading&&d.span.heading===anchor.span.heading&&Math.abs(d.span.segments[0].page.pdfPage-anchorPage)<=2);
    const enumeration=overview.filter(d=>/^\s*\(?\s*(?:[a-z]|\d+|[ivx]+)\s*\)/i.test(d.span.text));
    const methodLabels=enumeration.map(d=>d.span.text.replace(/^\s*\(?\s*(?:[a-z]|\d+|[ivx]+)\s*\)\s*/i,'').replace(/[.]$/,'').toLowerCase().replace(/\s+/g,' ').trim());
    const vocabulary=new Set((enumeration.length?enumeration:overview).flatMap(d=>meaningful(d.span.text)).filter(t=>!query.has(t)));
    const anchorPosition=index.docs.findIndex(d=>d.span.id===anchor.span.id);
    const expanded=index.docs.filter((d,i)=>i>=anchorPosition&&!d.span.isHeading&&d.span.segments[0].page.pdfPage-anchorPage<=14&&[...d.heading].some(t=>vocabulary.has(t)));
    const scope=candidates.filter(d=>d.span.segments[0].page.pdfPage>=anchorPage-(enumeration.length?0:2)&&d.span.segments[0].page.pdfPage-anchorPage<=14&&(d.span.heading===anchor.span.heading||d.tf.has(primary)||[...d.heading].some(t=>vocabulary.has(t))));
    const firstProse=new Map();for(const d of expanded)if(hasProse(d)&&!firstProse.has(d.span.heading))firstProse.set(d.span.heading,d.span.id);
    const merged=new Map([...scope,...expanded].map(d=>{const facet=[...d.heading].filter(t=>vocabulary.has(t)).sort().join(' ');const named=methodLabels.includes(d.span.heading.toLowerCase().replace(/\s+/g,' ').trim());return [d.span.id,{...d,facet:facet||d.span.heading,score:score(d)+(facet?anchor.score*2:0)+(named?anchor.score:0)+(firstProse.get(d.span.heading)===d.span.id?anchor.score*.75:0)}];}));
    candidates=[...merged.values()].sort((a,b)=>b.score-a.score);
  }
  // Topic qualifiers are retrieved too, but cannot replace the topic itself.
  const qualifierDocs=index.docs.filter(d=>!d.span.isHeading&&d.span.segments[0].page.pdfPage>=anchorPage&&d.span.segments[0].page.pdfPage-anchorPage<=14&&(d.tf.has(primary)||d.heading.has(primary))&&qualifiers.some(t=>d.tf.has(t)));
  const pool=[...candidates.slice(0,70),...qualifierDocs];const selected=new Set(),headings=new Set();let used=0;
  for(let round=0;round<35&&used<wordBudget&&result.passages.length<7;round++){
    let best=null,bestValue=-Infinity;
    for(const doc of pool){
      if(selected.has(doc.span.id))continue;
      const distance=Math.abs(doc.span.segments[0].page.pdfPage-anchorPage);
      if(broad&&distance>14)continue;
      const novelty=headings.has(doc.facet||doc.span.heading)? .12:1;
      const near=1/(1+distance*.04);
      const qualifierBoost=result.passages.length>=4&&qualifiers.length&&qualifiers.some(t=>doc.tf.has(t))&&!result.passages.some(p=>tokens(p.text).includes('astm'))?anchor.score*4:0;
      const value=(doc.score||score(doc))*novelty*near+qualifierBoost+(!broad&&doc.span.id===lead?.span.id?anchor.score*1.5:0);
      if(value>bestValue){best=doc;bestValue=value;}
    }
    if(!best)break;selected.add(best.span.id);
    const remaining=wordBudget-used;const allowance=broad?Math.min(remaining,38):Math.min(remaining,round===0?120:80);
    const forQualifier=(!broad||result.passages.length>=4)&&qualifiers.some(t=>best.tf.has(t));
    const passage=chooseWindow(best.span,allowance,forQualifier?new Set(qualifiers):new Set([...query,...meaningful(best.span.heading)]),broad&&!forQualifier);
    if(!passage)continue;
    if(result.passages.some(p=>p.text===passage.text))continue;
    result.passages.push(passage);used+=wordCount(passage.text);headings.add(best.facet||best.span.heading);
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
