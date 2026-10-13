export function chooseWorkspaceView(requested,{current='sources',books=0,results=0,busy=false}={}){
  let usable=current==='questions'||current==='answers'&&results>0?current:'sources';
  if(current==='answers'&&!(results>0))usable=books>0?'questions':'sources';
  if(busy)return usable;
  if(requested==='sources'||requested==='questions')return requested;
  if(requested==='answers'&&results>0)return 'answers';
  return usable;
}
