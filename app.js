// TEST

// DayFlow v0.7

const tasks=JSON.parse(localStorage.getItem('df6')||'[]');
const usesAndroidAgenda=/Android/i.test(navigator.userAgent)||matchMedia('(max-width:599px) and (pointer:coarse)').matches;
document.body.classList.toggle('android',usesAndroidAgenda);
let t=new Date(),y=t.getFullYear(),m=t.getMonth(),sel=new Date(t);
let mobileAgendaStart=new Date(t);
mobileAgendaStart.setHours(0,0,0,0);
let mobileAgendaDayCount=10,mobileAgendaObserver=null;
let editingAppointmentId=null,clearInboxAfterSave=false,editorReturnFocus=null;
let ignoreTaskClickUntil=0;
let lastTouchPointerDown=0;

function save(){localStorage.setItem('df6',JSON.stringify(tasks));}

function key(d){return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}

function compareTaskTitles(a,b){
 return a.title.localeCompare(b.title,undefined,{sensitivity:'base',numeric:true});
}

function compareTaskSchedule(a,b){
 if(!a.date&&!b.date)return compareTaskTitles(a,b);
 if(!a.date)return 1;
 if(!b.date)return -1;
 const [aYear,aMonth,aDay]=a.date.split('-').map(Number);
 const [bYear,bMonth,bDay]=b.date.split('-').map(Number);
 const dateDifference=Date.UTC(aYear,aMonth-1,aDay)-Date.UTC(bYear,bMonth-1,bDay);
 if(dateDifference)return dateDifference;
 const aMinutes=a.time==null?-1:timeToMinutes(a.time);
 const bMinutes=b.time==null?-1:timeToMinutes(b.time);
 return aMinutes-bMinutes||compareTaskTitles(a,b);
}

function seedWeeklyItemsOnce(weekday,title,seedKey,time=null,endTime=null){
 if(localStorage.getItem(seedKey))return;
 const start=new Date(2026,6,11,12);
 const firstDate=new Date(start);
 firstDate.setDate(start.getDate()+(weekday-start.getDay()+7)%7);
 const yearEnd=new Date(2026,11,31,12);
 for(const date=new Date(firstDate);date<=yearEnd;date.setDate(date.getDate()+7)){
  const dateValue=key(date);
  if(tasks.some(task=>task.title===title&&task.date===dateValue&&task.time===time))continue;
  tasks.push({id:String(Date.now()+Math.random()),title,date:dateValue,time,endTime,notes:'',color:'#2f80ed'});
 }
 save();
 localStorage.setItem(seedKey,'1');
}

seedWeeklyItemsOnce(1,'Take the trash out','df_seed_trash_mondays_2026_once');
seedWeeklyItemsOnce(2,'Take the trash in','df_seed_trash_tuesdays_2026_once');
seedWeeklyItemsOnce(2,'Dr. John','df_seed_dr_john_tuesdays_2026_once','10:00','11:30');
seedWeeklyItemsOnce(4,'Swim class','df_seed_swim_class_thursdays_2026_once','15:20','15:40');

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
   if(Date.now()-lastTouchPointerDown<1000){event.preventDefault();return;}
   event.dataTransfer.effectAllowed='move';
   event.dataTransfer.setData('id',task.id);
  };
 }
 return element;
}

function renderInbox(){
 inbox.innerHTML='';
 tasks.filter(x=>!x.date).sort(compareTaskTitles).forEach(x=>{
  inbox.append(createTaskElement(x,'li',true));
 });
}

