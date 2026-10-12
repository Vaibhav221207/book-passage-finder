export function questionDestination(count,current,key){
  if(!Number.isInteger(count)||count<1||!Number.isInteger(current)||current<0||current>=count)return null;
  if(key==='Home')return 0;
  if(key==='End')return count-1;
  if(key==='ArrowRight')return (current+1)%count;
  if(key==='ArrowLeft')return (current-1+count)%count;
  return null;
}

export function droppedBooks(files){
  return Array.from(files||[]).filter(file=>file&&typeof file==='object'&&typeof file.name==='string'&&(file.type==='application/pdf'||/\.pdf$/i.test(file.name)));
}
