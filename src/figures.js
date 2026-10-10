import {unionRects} from './layout.js';
import {tokens} from './search.js';

const pageLayouts=new WeakMap();
const generic=new Set(['concrete','cement','figure','fig','table','test','method','apparatus','equipment','mix','proportion','property','strength','value','shown','show','construction','material']);
const meaningful=text=>tokens(text).filter(t=>t.length>3&&!generic.has(t)&&!/^\d/.test(t));
const clamp=n=>Math.max(0,Math.min(1,n));
const pad=(box,x=.025,y=.008)=>({x:clamp(box.x-x),y:clamp(box.y-y),width:clamp(box.x+box.width+x)-clamp(box.x-x),height:clamp(box.y+box.height+y)-clamp(box.y-y)});
const key=(type,number)=>`${type}:${number}`;
const referenceSentence=text=>/\b(?:is|are|was|were)\s+(?:used|shown|given|described|discussed|presented|illustrated|referred)\b/i.test(text);

function referencesIn(text){
  const references=new Set();
  for(const match of text.matchAll(/\b(fig(?:ure)?s?\.?|tables?)\s*(\d+(?:\.\d+)*(?:\s*(?:,\s*(?:and\s+)?|and\s+|&\s*)\d+(?:\.\d+)*)*)/gi)){
    const type=/^table/i.test(match[1])?'table':'figure';
    for(const number of match[2].match(/\d+(?:\.\d+)*/g))references.add(key(type,number));
  }
  return references;
}

function captionOf(line){
  const match=line.text.match(/^\s*(Fig(?:ure)?\.?|Table)\s*(\d+(?:\.\d+)*)\b[.:]?\s*(.*)$/i);
  if(!match||referenceSentence(match[3])||/^(?:shows?|gives?|lists?|contains?|presents?|summari[sz]es?|illustrates?|provides?|is|are|was|were|can|will|has|have|indicates?|depicts?|compares?|of|in|on|as|and|from|to|with|at|below|above|respectively)\b/i.test(match[3]))return null;
  // Contents lists and sentences referring to a figure are not captions.
  if(/\.{3,}\s*\d+\s*$/.test(line.text))return null;
  return {type:/^table/i.test(match[1])?'table':'figure',number:match[2],title:match[3],line};
}

function makeLine(runs,sourceLine){return {runs,sourceLine,box:unionRects(runs.map(r=>r.bounds)),text:runs.map(r=>r.text.trim()).join(' ').replace(/\s+/g,' ')};}
function fragmentsOf(line){
  const groups=[];
  for(const run of line.runs){const group=groups.at(-1),last=group?.at(-1);if(!last||run.bounds.x-last.bounds.x-last.bounds.width>.045)groups.push([run]);else group.push(run);}
  return groups.map(runs=>makeLine(runs,line));
}
function captionsOf(line){
  const captions=[];
  for(let i=0;i<line.runs.length;i++){
    if(!/^\s*(?:Fig(?:ure)?\.?|Table)\b/i.test(line.runs[i].text))continue;
    const runs=[line.runs[i]];
    for(let j=i+1;j<line.runs.length;j++){
      const previous=runs.at(-1),next=line.runs[j];
      if(next.bounds.x-previous.bounds.x-previous.bounds.width>.055||/^\s*(?:Fig(?:ure)?\.?|Table)\b/i.test(next.text))break;
      runs.push(next);
    }
    const caption=captionOf(makeLine(runs,line));if(caption)captions.push(caption);
  }
  return captions;
}

function extendCaptions(lines,fragments,captions){
  return captions.filter(caption=>{
    const first=caption.line,initial=lines.indexOf(first.sourceLine);
    if(!caption.title){
      const previous=fragments.filter(l=>l.box.y+l.box.height<=first.box.y+.001&&first.box.y-l.box.y-l.box.height<.022&&l.box.x<first.box.x+first.box.width&&l.box.x+l.box.width>first.box.x).at(-1);
      if(previous&&/\b(?:shown|illustrated|depicted|given|listed|described|presented|referred\s+to)\s+in\s*$/i.test(previous.text))return false;
    }
    let end=first.sourceLine;
    for(let i=initial+1;i<Math.min(lines.length,initial+3);i++){
      const next=lines[i],box=caption.line.box,gap=next.box.y-box.y-box.height;
      const inside=caption.title?next.box.x>=box.x-.08&&next.box.x+next.box.width<=box.x+box.width+.08:/^[A-Z]/.test(next.text)&&next.text.split(/\s+/).length<=8;
      if(gap<0||gap>.008||!inside||columnCount(next)>1||captionOf(next)||referenceSentence(next.text)||next.text.split(/\s+/).length>14)break;
      caption.line=makeLine([...caption.line.runs,...next.runs],first.sourceLine);
      caption.title=`${caption.title} ${next.text}`.trim();end=next;
    }
    caption.line.endSourceLine=end;
    return true;
  });
}

