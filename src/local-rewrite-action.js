import {compileBookAnswer} from './book-answer.js';
import {rewriteBookAnswer} from './local-rewrite.js';

/** The unlimited action always starts from current book evidence, never an AI
 * draft or a previous rewrite. Selection changes discard it like other drafts. */
export function applyLocalRewrite(controller,result,{targetWords=300}={}){
  if(controller.state.activeJob||!controller.state.results.includes(result))return {status:'blocked'};
  const ticket=controller.explanationTicket(result),original=compileBookAnswer(result,{targetWords});
  result.bookAnswer=original;
  if(!original)return {status:'unavailable'};
  const answer=rewriteBookAnswer(original);
  if(!answer)return {status:'unavailable'};
  if(!answer.rewrite.changedSentences)return {status:'unchanged'};
  return controller.attachExplanation(ticket,answer)?{status:'changed',answer}:{status:'blocked'};
}
