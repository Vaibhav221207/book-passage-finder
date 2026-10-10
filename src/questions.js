import {openBook} from './book.js';import {ocrImage,ocrPages} from './ocr.js';import {abortIfNeeded} from './model.js';
export function parseQuestions(text){
  const lines=text.replace(/\r/g,'').split('\n');const groups=[];let current='';
  for(const raw of lines){const line=raw.trim();if(!line)continue;
    const numbered=/^(?:Q(?:uestion)?\s*)?\d{1,3}\s*[.)/:\-]\s*/i.test(line);
    if(numbered&&current){groups.push(current.trim());current='';}
    current+=(current?'\n':'')+line.replace(/^(?:Q(?:uestion)?\s*)?\d{1,3}\s*[.)/:\-]\s*/i,'');
  }if(current.trim())groups.push(current.trim());return groups.map((text,i)=>({id:`q${i+1}`,text}));
}
export async function readAssignment(file,{signal,onProgress=()=>{}}={}){
  abortIfNeeded(signal);
  if(file.type.startsWith('image/'))return parseQuestions(await ocrImage(file,{signal,onProgress}));
  const session=await openBook(file,{signal,onProgress});
  try{
    let text=session.pages.map(pageLines).join('\n');
    if(!text.trim()&&session.pageCount<=10){const pages=await ocrPages(session,Array.from({length:session.pageCount},(_,i)=>i+1),{signal,onProgress});text=pages.map(pageLines).join('\n');}
    if(!text.trim())throw new Error('No readable questions found. Use an image or paste the questions.');return parseQuestions(text);
  }finally{await session.dispose();}
}
function pageLines(page){const lines=[];for(const run of [...page.runs].sort((a,b)=>a.bounds.y-b.bounds.y||a.bounds.x-b.bounds.x)){let line=lines.find(l=>Math.abs(l.y-run.bounds.y)<Math.min(l.height,run.bounds.height)*.45);if(!line){line={y:run.bounds.y,height:run.bounds.height,runs:[]};lines.push(line);}line.runs.push(run);}return lines.map(l=>l.runs.sort((a,b)=>a.bounds.x-b.bounds.x).map(r=>r.text).join(' ')).join('\n');}
