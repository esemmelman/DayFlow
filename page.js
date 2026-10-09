(()=>{
 const dialog=document.getElementById('pageDialog'),entry=document.getElementById('listEntry'),list=document.getElementById('listItems'),status=document.getElementById('pageStatus');
 const key='dayflow:list';
 let items=[],loaded=false,returnFocus=null,recognition=null,silence=null,clickTimer=null,session=0,dragged=null;
 function save(){try{localStorage.setItem(key,JSON.stringify(items));status.textContent='Saved in this browser';}catch{status.textContent='Could not save. Keep this list open.';}}
 function move(from,to){if(from===to)return;items.splice(to,0,items.splice(from,1)[0]);render();save();}
 function render(){
  list.replaceChildren();
  items.forEach((text,index)=>{
   const row=document.createElement('li');row.className='list-item';row.draggable=true;
   const handle=document.createElement('span');handle.textContent='⠿';handle.className='list-handle';handle.setAttribute('aria-label','Drag to reorder');
   const label=document.createElement('span');label.textContent=text;label.className='list-label';
   row.append(handle,label);
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
 function add(){const value=entry.value.trim();stop();if(!value)return;items.push(value);entry.value='';render();save();}
 function keyboard(){clearTimeout(clickTimer);stop();entry.readOnly=false;entry.focus();status.textContent='Type an item and press Enter.';}
 function listen(){
  stop();entry.readOnly=true;
  const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Speech){keyboard();status.textContent='Voice input is unavailable in this browser. Type an item instead.';return;}
  const token=session,base=entry.value.trim();let transcript='';
  const arm=()=>{clearTimeout(silence);silence=setTimeout(()=>{if(token!==session)return;if(entry.value.trim())add();else{stop();status.textContent='No speech heard. Click to try again.';}},3000);};
  function start(){
   if(token!==session)return;
   const rec=new Speech();recognition=rec;rec.continuous=true;rec.interimResults=true;rec.lang=navigator.language||'en-US';
   let segment='';
   rec.onstart=()=>{if(token===session){status.textContent='Listening… items are added after 3 seconds of silence.';if(!silence)arm();}};
   rec.onspeechstart=()=>{if(token===session){clearTimeout(silence);silence=null;}};
   rec.onspeechend=()=>{if(token===session)arm();};
   rec.onresult=event=>{if(token!==session)return;segment=Array.from(event.results,result=>result[0].transcript).join(' ');entry.value=[base,transcript,segment].filter(Boolean).join(' ');arm();};
   rec.onerror=event=>{if(token!==session)return;if(event.error==='no-speech')return;stop();entry.readOnly=false;status.textContent='Voice input failed ('+event.error+'). Double-click to type or click to retry.';};
   rec.onend=()=>{if(token!==session)return;transcript=[transcript,segment].filter(Boolean).join(' ');recognition=null;start();};
   try{rec.start();}catch{stop();keyboard();status.textContent='Voice input could not start. Type an item instead.';}
  }
  start();
 }
 window.openDayFlowPage=opener=>{
  returnFocus=opener||document.activeElement;
  if(!loaded){try{const saved=localStorage.getItem(key);items=saved?JSON.parse(saved):(localStorage.getItem('dayflow:page')||'').split(/\r?\n/).filter(line=>line.trim());if(!Array.isArray(items)||items.some(item=>typeof item!=='string'))throw Error();loaded=true;render();status.textContent='Click the entry box to speak; double-click to type.';}catch{status.textContent='Could not load the saved list.';}}
  entry.readOnly=true;dialog.showModal();entry.focus();
 };
 entry.addEventListener('click',event=>{clearTimeout(clickTimer);if(event.detail===1)clickTimer=setTimeout(listen,350);});
 entry.addEventListener('dblclick',keyboard);
 entry.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();add();}else if(entry.readOnly&&event.key.length===1){keyboard();}});
 document.getElementById('listForm').addEventListener('submit',event=>{event.preventDefault();clearTimeout(clickTimer);add();});
 document.getElementById('pageClose').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{clearTimeout(clickTimer);stop();returnFocus?.focus();});
})();
