export function createController(){
  const state={session:null,books:[],activeBookId:null,questions:[],results:[],activeQuestionIndex:0,activeJob:null};
  const selectQuestion=index=>{if(Number.isInteger(index))state.activeQuestionIndex=Math.max(0,Math.min(state.results.length-1,index));};
  const fingerprint=result=>JSON.stringify([result.question.text,result.passages.map(p=>[p.id,p.text])]);
  return {state,start(){return state.activeJob=crypto.randomUUID();},cancel(){state.activeJob=null;},
    finish(id,patch={}){if(state.activeJob!==id)return false;Object.assign(state,patch,{activeJob:null});if(Object.hasOwn(patch,'results'))state.activeQuestionIndex=0;return true;},
    selectQuestion,
    moveQuestion(delta){selectQuestion(state.activeQuestionIndex+delta);},
    currentResult(){selectQuestion(state.activeQuestionIndex);return state.results[state.activeQuestionIndex]||null;},
    setBooks(books,selected=state.activeBookId){state.books=[...books];state.session=books.find(b=>b.id===selected)||books[0]||null;state.activeBookId=state.session?.id||null;state.results=[];state.activeQuestionIndex=0;},
    selectBook(id){const book=state.books.find(b=>b.id===id);if(!book)throw new Error('Book is no longer open.');state.session=book;state.activeBookId=id;},
    explanationTicket(result){return {result,fingerprint:fingerprint(result)};},
    attachExplanation(ticket,explanation){if(!state.results.includes(ticket.result)||ticket.fingerprint!==fingerprint(ticket.result))return false;ticket.result.explanation=explanation;return true;},
    removePassage(questionId,passageId){const result=state.results.find(r=>r.question.id===questionId);if(result){result.passages=result.passages.filter(p=>p.id!==passageId);delete result.explanation;}}
  };
}
