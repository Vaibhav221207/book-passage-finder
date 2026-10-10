import {buildIndex,searchQuestion} from './search.js';
let index,sessionId;
self.onmessage=event=>{
  const {jobId,type,payload}=event.data;
  try{
    if(type==='index'){index=buildIndex(payload.spans);sessionId=payload.sessionId;self.postMessage({jobId,type:'indexed',sessionId});}
    else if(type==='search'&&payload.sessionId===sessionId){const results=payload.questions.map(q=>searchQuestion(index,q,payload.options));self.postMessage({jobId,type:'results',payload:results,sessionId});}
    else if(type==='cancel'){index=null;sessionId=null;}
  }catch(error){self.postMessage({jobId,type:'error',message:error.message});}
};
