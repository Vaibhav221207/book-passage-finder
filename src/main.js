import {openBook} from './book.js';import {parseQuestions,readAssignment} from './questions.js';import {ocrPages} from './ocr.js';import {makeSourceSpans} from './layout.js';import {createController} from './session.js';import {pageName,wordCount} from './model.js';
const $=id=>document.getElementById(id),controller=createController(),state=controller.state;
let worker,abortController,currentFile,resultRevision=0;
const node=(tag,className='',text='')=>{const n=document.createElement(tag);n.className=className;if(text)n.textContent=text;return n;};
function button(text,fn,className='text-button'){const b=node('button',className,text);b.type='button';b.addEventListener('click',fn);return b;}
function message(text,error=false){$('message').textContent=text;$('message').hidden=!text;$('message').className=`message${error?' error':''}`;}
function updateControls(){const busy=!!state.activeJob;state.questions=parseQuestions($('questions').value);$('find').disabled=busy||!state.session||!state.questions.length;$('export').disabled=busy||!state.results.some(r=>r.passages.length||r.figures.some(f=>f.confirmed));$('run-ocr').disabled=busy||!state.session;$('book-tools').hidden=!state.session;$('progress-area').hidden=!busy;$('assignment-file').disabled=busy;const n=state.questions.length;$('question-count').textContent=n?`${n} question${n===1?'':'s'} detected`:'No questions yet';}
function progress(p){$('progress-label').textContent=`${p.phase} · ${p.completed} / ${p.total}`;$('progress').max=p.total||100;$('progress').value=p.completed||0;}
async function operate(task){
  abortController?.abort();const localAbort=new AbortController();abortController=localAbort;const job=controller.start();updateControls();message('');
  try{const patch=await task(localAbort.signal,job);if(controller.finish(job,patch||{}))updateControls();else if(patch?.session&&patch.session!==state.session)await patch.session.dispose();}
  catch(e){if(state.activeJob===job){controller.finish(job);message(e.name==='AbortError'?'Cancelled. You can try again.':e.message,e.name!=='AbortError');updateControls();}}
}
function workerCall(type,payload,signal,jobId=crypto.randomUUID()){
  const activeWorker=worker;return new Promise((resolve,reject)=>{
    const cleanup=()=>{activeWorker.removeEventListener('message',receive);activeWorker.removeEventListener('error',fail);signal?.removeEventListener('abort',cancel);};
    const receive=e=>{if(e.data.jobId!==jobId)return;cleanup();if(e.data.type==='error')reject(new Error(e.data.message));else resolve(e.data);};
    const fail=e=>{cleanup();reject(new Error(e.message||'Search worker failed.'));};const cancel=()=>{cleanup();reject(new DOMException('Cancelled','AbortError'));};
    activeWorker.addEventListener('message',receive);activeWorker.addEventListener('error',fail);signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted){cancel();return;}activeWorker.postMessage({jobId,type,payload});
  });
}
async function indexSession(session,signal){worker?.terminate();worker=new Worker(new URL('./search-worker.js',import.meta.url),{type:'module'});progress({completed:0,total:1,phase:'Preparing search'});await workerCall('index',{spans:session.spans,sessionId:session.id},signal);}
async function chooseBook(file){
  if(!file)return;currentFile=file;const old=state.session;state.session=null;state.results=[];resultRevision++;renderResults();old?.dispose();
  $('book-title').textContent=file.name;$('book-detail').textContent='Opening textbook…';
  await operate(async(signal)=>{
    const session=await openBook(file,{signal,onProgress:progress,onPassword:async({reason})=>window.prompt(reason==='incorrect-password'?'Incorrect password. Enter the PDF password:':'This PDF is protected. Enter its password:')});
    try{await indexSession(session,signal);}catch(e){await session.dispose();throw e;}
    $('book-detail').textContent=`${session.pageCount} pages · ready to search`;
    $('ocr-description').textContent=session.missingTextPages.length?`${session.missingTextPages.length} pages have little or no readable text. Recognize a selected range to search them.`:'Use OCR only for pages whose text does not extract correctly. The English language download needs a connection.';
    return {session};
  });
  if(!state.session)$('book-detail').textContent='Choose a book to try again';
}
$('book-file').addEventListener('change',e=>{const file=e.target.files[0];e.target.value='';chooseBook(file);});
$('questions').addEventListener('input',updateControls);
$('cancel').addEventListener('click',()=>{abortController?.abort();controller.cancel();message('Cancelled. Your completed selections are kept.');updateControls();});
$('assignment-file').addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;await operate(async signal=>{const qs=await readAssignment(file,{signal,onProgress:progress});$('questions').value=qs.map((q,i)=>`${i+1}. ${q.text}`).join('\n\n');message('Questions imported. Check and edit the text before searching.');return {questions:qs};});});
$('find').addEventListener('click',async()=>{
  const questions=parseQuestions($('questions').value),session=state.session;
  await operate(async(signal,job)=>{progress({completed:0,total:questions.length,phase:'Finding passages'});const response=await workerCall('search',{sessionId:session.id,questions,options:{wordBudget:200}},signal,job);return {results:response.payload,questions};});
  renderResults();if(state.results.length)$('results-heading').scrollIntoView({behavior:'instant',block:'start'});
});
async function viewSource(passage,figure,result){const {openSourceDialog}=await import('./source-view.js');await openSourceDialog(state.session,{passage,figure,onConfirm:selection=>{if(figure)Object.assign(figure,selection,{confirmed:true});else result.figures.push({...selection,id:crypto.randomUUID(),confirmed:true});renderResults();}});}
async function renderResults(){
  const revision=++resultRevision;const host=$('results');host.replaceChildren();$('empty-results').hidden=state.results.length>0;updateControls();
  for(const [i,result]of state.results.entries()){
    const card=node('article','question-card'),head=node('div','question-header');head.append(node('span','q-number',`Q${i+1}`),node('h3','',result.question.text));card.append(head,node('span',`result-status ${result.status}`,result.status==='no-match'?'No reliable match':`${result.status==='partial'?'Partial matches':'Source matches'} · ${result.passages.reduce((s,p)=>s+wordCount(p.text),0)} words`));
    for(const passage of result.passages){
      const wrap=node('div','passage');wrap.append(node('blockquote','',passage.text));const meta=node('div','passage-meta',passage.segments.map(s=>pageName(s.page)).join(' / '));if(passage.segments.some(s=>s.method==='ocr'))meta.append(node('span','','OCR · check the image'));wrap.append(meta);
      const actions=node('div','passage-actions');actions.append(button('View in book',()=>viewSource(passage,null,result)),button('More context',async()=>{const {expandPassage,buildIndex}=await import('./search.js');const full=expandPassage(buildIndex(state.session.spans),passage);Object.assign(passage,full,{originId:full.id});renderResults();}),button('Remove',()=>{controller.removePassage(result.question.id,passage.id);renderResults();},'text-button remove-button'));wrap.append(actions);card.append(wrap);
      import('./source-view.js').then(async({cropSpan})=>{const crops=await cropSpan(state.session,passage,{scale:1.3});if(revision!==resultRevision)return;for(const crop of crops){const img=node('img','source-crop');img.src=URL.createObjectURL(crop.blob);img.alt=`Original source: ${pageName(crop.page)}`;img.addEventListener('load',()=>URL.revokeObjectURL(img.src),{once:true});img.addEventListener('click',()=>viewSource(passage,null,result));wrap.insertBefore(img,actions);}}).catch(()=>{});
    }
    for(const note of result.coverageNotes)card.append(node('p','coverage-note',note));
    if(result.passages.length){const figures=node('div','figure-area');figures.append(node('h4','','Diagrams & tables'),node('p','figure-help','Check the original page, adjust the crop, then include the figure you need.'));const addFigures=list=>{for(const figure of list){const row=node('div','figure-row'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=figure.confirmed;checkbox.id=`figure-${figure.id}`;checkbox.addEventListener('change',()=>{figure.confirmed=checkbox.checked;updateControls();});const label=node('label','',`${figure.caption} · ${pageName(figure.page)}`);label.htmlFor=checkbox.id;row.append(checkbox,label,button('View / crop',()=>viewSource(null,figure,result)));figures.append(row);}figures.append(button('Choose a figure from source',()=>viewSource(result.passages[0],null,result)));};
      if(!result.figures.length)import('./figures.js').then(({suggestFigures})=>{if(revision!==resultRevision)return;result.figures=suggestFigures(state.session,result);addFigures(result.figures);}).catch(()=>addFigures([]));else addFigures(result.figures);card.append(figures);
    }host.append(card);
  }
}
$('run-ocr').addEventListener('click',async()=>{const raw=$('ocr-range').value.trim(),match=raw.match(/^(\d+)(?:\s*-\s*(\d+))?$/);if(!match){message('Enter a PDF page or range, such as 20-25.',true);return;}const start=+match[1],end=+(match[2]||match[1]);if(start<1||end<start||end>state.session.pageCount||end-start>29){message('Choose a valid range of up to 30 PDF pages. You can recognize more in another batch.',true);return;}const session=state.session;await operate(async signal=>{const pages=await ocrPages(session,Array.from({length:end-start+1},(_,i)=>start+i),{signal,onProgress:progress});if(!pages.some(p=>p.runs.length))throw new Error('No readable text found in the selected pages.');for(const p of pages)session.pages[p.ref.pdfPage-1]=p;session.spans=makeSourceSpans(session.pages);await indexSession(session,signal);message(`${pages.length} pages recognized. Check OCR passages against the originals.`);});});
$('export').addEventListener('click',()=>operate(async signal=>{const {exportPacket,downloadBlob}=await import('./export.js');const blob=await exportPacket(state.session,state.results,{signal,onProgress:progress});downloadBlob(blob,'book-passages.pdf');message(`Downloaded ${blob.pageCount} PDF pages with your selected passages and figures.`);}));
$('save-book').addEventListener('click',async()=>{try{const {saveBook}=await import('./storage.js');await saveBook(currentFile);await refreshSaved();message('Book saved on this device. You can delete it below.');}catch(e){message(`Unable to save here. ${e.message}`,true);}});
$('saved-books').addEventListener('change',async e=>{if(!e.target.value)return;try{const {loadSavedBook}=await import('./storage.js');await chooseBook(await loadSavedBook(e.target.value));}catch(e){message(e.message,true);}});
$('delete-saved').addEventListener('click',async()=>{const id=$('saved-books').value;if(!id)return;const {deleteSavedBook}=await import('./storage.js');await deleteSavedBook(id);await refreshSaved();message('Saved copy deleted.');});
async function refreshSaved(){try{const {listSavedBooks}=await import('./storage.js'),books=await listSavedBooks();$('saved-row').hidden=!books.length;$('saved-books').replaceChildren(new Option('Choose a saved book',''),...books.map(b=>new Option(b.name,b.id)));}catch{}}
$('page-label').addEventListener('click',()=>{const n=Number(window.prompt('Which physical PDF page do you want to label?'));if(!Number.isInteger(n)||n<1||n>state.session.pageCount)return;const label=window.prompt(`Printed label on PDF page ${n} (blank removes it):`,state.session.pages[n-1].ref.printedLabel||'');if(label===null)return;state.session.pages[n-1].ref.printedLabel=label.trim()||null;for(const result of state.results)for(const p of result.passages)for(const s of p.segments)if(s.page.pdfPage===n)s.page.printedLabel=label.trim()||null;renderResults();});
$('close-source').addEventListener('click',()=>$('source-dialog').close());
window.addEventListener('beforeunload',()=>{worker?.terminate();state.session?.dispose();});
updateControls();refreshSaved();
