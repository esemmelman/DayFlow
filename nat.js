/* English date parsing: vendored chrono-node 2.10.0 (MIT). */
function parseNaturalTask(transcript,now=new Date()){
 const text=transcript.trim().replace(/^(?:please\s+)?(?:add\s+(?:(?:a|an)\s+)?(?:task|appointment|event)\s+(?:to\s+)?|add\s+|schedule\s+|remind me to\s+)/i,'');
 if(!text)throw new Error('Say or type a task first.');
 const results=chrono.parse(text,now,{forwardDate:true});
 if(results.length>1)throw new Error('Please add one task and one date at a time.');
 const result=results[0];
 const title=(result?`${text.slice(0,result.index)} ${text.slice(result.index+result.text.length)}`:text)
  .replace(/\b(?:on|at|for)\s*$/i,'').replace(/\s+/g,' ').replace(/^[\s,.;]+|[\s,.;]+$/g,'');
 if(!title)throw new Error('Include a task name, such as “Dentist tomorrow at 3 PM”.');
 const dateKey=date=>`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
 const timeValue=components=>`${String(components.get('hour')).padStart(2,'0')}:${String(components.get('minute')||0).padStart(2,'0')}`;
 if(result?.end&&dateKey(result.start.date())!==dateKey(result.end.date()))throw new Error('Please add each day separately for an appointment spanning multiple days.');
 return {title,date:result?dateKey(result.start.date()):null,
  time:result?.start.isCertain('hour')?timeValue(result.start):null,
  endTime:result?.end?.isCertain('hour')?timeValue(result.end):null,
  notes:'',color:'#2f80ed'};
}

const natDialog=document.getElementById('natDialog');
const natText=document.getElementById('natText');
const natStatus=document.getElementById('natStatus');
const natListen=document.getElementById('natListen');
let natRecognition=null,natReturnFocus=null;

function stopNatListening(){
 const recognition=natRecognition;
 natRecognition=null;
 if(recognition)recognition.abort();
 natListen.disabled=false;
}
function closeNat(){
 stopNatListening();
 natDialog.hidden=true;
 const target=natReturnFocus?.isConnected?natReturnFocus:document.getElementById('androidAbout');
 target?.focus();
}
function addNaturalTask(){
 try{
  const task=parseNaturalTask(natText.value);
  stopNatListening();
  tasks.push({id:crypto.randomUUID(),...task});
  save();
  renderEverything();
  natStatus.textContent=`Added “${task.title}”${task.date?` on ${task.date}${task.time?` at ${formatTime(task.time)}`:' (all day)'}`:' to the inbox'}.`;
  natText.value='';
 }catch(error){natStatus.textContent=error.message;}
}
function startNatListening(){
 stopNatListening();
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Recognition){natStatus.textContent='Voice input is unavailable in this browser. Type your task below.';natText.focus();return;}
 try{
  const recognition=new Recognition();
  natRecognition=recognition;
  recognition.lang='en-US';
  recognition.continuous=false;
  recognition.interimResults=true;
  natListen.disabled=true;
  natStatus.textContent='Listening… Say one task, including its date and time if needed.';
  recognition.onresult=event=>{
   if(natRecognition!==recognition)return;
   natText.value=Array.from(event.results,result=>result[0].transcript).join(' ');
   if(Array.from(event.results).every(result=>result.isFinal))addNaturalTask();
  };
  recognition.onerror=event=>{
   if(natRecognition!==recognition)return;
   const messages={'not-allowed':'Microphone access was denied. Allow it in browser settings or type below.','service-not-allowed':'Voice input is unavailable. Type your task below.','audio-capture':'No microphone is available. Connect one or type below.','no-speech':'No speech was detected. Try again or type below.',network:'Voice recognition could not connect. Try again or type below.'};
   natStatus.textContent=messages[event.error]||'Voice input stopped. Try again or type below.';
   stopNatListening();
  };
  recognition.onend=()=>{
   if(natRecognition!==recognition)return;
   natRecognition=null;natListen.disabled=false;
   natStatus.textContent='Listening ended. Try again, or edit the text and choose Add.';
  };
  recognition.start();
 }catch(error){stopNatListening();natStatus.textContent='Could not start the microphone. Try again or type below.';}
}
function openNat(){
 natReturnFocus=document.activeElement;
 natText.value='';natDialog.hidden=false;
 document.getElementById('natClose').focus();
 startNatListening();
}
document.getElementById('natBtn').onclick=openNat;
natListen.onclick=startNatListening;
natText.addEventListener('input',stopNatListening);
document.getElementById('natForm').onsubmit=event=>{event.preventDefault();addNaturalTask();};
natDialog.querySelectorAll('[data-nat-close]').forEach(button=>button.onclick=closeNat);
document.addEventListener('keydown',event=>{
 if(natDialog.hidden)return;
 if(event.key==='Escape')closeNat();
 if(event.key==='Tab'){
  const controls=Array.from(natDialog.querySelectorAll('button,textarea')).filter(control=>!control.disabled);
  const first=controls[0],last=controls[controls.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 }
});
