// TEST

// DayFlow v0.7

const tasks=JSON.parse(localStorage.getItem('df6')||'[]');
let t=new Date(),y=t.getFullYear(),m=t.getMonth(),sel=new Date(t);
let editingAppointmentId=null,clearInboxAfterSave=false,editorReturnFocus=null;
let ignoreTaskClickUntil=0;

function save(){localStorage.setItem('df6',JSON.stringify(tasks));}

function key(d){return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}

function createTaskElement(task,tagName='div',draggable=false){
 const element=document.createElement(tagName);
 element.className=`task${task.date?' appointment':''}`;
 element.dataset.taskId=task.id;
 const title=document.createElement('span');
 title.textContent=task.title;
 element.append(title);
 if(task.date&&task.time!==null&&task.time!==undefined){
  const time=document.createElement('span');
  time.className='task-time';
  time.textContent=formatTimeRange(task.time,task.endTime);
  element.append(time);
 }
 element.style.setProperty('--appointment-color',task.color||(task.date?'#2f80ed':'#ccd5df'));
 element.tabIndex=0;
 element.setAttribute('role','button');
 element.onclick=()=>{
  if(Date.now()>=ignoreTaskClickUntil)openAppointmentEditor(task);
 };
 element.onkeydown=event=>{
  if(event.key==='Enter'||event.key===' '){event.preventDefault();openAppointmentEditor(task);}
 };
 if(draggable){
  element.draggable=true;
  element.ondragstart=event=>{
   event.dataTransfer.effectAllowed='move';
   event.dataTransfer.setData('id',task.id);
  };
 }
 return element;
}

function renderInbox(){
 inbox.innerHTML='';
 tasks.filter(x=>!x.date).forEach(x=>{
  inbox.append(createTaskElement(x,'li',true));
 });
}

function renderAllDay(){
 allDay.innerHTML='';
 tasks.filter(x=>x.date===key(sel)&&!x.time).forEach(x=>{
   allDay.append(createTaskElement(x,'div',true));
 });
}

function renderSelectedDay(){
 dayTitle.textContent=sel.toDateString();
 renderAllDay();
 renderTimeline();
}

function drawCal(){
 monthTitle.textContent=new Date(y,m).toLocaleString('default',{month:'long',year:'numeric'});
 calendar.innerHTML='';
 ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(n=>{let e=document.createElement('div');e.className='dow';e.textContent=n;calendar.append(e);});
 let first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();
 for(let i=0;i<first;i++)calendar.append(document.createElement('div'));
 for(let d=1;d<=days;d++){
   let c=document.createElement('div');c.className='day';
   c.dataset.date=`${y}-${m+1}-${d}`;
   if(sel.getFullYear()==y&&sel.getMonth()==m&&sel.getDate()==d)c.classList.add('selected');
   c.innerHTML="<b>"+d+"</b>";
   let k=`${y}-${m+1}-${d}`;
   if(tasks.some(x=>x.date===k)){let dot=document.createElement('div');dot.className='dot';c.append(dot);}
   c.onclick=()=>{sel=new Date(y,m,d);drawCal();renderSelectedDay();}
   c.ondragover=e=>e.preventDefault();
   c.ondrop=e=>{
      e.preventDefault();
      e.stopPropagation();
      let id=e.dataTransfer.getData('id');
      let task=tasks.find(a=>a.id===id);
      if(task){
        task.date=k;
        sel=new Date(y,m,d);
        finishScheduleMove();
      }
   };
   calendar.append(c);
 }
}
function addInboxTask(){
 const title=newTask.value.trim();
 if(!title)return;
 tasks.push({id:String(Date.now()+Math.random()),title,date:null,time:null});
 newTask.value='';
 save();
 renderInbox();
}
addBtn.onclick=addInboxTask;
newTask.addEventListener('keydown',event=>{
 if(event.key==='Enter'){event.preventDefault();addInboxTask();}
});
prev.onclick=()=>{m--;if(m<0){m=11;y--;}drawCal();}
next.onclick=()=>{m++;if(m>11){m=0;y++;}drawCal();}
todayBtn.onclick=()=>{t=new Date();y=t.getFullYear();m=t.getMonth();sel=new Date(t);drawCal();renderSelectedDay();}
for(let h=7;h<=20;h++){
 let r=document.createElement('div');
 r.className='hour';
 let time=document.createElement('div');
 time.className='time';
 time.textContent=`${((h%12)||12)}:00 ${h<12?'AM':'PM'}`;
 let slot=document.createElement('div');
 slot.className='slot';
 slot.dataset.hour=String(h);
 let addButton=addSlotButton(slot);
 r.append(time,addButton,slot);
 timeline.append(r);
}
renderInbox();
drawCal();
renderSelectedDay();
// v0.7 foundation: timeline drag/drop to be implemented from this codebase.


