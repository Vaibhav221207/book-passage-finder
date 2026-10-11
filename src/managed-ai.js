import {ExplanationError,prepareExplanationSources,validateExplanationContent} from './ai.js';

const validId=id=>typeof id==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id);
let tabId;
export function getAnonymousClientId({storage}={}) {
  try { storage??=globalThis.localStorage; const saved=storage?.getItem('bpf-ai-client-v1'); if(validId(saved))return saved; } catch {}
  tabId??=crypto.randomUUID();
  try { storage?.setItem('bpf-ai-client-v1',tabId); } catch {}
  return tabId;
}
const failure=(code,message)=>new ExplanationError(code,message);
const cancelled=()=>new DOMException('Cancelled. Your book answer is kept.','AbortError');
function serviceUrl(endpoint) {
  if(!endpoint)throw failure('not-configured','Shared AI is not connected yet. Your book answer is ready without it.');
  let url;try{url=new URL(endpoint);}catch{throw failure('invalid-input','The AI service address is invalid.');}
  const local=['localhost','127.0.0.1'].includes(url.hostname);
  if((url.protocol!=='https:'&&!(local&&url.protocol==='http:'))||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw failure('invalid-input','The AI service address is invalid.');
  return new URL('/v1/explanations',url).href;
}
function serviceError(status) {
  if(status===429)return failure('quota','The shared AI allowance is used up or busy. Your book answer is still available; try AI again later.');
  return failure('unavailable','AI is temporarily unavailable. Your book answer is still ready to read and download.');
}

/** One explicit request; no student account, key, retry, document upload or
 * paid fallback. Source identity and page references never leave this tab. */
export async function requestManagedExplanation({endpoint,question,sources=[],targetWords=300,mode='book',clientId,signal,fetchImpl=globalThis.fetch,timeoutMs=60000}={}) {
  if(signal?.aborted)throw cancelled();
  const url=serviceUrl(endpoint),text=typeof question==='string'?question:question?.text;
  if(typeof text!=='string'||!text.trim()||text.length>1600||![200,300,450].includes(targetWords)||!validId(clientId)||typeof fetchImpl!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>120000)throw failure('invalid-input','Check the question and answer length before trying AI again.');
  const selected=prepareExplanationSources(sources,mode);
  if(mode==='book'&&!selected.length)throw failure('no-sources','Select matching passages first, or choose a general explanation.');
  if(selected.length>12||selected.reduce((n,s)=>n+s.text.length+(s.heading?.length||0),0)>12000)throw failure('invalid-input','The selected passages are too long for shared AI. Keep the most relevant passages; your book answer is kept.');
  const controller=new AbortController();let timedOut=false;
  const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  const aborted=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(timedOut?failure('timeout','AI took too long. Your book answer is still available.'):cancelled()),{once:true}));
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
  try {
    const operation=(async()=>{
      const response=await fetchImpl(url,{method:'POST',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({question:text.trim(),targetWords,mode,clientId,sources:selected.map(({id,text,heading})=>({id,text,...(heading!=null?{heading}:{})}))})});
      if(!response.ok)throw serviceError(response.status);
      const raw=await response.text();if(raw.length>40000)throw failure('invalid-answer','AI returned an invalid response. Your book answer is kept.');
      let data;try{data=JSON.parse(raw);}catch{throw failure('invalid-answer','AI returned an invalid response. Your book answer is kept.');}
      if(typeof data?.content!=='string'||typeof data?.model!=='string'||data.model.length>160)throw failure('invalid-answer','AI returned an invalid response. Your book answer is kept.');
      const answer=validateExplanationContent(data.content,{sources:selected,mode,targetWords,model:data.model});
      if(Number.isInteger(data.remaining)&&data.remaining>=0&&typeof data.resetAt==='string'&&Number.isFinite(Date.parse(data.resetAt)))answer.allowance={remaining:data.remaining,resetAt:data.resetAt};
      return answer;
    })();
    return await Promise.race([operation,aborted]);
  } catch(error) {
    if(controller.signal.aborted)throw timedOut?failure('timeout','AI took too long. Your book answer is still available.'):cancelled();
    if(error instanceof ExplanationError)throw error;
    throw failure('network','AI could not connect. Your book answer is still available.');
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
