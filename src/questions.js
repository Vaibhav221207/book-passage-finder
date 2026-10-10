import {openBook} from './book.js';import {ocrImage,ocrPages} from './ocr.js';import {abortIfNeeded} from './model.js';
const promptStart=/^(?:what|why|how|when|where|which|who|is|are|can|does|do|explain|describe|discuss|define|state|list|enlist|classify|write|compare|differentiate|distinguish|calculate|determine|derive|draw|sketch|show|prove|evaluate|illustrate|enumerate|justify|give|find|outline|mention|identify|include|use|summari[sz]e|demonstrate)\b/i;
const questionLabel=/^(?:(?:q(?:uestion)?\.?\s*(?:no\.?\s*)?\d{1,3}\s*[.)/:\-]?\s*)|(?:\(\d{1,3}\)\s*)|(?:\d{1,3}\s*[.)/:\-](?!\d)\s*))/i;
function stripLabel(line){
  const bare=line.match(/^\d{1,3}\s+/),match=line.match(questionLabel)||(bare&&promptStart.test(line.slice(bare[0].length))?bare:null);
  return {numbered:!!match,text:match?line.slice(match[0].length).trim():line};
}
function sectionHeading(line){
  // Match document labels, not questions containing words such as "Assignment".
  if(promptStart.test(line)||line.split(/:\s*/).slice(1).some(part=>promptStart.test(part)))return false;
  return /^(?:assignment|tutorial)(?:\s*\/\s*(?:assignment|tutorial))?(?:\s+(?:no\.?|number)\s*[:.#\-]?\s*-?\s*\d+.*|\s+for\b.*|\s*[:#\-]?\s*\d+|\s*:?)$/i.test(line)
    || /^(?:section|part|unit|chapter)\s+(?:[a-z]|\d+|[ivxlcdm]+)(?:\s*[:.\-]\s*[^?]*)?$/i.test(line)
    || /^(?:general|instructions?|short answers?|long answers?|questions?|certificate)\s*:?$/i.test(line);
}
function metadataLine(line){
  return /^(?:page\s+\d+(?:\s*(?:of|\/)\s*\d+)?|[-–—]?\s*\d+\s*[-–—]?)$/i.test(line)
    || /^(?:course(?:\s+code)?|subject(?:\s+code)?|semester|date|name|roll\s*(?:no\.?|number)|enrollment\s*(?:no\.?|number))\s*[:#]/i.test(line);
}
export function parseQuestions(text){
  const inlineLabel=new RegExp('\\s+(?=(?:Q(?:uestion)?\\.?\\s*)?(?:\\d{1,3}[.)]|\\(\\d{1,3}\\))\\s+'+promptStart.source.slice(1)+')','gi');
  const pages=String(text??'').replace(/\r/g,'').replace(/\u00a0/g,' ').replace(inlineLabel,'\n').split('\f').map(page=>page.split('\n').map(line=>line.trim()).filter(Boolean));
  // Only repeated titles at the start of different pages are header candidates.
  // A lowercase continuation or a prompt ends the header region.
  const candidates=pages.map(lines=>{
    const end=lines.findIndex(line=>stripLabel(line).numbered||promptStart.test(line)||/^[a-z(]/.test(line));
    return lines.slice(0,Math.min(end<0?4:end,4)).map((line,index)=>({line,index})).filter(({line})=>!sectionHeading(line)&&!metadataLine(line)&&/^[A-Z][^.?!]*$/.test(line)&&line.split(/\s+/).length<=14);
  });
  const headerCounts=new Map();for(const entries of candidates)for(const line of new Set(entries.map(entry=>entry.line)))headerCounts.set(line,(headerCounts.get(line)||0)+1);
  const lines=pages.flatMap((lines,page)=>{
    const excluded=new Set(candidates[page].filter(entry=>headerCounts.get(entry.line)>1).map(entry=>entry.index));
    return lines.filter((line,index)=>!excluded.has(index));
  });
  const numbered=lines.some(line=>{const item=stripLabel(line);return item.numbered&&!sectionHeading(item.text)&&!metadataLine(item.text);});
  const hasHeaders=lines.some(line=>sectionHeading(stripLabel(line).text)||metadataLine(line));
  const groups=[];let current='',waitingForPrompt=numbered||hasHeaders;
  const finish=()=>{if(current.trim())groups.push(current.trim());current='';};
  for(const line of lines){
    const item=stripLabel(line);
    if(sectionHeading(item.text)){finish();waitingForPrompt=true;continue;}
    if(metadataLine(item.text))continue;
    if(item.numbered){finish();current=item.text;waitingForPrompt=false;continue;}
    if(numbered){if(!waitingForPrompt)current+=(current?'\n':'')+line;continue;}
    const startsPrompt=promptStart.test(line);
    if(waitingForPrompt&&!startsPrompt)continue;
    if(startsPrompt&&current&&/[?.!]$/.test(current.trim()))finish();
    current+=(current?'\n':'')+line;waitingForPrompt=false;
  }
  finish();return groups.map((text,i)=>({id:`q${i+1}`,text}));
}
export async function readAssignment(file,{signal,onProgress=()=>{}}={}){
  abortIfNeeded(signal);
  if(file.type.startsWith('image/'))return parseQuestions(await ocrImage(file,{signal,onProgress}));
  const session=await openBook(file,{signal,onProgress});
  try{
    let text=session.pages.map(pageLines).join('\n\f\n');
    if(!text.trim()&&session.pageCount<=10){const pages=await ocrPages(session,Array.from({length:session.pageCount},(_,i)=>i+1),{signal,onProgress});text=pages.map(pageLines).join('\n\f\n');}
    const questions=parseQuestions(text);if(!questions.length)throw new Error('No assignment questions detected. Choose a page with questions or paste them.');return questions;
  }finally{await session.dispose();}
}
function pageLines(page){
  const lines=[],bottom=run=>run.bounds.y+run.bounds.height;
  // OCR lowercase words have shorter boxes than capitals. Align their bottoms,
  // rather than their tops, before sorting the words from left to right.
  for(const run of page.runs.filter(run=>run.text.trim()).sort((a,b)=>bottom(a)-bottom(b)||a.bounds.x-b.bounds.x)){
    let line=lines.find(line=>Math.abs(line.bottom-bottom(run))<Math.max(line.height,run.bounds.height)*.45);
    if(!line){line={bottom:bottom(run),height:run.bounds.height,runs:[]};lines.push(line);}
    line.runs.push(run);line.height=Math.max(line.height,run.bounds.height);
  }
  return lines.map(line=>line.runs.sort((a,b)=>a.bounds.x-b.bounds.x).map(run=>run.text.trim()).join(' ').replace(/\s+/g,' ')).join('\n');
}