// v0.7 milestone: timeline drop targets
document.querySelectorAll('.slot').forEach(slot=>{
  slot.addEventListener('dragover',e=>e.preventDefault());
  slot.addEventListener('drop',e=>{
    e.preventDefault();
    const id=e.dataTransfer.getData('id');
    const task=tasks.find(t=>t.id===id);
    if(task){
      moveTaskToTime(task,key(sel),Number(slot.dataset.hour));
      finishScheduleMove();
    }
  });
});

const allDayDropZone=allDay.closest('.allday');
allDayDropZone.addEventListener('dragover',event=>event.preventDefault());
allDayDropZone.addEventListener('drop',event=>{
 event.preventDefault();
 const task=tasks.find(item=>item.id===event.dataTransfer.getData('id'));
 if(!task)return;
 task.date=key(sel);
 task.time=null;
 task.endTime=null;
 finishScheduleMove();
});

function timeToMinutes(time){
 const [hour,minute]=toTimeValue(time).split(':').map(Number);
 return hour*60+minute;
}

function minutesToTime(minutes){
 const bounded=Math.max(0,Math.min(1439,minutes));
 return `${String(Math.floor(bounded/60)).padStart(2,'0')}:${String(bounded%60).padStart(2,'0')}`;
}

function moveTaskToTime(task,date,hour){
 const duration=task.time!=null&&task.endTime
  ?Math.max(1,timeToMinutes(task.endTime)-timeToMinutes(task.time))
  :60;
 const start=hour*60;
 task.date=date;
 task.time=minutesToTime(start);
 task.endTime=minutesToTime(start+duration);
}

function finishScheduleMove(){
 save();
 renderInbox();
 drawCal();
 renderSelectedDay();
}

let touchDrag=null;

function positionTouchGhost(event){
 if(!touchDrag?.ghost)return;
 touchDrag.ghost.style.left=`${event.clientX}px`;
 touchDrag.ghost.style.top=`${event.clientY}px`;
}

function endTouchDrag(event,shouldDrop){
 if(!touchDrag||event.pointerId!==touchDrag.pointerId)return;
 clearTimeout(touchDrag.timer);
 const drag=touchDrag;
 touchDrag=null;
 if(drag.active){
  ignoreTaskClickUntil=Date.now()+500;
  drag.ghost.remove();
  document.body.classList.remove('touch-dragging');
  if(shouldDrop){
   const target=document.elementFromPoint(event.clientX,event.clientY);
   const task=tasks.find(item=>item.id===drag.taskId);
   if(task&&target){
    const slot=target.closest('.slot');
    const allDayZone=target.closest('.allday');
    const day=target.closest('.day');
    if(slot){
     moveTaskToTime(task,key(sel),Number(slot.dataset.hour));
     finishScheduleMove();
    }else if(allDayZone){
     task.date=key(sel);
     task.time=null;
     task.endTime=null;
     finishScheduleMove();
    }else if(day?.dataset.date){
     task.date=day.dataset.date;
     const [year,month,date]=day.dataset.date.split('-').map(Number);
     sel=new Date(year,month-1,date);
     finishScheduleMove();
    }
   }
  }
 }
}

