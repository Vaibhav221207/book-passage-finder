import {unionRects} from './layout.js';import {tokens} from './search.js';
export function suggestFigures(session,result){
  const pages=result.passages.flatMap(p=>p.segments.map(s=>s.page.pdfPage));if(!pages.length)return [];
  const references=new Set([...result.passages.map(p=>p.text).join(' ').matchAll(/Fig(?:ure)?s?\.?\s*(\d+(?:\.\d+)+)/gi)].map(m=>m[1]));
  const topic=new Set(tokens(result.passages.map(p=>p.heading+' '+p.text).join(' ')).filter(t=>t.length>3));const candidates=[],seen=new Set();
  for(const page of session.pages){
    const distance=Math.min(...pages.map(n=>Math.abs(n-page.ref.pdfPage)));if(distance>2)continue;
    for(const run of page.runs){const match=run.text.match(/^\s*(?:Fig(?:ure)?\.?|Table)\s*(\d+(?:\.\d+)+)\b/i);if(!match||seen.has(`${page.ref.pdfPage}:${match[1]}`))continue;
      seen.add(`${page.ref.pdfPage}:${match[1]}`);const captionRuns=page.runs.filter(r=>Math.abs(r.bounds.y-run.bounds.y)<.008&&r.bounds.x>=run.bounds.x-.02);const caption=captionRuns.map(r=>r.text.trim()).filter(Boolean).join(' ').replace(/\s+/g,' ');
      const explicit=references.has(match[1]);const shared=tokens(caption).filter(t=>topic.has(t)).length;if(!explicit&&!shared)continue;
      const box=unionRects(captionRuns.map(r=>r.bounds)),y=Math.max(.04,box.y-.35);
      candidates.push({id:`fig-${page.ref.pdfPage}-${match[1]}`,page:page.ref,caption,bounds:{x:Math.max(.02,box.x-.07),y,width:Math.min(.92,box.width+.14),height:Math.min(1-y,box.y+box.height-y+.015)},confirmed:false,score:(explicit?100:shared)+1/(1+distance)});
    }
  }return candidates.sort((a,b)=>b.score-a.score).slice(0,6);
}
