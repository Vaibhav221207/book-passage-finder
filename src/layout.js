const clamp = (n,lo=0,hi=1)=>Math.max(lo,Math.min(hi,n));
export function itemToRun(item,id,viewport) {
  const [a,b,c,d,e,f]=item.transform;
  const height=Math.hypot(c,d)||item.height||10;
  const width=item.width||0;
  const ux=a/Math.hypot(a,b)||1, uy=b/Math.hypot(a,b)||0;
  const vx=c/height||0, vy=d/height||1;
  const corners=[[e,f-height*.2],[e+ux*width,f+uy*width-height*.2],
    [e+vx*height,f+vy*height*.85],[e+ux*width+vx*height,f+uy*width+vy*height*.85]];
  const [va,vb,vc,vd,ve,vf]=viewport.transform;
  const points=corners.map(([x,y])=>[(va*x+vc*y+ve)/viewport.width,(vb*x+vd*y+vf)/viewport.height]);
  const x=clamp(Math.min(...points.map(p=>p[0]))),y=clamp(Math.min(...points.map(p=>p[1])));
  const right=clamp(Math.max(...points.map(p=>p[0]))),bottom=clamp(Math.max(...points.map(p=>p[1])));
  return {id:String(id),text:item.str,bounds:{x,y,width:right-x,height:bottom-y},fontSize:height};
}
function romanValue(text) {
  if(!/^[ivxlcdm]+$/i.test(text)) return null;
  const values={i:1,v:5,x:10,l:50,c:100,d:500,m:1000};let total=0,last=0;
  for(const c of text.toLowerCase().split('').reverse()){const value=values[c];total+=value<last?-value:value;last=Math.max(value,last);}return total;
}
export function detectPageLabels(pages) {
  const candidates=pages.map(p=>p.runs.filter(r=>(r.bounds.y<.20||r.bounds.y>.88)&&/^(\d{1,4}|[ivxlcdm]{1,12})$/i.test(r.text.trim())).map(r=>({text:r.text.trim(),value:/^\d+$/.test(r.text.trim())?Number(r.text.trim()):romanValue(r.text.trim()),y:r.bounds.y})));
  pages.forEach((page,i)=>{
    if(page.ref.printedLabel!==null)return;
    const matches=candidates[i].filter(c=>{
      const neighbors=[i-1,i+1].filter(j=>j>=0&&j<pages.length);
      if(!neighbors.length)return false;
      return neighbors.every(j=>candidates[j].some(n=>Math.abs(n.y-c.y)<.06 && n.value===c.value+(j-i)));
    });
    if(matches.length===1)page.ref.printedLabel=matches[0].text;
  });
}
export function unionRects(rects) {
  const x=Math.min(...rects.map(r=>r.x)),y=Math.min(...rects.map(r=>r.y));
  return {x,y,width:Math.max(...rects.map(r=>r.x+r.width))-x,height:Math.max(...rects.map(r=>r.y+r.height))-y};
}
export function makeSourceSpans(pages,outline=[]) {
  const spans=[];let heading='',section='';
  const repeated=new Map();
  for(const p of pages)for(const r of p.runs)if(r.bounds.y<.20||r.bounds.y>.90){const t=r.text.trim().toLowerCase();repeated.set(t,(repeated.get(t)||0)+1);}
  for(const page of pages){
    const firstY=Math.min(...page.runs.filter(r=>r.text.trim()).map(r=>r.bounds.y));
    const seen=new Set();const usable=page.runs.filter(r=>{
      const t=r.text.trim();if(!t)return false;
      if(t===page.ref.printedLabel&&(r.bounds.y<.20||r.bounds.y>.90))return false;
      if(((r.bounds.y<.20&&r.bounds.y<firstY+.009)||r.bounds.y>.93)&&t.length<60&&!/[.!?]$/.test(t)&&(repeated.get(t.toLowerCase())||0)>2)return false;
      const key=`${t}:${Math.round(r.bounds.x*100)}:${Math.round(r.bounds.y*100)}`;
      if(seen.has(key))return false;seen.add(key);return true;
    });
    const sizes=usable.map(r=>r.fontSize||12).sort((a,b)=>a-b);const bodySize=sizes[Math.floor(sizes.length*.5)]||12;
    const clean=usable.filter(r=>!usable.some(other=>other!==r&&other.text.trim().length>r.text.trim().length&&Math.abs(other.bounds.y-r.bounds.y)<.006&&other.bounds.x<=r.bounds.x+.005&&other.bounds.x+other.bounds.width>=r.bounds.x+r.bounds.width-.005&&other.text.includes(r.text.trim())));
    const sorted=clean.toSorted((a,b)=>a.bounds.y-b.bounds.y||a.bounds.x-b.bounds.x);
    const lines=[];
    for(const run of sorted){
      let line=lines.find(l=>Math.abs(l.y-run.bounds.y)<Math.min(run.bounds.height*.45,.007)&&run.bounds.x-l.right<.045&&run.bounds.x+run.bounds.width>=l.left-.045);
      if(!line){line={runs:[],y:run.bounds.y,left:run.bounds.x,right:run.bounds.x+run.bounds.width};lines.push(line);}
      line.runs.push(run);line.left=Math.min(line.left,run.bounds.x);line.right=Math.max(line.right,run.bounds.x+run.bounds.width);
    }
    // Sort reading order by columns only when both sides contain real body lines.
    const left=lines.filter(l=>l.left<.45&&l.right<.57),right=lines.filter(l=>l.left>.45);
    const bodyLine=l=>l.runs.map(r=>r.text).join('').length>25;
    const fullWidth=lines.filter(l=>l.left<.45&&l.right>.57).length;
    const columnar=left.filter(bodyLine).length>=4&&right.filter(bodyLine).length>=4&&fullWidth<(left.length+right.length)*.5;
    const ordered=columnar?[...lines.filter(l=>l.right>.57&&l.left<.45),...left,...right].sort((a,b)=>{
      const ca=a.right>.57&&a.left<.45?-1:(a.left>.45?1:0),cb=b.right>.57&&b.left<.45?-1:(b.left>.45?1:0);return ca-cb||a.y-b.y;
    }):lines;
    let paragraph=[];
    const emit=()=>{
      if(!paragraph.length)return;
      const runs=paragraph.flatMap(l=>l.runs.toSorted((a,b)=>a.bounds.x-b.bounds.x));
      const text=runs.map(r=>r.text.trim()).join(' ').replace(/\s+/g,' ').trim();
      const rects=paragraph.map(l=>unionRects(l.runs.map(r=>r.bounds)));
      spans.push({id:`p${page.ref.pdfPage}-${spans.length}`,text,heading,section,
        segments:[{page:page.ref,ranges:runs.map(r=>({runId:r.id,start:0,end:r.text.length})),rects,method:page.method}]});paragraph=[];
    };
    for(const line of ordered){
      const text=line.runs.map(r=>r.text.trim()).join(' ').replace(/\s+/g,' ').trim();
      const large=line.runs.some(r=>(r.fontSize||12)>bodySize*1.13);
      const titleCase=line.runs.some(r=>r.fontSize>=bodySize*.96)&&text.split(/\s+/).length<=10&&text.split(/\s+/).every(w=>/^(?:[A-Z][A-Za-z-]*|of|and|for|in|the|to|&)$/.test(w));
      const isHeading=text.length>=3&&text.length<110&&text.split(/\s+/).length<15&&(large||titleCase||(/^[A-Z][A-Z\s()–—:-]{4,}$/.test(text)));
      if(isHeading){emit();heading=text; if(large&&line.runs.some(r=>(r.fontSize||12)>bodySize*1.35))section=text;
        spans.push({id:`p${page.ref.pdfPage}-h${spans.length}`,text,heading,section,isHeading:true,segments:[{page:page.ref,ranges:line.runs.map(r=>({runId:r.id,start:0,end:r.text.length})),rects:[unionRects(line.runs.map(r=>r.bounds))],method:page.method}]});continue;}
      const prev=paragraph.at(-1); const gap=prev?line.y-prev.y:0;
      const prevText=prev?.runs.map(r=>r.text).join(' ')||'';
      if(prev&&(gap>.035||line.left-prev.left>.035||Math.abs(line.left-prev.left)>.25||paragraph.length>=12||(gap>.022&&/[.!?]$/.test(prevText))))emit();
      paragraph.push(line);
    }emit();
  }
  return spans;
}