document.addEventListener('pointerdown',event=>{
 if(event.pointerType==='mouse'||event.button!==0)return;
 const taskElement=event.target.closest('.task[draggable="true"]');
 if(!taskElement)return;
 const startX=event.clientX,startY=event.clientY;
 touchDrag={pointerId:event.pointerId,taskId:null,startX,startY,active:false,ghost:null,timer:null};
 const taskId=taskElement.closest('[data-task-id]')?.dataset.taskId;
 touchDrag.taskId=taskId;
 touchDrag.timer=setTimeout(()=>{
  if(!touchDrag||touchDrag.pointerId!==event.pointerId)return;
  touchDrag.active=true;
  touchDrag.ghost=taskElement.cloneNode(true);
  touchDrag.ghost.classList.add('touch-drag-ghost');
  document.body.append(touchDrag.ghost);
  document.body.classList.add('touch-dragging');
  positionTouchGhost(event);
 },350);
});

document.addEventListener('pointermove',event=>{
 if(!touchDrag||event.pointerId!==touchDrag.pointerId)return;
 if(!touchDrag.active){
  if(Math.hypot(event.clientX-touchDrag.startX,event.clientY-touchDrag.startY)>10){
   clearTimeout(touchDrag.timer);
   touchDrag=null;
  }
  return;
 }
 event.preventDefault();
 if(event.clientY<64)window.scrollBy(0,-18);
 else if(event.clientY>window.innerHeight-64)window.scrollBy(0,18);
 positionTouchGhost(event);
},{passive:false});

document.addEventListener('pointerup',event=>endTouchDrag(event,true));
document.addEventListener('pointercancel',event=>endTouchDrag(event,false));
document.addEventListener('contextmenu',event=>{
 if(touchDrag?.active&&event.target.closest('.task'))event.preventDefault();
});

function renderTimeline(){
 document.querySelectorAll('.slot').forEach(slot=>slot.replaceChildren());
 tasks.filter(x=>x.date===key(sel)&&x.time!=null).forEach(task=>{
   const slot=document.querySelector(`.slot[data-hour="${timeHour(task.time)}"]`);
   if(slot){
      let items = slot.querySelector(".appointments");

if (!items) {
    items = document.createElement("div");
    items.className = "appointments";
    slot.appendChild(items);
}

items.appendChild(createTaskElement(task,'div',true));
   }
 });
}

// v0.7-m2 milestone

function addScheduled(time){
 openAppointmentEditor(null,{date:key(sel),time,allDay:time===null});
}

function addSlotButton(slot){
 const btn=document.createElement('button');
 btn.type='button';
 btn.className='add-slot';
 btn.textContent='+';
 btn.onclick=()=>{
  const clickedHour=Number(slot.dataset.hour);
  addScheduled(clickedHour);
 };
 return btn;
}

const allDayButton=document.getElementById('addAllDay');
if(allDayButton)allDayButton.onclick=()=>addScheduled(null);

const appointmentEditor=document.getElementById('appointmentEditor');
const appointmentForm=document.getElementById('appointmentForm');
const editorTaskTitle=document.getElementById('editorTaskTitle');
const editorDate=document.getElementById('editorDate');
const editorAllDay=document.getElementById('editorAllDay');
const editorStartTime=document.getElementById('editorStartTime');
const editorEndTime=document.getElementById('editorEndTime');
const editorNotes=document.getElementById('editorNotes');
const editorColor=document.getElementById('editorColor');
const editorDelete=document.getElementById('editorDelete');
const editorError=document.getElementById('editorError');

function toDateInput(dateValue){
 if(!dateValue)return '';
 const [year,month,day]=dateValue.split('-');
 return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
}

function toDateKey(dateValue){
 if(!dateValue)return null;
 const [year,month,day]=dateValue.split('-').map(Number);
 return `${year}-${month}-${day}`;
}