function renderAllDay(){
 allDay.innerHTML='';
 tasks.filter(x=>x.date===key(sel)&&!x.time).sort(compareTaskTitles).forEach(x=>{
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
const androidNav=document.getElementById('androidNav');
const androidAdd=document.getElementById('androidAdd');
const androidCal=document.getElementById('androidCal');
const androidFind=document.getElementById('androidFind');
const androidAbout=document.getElementById('androidAbout');
const androidAddForm=document.getElementById('androidAddForm');
const androidNewTask=document.getElementById('androidNewTask');
const androidSearchForm=document.getElementById('androidSearchForm');
const androidSearch=document.getElementById('androidSearch');
const androidSearchCancel=document.getElementById('androidSearchCancel');
const androidPanel=document.getElementById('androidPanel');
let androidPickerMonth=new Date(mobileAgendaStart.getFullYear(),mobileAgendaStart.getMonth(),1);

function closeAndroidPanel(){
 androidPanel.hidden=true;
 androidPanel.replaceChildren();
}

function showAndroidButtons(){
 androidAddForm.hidden=true;
 androidSearchForm.hidden=true;
 androidNav.hidden=false;
}

androidAdd.onclick=()=>{
 closeAndroidPanel();
 androidNav.hidden=true;
 androidSearchForm.hidden=true;
 androidAddForm.hidden=false;
 androidNewTask.focus();
};

androidAddForm.addEventListener('submit',event=>{
 event.preventDefault();
 const title=androidNewTask.value.trim();
 if(!title)return;
 newTask.value=title;
 addInboxTask();
 androidNewTask.value='';
 androidNewTask.blur();
 showAndroidButtons();
});

function searchResultDetail(task){
 if(!task.date)return 'Inbox';
 const [year,month,date]=task.date.split('-').map(Number);
 const day=new Date(year,month-1,date).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'});
 return task.time!=null?`${day} · ${formatTimeRange(task.time,task.endTime)}`:`${day} · All Day`;
}

function renderAndroidSearchResults(){
 androidPanel.hidden=false;
 androidPanel.replaceChildren();
 const query=androidSearch.value.trim().toLocaleLowerCase();
 if(!query){
  const message=document.createElement('p');
  message.className='android-search-message';
  message.textContent='Type to search all tasks.';
  androidPanel.append(message);
  return;
 }
 const matches=tasks.filter(task=>`${task.title} ${task.notes||''}`.toLocaleLowerCase().includes(query)).sort(compareTaskSchedule);
 if(!matches.length){
  const message=document.createElement('p');
  message.className='android-search-message';
  message.textContent='No matching tasks.';
  androidPanel.append(message);
  return;
 }
 const results=document.createElement('div');
 results.className='android-search-results';
 matches.forEach(task=>{
  const result=document.createElement('button');
  result.type='button';
  result.className='android-search-result';
  const title=document.createElement('strong');
  title.textContent=task.title;
  const detail=document.createElement('small');
  detail.textContent=searchResultDetail(task);
  result.append(title,detail);
  result.onclick=()=>{
   if(task.date){
    const [year,month,date]=task.date.split('-').map(Number);
    mobileAgendaStart=new Date(year,month-1,date);
    mobileAgendaDayCount=10;
    renderMobileAgenda();
   }
   androidSearch.value='';
   closeAndroidPanel();
   showAndroidButtons();
   openAppointmentEditor(task);
  };
  results.append(result);
 });
 androidPanel.append(results);
}

androidFind.onclick=()=>{
 closeAndroidPanel();
 androidNav.hidden=true;
 androidAddForm.hidden=true;
 androidSearchForm.hidden=false;
 androidSearch.value='';
 renderAndroidSearchResults();
 androidSearch.focus();
};
androidSearch.addEventListener('input',renderAndroidSearchResults);
androidSearchForm.addEventListener('submit',event=>{
 event.preventDefault();
 renderAndroidSearchResults();
});
androidSearchCancel.onclick=()=>{
 androidSearch.value='';
 androidSearch.blur();
 closeAndroidPanel();
 showAndroidButtons();
};

function renderAndroidCalendar(){
 androidPanel.hidden=false;
 androidPanel.replaceChildren();
 const header=document.createElement('div');
 header.className='android-calendar-header';
 const previous=document.createElement('button');
 previous.type='button';
 previous.textContent='<';
 const title=document.createElement('h2');
 title.textContent=androidPickerMonth.toLocaleDateString(undefined,{month:'long',year:'numeric'});
 const next=document.createElement('button');
 next.type='button';
 next.textContent='>';
 previous.onclick=()=>{androidPickerMonth.setMonth(androidPickerMonth.getMonth()-1);renderAndroidCalendar();};
 next.onclick=()=>{androidPickerMonth.setMonth(androidPickerMonth.getMonth()+1);renderAndroidCalendar();};
 header.append(previous,title,next);
 const grid=document.createElement('div');
 grid.className='android-calendar-grid';
 ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(label=>{
  const weekday=document.createElement('b');
  weekday.textContent=label;
  grid.append(weekday);
 });
 const year=androidPickerMonth.getFullYear();
 const month=androidPickerMonth.getMonth();
 const firstWeekday=new Date(year,month,1).getDay();
 for(let blank=0;blank<firstWeekday;blank++)grid.append(document.createElement('span'));
 const days=new Date(year,month+1,0).getDate();
 for(let date=1;date<=days;date++){
  const button=document.createElement('button');
  button.type='button';
  button.textContent=String(date);
  const dateValue=`${year}-${month+1}-${date}`;
  if(tasks.some(task=>task.date===dateValue)){
   button.classList.add('has-items');
   button.setAttribute('aria-label',`${date}, has scheduled items`);
  }
  button.onclick=()=>{
   mobileAgendaStart=new Date(year,month,date);
   mobileAgendaDayCount=10;
   closeAndroidPanel();
   renderMobileAgenda();
   document.getElementById('mobileAgenda').scrollIntoView({block:'start'});
  };
  grid.append(button);
 }
 androidPanel.append(header,grid);
}

androidCal.onclick=()=>{
 if(!androidPanel.hidden&&androidPanel.querySelector('.android-calendar-grid')){closeAndroidPanel();return;}
 androidPickerMonth=new Date(mobileAgendaStart.getFullYear(),mobileAgendaStart.getMonth(),1);
 renderAndroidCalendar();
};

androidAbout.onclick=()=>{
 if(!androidPanel.hidden&&androidPanel.querySelector('.android-about')){closeAndroidPanel();return;}
 androidPanel.hidden=false;
 androidPanel.innerHTML='<div class="android-about">DayFlow v0.7-m26</div>';
};
prev.onclick=()=>{m--;if(m<0){m=11;y--;}drawCal();}
next.onclick=()=>{m++;if(m>11){m=0;y++;}drawCal();}
todayBtn.onclick=()=>{t=new Date();y=t.getFullYear();m=t.getMonth();sel=new Date(t);mobileAgendaStart=new Date(t);mobileAgendaStart.setHours(0,0,0,0);mobileAgendaDayCount=10;drawCal();renderSelectedDay();renderMobileAgenda();}
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
renderMobileAgenda();
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

function renderMobileAgenda(){
 const agenda=document.getElementById('mobileAgenda');
 if(!agenda)return;
 mobileAgendaObserver?.disconnect();
 agenda.replaceChildren();
 const start=new Date(mobileAgendaStart);
 const yearEnd=new Date(start.getFullYear(),11,31);
 const startUtc=Date.UTC(start.getFullYear(),start.getMonth(),start.getDate());
 const endUtc=Date.UTC(yearEnd.getFullYear(),yearEnd.getMonth(),yearEnd.getDate());
 const daysRemaining=Math.floor((endUtc-startUtc)/86400000)+1;
 const daysToRender=Math.max(0,Math.min(mobileAgendaDayCount,daysRemaining));
 for(let offset=0;offset<daysToRender;offset++){
  const date=new Date(start);
  date.setDate(start.getDate()+offset);
  const dateKey=key(date);
  const day=document.createElement('section');
  day.className='agenda-day';
  day.dataset.date=dateKey;

  const heading=document.createElement('h2');
  heading.className='agenda-day-title';
  const dateLabel=date.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});
  const headingDate=document.createElement('span');
  headingDate.textContent=dateLabel;
  const today=new Date();
  const dateUtc=Date.UTC(date.getFullYear(),date.getMonth(),date.getDate());
  const todayUtc=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());
  const headingOffset=document.createElement('span');
  headingOffset.className='agenda-day-offset';
  headingOffset.textContent=String(Math.round((dateUtc-todayUtc)/86400000));
  heading.append(headingDate,headingOffset);
  day.append(heading);

  const allDayZone=document.createElement('div');
  allDayZone.className='allday';
  allDayZone.dataset.date=dateKey;
  const allDayHeader=document.createElement('div');
  allDayHeader.className='allday-header';
  const allDayLabel=document.createElement('b');
  allDayLabel.textContent='All Day';
  const allDayAdd=document.createElement('button');
  allDayAdd.type='button';
  allDayAdd.textContent='+';
  allDayAdd.setAttribute('aria-label',`Add all-day appointment on ${dateLabel}`);
  allDayAdd.onclick=()=>openAppointmentEditor(null,{date:dateKey,time:null,allDay:true});
  allDayHeader.append(allDayLabel,allDayAdd);
  allDayZone.append(allDayHeader);
  tasks.filter(task=>task.date===dateKey&&task.time==null).sort(compareTaskTitles).forEach(task=>{
   allDayZone.append(createTaskElement(task,'div',true));
  });
  allDayZone.addEventListener('dragover',event=>event.preventDefault());
  allDayZone.addEventListener('drop',event=>{
   event.preventDefault();
   const task=tasks.find(item=>item.id===event.dataTransfer.getData('id'));
   if(!task)return;
   task.date=dateKey;
   task.time=null;
   task.endTime=null;
   finishScheduleMove();
  });
  day.append(allDayZone);

  const timeline=document.createElement('div');
  for(let hour=7;hour<=20;hour++){
   const row=document.createElement('div');
   row.className='hour';
   row.dataset.date=dateKey;
   const time=document.createElement('div');
   time.className='time';
   time.textContent=`${hour%12||12}:00 ${hour<12?'AM':'PM'}`;
   const add=document.createElement('button');
   add.type='button';
   add.className='add-slot';
   add.textContent='+';
   add.setAttribute('aria-label',`Add appointment at ${time.textContent} on ${dateLabel}`);
   add.onclick=()=>openAppointmentEditor(null,{date:dateKey,time:hour,allDay:false});
   const slot=document.createElement('div');
   slot.className='slot';
   slot.dataset.date=dateKey;
   slot.dataset.hour=String(hour);
   const appointments=tasks.filter(task=>task.date===dateKey&&task.time!=null&&taskOccupiesHour(task,hour));
   if(appointments.length){
    const items=document.createElement('div');
    items.className='appointments';
    appointments.forEach(task=>items.append(createTaskElement(task,'div',true)));
    slot.append(items);
   }
   slot.addEventListener('dragover',event=>event.preventDefault());
   slot.addEventListener('drop',event=>{
    event.preventDefault();
    const task=tasks.find(item=>item.id===event.dataTransfer.getData('id'));
    if(!task)return;
    moveTaskToTime(task,dateKey,hour);
    finishScheduleMove();
   });
   row.append(time,add,slot);
   timeline.append(row);
  }
  day.append(timeline);
  agenda.append(day);
 }
 if(daysToRender<daysRemaining){
  const sentinel=document.createElement('div');
  sentinel.className='agenda-load-more';
  sentinel.textContent='Loading more days…';
  agenda.append(sentinel);
  mobileAgendaObserver=new IntersectionObserver(entries=>{
   if(!entries.some(entry=>entry.isIntersecting))return;
   mobileAgendaObserver.disconnect();
   mobileAgendaDayCount=Math.min(daysRemaining,mobileAgendaDayCount+10);
   renderMobileAgenda();
  },{rootMargin:'600px 0px'});
  mobileAgendaObserver.observe(sentinel);
 }
}

