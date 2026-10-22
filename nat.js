/* English date parsing: vendored chrono-node 2.10.0 (MIT). */
function parseNaturalTask(transcript,now=new Date()){
 const longDuration=/(?:^|\s)long[.!?,;]*$/i.test(transcript.trim());
 const text=transcript.trim().replace(/(?:^|\s)long[.!?,;]*$/i,'').trim().replace(/^(?:please\s+)?(?:add\s+(?:(?:a|an)\s+)?(?:task|appointment|event)\s+(?:to\s+)?|add\s+|schedule\s+|remind me to\s+)/i,'');
 if(!text)throw new Error('Say or type a task first.');
 const results=chrono.parse(text,now,{forwardDate:true});
 if(results.length>1)throw new Error('Please add one task and one date at a time.');
 const result=results[0];
 // Resolve an unspecified AM/PM before using Chrono's forward-date guesses.
 if(result?.start.isCertain('hour')&&!result.start.isCertain('meridiem')&&!result.end?.isCertain('meridiem')&&!/\b(?:noon|midnight|morning|afternoon|evening|night|tonight)\b/i.test(result.text)){
  const resolve=(components,reference,base,rollDay)=>{
   const date=new Date(base);
   date.setHours(components.get('hour')%12,components.get('minute')||0,0,0);
   if(date<=reference)date.setHours(date.getHours()+12);
   if(rollDay&&date<=reference)date.setHours(date.getHours()+12);
   for(const [key,value] of Object.entries({year:date.getFullYear(),month:date.getMonth()+1,day:date.getDate(),hour:date.getHours()}))components.assign(key,value);
  };
  const hasDate=['day','month','year','weekday'].some(key=>result.start.isCertain(key));
  resolve(result.start,now,hasDate?result.start.date():now,!hasDate);
  if(result.end?.isCertain('hour'))resolve(result.end,result.start.date(),result.start.date(),true);
 }
 const title=(result?`${text.slice(0,result.index)} ${text.slice(result.index+result.text.length)}`:text)
  .replace(/\b(?:on|at|for)\s*$/i,'').replace(/\s+/g,' ').replace(/^[\s,.;]+|[\s,.;]+$/g,'').replace(/\p{L}/u,letter=>letter.toUpperCase());
 if(!title)throw new Error('Include a task name.');
 const dateKey=date=>`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
 const timeValue=components=>`${String(components.get('hour')).padStart(2,'0')}:${String(components.get('minute')||0).padStart(2,'0')}`;
 if(result?.end&&dateKey(result.start.date())!==dateKey(result.end.date()))throw new Error('Please add each day separately for an appointment spanning multiple days.');
 const time=result?.start.isCertain('hour')?timeValue(result.start):null;
 let endTime=result?.end?.isCertain('hour')?timeValue(result.end):null;
 if(time&&(!endTime||longDuration)){
  const endMinutes=(result.start.get('hour')*60+(result.start.get('minute')||0)+(longDuration?60:10))%1440;
  endTime=`${String(Math.floor(endMinutes/60)).padStart(2,'0')}:${String(endMinutes%60).padStart(2,'0')}`;
 }
 return {title,date:dateKey(result?result.start.date():now),
  time,endTime,
  notes:'',color:'#2f80ed',
  reminderEnabled:Boolean(time),reminderMinutes:20,reminderEmail:true,reminderPush:false};
}

function parseShowCommand(transcript,now=new Date()){
 if(!/^show\s+me\b/i.test(transcript.trim()))return null;
 const request=transcript.trim().replace(/^show\s+me\b[\s,:]*/i,'')
  .replace(/^(?:(?:all\s+)?(?:my\s+)?(?:events|appointments|tasks|schedule|calendar)\b\s*)?(?:(?:for|on)\s+)?/i,'')
  .replace(/[.!?]+$/,'').trim();
 const results=chrono.parse(request,now,{forwardDate:true});
 const result=results[0];
 if(results.length!==1||!result||result.end||result.start.isCertain('hour')||
  request.slice(0,result.index).trim()||request.slice(result.index+result.text.length).trim()){
  throw new Error('Try “show me my events for Sunday” or “show me tomorrow”. Please request one day.');
 }
 const date=result.start.date();
 date.setHours(0,0,0,0);
 // A weekday alone means its next occurrence, including today.
 if(/^(?:next\s+)?(?:sun|mon|tues|wednes|thurs|fri|satur)day$/i.test(request)){
  const today=new Date(now);today.setHours(0,0,0,0);
  const offset=(date.getDay()-today.getDay()+7)%7;
  date.setTime(today.getTime());date.setDate(date.getDate()+offset);
  if(!offset&&/^next\s/i.test(request))date.setDate(date.getDate()+7);
 }
 return {date:`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`,
  label:date.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric',year:'numeric'})};
}

const natDialog=document.getElementById('natDialog');
const natText=document.getElementById('natText');
const natStatus=document.getElementById('natStatus');
const natListen=document.getElementById('natListen');
let natRecognition=null,natReturnFocus=null;

function updateNatPreview(){
 const preview=document.getElementById('natPreview');
 const title=document.getElementById('natPreviewTitle');
 const schedule=document.getElementById('natPreviewSchedule');
 title.textContent='';schedule.textContent='';preview.hidden=true;
 if(!natText.value.trim())return;
 try{
  const command=parseShowCommand(natText.value);
  if(command){title.textContent='Show events';schedule.textContent=command.label;schedule.hidden=false;preview.hidden=false;return;}
  const task=parseNaturalTask(natText.value);
  title.textContent=task.title;
  if(task.date){
   const [year,month,day]=task.date.split('-').map(Number);
   const date=new Date(year,month-1,day).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'});
   schedule.textContent=task.time
    ?`${date} · ${formatTime(task.time)}–${formatTime(task.endTime)}${task.endTime<task.time?' (ends next day)':''}`
    :`${date} · All day`;
  }
  schedule.hidden=!task.date;
  preview.hidden=false;
 }catch(error){
  title.textContent=error.message;
  schedule.hidden=true;
  preview.hidden=false;
 }
}

function showNatError(message){
 natStatus.textContent=message;
 natText.setCustomValidity?.(message);
 natText.reportValidity?.();
}
function stopNatListening(){
 const recognition=natRecognition;
 natRecognition=null;
 if(recognition)recognition.abort();
 natListen.disabled=false;
 natListen.textContent='Speak again';
}
function closeNat(){
 stopNatListening();
 natDialog.hidden=true;
 const target=natReturnFocus?.isConnected?natReturnFocus:document.getElementById('androidAbout');
 target?.focus();
}
function addNaturalTask(){
 if(natDialog.hidden)return;
 try{
  const command=parseShowCommand(natText.value);
  if(command){
   closeNat();
   closeAndroidPanel();showAndroidButtons();
   openScheduleDate(command.date);
   natStatus.textContent=`Showing events for ${command.label}.`;
   natText.value='';
   return;
  }
  const task=parseNaturalTask(natText.value);
  stopNatListening();
  tasks.push({id:crypto.randomUUID(),...task});
  save();
  renderEverything();
  natStatus.textContent=`Added “${task.title}”${task.date?` on ${task.date}${task.time?` at ${formatTime(task.time)}`:' (all day)'}`:' to the inbox'}.`;
  natText.value='';
  closeNat();
 }catch(error){showNatError(error.message);}
}
function startNatListening(){
 stopNatListening();
 natText.setCustomValidity?.('');
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Recognition){natStatus.textContent='Voice input is unavailable in this browser. Type your task below.';natText.focus();return;}
 try{
  const recognition=new Recognition();
  const existingText=natText.value.trim();
  natRecognition=recognition;
  recognition.lang='en-US';
  recognition.continuous=false;
  recognition.interimResults=true;
  natListen.disabled=true;
  natListen.textContent='Listening...';
  natStatus.textContent='Listening… Say a task, or “show me my events for Sunday”.';
  recognition.onresult=event=>{
   if(natRecognition!==recognition)return;
   const transcript=Array.from(event.results,result=>result[0].transcript).join(' ').replace(/\bAubrey\b/gi,'Aubree');
   natText.value=[existingText,transcript].filter(Boolean).join(' ');
   natText.setCustomValidity?.('');
   updateNatPreview();
  };
  recognition.onerror=event=>{
   if(natRecognition!==recognition)return;
   const messages={'not-allowed':'Microphone access was denied. Allow it in browser settings or type below.','service-not-allowed':'Voice input is unavailable. Type your task below.','audio-capture':'No microphone is available. Connect one or type below.','no-speech':'No speech was detected. Try again or type below.',network:'Voice recognition could not connect. Try again or type below.'};
   showNatError(messages[event.error]||'Voice input stopped. Try again or type below.');
   stopNatListening();
  };
  recognition.onend=()=>{
   if(natRecognition!==recognition)return;
   natRecognition=null;natListen.disabled=false;natListen.textContent='Speak again';
   natStatus.textContent='Listening ended. Review the task and choose Done to save.';
   updateNatPreview();
   if(/^show\s+me\b/i.test(natText.value.trim()))addNaturalTask();
  };
  recognition.start();
 }catch(error){stopNatListening();showNatError('Could not start the microphone. Try again or type below.');}
}
function openNat(){
 natReturnFocus=document.activeElement;
 natText.value='';natDialog.hidden=false;
 updateNatPreview();
 natListen.focus();
 startNatListening();
}
natListen.onclick=startNatListening;
natText.addEventListener('input',()=>{stopNatListening();natText.setCustomValidity?.('');updateNatPreview();});
natText.addEventListener('change',updateNatPreview);
natText.addEventListener('blur',updateNatPreview);
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
