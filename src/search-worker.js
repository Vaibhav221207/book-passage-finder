import {indexBooks,searchLibrary} from './library.js';
let indexes,libraryId;
self.onmessage=event=>{
  const {jobId,type,payload}=event.data;
  try{
    if(type==='index'){
      const id=payload.libraryId||payload.sessionId;
      const candidate=indexBooks(payload.books||[{id:payload.sessionId,spans:payload.spans}]);indexes=candidate;libraryId=id;
      self.postMessage({jobId,type:'indexed',libraryId,sessionId:libraryId});
    }
    else if(type==='search'){
      if(!indexes||(payload.libraryId||payload.sessionId)!==libraryId)throw new Error('The loaded books changed. Search again.');
      const results=payload.questions.map(q=>searchLibrary(indexes,q,payload.options));self.postMessage({jobId,type:'results',payload:results,libraryId,sessionId:libraryId});
    }
    else if(type==='cancel'){indexes=null;libraryId=null;}
  }catch(error){self.postMessage({jobId,type:'error',message:error.message});}
};