function timeToMinutes(time){
 const [hour,minute]=toTimeValue(time).split(':').map(Number);
 return hour*60+minute;
}

function taskOccupiesHour(task,hour){
 const start=timeToMinutes(task.time);
 const end=task.endTime?timeToMinutes(task.endTime):start+60;
 if(end<=start)return hour===Math.floor(start/60);
 const slotStart=hour*60;
 return slotStart<end&&slotStart+60>start;
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
 renderMobileAgenda();
}

let touchDrag=null,swipeDelete=null;

function finishSwipeDelete(event,cancelled=false){
 if(!swipeDelete||event.pointerId!==swipeDelete.pointerId)return;
 const swipe=swipeDelete;
 swipeDelete=null;
 if(!swipe.active)return;
 ignoreTaskClickUntil=Date.now()+500;
 const distance=event.clientX-swipe.startX;
 swipe.element.style.transition='transform .18s ease, opacity .18s ease';
 if(!cancelled&&distance>=Math.max(120,window.innerWidth*.45)){
  swipe.element.style.transform='translateX(110vw)';
  swipe.element.style.opacity='0';
  setTimeout(()=>{
   const index=tasks.findIndex(task=>task.id===swipe.taskId);
   if(index<0)return;
   tasks.splice(index,1);
   refreshAppointments();
  },180);
 }else{
  swipe.element.style.transform='';
  swipe.element.style.opacity='';
  setTimeout(()=>{swipe.element.style.transition='';},180);
 }
}

