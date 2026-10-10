export function createController(){
  const state={session:null,questions:[],results:[],activeJob:null};
  return {state,start(){return state.activeJob=crypto.randomUUID();},cancel(){state.activeJob=null;},
    finish(id,patch={}){if(state.activeJob!==id)return false;Object.assign(state,patch,{activeJob:null});return true;},
    removePassage(questionId,passageId){const result=state.results.find(r=>r.question.id===questionId);if(result)result.passages=result.passages.filter(p=>p.id!==passageId);}
  };
}
