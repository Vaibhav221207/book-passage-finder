import {openBook} from './book.js';
import {parseQuestions,readAssignment} from './questions.js';
import {ocrPages,prepareOcrUpdate} from './ocr.js';
import {createController} from './session.js';
import {pageName,wordCount,abortIfNeeded,resolveResultReferences} from './model.js';
import {getBook} from './library.js';
import {requestText} from './text-dialog.js';
import {buildAnswerSources,requestExplanation} from './ai.js';
import {findAnswerPassage} from './answer-source.js';
import {compileBookAnswer} from './book-answer.js';
import {requestManagedExplanation,getAnonymousClientId} from './managed-ai.js';
import {MANAGED_AI_ENDPOINT} from './service-config.js';
import {questionDestination,droppedBooks} from './studio.js';

const $=id=>document.getElementById(id),controller=createController(),state=controller.state;
const files=new Map();
let worker,libraryId,abortController,resultRevision=0,apiKey='',sourceOpening=false,aiAllowance;
const context=()=>({books:state.books});
const targetWords=()=>Number($('answer-length').value)||300;
const node=(tag,className='',text='')=>{const n=document.createElement(tag);n.className=className;if(text)n.textContent=text;return n;};
function button(text,fn,className='text-button'){const b=node('button',className,text);b.type='button';b.disabled=!!state.activeJob;b.addEventListener('click',fn);return b;}
function message(text,error=false){$('message').textContent=text;$('message').hidden=!text;$('message').className=`message${error?' error':''}`;}
function updateControls(){
  const busy=!!state.activeJob;state.questions=parseQuestions($('questions').value);
  document.body.classList.toggle('is-busy',busy);
  if(busy||!state.results.length)setFocusMode(false);
  if($('focus-toggle'))$('focus-toggle').disabled=busy||!state.results.length;
  $('find').disabled=busy||!state.books.length||!state.questions.length;
  $('export').disabled=busy||!state.results.some(r=>r.passages.length||r.figures.some(f=>f.confirmed)||r.explanation||r.bookAnswer);
  $('run-ocr').disabled=busy||!state.session;$('book-tools').hidden=!state.session;$('progress-area').hidden=!busy;
  for(const id of ['book-file','assignment-file','active-book','answer-length','questions','save-book','page-label','saved-books','delete-saved','connect-ai'])$(id).disabled=busy;
  for(const b of document.querySelectorAll('#library-books button, #results button, #results input'))b.disabled=busy||(b.dataset.needsAi==='true'&&!apiKey&&!MANAGED_AI_ENDPOINT);
  for(const b of document.querySelectorAll('#desk-question-list button, #empty-results button'))b.disabled=busy;
  $('question-select').disabled=busy;
  $('question-previous').disabled=busy||state.activeQuestionIndex===0;
  $('question-next').disabled=busy||state.activeQuestionIndex>=state.results.length-1;
  const n=state.questions.length;$('question-count').textContent=n?`${n} question${n===1?'':'s'} detected`:'No questions yet';serviceStatus();
}
function progress(p){$('progress-label').textContent=`${p.phase} · ${p.completed} / ${p.total}`;$('progress').max=p.total||100;$('progress').value=p.completed||0;}
async function operate(task){
  abortController?.abort();const localAbort=new AbortController();abortController=localAbort;const job=controller.start();updateControls();message('');
  try{const patch=await task(localAbort.signal,job);if(controller.finish(job,patch||{}))updateControls();}
  catch(e){if(state.activeJob===job){controller.finish(job);message(e.name==='AbortError'?'Cancelled. You can try again.':e.message,e.name!=='AbortError');updateControls();}}
}
function workerCall(type,payload,signal,jobId=crypto.randomUUID(),activeWorker=worker){
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{activeWorker.removeEventListener('message',receive);activeWorker.removeEventListener('error',fail);signal?.removeEventListener('abort',cancel);};
    const receive=e=>{if(e.data.jobId!==jobId)return;cleanup();if(e.data.type==='error')reject(new Error(e.data.message));else resolve(e.data);};
    const fail=e=>{cleanup();reject(new Error(e.message||'Search worker failed.'));};
    const cancel=()=>{cleanup();reject(new DOMException('Cancelled','AbortError'));};
    activeWorker.addEventListener('message',receive);activeWorker.addEventListener('error',fail);signal?.addEventListener('abort',cancel,{once:true});
    if(signal?.aborted){cancel();return;}activeWorker.postMessage({jobId,type,payload});
  });
}
async function indexLibrary(books,signal){
  const candidate=new Worker(new URL('./search-worker.js',import.meta.url),{type:'module'}),id=crypto.randomUUID();
  try{progress({completed:0,total:1,phase:'Preparing book search'});await workerCall('index',{books:books.map(b=>({id:b.id,filename:b.filename,spans:b.spans})),libraryId:id},signal,crypto.randomUUID(),candidate);abortIfNeeded(signal);worker?.terminate();worker=candidate;libraryId=id;}
  catch(e){candidate.terminate();throw e;}
}
function renderLibrary(){
  $('library').hidden=!state.books.length;$('active-book').replaceChildren(...state.books.map(b=>new Option(b.filename,b.id)));$('active-book').value=state.activeBookId||'';
  const host=$('library-books');host.replaceChildren();
  for(const [i,book] of state.books.entries()){
    const active=book.id===state.activeBookId,row=node('div',`book-tile${active?' is-active':''}`);row.dataset.bookSlot=String(i%4);row.dataset.bookId=book.id;
    const select=button('',()=>{controller.selectBook(book.id);renderLibrary();host.querySelector(`[data-book-id="${book.id}"] .book-select`)?.focus({preventScroll:true});},'book-select');select.setAttribute('aria-pressed',String(active));select.setAttribute('aria-label',`Use ${book.filename} for source viewing and book tools`);
    const spine=node('span','book-spine',String(i+1).padStart(2,'0'));spine.setAttribute('aria-hidden','true');
    const info=node('span','book-info'),name=node('span','book-name',book.filename.replace(/\.pdf$/i,'').replace(/_/g,' '));name.title=book.filename;
    info.append(name,node('span','book-meta',`${book.pageCount} pages${active?' · Selected':''}`));select.append(spine,info);
    const remove=button('×',()=>removeBook(book.id),'book-remove');remove.setAttribute('aria-label',`Remove ${book.filename}`);remove.title='Remove book';row.append(select,remove);host.append(row);
  }
  const total=state.books.reduce((sum,b)=>sum+b.pageCount,0);
  $('book-title').textContent=state.books.length?`${state.books.length} book${state.books.length===1?'':'s'} open`:'Add your textbooks';
  $('book-detail').textContent=state.books.length?`${total} pages · ready to search`:'Select one or more PDFs from your device';
  $('ocr-description').textContent=state.session?.missingTextPages.length?`${state.session.missingTextPages.length} pages in this book have little readable text. Recognize a selected range.`:'Choose the book above, then recognize pages whose text does not extract correctly. OCR downloads English language data.';
  updateControls();
}
async function addBooks(selected){
  if(!selected.length||state.activeJob)return;
  await operate(async(signal,job)=>{
    const failures=[];
    for(const file of selected){
      abortIfNeeded(signal);$('book-detail').textContent=`Opening ${file.name}…`;
      let book;
      try{
        book=await openBook(file,{signal,onProgress:progress,onPassword:({reason})=>requestText({title:reason==='incorrect-password'?'Incorrect password. Try again.':'Unlock this PDF',label:'PDF password',type:'password',submit:'Open PDF',signal})});
        await indexLibrary([...state.books,book],signal);abortIfNeeded(signal);if(state.activeJob!==job)throw new DOMException('Cancelled','AbortError');
        files.set(book.id,file);controller.setBooks([...state.books,book],book.id);renderLibrary();renderResults();
      }catch(e){if(book)await book.dispose();if(e.name==='AbortError')throw e;failures.push(`${file.name}: ${e.message}`);}
    }
    message(failures.length?`Some books could not be added. ${failures.join(' ')} Other open books are kept.`:'Books ready. Search includes every open book.',!!failures.length);
  });renderLibrary();
}
async function removeBook(id){
  if(state.activeJob)return;const book=getBook(context(),id),remaining=state.books.filter(b=>b.id!==id);
  await operate(async signal=>{await indexLibrary(remaining,signal);abortIfNeeded(signal);controller.setBooks(remaining);files.delete(id);await book.dispose();renderLibrary();renderResults();message('Book removed. Search again with the remaining books.');});
}
$('book-file').addEventListener('change',e=>{const selected=[...e.target.files];e.target.value='';addBooks(selected);});
$('active-book').addEventListener('change',e=>{controller.selectBook(e.target.value);renderLibrary();});
function setFocusMode(enabled){
  const active=!!enabled&&!!state.results.length&&!state.activeJob;document.body.classList.toggle('focus-mode',active);
  const toggle=$('focus-toggle');if(toggle){toggle.setAttribute('aria-pressed',String(active));toggle.textContent=active?'Back to desk':'Focus view';}
}
$('focus-toggle')?.addEventListener('click',()=>{setFocusMode(!document.body.classList.contains('focus-mode'));if(document.body.classList.contains('focus-mode'))$('focus-toggle').closest('.results-top').scrollIntoView({behavior:'instant',block:'start'});});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('focus-mode')&&!document.querySelector('dialog[open]')){setFocusMode(false);$('focus-toggle')?.focus();}});
$('empty-add-book')?.addEventListener('click',()=>$('book-file').click());
$('empty-add-questions')?.addEventListener('click',()=>{$('questions').scrollIntoView({behavior:'instant',block:'center'});$('questions').focus();});
let dragDepth=0;const dropzone=$('book-dropzone');
const fileDrag=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
dropzone?.addEventListener('dragenter',e=>{if(!fileDrag(e))return;e.preventDefault();dragDepth++;if(!state.activeJob)dropzone.classList.add('is-dragging');});
dropzone?.addEventListener('dragover',e=>{if(!fileDrag(e))return;e.preventDefault();e.dataTransfer.dropEffect=state.activeJob?'none':'copy';});
dropzone?.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)dropzone.classList.remove('is-dragging');});
dropzone?.addEventListener('drop',e=>{if(!fileDrag(e))return;e.preventDefault();dragDepth=0;dropzone.classList.remove('is-dragging');if(state.activeJob)return;const selected=droppedBooks(e.dataTransfer.files);if(!selected.length){message('Drop a PDF textbook here. Assignment images go in the assignment upload.',true);return;}addBooks(selected);});
function selectBookmark(index,focus=false){if(state.activeJob)return;controller.selectQuestion(index);renderResults();if(focus){const selected=$('desk-question-list')?.querySelector(`[data-question-index="${index}"]`);selected?.focus({preventScroll:true});selected?.scrollIntoView({behavior:'instant',block:'nearest',inline:'nearest'});}}
$('desk-question-list')?.addEventListener('keydown',e=>{const index=Number(e.target.closest('[data-question-index]')?.dataset.questionIndex);const next=questionDestination(state.results.length,index,e.key);if(next==null||state.activeJob)return;e.preventDefault();selectBookmark(next,true);});
$('questions').addEventListener('input',()=>{state.results=[];renderResults();});
$('answer-length').addEventListener('change',()=>{for(const r of state.results)delete r.explanation;renderResults();message('Length updated. Find passages again for more source context, or generate a new explanation.');});
$('question-select').addEventListener('change',e=>{controller.selectQuestion(Number(e.target.value));renderResults();});
for(const [id,delta]of [['question-previous',-1],['question-next',1]])$(id).addEventListener('click',()=>{controller.moveQuestion(delta);renderResults();$('question-navigation').scrollIntoView({behavior:'instant',block:'start'});});
$('cancel').addEventListener('click',()=>{abortController?.abort();controller.cancel();message('Cancelled. Your completed selections are kept.');updateControls();});
$('assignment-file').addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;await operate(async signal=>{const qs=await readAssignment(file,{signal,onProgress:progress});abortIfNeeded(signal);$('questions').value=qs.map((q,i)=>`${i+1}. ${q.text}`).join('\n\n');message('Questions imported. Check and edit the text before searching.');return {questions:qs,results:[]};});renderResults();});
$('find').addEventListener('click',async()=>{
  const questions=parseQuestions($('questions').value),library=context();
  await operate(async(signal,job)=>{progress({completed:0,total:questions.length,phase:'Finding passages'});const response=await workerCall('search',{libraryId,questions,options:{wordBudget:targetWords()}},signal,job);return {results:resolveResultReferences(library,response.payload),questions};});
  renderResults();if(state.results.length)$('results-heading').closest('.results-top').scrollIntoView({behavior:'instant',block:'start'});
});
async function viewSource(passage,figure,result){
  if(state.activeJob||sourceOpening||$('source-dialog').open)return;sourceOpening=true;
  try{const {openSourceDialog}=await import('./source-view.js');if(state.activeJob||!state.results.includes(result))return;
    await openSourceDialog(context(),{passage,figure,bookId:state.activeBookId,onConfirm:selection=>{if(!state.results.includes(result))return;if(figure)Object.assign(figure,selection,{confirmed:true});else result.figures.push({...selection,id:crypto.randomUUID(),confirmed:true});renderResults();}});
  }catch(e){message(`Unable to open the source. ${e.message}`,true);}finally{sourceOpening=false;}
}
function keyStatus(){
  $('ai-connection').textContent=apiKey?'Key ready for this tab. Free requests only.':'Optional. Book search works without a key.';
  $('disconnect-ai').hidden=!apiKey;$('connect-ai').textContent=apiKey?'Replace key':'Use this key';
}
function serviceStatus(){
  const host=$('ai-service-status');if(!host)return;
  host.textContent=apiKey?'Personal AI is connected. Book answers are always available.':!MANAGED_AI_ENDPOINT?'Book answers work without setup. Shared AI is not connected yet.':aiAllowance&&Date.parse(aiAllowance.resetAt)>Date.now()?`${aiAllowance.remaining} AI requests left in your daily allowance. Book answers are always available.`:'Shared AI: up to 8 requests daily, within the app allowance. No account or download needed.';
}
$('connect-ai').addEventListener('click',()=>{const key=$('ai-key').value.trim();if(!key){message('Paste your OpenRouter key in the advanced AI settings field.',true);$('ai-key').focus();return;}apiKey=key;$('ai-key').value='';keyStatus();renderResults();message('Personal AI connected for this tab.');});
$('disconnect-ai').addEventListener('click',()=>{apiKey='';$('ai-key').value='';abortController?.abort();controller.cancel();keyStatus();renderResults();message('Personal key cleared. Book answers remain available.');});
async function explain(result){
  if(state.activeJob)return;
  if(!apiKey&&!MANAGED_AI_ENDPOINT){message('Shared AI is not connected yet. Your answer from the books is ready to read and download.');return;}
  const sources=buildAnswerSources(result),mode=sources.length?'book':'general',ticket=controller.explanationTicket(result);
  // A failed or cancelled attempt may still consume a reserved request.
  // Keep a count only when the service has confirmed it for this attempt.
  if(!apiKey)aiAllowance=undefined;
  await operate(async(signal,job)=>{
    progress({completed:0,total:1,phase:'Making your answer clearer'});
    const answer=apiKey?await requestExplanation({apiKey,question:result.question.text,sources,targetWords:targetWords(),mode,signal}):await requestManagedExplanation({endpoint:MANAGED_AI_ENDPOINT,clientId:getAnonymousClientId(),question:result.question.text,sources,targetWords:targetWords(),mode,signal});
    abortIfNeeded(signal);if(state.activeJob!==job)return;
    if(controller.attachExplanation(ticket,answer)){if(answer.allowance)aiAllowance=answer.allowance;message(mode==='book'?'AI answer ready. Check the linked source pages.':'General AI answer ready. It is not verified against your books.');progress({completed:1,total:1,phase:'Answer ready'});}
  });renderResults();
}
function renderExplanation(card,result){
  const area=node('section','explanation-area');area.append(node('h4','','Your study answer'));
  const answer=result.explanation||result.bookAnswer;
  if(!answer)area.append(node('p','explanation-help',result.passages.length?'The selected passages do not contain complete sentences for a draft. Review the source or try AI.':'These books do not provide a reliable answer. Add another textbook or your lecture notes, or try an unverified general AI answer.'));
  const actions=node('div','explanation-actions'),aiButton=button(result.explanation?'Rewrite with AI':result.passages.length?'Improve with AI':'Try a general AI answer',()=>explain(result),'secondary');aiButton.dataset.needsAi='true';actions.append(aiButton);
  if(answer){
    const label=answer.mode==='general'?'General AI answer · not verified against your books':answer.mode==='extractive'?'Organized textbook sentences · linked to the original pages':'AI explanation · based on the selected book passages';
    const draft=node('div',`answer-draft ${answer.mode} ${answer.mode==='extractive'?'book-answer':''}`);draft.append(node('p','answer-label',label));if(answer.title&&answer.title!=='Answer from your books')draft.append(node('h4','',answer.title));
    for(const section of answer.sections){if(section.heading)draft.append(node('h5','',section.heading));draft.append(node('p','answer-text',section.text));
      const citations=node('div','answer-citations');for(const id of section.sourceIds){const source=answer.sources.find(s=>s.id===id);if(!source)continue;citations.append(button(`[${id}] ${source.bookName||'Source'}`,()=>{const passage=findAnswerPassage(result,source);if(passage)viewSource(passage,null,result);}));}if(citations.childNodes.length)draft.append(citations);
    }
    for(const gap of answer.missingDetails||[])draft.append(node('p','coverage-note',gap));
    draft.append(node('p','answer-model',`${answer.sections.reduce((n,s)=>n+wordCount(s.text),0)} words · ${answer.mode==='extractive'?'assembled on your device':'review the source before using'}`));
    actions.append(button('Copy answer',async()=>{try{const text=[label,answer.title,...answer.sections.map(s=>`${s.heading?s.heading+'\n':''}${s.text}${s.sourceIds.length?' ['+s.sourceIds.join(', ')+']':''}`),...(answer.missingDetails||[]),...answer.sources.map(s=>`[${s.id}] ${s.pages.map(pageName).join(' / ')}`)].join('\n\n');await navigator.clipboard.writeText(text);message('Answer copied with its source references.');}catch{message('Copy is unavailable here. Select the answer text to copy it.',true);}}));
    if(result.explanation)actions.append(button('Use book answer',()=>{delete result.explanation;renderResults();}));area.append(draft);
  }
  area.append(actions,node('p','explanation-help',!MANAGED_AI_ENDPOINT&&!apiKey?'Book answers need no account, key or download. Shared AI is currently unavailable.':`AI aims for about ${targetWords()} words. It sends the question and selected text to ${apiKey?'OpenRouter':'our AI service'} when you click; your full PDFs stay here.`));card.append(area);
}
async function renderResults(){
  for(const r of state.results)r.bookAnswer=compileBookAnswer(r,{targetWords:targetWords()});
  const revision=++resultRevision,host=$('results');host.replaceChildren();$('empty-results').hidden=state.results.length>0;updateControls();
  const result=controller.currentResult(),i=state.activeQuestionIndex,library=context();$('question-navigation').hidden=!result;
  const queue=$('desk-question-list');if(queue){queue.replaceChildren(...state.results.map((r,n)=>{const tab=button('',()=>selectBookmark(n,true),`question-tab${n===i?' is-active':''}`);tab.dataset.questionIndex=String(n);tab.tabIndex=n===i?0:-1;tab.setAttribute('aria-current',n===i?'true':'false');tab.setAttribute('aria-label',`Question ${n+1}: ${r.question.text}`);tab.title=r.question.text;tab.append(node('span','question-tab-number',`Q${n+1}`),node('span','question-tab-copy',r.question.text),node('span','question-tab-status',r.status==='no-match'?'Needs a source':'Book passages'));return tab;}));}if(!result)return;
  $('question-select').replaceChildren(...state.results.map((r,n)=>new Option(`Q${n+1} · ${r.question.text}`,String(n))));$('question-select').value=String(i);
  $('question-position').textContent=`${i+1} of ${state.results.length}`;$('question-previous').disabled=!!state.activeJob||i===0;$('question-next').disabled=!!state.activeJob||i===state.results.length-1;
  const card=node('article','question-card'),head=node('div','question-header');head.append(node('span','q-number',`Q${i+1}`),node('h3','',result.question.text));
  card.append(head,node('span',`result-status ${result.status}`,result.status==='no-match'?'No match found in open books':!result.passages.length?'No passages selected':`${result.status==='partial'?'Partial matches':'Source matches'} · ${result.passages.reduce((s,p)=>s+wordCount(p.text),0)} source words`));renderExplanation(card,result);
  if(result.bookSummaries?.length>1){const notes=node('details','book-coverage');notes.append(node('summary','',`Searched ${result.bookSummaries.length} books`));for(const b of result.bookSummaries)notes.append(node('p','',`${b.name}: ${b.status==='no-match'?'no reliable passage':b.status==='partial'?'partial matches':'source matches'}`));card.append(notes);}
  const evidence=node('details','evidence-details');if(result.passages.length){evidence.append(node('summary','',`Book passages and screenshots (${result.passages.length})`));card.append(evidence);}
  for(const passage of result.passages){
    const wrap=node('div','passage');wrap.append(node('blockquote','',passage.text));const meta=node('div','passage-meta',passage.segments.map(s=>pageName(s.page)).join(' / '));if(passage.segments.some(s=>s.method==='ocr'))meta.append(node('span','','OCR · check the image'));wrap.append(meta);
    const actions=node('div','passage-actions');actions.append(button('View in book',()=>viewSource(passage,null,result)),button('More context',async()=>{if(state.activeJob)return;const book=getBook(library,passage.bookId||passage.segments[0]?.page.bookId),{expandPassage,buildIndex}=await import('./search.js');const full=expandPassage(buildIndex(book.spans),passage);Object.assign(passage,full,{originId:full.id});delete result.explanation;renderResults();}),button('Remove',()=>{controller.removePassage(result.question.id,passage.id);renderResults();},'text-button remove-button'));wrap.append(actions);evidence.append(wrap);
    const preview=node('details','source-preview');preview.append(node('summary','','Show original page crop'));wrap.insertBefore(preview,actions);let loaded=false;
    preview.addEventListener('toggle',async()=>{if(!preview.open||loaded)return;loaded=true;const loading=node('p','','Loading source crop…');preview.append(loading);
      try{const {cropSpan}=await import('./source-view.js'),crops=await cropSpan(library,passage,{scale:2});if(revision!==resultRevision)return;loading.remove();
        for(const [n,crop]of crops.entries()){const img=node('img','source-crop');img.src=URL.createObjectURL(crop.blob);img.alt=`Original source: ${pageName(crop.page)}`;img.addEventListener('load',()=>URL.revokeObjectURL(img.src),{once:true});img.addEventListener('click',()=>viewSource(passage,null,result));preview.append(img,button('Download this screenshot',async()=>{const {downloadBlob}=await import('./export.js');downloadBlob(crop.blob,`passage-${i+1}-pdf-${crop.page.pdfPage}-${n+1}.png`);}));}
      }catch{loading.textContent='Preview unavailable. Use View in book to check the page.';loaded=false;}
    });
  }
  for(const note of result.coverageNotes||[])card.append(node('p','coverage-note',note));
  if(state.books.length){
    const figures=node('div','figure-area');figures.append(node('h4','','Diagrams & tables'),node('p','figure-help','Review each crop before including it. Resize the selection or capture the full page to keep labels and rows.'));
    const addFigures=list=>{for(const figure of list){const row=node('div','figure-row'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=figure.confirmed;checkbox.disabled=!!state.activeJob;checkbox.id=`figure-${figure.id}`;checkbox.addEventListener('change',()=>{if(checkbox.checked&&!figure.confirmed){checkbox.checked=false;viewSource(null,figure,result);}else{figure.confirmed=checkbox.checked;renderResults();}});
        const label=node('label','',`${figure.caption} · ${pageName(figure.page)}`);label.htmlFor=checkbox.id;label.append(node('span',`figure-state${figure.confirmed?' included':''}`,figure.confirmed?'Included in PDF':'Review crop'));row.append(checkbox,label,button('View / crop',()=>viewSource(null,figure,result)));figures.append(row);}
      figures.append(button('Choose a figure or table from source',()=>viewSource(null,null,result)));};
    if(!result.figures.length)import('./figures.js').then(({suggestFigures})=>{if(revision!==resultRevision)return;result.figures=suggestFigures(library,result);addFigures(result.figures);}).catch(()=>{if(revision===resultRevision)addFigures([]);});else addFigures(result.figures);card.append(figures);
  }
  host.append(card);updateControls();
}
$('run-ocr').addEventListener('click',async()=>{
  const raw=$('ocr-range').value.trim(),match=raw.match(/^(\d+)(?:\s*-\s*(\d+))?$/);if(!match){message('Enter a PDF page or range, such as 20-25.',true);return;}
  const start=+match[1],end=+(match[2]||match[1]),book=state.session;
  if(start<1||end<start||end>book.pageCount||end-start>29){message('Choose a valid range of up to 30 PDF pages.',true);return;}
  await operate(async(signal,job)=>{
    const pages=await ocrPages(book,Array.from({length:end-start+1},(_,i)=>start+i),{signal,onProgress:progress}),update=prepareOcrUpdate(book,pages,{signal});
    await indexLibrary(state.books.map(b=>b.id===book.id?{...book,...update}:b),signal);abortIfNeeded(signal);if(state.activeJob!==job)throw new DOMException('Cancelled','AbortError');
    Object.assign(book,update);controller.setBooks(state.books,book.id);message(`${pages.length-update.skipped.length} pages recognized. Check OCR against the originals, then search again.`);
  });renderLibrary();renderResults();
});
$('export').addEventListener('click',()=>operate(async signal=>{const {exportPacket,downloadBlob}=await import('./export.js');const blob=await exportPacket(context(),state.results,{signal,onProgress:progress});downloadBlob(blob,'book-passages.pdf');message(`Downloaded ${blob.pageCount} PDF pages with your selected answers and figures.`);}));
$('save-book').addEventListener('click',async()=>{try{const {saveBook}=await import('./storage.js');await saveBook(files.get(state.activeBookId));await refreshSaved();message('Book saved on this device.');}catch(e){message(`Unable to save here. ${e.message}`,true);}});
$('saved-books').addEventListener('change',async e=>{if(!e.target.value)return;try{const {loadSavedBook}=await import('./storage.js');await addBooks([await loadSavedBook(e.target.value)]);}catch(e){message(e.message,true);}});
$('delete-saved').addEventListener('click',async()=>{const id=$('saved-books').value;if(!id)return;const {deleteSavedBook}=await import('./storage.js');await deleteSavedBook(id);await refreshSaved();message('Saved copy deleted.');});
async function refreshSaved(){try{const {listSavedBooks}=await import('./storage.js'),books=await listSavedBooks();$('saved-row').hidden=!books.length;$('saved-books').replaceChildren(new Option('Add a saved book',''),...books.map(b=>new Option(b.name,b.id)));}catch{}}
$('page-label').addEventListener('click',async()=>{
  const book=state.session;if(!book)return;const n=Number(await requestText({title:'Correct a printed page label',label:'Physical PDF page',type:'number',value:'1',min:1,max:book.pageCount}));
  if(!Number.isInteger(n)||n<1||n>book.pageCount)return;const label=await requestText({title:`Printed label for PDF page ${n}`,label:'Printed page label (blank removes it)',value:book.pages[n-1].ref.printedLabel||'',required:false,submit:'Save label'});
  if(label===null||!state.books.includes(book))return;book.pages[n-1].ref.printedLabel=label.trim()||null;resolveResultReferences(context(),state.results);renderResults();
});
$('close-source').addEventListener('click',()=>$('source-dialog').close());
window.addEventListener('beforeunload',()=>{apiKey='';abortController?.abort();worker?.terminate();for(const book of state.books)book.dispose();});
updateControls();refreshSaved();keyStatus();