function positionTouchGhost(event){
 if(!touchDrag?.ghost)return;
 touchDrag.currentX=event.clientX;
 touchDrag.currentY=event.clientY;
 touchDrag.ghost.style.left=`${event.clientX}px`;
 touchDrag.ghost.style.top=`${event.clientY}px`;
 updateTouchDropTarget();
}

function updateTouchDropTarget(){
 if(!touchDrag?.active)return;
 const target=document.elementFromPoint(touchDrag.currentX,touchDrag.currentY);
 const dropTarget=target?.closest('.hour,.allday,.day')||null;
 if(dropTarget===touchDrag.dropTarget)return;
 touchDrag.dropTarget?.classList.remove('touch-drop-target');
 touchDrag.dropTarget=dropTarget;
 touchDrag.dropTarget?.classList.add('touch-drop-target');
}

function runTouchAutoScroll(){
 if(!touchDrag?.active)return;
 let scrollAmount=0;
 if(touchDrag.currentY<72)scrollAmount=-12;
 else if(touchDrag.currentY>window.innerHeight-72)scrollAmount=12;
 if(scrollAmount){
  window.scrollBy(0,scrollAmount);
  updateTouchDropTarget();
 }
 touchDrag.scrollFrame=requestAnimationFrame(runTouchAutoScroll);
}

