(()=>{
 const dialog=document.getElementById('pageDialog'),entry=document.getElementById('listEntry'),list=document.getElementById('listItems'),status=document.getElementById('pageStatus');
 const menu=document.getElementById('listItemMenu'),editDialog=document.getElementById('listEditDialog'),editText=document.getElementById('listEditText');
 let selectedId=null,pressTimer=null,pressPoint=null;

 let items=[],returnFocus=null,recognition=null,silence=null,clickTimer=null,session=0,dragged=null;
 const store=window.createDayFlowListStore(rows=>{items=rows;render();},message=>{status.textContent=message;});
 window.connectDayFlowList=(client,user)=>{clearTimeout(clickTimer);clearTimeout(pressTimer);stop();menu.close();editDialog.close();entry.value='';selectedId=null;return store.connect(client,user);};
 function move(from,to){if(from!==to)store.move(from,to);}
 function render(){
  list.replaceChildren();
  items.forEach((item,index)=>{
   const row=document.createElement('li');row.className='list-item';row.draggable=true;
   const handle=document.createElement('span');handle.textContent='⠿';handle.className='list-handle';handle.setAttribute('aria-label','Drag to reorder');
   const label=document.createElement('span');label.textContent=item.text;label.className='list-label';
   row.append(handle,label);row.tabIndex=0;
   function openMenu(){clearTimeout(pressTimer);stop();selectedId=item.id;menu.showModal();document.getElementById('listItemEdit').focus();}
   row.addEventListener('pointerdown',event=>{if(event.target===handle)return;clearTimeout(pressTimer);pressPoint={x:event.clientX,y:event.clientY};pressTimer=setTimeout(openMenu,550);});
   row.addEventListener('pointermove',event=>{if(pressPoint&&Math.hypot(event.clientX-pressPoint.x,event.clientY-pressPoint.y)>8)clearTimeout(pressTimer);});
   for(const type of ['pointerup','pointercancel','pointerleave','dragstart'])row.addEventListener(type,()=>clearTimeout(pressTimer));
   row.addEventListener('contextmenu',event=>{event.preventDefault();if(!menu.open)openMenu();});
   row.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10')){event.preventDefault();openMenu();}});
   row.addEventListener('dragstart',event=>{dragged=index;event.dataTransfer.setData('text/plain',String(index));event.dataTransfer.effectAllowed='move';});
   row.addEventListener('dragover',event=>event.preventDefault());
   row.addEventListener('drop',event=>{event.preventDefault();if(dragged!==null)move(dragged,index);dragged=null;});
   row.addEventListener('dragend',()=>{dragged=null;});
   handle.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse')return;
    event.preventDefault();handle.setPointerCapture(event.pointerId);dragged=index;row.classList.add('list-dragging');
   });
   handle.addEventListener('pointerup',event=>{
    if(event.pointerType==='mouse'||dragged===null)return;
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.list-item');
    const to=Array.from(list.children).indexOf(target);row.classList.remove('list-dragging');if(to>=0)move(dragged,to);dragged=null;
   });
   handle.addEventListener('pointercancel',()=>{dragged=null;row.classList.remove('list-dragging');});
   list.append(row);
  });
 }
 function stop(){session++;clearTimeout(silence);silence=null;const old=recognition;recognition=null;old?.abort();}
 function add(){const value=entry.value.trim();stop();if(!value)return;store.add(value);entry.value='';}
 function keyboard(){clearTimeout(clickTimer);stop();entry.readOnly=false;entry.focus();status.textContent='Type an item and press Enter.';}
 function listen(){
  stop();entry.readOnly=true;
  const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Speech){keyboard();status.textContent='Voice input is unavailable in this browser. Type an item instead.';return;}
  const token=session,base=entry.value.trim();let transcript='';
  const arm=()=>{clearTimeout(silence);silence=setTimeout(()=>{if(token!==session)return;if(entry.value.trim())add();else{stop();status.textContent='No speech heard. Click to try again.';}},3000);};
  function start(){
   if(token!==session)return;
   const rec=new Speech();recognition=rec;// Capture one finalized utterance at a time. Mobile recognizers can otherwise
   // return cumulative phrase snapshots as separate continuous results.
   rec.continuous=false;rec.interimResults=false;rec.lang=navigator.language||'en-US';
   let segment='';
   rec.onstart=()=>{if(token===session&&recognition===rec){status.textContent='Listening… items are added after 3 seconds of silence.';if(!silence)arm();}};
   rec.onspeechstart=()=>{if(token===session&&recognition===rec){clearTimeout(silence);silence=null;}};
   rec.onspeechend=()=>{if(token===session&&recognition===rec)arm();};
   rec.onresult=event=>{if(token!==session||recognition!==rec)return;segment=event.results[event.results.length-1]?.[0]?.transcript?.trim()||'';entry.value=[base,transcript,segment].filter(Boolean).join(' ');arm();};
   rec.onerror=event=>{if(token!==session||recognition!==rec)return;if(event.error==='no-speech')return;stop();entry.readOnly=false;status.textContent='Voice input failed ('+event.error+'). Double-click to type or click to retry.';};
   rec.onend=()=>{if(token!==session||recognition!==rec)return;transcript=[transcript,segment].filter(Boolean).join(' ');recognition=null;start();};
   try{rec.start();}catch{stop();keyboard();status.textContent='Voice input could not start. Type an item instead.';}
  }
  start();
 }
 window.openDayFlowPage=opener=>{
  returnFocus=opener||document.activeElement;
  entry.readOnly=true;dialog.showModal();entry.focus();
 };
 entry.addEventListener('click',event=>{clearTimeout(clickTimer);if(event.detail===1)clickTimer=setTimeout(listen,350);});
 entry.addEventListener('dblclick',keyboard);
 entry.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();add();}else if(entry.readOnly&&event.key.length===1){keyboard();}});
 document.getElementById('listForm').addEventListener('submit',event=>{event.preventDefault();clearTimeout(clickTimer);add();});
 document.getElementById('listItemEdit').addEventListener('click',()=>{const item=items.find(row=>row.id===selectedId);menu.close();if(!item)return;editText.value=item.text;editDialog.showModal();editText.focus();});
 document.getElementById('listItemDelete').addEventListener('click',()=>{store.remove(selectedId);menu.close();});
 document.getElementById('listItemCancel').addEventListener('click',()=>menu.close());
 document.getElementById('listEditCancel').addEventListener('click',()=>editDialog.close());
 document.getElementById('listEditForm').addEventListener('submit',event=>{event.preventDefault();const text=editText.value.trim();if(text){store.edit(selectedId,text);editDialog.close();}});
 document.getElementById('pageClose').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{clearTimeout(clickTimer);clearTimeout(pressTimer);stop();menu.close();editDialog.close();returnFocus?.focus();});
})();