function toTimeValue(time){
 if(time===null||time===undefined)return '';
 if(typeof time==='number')return `${String(time).padStart(2,'0')}:00`;
 return time;
}

function timeHour(time){
 return Number(toTimeValue(time).slice(0,2));
}

function formatTime(time){
 const [hour,minute]=toTimeValue(time).split(':').map(Number);
 return `${hour%12||12}:${String(minute).padStart(2,'0')} ${hour<12?'AM':'PM'}`;
}

function formatTimeRange(start,end){
 return end?`${formatTime(start)}–${formatTime(end)}`:formatTime(start);
}

function defaultEndTime(start){
 const value=toTimeValue(start);
 if(!value)return '';
 const [hour,minute]=value.split(':').map(Number);
 return `${String(Math.min(23,hour+1)).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
}

function updateEditorTimeFields(){
 const disabled=editorAllDay.checked||!editorDate.value;
 editorStartTime.disabled=disabled;
 editorEndTime.disabled=disabled;
}

function openAppointmentEditor(task=null,defaults={}){
 editorReturnFocus=document.activeElement;
 editingAppointmentId=task?.id||null;
 clearInboxAfterSave=Boolean(defaults.clearInbox);
 const selectedTime=task?.time??defaults.time??null;
 editorTaskTitle.value=task?.title??defaults.title??'';
 editorDate.value=toDateInput(task?.date??defaults.date??null);
 editorAllDay.checked=task?Boolean(task.date)&&task.time===null:Boolean(defaults.allDay);
 editorStartTime.value=toTimeValue(selectedTime);
 editorEndTime.value=task?.endTime??defaults.endTime??defaultEndTime(selectedTime);
 editorNotes.value=task?.notes??'';
 editorColor.value=task?.color??'#2f80ed';
 editorDelete.hidden=!task;
 editorError.textContent='';
 updateEditorTimeFields();
 appointmentEditor.hidden=false;
 editorTaskTitle.focus();
}

function closeAppointmentEditor(){
 appointmentEditor.hidden=true;
 editingAppointmentId=null;
 clearInboxAfterSave=false;
 if(editorReturnFocus&&typeof editorReturnFocus.focus==='function')editorReturnFocus.focus();
 editorReturnFocus=null;
}

function refreshAppointments(){
 save();
 renderInbox();
 drawCal();
 renderSelectedDay();
}

appointmentForm.addEventListener('submit',event=>{
 event.preventDefault();
 const title=editorTaskTitle.value.trim();
 const date=toDateKey(editorDate.value);
 const isAllDay=editorAllDay.checked;
 const start=editorStartTime.value;

 if(!title){editorError.textContent='Title is required.';return;}
 if(date&&!isAllDay&&!start){editorError.textContent='Choose a start time or mark this appointment all day.';return;}

 const appointment={
  title,
  date,
  time:date&&!isAllDay?start:null,
  endTime:date&&!isAllDay?editorEndTime.value:null,
  notes:editorNotes.value.trim(),
  color:editorColor.value
 };
 const existing=tasks.find(task=>task.id===editingAppointmentId);
 if(existing)Object.assign(existing,appointment);
 else tasks.push({id:String(Date.now()+Math.random()),...appointment});
 if(clearInboxAfterSave)newTask.value='';
 closeAppointmentEditor();
 refreshAppointments();
});

editorDelete.onclick=()=>{
 const index=tasks.findIndex(task=>task.id===editingAppointmentId);
 if(index<0)return;
 tasks.splice(index,1);
 closeAppointmentEditor();
 refreshAppointments();
};

editorAllDay.onchange=updateEditorTimeFields;
editorDate.onchange=updateEditorTimeFields;
appointmentEditor.querySelectorAll('[data-editor-cancel]').forEach(button=>button.onclick=closeAppointmentEditor);
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!appointmentEditor.hidden)closeAppointmentEditor();
});
