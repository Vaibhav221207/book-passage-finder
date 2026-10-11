import {wordCount} from './model.js';
const stop=new Set('a an the and or of to in on at by for with from is are be was were what why how when which who discuss describe explain give state write list compare according per as using used use given answer question show graph graphs diagram diagrams figure figures method methods test tests measure measuring measurement measurements standard standards astm indian british short note notes briefly brief'.split(' '));
const forms={measured:'measure',measures:'measure',measuring:'measure',measurement:'measure',measurements:'measure',workabilities:'workability',compacted:'compact',compacting:'compact',compaction:'compact',densities:'density'};
for(const term of 'book textbook this that it they them we you he she do does did has have had can could should would will shall must into about such also some any other all its their these those two three each both needed relevant explanation described including include report reports reports determining determine laboratory chapter edition distinguish definition define identify introduced changes change approved procedure only same amount achieved obtain records recorded compares compare advantages limitations forms form give shown difference differences differ relating relation degree suitable'.split(' '))stop.add(term);
export function tokens(text){return (text.toLowerCase().match(/[a-z][a-z0-9]+|\d{3,4}/g)||[]).map(t=>forms[t]|| (t.length>4&&t.endsWith('s')&&!t.endsWith('ss')?t.slice(0,-1):t));}
const meaningful=text=>tokens(text).filter(t=>!stop.has(t));
function sourceReferences(text){
  const found=[];
  for(const match of text.matchAll(/\b(fig(?:ure)?s?\.?|tables?)\s*(\d+(?:\.\d+)*(?:\s*(?:,\s*(?:and\s+)?|and\s+|&\s*)\d+(?:\.\d+)*)*)/gi)){
    const kind=/^table/i.test(match[1])?'table':'figure';
    for(const number of match[2].match(/\d+(?:\.\d+)*/g))found.push({key:`${kind}:${number}`,kind,number,start:match.index,end:match.index+match[0].length});
  }
  return found;
}
function captionReference(span){
  const match=span.text.match(/^\s*(Fig(?:ure)?\.?|Table)\s*(\d+(?:\.\d+)*)\b[.:]?\s*(.*)$/i);
  if(!match)return null;
  const title=match[3].replace(/^[,;)\]]+\s*/,'');
  if(/\b(?:is|are|was|were)\s+(?:used|shown|given|described|discussed|presented|illustrated|referred)\b/i.test(title)
    ||/^(?:\([^)]*\)\s*[,;:]?\s*)?(?:also\s+|clearly\s+|further\s+)?(?:shows?|represents?|illustrates?|indicates?|gives?|depicts?|compares?)\b/i.test(title)
    ||/^(?:\([^)]*\)\s*[,;:]?\s*)?(?:the|this|it)\b.{0,85}\b(?:shows?|shall|cannot|can|is|are)\b/i.test(title)
    ||/^(?:shows?|gives?|lists?|contains?|presents?|summari[sz]es?|illustrates?|provides?|is|are|was|were|can|will|has|have|indicates?|depicts?|compares?|of|in|on|as|and|from|to|with|at|for|below|above|respectively|adopt|take|use|refer|see)\b/i.test(title)
    ||/^(?:Fig(?:ure)?\.?|Tables?)\s*\d/i.test(title)||/\.{3,}\s*\d+\s*$/.test(span.text))return null;
  return `${/^table/i.test(match[1])?'table':'figure'}:${match[2]}`;
}
function isSourceListing(span){
  const listingLabel=value=>/^(?:references?|generalreferencebooks?|bibliograph(?:y|ies)|furtherreading|recommendedreading|workscited|(?:tableof)?contents)$/.test((value||'').toLowerCase().replace(/[^a-z]/g,''));
  if(listingLabel(span.section)||listingLabel(span.heading))return true;
  if((span.text.match(/[!•]/g)||[]).length>=3&&!/[.?]/.test(span.text))return true;
  // A numbered author entry with publication metadata is a citation. A
  // numbered explanation that mentions ASTM or a year is still useful prose.
  return /^\s*(?:\[\d+\]|\d+(?:\.\d+)*[.)]?)\s+[A-Z][a-z'-]+\s+(?:[A-Z]\.\s*){1,3}/.test(span.text)
    && /\b(?:journal|publication|proceedings|press|publisher|publishing)\b/i.test(span.text)
    && /\b(?:18|19|20)\d{2}\b/.test(span.text);
}
export function buildIndex(spans){
  const df=new Map();const headingTerms=new Set();let previous=null,headingLabel='',rawHeading='';
  const docs=spans.filter(span=>!isSourceListing(span)).map((span,order)=>{
    if(span.isHeading){
      const a=previous?.segments[0],b=span.segments[0],ra=a?.rects?.at(-1),rb=b?.rects?.[0];
      const wrapped=previous?.isHeading&&a?.page.pdfPage===b?.page.pdfPage&&ra&&rb
        &&Math.abs(ra.x-rb.x)<.015&&rb.y>=ra.y+ra.height-.002&&rb.y-ra.y-ra.height<.012
        &&Math.max(ra.height,rb.height)/Math.max(Math.min(ra.height,rb.height),.001)<1.35
        &&wordCount(headingLabel+' '+span.text)<=14;
      headingLabel=wrapped?headingLabel+' '+span.text:span.heading||span.text;rawHeading=span.heading||span.text;
    }
    const logicalHeading=span.heading===rawHeading?headingLabel:span.heading||'';previous=span;
    const embedded=span.text.match(/^([A-Z][A-Za-z -]{2,45}(?:Test|Method|Apparatus))\s+(?:The|This|A|An)\b/);
    const terms=tokens(span.text),heading=meaningful(embedded?.[1]||logicalHeading);const tf=new Map();if(span.isHeading||embedded)for(const t of heading)headingTerms.add(t);
    for(const t of terms)tf.set(t,(tf.get(t)||0)+1);
    for(const t of new Set([...terms,...heading]))df.set(t,(df.get(t)||0)+1);
    return {span,order,tf,heading:new Set(heading),headingPhrase:` ${heading.join(' ')} `,phraseText:` ${meaningful(span.text).join(' ')} `,length:Math.max(terms.length,1)};
  });
  const references=new Map();
  for(const doc of docs)for(const reference of sourceReferences(doc.span.text)){
    if(!references.has(reference.key))references.set(reference.key,{captions:[],mentions:[]});
    const entry=references.get(reference.key);if(!entry.mentions.includes(doc))entry.mentions.push(doc);
    if(captionReference(doc.span)===reference.key&&!entry.captions.includes(doc))entry.captions.push(doc);
  }
  return {docs,df,headingTerms,references,average:docs.reduce((s,d)=>s+d.length,0)/Math.max(docs.length,1)};
}
export function sentenceWindows(text){
  const parts=[];let start=0;
  const add=end=>{const raw=text.slice(start,end),trim=raw.trim();if(trim)parts.push({text:trim,start:start+raw.indexOf(trim),end:start+raw.indexOf(trim)+trim.length});start=end;};
  for(let i=0;i<text.length;i++){
    if(!/[.!?]/.test(text[i]))continue;
    if(text[i]==='.'&&/\d/.test(text[i-1]||'')&&/\d/.test(text[i+1]||''))continue;
    const prefix=text.slice(Math.max(0,i-12),i+1),suffix=text.slice(i+1);
    if(text[i]==='.'&&(/(?:^|\s)(?:Fig|Figs|No|Dr|Mr|Mrs|sq|e\.g|i\.e)\.$/i.test(prefix)||(/[A-Z]\.$/.test(prefix)&&/^[A-Z]\./.test(suffix))||(/\b(?:[A-Z]\.\s*){2,}$/.test(prefix)&&/^\s+[A-Z][a-z]/.test(suffix))))continue;
    let end=i+1;while(/[.!?"”')]/.test(text[end]||' ')&&end<text.length)end++;
    if(end===text.length||/\s/.test(text[end])){add(end);i=end-1;}
  }if(start<text.length)add(text.length);return parts;
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
const completeSentence=window=>wordCount(window.text)>=5&&/[.!?]$/.test(window.text)&&/^[A-Z“"(]/.test(window.text);
const hasProse=doc=>!doc.span.isHeading&&wordCount(doc.span.text)>=8&&sentenceWindows(doc.span.text).some(completeSentence);
function referenceContext(index,question,references,wordBudget){
  const result={question,passages:[],figures:[],status:'no-match',coverageNotes:[]};
  let topicText=question.text;
  const ranges=[...new Map(references.map(reference=>[`${reference.start}:${reference.end}`,reference])).values()];
  for(const reference of ranges.sort((a,b)=>b.start-a.start))topicText=topicText.slice(0,reference.start)+' '+topicText.slice(reference.end);
  const topic=new Set(meaningful(topicText).filter(t=>t!=='table'));
  const unique=[...new Map(references.map(reference=>[reference.key,reference])).values()];
  const groups=unique.map(reference=>{
    const entry=index.references.get(reference.key);if(!entry)return [];
    const seeds=entry.captions.length?entry.captions:entry.mentions;
    const pageOf=doc=>doc.span.segments[0].page.pdfPage;
    const direct=entry.mentions.filter(doc=>seeds.some(seed=>Math.abs(pageOf(doc)-pageOf(seed))<=1));
    const nearby=index.docs.filter(doc=>seeds.some(seed=>Math.abs(pageOf(doc)-pageOf(seed))<=1&&(doc.span.heading===seed.span.heading||direct.some(mention=>mention.span.heading===doc.span.heading))));
    const eligible=doc=>hasProse(doc)&&!captionReference(doc.span)&&(!topic.size||[...topic].some(term=>doc.tf.has(term)||doc.heading.has(term)));
    const directProse=direct.filter(eligible);
    const captionTopics=new Set(entry.captions.flatMap(seed=>meaningful(seed.span.text).filter(term=>!['table','figure','fig'].includes(term))));
    const supportsCaption=doc=>captionTopics.size&&[...captionTopics].filter(term=>doc.tf.has(term)).length>=Math.min(2,captionTopics.size);
    return directProse.length?directProse:nearby.filter(doc=>eligible(doc)&&supportsCaption(doc)).sort((a,b)=>Math.min(...seeds.map(seed=>Math.abs(a.order-seed.order)))-Math.min(...seeds.map(seed=>Math.abs(b.order-seed.order)))).slice(0,2);
  });
  const selected=new Set();let used=0;
  for(let round=0;round<7&&used<wordBudget&&result.passages.length<7;round++)for(const group of groups){
    const doc=group.find(candidate=>!selected.has(candidate.span.id));if(!doc)continue;selected.add(doc.span.id);
    const remaining=wordBudget-used,allowance=Math.min(remaining,unique.length>1?Math.ceil(wordBudget/unique.length):Math.round(120*Math.max(1,wordBudget/200)));
    const passage=chooseWindow(doc.span,allowance,topic,!topic.size);if(!passage)continue;
    result.passages.push(passage);used+=wordCount(passage.text);
    if(result.passages.length>=7||used>=wordBudget)break;
  }
  if(result.passages.length){result.status='partial';result.coverageNotes.push('These passages provide source context for the requested figure or table. Check the original selection; full coverage is unverified.');}
  else result.coverageNotes.push('No complete source explanation was found for the requested figure or table. Review the original selection.');
  if(groups.some(group=>!group.length))result.coverageNotes.push('Some requested references have no matching explanatory passage.');
  return result;
}
function compositionContext(index,question,wordBudget){
  const intent=question.text.match(/\b(?:components?|constituents?|ingredients?)\s+(?:of|in)\s+(.+?)(?:[?!.]|$)/i);
  if(!intent)return null;
  const subjectText=intent[1].split(/\b(?:and|then|also)\s+(?:explain|describe|discuss|give|state|identify|compare|list)\b/i)[0];
  const subject=meaningful(subjectText).filter(term=>!['basic','main','fundamental','major','essential'].includes(term));
  if(!subject.length)return null;
  const label=subject.join(' '),parts='(?:component|ingredient|constituent)',determiner='(?:(?:a|an|the) )?';
  const subjectEnd='(?=$| (?:which|that|while|and|but|because|when|where)\\b)';
  const identity=new RegExp(`(?:\\b${parts} (?:of|in) ${determiner}${label} (?:is|are|include|comprise|consist)\\b|\\b(?:is|are) (?:[a-z0-9]+ ){0,5}${parts} (?:of|in) ${determiner}${label}${subjectEnd})`);
  const candidates=index.docs.flatMap(doc=>hasProse(doc)?sentenceWindows(doc.span.text).filter(window=>completeSentence(window)&&identity.test(tokens(window.text).join(' '))).map(window=>({doc,window})):[]);
  const result={question,passages:[],figures:[],status:'no-match',coverageNotes:[]};
  let used=0;
  for(const {doc,window} of candidates){
    if(result.passages.some(p=>p.originId===doc.span.id))continue;
    const allowance=Math.min(Math.round(80*Math.max(1,wordBudget/200)),wordBudget-used);if(wordCount(window.text)>allowance)continue;
    let end=window.end;
    for(const next of sentenceWindows(doc.span.text).filter(part=>part.start>=end)){
      if(!completeSentence(next)||wordCount(doc.span.text.slice(window.start,next.end))>allowance)break;end=next.end;
    }
    const text=doc.span.text.slice(window.start,end);
    result.passages.push({...doc.span,id:`${doc.span.id}:${window.start}:${end}`,originId:doc.span.id,text,selectedOffsets:{start:window.start,end}});used+=wordCount(text);
    if(used>=wordBudget||result.passages.length>=3)break;
  }
  if(result.passages.length){result.status='partial';result.coverageNotes.push('These source passages identify constituents of the requested subject. Coverage of every component and requested detail is unverified.');}
  else result.coverageNotes.push('No clear source passage identifying the constituents of this subject was found. Try the book’s terminology or a more specific topic.');
  return result;
}
export function searchQuestion(index,question,{wordBudget=200}={}){
  const references=sourceReferences(question.text);
  if(references.length)return referenceContext(index,question,references,wordBudget);
  const composition=compositionContext(index,question,wordBudget);if(composition)return composition;
  const core=[...new Set(meaningful(question.text))];const all=[...new Set(tokens(question.text))];
  const result={question,passages:[],figures:[],status:'no-match',coverageNotes:[]};
  if(!core.length){result.coverageNotes.push('Add the textbook topic to this question.');return result;}
  const known=core.filter(t=>index.df.has(t)),unknown=core.filter(t=>!index.df.has(t));
  // Context words cannot rescue an absent leading compound subject. Later
  // requested parts remain eligible for the existing partial-coverage path.
  const firstSubjectWord=[...question.text.matchAll(/[a-z][a-z0-9]+|\d{3,4}/gi)].find(match=>meaningful(match[0]).length);
  const subject=firstSubjectWord?question.text.slice(firstSubjectWord.index).match(/^([^,;:?!]*?)\b(?:in|on|of|for|with|from|to|using|according|per|as)\b/i)?.[1]:null;
  const leadingSubject=subject?meaningful(subject.split(/\b(?:and|or|then|also|including)\b/i)[0]).slice(0,2):[];
  const absentCompound=leadingSubject.length===2&&leadingSubject.some(term=>!index.df.has(term));
  if(!known.length||unknown.includes(core[0])||absentCompound||unknown.some(t=>/^\d{4}$/.test(t))||(unknown.length&&/\b(only|without|approved)\b/i.test(question.text))||(unknown.length>=known.length&&known.length<=1)){result.coverageNotes.push('No reliable passage found for this topic or requested edition.');return result;}
  const N=index.docs.length,idf=t=>Math.log(1+(N-(index.df.get(t)||0)+.5)/((index.df.get(t)||0)+.5));
  const query=new Set(known),pairs=core.slice(0,-1).map((t,i)=>[t,core[i+1]]);const score=doc=>known.reduce((s,t,i)=>{
    const f=doc.tf.get(t)||0;return s+idf(t)*(i<2?1.4:1)*(f*2.2/(f+1.2*(.25+.75*doc.length/index.average))+(doc.heading.has(t)?1.7:0));
  },0)+pairs.reduce((s,[a,b],i)=>{const phrase=` ${a} ${b} `;return s+(doc.headingPhrase.includes(phrase)?4:doc.phraseText.includes(phrase)?2:0)*(idf(a)+idf(b))*(i===0?1.5:1);},0);
  const ranked=index.docs.map(d=>({...d,score:score(d)})).filter(d=>d.score>0).sort((a,b)=>b.score-a.score);
  if(!ranked.length)return result;
  let broad=/\b(methods|tests|ways|types|discuss)\b/i.test(question.text);
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
  const exactTopic=!broad&&!unknown.length&&core.length>=2&&core.every(t=>anchor.heading.has(t));
  const lead=index.docs.find(d=>hasProse(d)&&d.span.heading===anchor.span.heading&&Math.abs(d.span.segments[0].page.pdfPage-anchorPage)<=2);
  let candidates=ranked.filter(d=>!d.span.isHeading&&!/^fig(?:ure)?\.?\s*\d/i.test(d.span.text)&&Math.abs(d.span.segments[0].page.pdfPage-anchorPage)<=14);
  if(exactTopic)candidates=candidates.filter(d=>d.headingPhrase===anchor.headingPhrase);
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
      // When the question names a full heading, retain its explanation in
      // source order rather than favoring later repetitions of title words.
      const value=exactTopic?1/(1+doc.order):(doc.score||score(doc))*novelty*near+qualifierBoost+(!broad&&doc.span.id===lead?.span.id?anchor.score*1.5:0);
      if(value>bestValue){best=doc;bestValue=value;}
    }
    if(!best)break;selected.add(best.span.id);
    const remaining=wordBudget-used,scale=Math.max(1,wordBudget/200);const allowance=broad?Math.min(remaining,Math.round(38*scale)):Math.min(remaining,Math.round((round===0?120:80)*scale));
    const forQualifier=(!broad||result.passages.length>=4)&&qualifiers.some(t=>best.tf.has(t));
    const passage=chooseWindow(best.span,allowance,forQualifier?new Set(qualifiers):new Set([...query,...meaningful(best.span.heading)]),exactTopic||broad&&!forQualifier);
    if(!passage)continue;
    if(result.passages.some(p=>p.text===passage.text))continue;
    result.passages.push(passage);used+=wordCount(passage.text);headings.add(best.facet||best.span.heading);
  }
  if(!result.passages.length){result.coverageNotes.push('Matches were found, but no complete short passage fits. Try a more specific question or view a source page.');return result;}
  const found=new Set(result.passages.flatMap(p=>tokens(p.text)));
  const uncovered=known.filter(t=>!found.has(t));
  const relationship=/\b(same|identical|equivalent|always|never|only|approved|prove|why|cause|without)\b/i.test(question.text);
  const facets=/\b(and|compare|methods|tests|forms|procedure|formula|recorded|advantages|limitations|two|three|graph|results)\b/i.test(question.text);
  result.status=unknown.length||uncovered.length||relationship||facets||qualifiers.some(t=>!found.has(t))?'partial':'matches';
  if(relationship)result.coverageNotes.push('These source suggestions do not verify the requested claim or relationship. Check the original explanation.');
  if(facets)result.coverageNotes.push('Coverage of every requested part is unverified. View the source or expand a passage for the missing details.');
  if(unknown.length)result.coverageNotes.push(`Not found in this book: ${unknown.slice(0,6).join(', ')}.`);
  if(uncovered.length)result.coverageNotes.push(`Short selections may not cover: ${uncovered.slice(0,6).join(', ')}.`);
  if(qualifiers.some(t=>!found.has(t)))result.coverageNotes.push('The selected passages do not establish every requested standard.');
  result.coverageNotes.push('Source matches are suggestions. Check that they cover your question.');
  return result;
}
export function expandPassage(index,passage){const span=index.docs.find(d=>d.span.id===passage.originId||d.span.id===passage.id)?.span;return span?{...span,originId:span.id,selectedOffsets:{start:0,end:span.text.length}}:passage;}