function rotate(box,turn){
  if(turn===1)return {x:1-box.y-box.height,y:box.x,width:box.height,height:box.width};
  if(turn===2)return {x:1-box.x-box.width,y:1-box.y-box.height,width:box.width,height:box.height};
  if(turn===3)return {x:box.y,y:1-box.x-box.width,width:box.height,height:box.width};
  return box;
}

function layoutFor(page){
  const cached=pageLayouts.get(page);
  if(cached?.runs===page.runs&&cached.count===page.runs.length)return cached;
  const runs=page.runs.filter(r=>r.text.trim()&&r.bounds.width>0&&r.bounds.height>0).map(r=>({...r,sourceBounds:r.bounds,bounds:r.readingBounds||r.bounds}));
  const clean=runs.filter(r=>!runs.some(other=>other!==r&&other.text.trim().length>r.text.trim().length&&Math.abs(other.bounds.y-r.bounds.y)<.004&&other.bounds.x<=r.bounds.x+.004&&other.bounds.x+other.bounds.width>=r.bounds.x+r.bounds.width-.004&&other.text.includes(r.text.trim())));
  const lines=[];
  for(const run of clean.toSorted((a,b)=>a.bounds.y-b.bounds.y||a.bounds.x-b.bounds.x)){
    let line=lines.find(l=>Math.abs(l.box.y-run.bounds.y)<Math.min(.006,run.bounds.height*.5));
    if(!line){line={runs:[],box:run.bounds};lines.push(line);}
    if(line.runs.some(r=>r.text.trim()===run.text.trim()&&Math.abs(r.bounds.x-run.bounds.x)<.004))continue;
    line.runs.push(run);line.box=unionRects(line.runs.map(r=>r.bounds));
  }
  for(const line of lines){line.runs.sort((a,b)=>a.bounds.x-b.bounds.x);line.text=line.runs.map(r=>r.text.trim()).join(' ').replace(/\s+/g,' ');}
  let turn=0,lowest=Infinity;
  const paired=runs.filter(r=>r.readingBounds).slice(0,12);
  for(let candidate=0;candidate<4&&paired.length;candidate++){
    const error=paired.reduce((sum,r)=>{const box=rotate(r.bounds,candidate),actual=r.sourceBounds;return sum+Math.abs(box.x-actual.x)+Math.abs(box.y-actual.y)+Math.abs(box.width-actual.width)+Math.abs(box.height-actual.height);},0);
    if(error<lowest){lowest=error;turn=candidate;}
  }
  const fragments=lines.flatMap(fragmentsOf);
  const header=lines.find(l=>l.box.y<.18&&l.runs.some(r=>r.text.trim()===String(page.ref.printedLabel)));
  const layout={runs:page.runs,count:page.runs.length,lines,fragments,captions:extendCaptions(lines,fragments,lines.flatMap(captionsOf)),headerBottom:header?header.box.y+header.box.height+.008:0,turn};
  pageLayouts.set(page,layout);return layout;
}

function columnCount(line){
  let columns=0,right=-1;
  for(const run of line.runs){if(run.bounds.x-right>.018)columns++;right=Math.max(right,run.bounds.x+run.bounds.width);}
  return columns;
}
function tableRow(line){
  const columns=columnCount(line),numbers=(line.text.match(/\b\d+(?:\.\d+)?\b/g)||[]).length;
  return columns>=2&&numbers>=2||columns>=3&&line.runs.every(r=>r.text.trim().split(/\s+/).length<=8);
}
function prose(line){return columnCount(line)<3&&/[A-Za-z]{3}/.test(line.text)&&(line.text.split(/\s+/).length>=8||line.text.split(/\s+/).length>=6&&line.box.width>.4&&/[.!?]$/.test(line.text));}

