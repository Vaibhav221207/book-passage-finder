export function createController(){
  const state={session:null,questions:[],results:[],activeQuestionIndex:0,activeJob:null};
  const selectQuestion=index=>{if(Number.isInteger(index))state.activeQuestionIndex=Math.max(0,Math.min(state.results.length-1,index));};
  return {state,start(){return state.activeJob=crypto.randomUUID();},cancel(){state.activeJob=null;},
    finish(id,patch={}){if(state.activeJob!==id)return false;Object.assign(state,patch,{activeJob:null});if(Object.hasOwn(patch,'results'))state.activeQuestionIndex=0;return true;},
    selectQuestion,
    moveQuestion(delta){selectQuestion(state.activeQuestionIndex+delta);},
    currentResult(){selectQuestion(state.activeQuestionIndex);return state.results[state.activeQuestionIndex]||null;},
    removePassage(questionId,passageId){const result=state.results.find(r=>r.question.id===questionId);if(result)result.passages=result.passages.filter(p=>p.id!==passageId);}
  };
}