function endTouchDrag(event,shouldDrop){
 if(!touchDrag||event.pointerId!==touchDrag.pointerId)return;
 clearTimeout(touchDrag.timer);
 const drag=touchDrag;
 touchDrag=null;
 if(drag.active){
  cancelAnimationFrame(drag.scrollFrame);
  drag.dropTarget?.classList.remove('touch-drop-target');
  ignoreTaskClickUntil=Date.now()+500;
  drag.ghost.remove();
  document.body.classList.remove('touch-dragging');
  if(shouldDrop){
   const x=event.clientX??drag.currentX;
   const y=event.clientY??drag.currentY;
   const target=document.elementFromPoint(x,y);
   const task=tasks.find(item=>item.id===drag.taskId);
   if(task&&target){
    const hour=target.closest('.hour');
    const slot=target.closest('.slot')||hour?.querySelector('.slot');
    const allDayZone=target.closest('.allday');
    const day=target.closest('.day');
    if(slot){
     moveTaskToTime(task,slot.dataset.date||key(sel),Number(slot.dataset.hour));
     finishScheduleMove();
    }else if(allDayZone){
     task.date=allDayZone.dataset.date||key(sel);
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
 lastTouchPointerDown=Date.now();
 const taskElement=event.target.closest('.task[draggable="true"]');
 if(!taskElement)return;
 const startX=event.clientX,startY=event.clientY;
 touchDrag={pointerId:event.pointerId,taskId:null,startX,startY,currentX:startX,currentY:startY,active:false,ghost:null,dropTarget:null,scrollFrame:null,timer:null};
 const taskId=taskElement.closest('[data-task-id]')?.dataset.taskId;
 touchDrag.taskId=taskId;
 swipeDelete={pointerId:event.pointerId,taskId,startX,startY,active:false,element:taskElement};
 touchDrag.timer=setTimeout(()=>{
 if(!touchDrag||touchDrag.pointerId!==event.pointerId)return;
  swipeDelete=null;
  touchDrag.active=true;
  touchDrag.ghost=taskElement.cloneNode(true);
  touchDrag.ghost.classList.add('touch-drag-ghost');
  document.body.append(touchDrag.ghost);
  document.body.classList.add('touch-dragging');
  positionTouchGhost(event);
  touchDrag.scrollFrame=requestAnimationFrame(runTouchAutoScroll);
 },350);
});

document.addEventListener('pointermove',event=>{
 if(swipeDelete&&event.pointerId===swipeDelete.pointerId){
  const deltaX=event.clientX-swipeDelete.startX;
  const deltaY=event.clientY-swipeDelete.startY;
  if(swipeDelete.active||(deltaX>8&&Math.abs(deltaX)>Math.abs(deltaY)*1.2)){
   swipeDelete.active=true;
   if(touchDrag){clearTimeout(touchDrag.timer);touchDrag=null;}
   event.preventDefault();
   swipeDelete.element.style.transform=`translateX(${Math.max(0,deltaX)}px)`;
   swipeDelete.element.style.opacity=String(Math.max(.25,1-Math.max(0,deltaX)/window.innerWidth));
   return;
  }
 }
 if(!touchDrag||event.pointerId!==touchDrag.pointerId)return;
 if(!touchDrag.active){
  if(Math.hypot(event.clientX-touchDrag.startX,event.clientY-touchDrag.startY)>18){
   clearTimeout(touchDrag.timer);
   touchDrag=null;
  }
  return;
 }
 event.preventDefault();
 touchDrag.currentX=event.clientX;
 touchDrag.currentY=event.clientY;
 positionTouchGhost(event);
},{passive:false});

document.addEventListener('pointerup',event=>{
 endTouchDrag(event,true);
 finishSwipeDelete(event);
});
document.addEventListener('pointercancel',event=>{
 endTouchDrag(event,false);
 finishSwipeDelete(event,true);
});
document.addEventListener('contextmenu',event=>{
 if(touchDrag?.active&&event.target.closest('.task'))event.preventDefault();
});

function renderTimeline(){
 document.querySelectorAll('.slot').forEach(slot=>slot.replaceChildren());
 tasks.filter(x=>x.date===key(sel)&&x.time!=null).forEach(task=>{
  for(let hour=7;hour<=20;hour++){
   if(!taskOccupiesHour(task,hour))continue;
   const slot=document.querySelector(`.day-panel .slot[data-hour="${hour}"]`);
   if(slot){
      let items = slot.querySelector(".appointments");

if (!items) {
    items = document.createElement("div");
    items.className = "appointments";
    slot.appendChild(items);
}

items.appendChild(createTaskElement(task,'div',true));
   }
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
 renderMobileAgenda();
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