function tableBounds(layout,caption){
  const firstIndex=layout.lines.indexOf(caption.line.sourceLine),index=layout.lines.indexOf(caption.line.endSourceLine),box=caption.line.box;
  const isCaption=line=>layout.captions.some(c=>c.line.sourceLine===line);
  function rows(direction){
    const chosen=[];let started=false,previous=direction>0?box.y+box.height:box.y,notes=false;
    for(let i=(direction>0?index:firstIndex)+direction;i>=0&&i<layout.lines.length;i+=direction){
      const line=layout.lines[i],gap=direction>0?line.box.y-previous:previous-line.box.y-line.box.height;
      if(isCaption(line)||gap>(started?.065:.08)||line.box.y<.035||line.box.y>.93)break;
      const row=tableRow(line),note=direction>0&&(/^\s*(?:notes?|sources?)\s*[:.]/i.test(line.text)||(notes&&line.box.x>=chosen.at(-1).box.x-.015));
      if(!row&&!note&&prose(line))break;
      if(row){started=true;notes=false;}else if(note)notes=true;
      if(!started&&chosen.length>=4)break;
      chosen.push(line);previous=direction>0?line.box.y+line.box.height:line.box.y;
    }
    return started?chosen:[];
  }
  const below=rows(1),above=rows(-1);
  const selected=below.length?below:above;
  if(selected.length)return pad(unionRects([box,...selected.map(l=>l.box)]));
  // Image-only tables have no cells to measure. Offer a conservative below-caption
  // region for manual review, stopping before the next paragraph or caption.
  const next=layout.lines.slice(index+1).find(l=>isCaption(l)||prose(l));
  const bottom=Math.min(.94,box.y+box.height+.4,next?.box.y??1);
  return pad({x:.08,y:box.y,width:.84,height:Math.max(box.height,bottom-box.y)},.01,.006);
}

function figureBounds(layout,caption){
  const box=caption.line.box;
  const preceding=layout.fragments.filter(l=>l.box.y+l.box.height<=box.y+.001);
  const nearbyBody=preceding.filter(l=>prose(l)&&l.box.y>=box.y-.5);
  let left=.06,right=.94;
  if(box.x>=.45&&nearbyBody.filter(l=>l.box.x+l.box.width<.46).length>=3)left=Math.max(.42,box.x-.055);
  if(box.x+box.width<=.55&&nearbyBody.filter(l=>l.box.x>.46).length>=3)right=Math.min(.59,box.x+box.width+.06);
  const overlaps=line=>Math.min(right,line.box.x+line.box.width)-Math.max(left,line.box.x)>.04;
  const boundary=preceding.filter(l=>overlaps(l)&&(prose(l)||captionOf(l))).at(-1);
  const top=Math.max(.035,layout.headerBottom,boundary?boundary.box.y+boundary.box.height+.008:box.y-.5);
  // Graphic edges need not coincide with text labels or a centered caption.
  return {x:left,y:Math.min(top,box.y),width:right-left,height:Math.min(1-box.y-box.height,.008)+box.y+box.height-Math.min(top,box.y)};
}

export function suggestFigures(session,result){
  const pages=result.passages.flatMap(p=>p.segments.map(s=>s.page.pdfPage));
  const passageText=result.passages.map(p=>p.text).join(' ');
  const questionReferences=referencesIn(result.question?.text||'');
  const references=questionReferences.size?questionReferences:referencesIn(passageText);
  if(!pages.length&&!references.size)return [];
  const focus=new Set(meaningful(`${result.question?.text||''} ${result.passages.map(p=>p.heading||'').join(' ')}`));
  const topic=new Set(meaningful(passageText)),candidates=[],seen=new Set();
  for(const page of session.pages){
    const distance=Math.min(...pages.map(n=>Math.abs(n-page.ref.pdfPage)));
    if(distance>2&&!references.size)continue;
    if(!page.runs.some(r=>/^\s*(?:Fig(?:ure)?\.?|Table)\b/i.test(r.text)))continue;
    const layout=layoutFor(page);
    for(const caption of layout.captions){
      const reference=key(caption.type,caption.number),explicit=references.has(reference);
      if(questionReferences.size&&!explicit)continue;
      if(distance>2&&!explicit)continue;
      const words=[...new Set(meaningful(caption.title))],shared=words.filter(t=>topic.has(t)||focus.has(t));
      const focused=shared.some(t=>focus.has(t));
      if(!explicit&&(!shared.length||(!focused&&shared.length<2)||shared.length/Math.max(1,words.length)<.4))continue;
      const id=`${caption.type}-${page.ref.pdfPage}-${caption.number}`;
      if(seen.has(id))continue;seen.add(id);
      const bounds=caption.type==='table'?tableBounds(layout,caption):figureBounds(layout,caption);
      candidates.push({id,page:page.ref,caption:caption.line.text,kind:caption.type,bounds:rotate(bounds,layout.turn),confirmed:false,score:(explicit?100:shared.length)+1/(1+distance)});
    }
  }
  return candidates.sort((a,b)=>b.score-a.score).slice(0,6);
}
