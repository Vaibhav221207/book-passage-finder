// App-owned dialogs also work in embedded browsers without window.prompt.
export function requestText({title,label,value='',type='text',submit='Continue',required=true,min,max,signal}){
  if(signal?.aborted)return Promise.resolve(null);
  return new Promise((resolve,reject)=>{
    const dialog=document.createElement('dialog');dialog.className='text-dialog';
    const form=document.createElement('form'),heading=document.createElement('h2'),fieldLabel=document.createElement('label'),input=document.createElement('input'),actions=document.createElement('div'),cancel=document.createElement('button'),accept=document.createElement('button');
    heading.textContent=title;heading.id='text-dialog-title';dialog.setAttribute('aria-labelledby',heading.id);
    fieldLabel.textContent=label;input.type=type;input.value=value;input.required=required;input.autocomplete='off';
    if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;
    fieldLabel.append(input);actions.className='crop-buttons';cancel.type='button';cancel.className='secondary';cancel.textContent='Cancel';accept.type='submit';accept.className='primary';accept.textContent=submit;
    actions.append(cancel,accept);form.append(heading,fieldLabel,actions);dialog.append(form);
    let settled=false;
    function finish(result){if(settled)return;settled=true;signal?.removeEventListener('abort',abort);if(dialog.open)dialog.close();dialog.remove();resolve(result);}
    function abort(){finish(null);}
    cancel.addEventListener('click',()=>finish(null));dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
    form.addEventListener('submit',event=>{event.preventDefault();if(form.reportValidity())finish(input.value);});
    signal?.addEventListener('abort',abort,{once:true});
    try{document.body.append(dialog);dialog.showModal();input.focus();}catch(error){signal?.removeEventListener('abort',abort);dialog.remove();reject(error);}
  });
}
