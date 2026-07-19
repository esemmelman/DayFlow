// TEST

// DayFlow v0.8-m17

let legacyTasks=JSON.parse(localStorage.getItem('df6')||'[]');
let tasks=[...legacyTasks];
let currentUser=null,remoteTaskIds=new Set(),syncTimer=null,syncInProgress=false,syncAgain=false,taskChannel=null;
const supabaseSettings=window.DAYFLOW_SUPABASE||{};
const supabaseClient=window.supabase&&supabaseSettings.url&&supabaseSettings.publishableKey
 ?window.supabase.createClient(supabaseSettings.url,supabaseSettings.publishableKey):null;
const usesAndroidAgenda=/Android/i.test(navigator.userAgent)||matchMedia('(max-width:599px) and (pointer:coarse)').matches;
document.body.classList.toggle('android',usesAndroidAgenda);
let t=new Date(),y=t.getFullYear(),m=t.getMonth(),sel=new Date(t);
let mobileAgendaStart=new Date(t);
mobileAgendaStart.setHours(0,0,0,0);
let mobileAgendaDayCount=10,mobileAgendaObserver=null;
let editingAppointmentId=null,clearInboxAfterSave=false,editorReturnFocus=null;
let ignoreTaskClickUntil=0;
let lastTouchPointerDown=0;

function setSyncStatus(message,state=''){
 const status=document.getElementById('syncStatus');
 if(status){status.textContent=message;status.dataset.state=state;}
}
function deduplicateSeededTimeSlots(){
 const deduplicatedTitles=new Set(['dr. john','swim class','take the trash in','take the trash out']);
 const occupiedSlots=new Set();
 const originalCount=tasks.length;
 tasks=tasks.filter(task=>{
  const normalizedTitle=task.title.trim().toLocaleLowerCase();
  if(!deduplicatedTitles.has(normalizedTitle)||!task.date)return true;
  const slot=`${normalizedTitle}|${task.date}|${task.time??'all-day'}`;
  if(occupiedSlots.has(slot))return false;
  occupiedSlots.add(slot);
  return true;
 });
 return originalCount-tasks.length;
}
function snapshotStorageKey(){return `dayflow:snapshots:${currentUser?.id||'device'}`;}
function createTaskSnapshot(reason,snapshotTasks=tasks){
 if(!snapshotTasks.length)return;
 try{
  const snapshots=JSON.parse(localStorage.getItem(snapshotStorageKey())||'[]');
  snapshots.unshift({createdAt:new Date().toISOString(),reason,tasks:snapshotTasks});
  localStorage.setItem(snapshotStorageKey(),JSON.stringify(snapshots.slice(0,10)));
 }catch(error){console.warn('Could not create DayFlow snapshot',error);}
}
function save(){
 createTaskSnapshot('change');
 deduplicateSeededTimeSlots();
 localStorage.setItem(currentUser?`df6:${currentUser.id}`:'df6',JSON.stringify(tasks));
 if(!currentUser)return;
 clearTimeout(syncTimer);setSyncStatus('Saving…','pending');syncTimer=setTimeout(syncTasks,250);
}
function taskToRow(task){return {id:String(task.id),user_id:currentUser.id,title:task.title,date:task.date||null,start_time:task.time??null,end_time:task.endTime??null,notes:task.notes||'',color:task.color||'#2f80ed'};}
function rowToTask(row){
 const date=row.date?row.date.split('-').map(Number).join('-'):null;
 return {id:row.id,title:row.title,date,time:row.start_time?.slice(0,5)??null,endTime:row.end_time?.slice(0,5)??null,notes:row.notes||'',color:row.color||'#2f80ed'};
}
async function syncTasks(){
 if(!supabaseClient||!currentUser)return;
 if(syncInProgress){syncAgain=true;return;}
 syncInProgress=true;
 try{
  deduplicateSeededTimeSlots();
  const rows=tasks.map(taskToRow);
  if(rows.length){const {error}=await supabaseClient.from('tasks').upsert(rows,{onConflict:'user_id,id'});if(error)throw error;}
  const currentIds=new Set(tasks.map(task=>String(task.id)));
  const deleted=[...remoteTaskIds].filter(id=>!currentIds.has(id));
  if(deleted.length){const {error}=await supabaseClient.from('tasks').delete().in('id',deleted);if(error)throw error;}
  remoteTaskIds=currentIds;
  localStorage.setItem(`df6:${currentUser.id}`,JSON.stringify(tasks));
  if(legacyTasks.length){
   localStorage.setItem('df6:legacy-backup',JSON.stringify(legacyTasks));
   legacyTasks=[];
   localStorage.removeItem('df6');
  }
  setSyncStatus('Synced','ok');
 }catch(error){console.error('DayFlow sync failed',error);setSyncStatus('Sync failed','error');}
 finally{syncInProgress=false;if(syncAgain){syncAgain=false;syncTasks();}}
}
function renderEverything(){renderInbox();drawCal();renderSelectedDay();renderMobileAgenda();}
async function loadRemoteTasks(){
 setSyncStatus('Loading…','pending');
 const {data,error}=await supabaseClient.from('tasks').select('*').order('created_at');
 if(error){setSyncStatus('Load failed','error');throw error;}
 remoteTaskIds=new Set((data||[]).map(row=>row.id));
 if(data?.length){
  const remoteTasks=data.map(rowToTask);
  if(legacyTasks.length){
   const merged=new Map(legacyTasks.map(task=>[String(task.id),task]));
   remoteTasks.forEach(task=>merged.set(String(task.id),task));
   tasks=[...merged.values()];
   deduplicateSeededTimeSlots();
   renderEverything();
   await syncTasks();
 }else{
   createTaskSnapshot('before remote refresh');
   tasks=remoteTasks;
   const duplicatesRemoved=deduplicateSeededTimeSlots();
   localStorage.setItem(`df6:${currentUser.id}`,JSON.stringify(tasks));
   renderEverything();
   if(duplicatesRemoved)await syncTasks();else setSyncStatus('Synced','ok');
  }
 }
 else if(tasks.length)await syncTasks();
 else setSyncStatus('Synced','ok');
}

function key(d){return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}
function daysFromToday(date){
 const today=new Date();
 const dateUtc=Date.UTC(date.getFullYear(),date.getMonth(),date.getDate());
 const todayUtc=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());
 return Math.round((dateUtc-todayUtc)/86400000);
}

function compareTaskTitles(a,b){
 return a.title.localeCompare(b.title,undefined,{sensitivity:'base',numeric:true});
}

function compareTaskStartTimes(a,b){
 return timeToMinutes(a.time)-timeToMinutes(b.time)||compareTaskTitles(a,b);
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
if(deduplicateSeededTimeSlots())save();

function createTaskElement(task,tagName='div',draggable=false){
 const element=document.createElement(tagName);
 element.className=`task${task.date?' appointment':''}`;
 element.dataset.taskId=task.id;
 const title=document.createElement('span');
 title.textContent=task.title;
 element.append(title);
 if(task.notes?.trim()){
  const noteIndicator=document.createElement('span');
  noteIndicator.className='note-indicator';
  noteIndicator.textContent='✎';
  noteIndicator.title='Has notes';
  noteIndicator.setAttribute('aria-label','Has notes');
  title.append(noteIndicator);
 }
 if(task.date&&task.time!==null&&task.time!==undefined){
  const timeDetails=document.createElement('span');
  timeDetails.className='task-time-details';
  const time=document.createElement('span');
  time.className='task-time';
  time.textContent=formatTimeRange(task.time,task.endTime);
  timeDetails.append(time);
  const minutesUntil=document.createElement('span');
  minutesUntil.className='minutes-until';
  minutesUntil.dataset.date=task.date;
  minutesUntil.dataset.startTime=toTimeValue(task.time);
  minutesUntil.title='Minutes until start';
  minutesUntil.setAttribute('aria-label','Minutes until start');
  const remaining=minutesUntilStart(minutesUntil.dataset.startTime);
  const isToday=task.date===key(new Date());
  minutesUntil.textContent=isToday&&remaining>0?String(remaining):'';
  minutesUntil.hidden=!isToday||remaining<=0;
  timeDetails.append(minutesUntil);
  element.append(timeDetails);
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
 const dateLabel=document.createElement('span');
 dateLabel.textContent=sel.toDateString();
 const dayOffset=document.createElement('span');
 dayOffset.className='day-title-offset';
 dayOffset.textContent=String(daysFromToday(sel));
 dayOffset.title='Days from today';
 dayTitle.replaceChildren(dateLabel,dayOffset);
 renderAllDay();
 renderTimeline();
}

function drawCal(){
 monthTitle.textContent=new Date(y,m).toLocaleString('default',{month:'long',year:'numeric'});
 calendar.innerHTML='';
 ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(n=>{let e=document.createElement('div');e.className='dow';e.textContent=n;calendar.append(e);});
 let first=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate();
 for(let i=0;i<first;i++)calendar.append(document.createElement('div'));
 for(let d=1;d<=days;d++){
   let c=document.createElement('div');c.className='day';
   c.dataset.date=`${y}-${m+1}-${d}`;
   if(sel.getFullYear()==y&&sel.getMonth()==m&&sel.getDate()==d)c.classList.add('selected');
   c.innerHTML="<b>"+d+"</b>";
   let k=`${y}-${m+1}-${d}`;
   if(k===key(new Date()))c.classList.add('today');
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
const androidAccount=document.getElementById('androidAccount');
const androidAddForm=document.getElementById('androidAddForm');
const androidNewTask=document.getElementById('androidNewTask');
const androidSearchForm=document.getElementById('androidSearchForm');
const androidSearch=document.getElementById('androidSearch');
const androidSearchCancel=document.getElementById('androidSearchCancel');
const androidPanel=document.getElementById('androidPanel');
const desktopFindBtn=document.getElementById('desktopFindBtn');
const desktopSearchDialog=document.getElementById('desktopSearchDialog');
const desktopSearch=document.getElementById('desktopSearch');
const desktopSearchResults=document.getElementById('desktopSearchResults');
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

function renderSearchResults(searchInput,container,onSelect){
 container.replaceChildren();
 const query=searchInput.value.trim().toLocaleLowerCase();
 if(!query){
  const message=document.createElement('p');
  message.className='search-message';
  message.textContent='Type to search all tasks.';
  container.append(message);
  return;
 }
 const matches=tasks.filter(task=>`${task.title} ${task.notes||''}`.toLocaleLowerCase().includes(query)).sort(compareTaskSchedule);
 if(!matches.length){
  const message=document.createElement('p');
  message.className='search-message';
  message.textContent='No matching tasks.';
  container.append(message);
  return;
 }
 const results=document.createElement('div');
 results.className='search-results';
 matches.forEach(task=>{
  const result=document.createElement('button');
  result.type='button';
  result.className='search-result';
  const title=document.createElement('strong');
  title.textContent=task.title;
  const detail=document.createElement('small');
  detail.textContent=searchResultDetail(task);
  result.append(title,detail);
  result.onclick=()=>onSelect(task);
  results.append(result);
 });
 container.append(results);
}

function renderAndroidSearchResults(){
 androidPanel.hidden=false;
 renderSearchResults(androidSearch,androidPanel,task=>{
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
 });
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

function closeDesktopSearch(){
 desktopSearchDialog.hidden=true;
 desktopSearch.value='';
 desktopSearchResults.replaceChildren();
 desktopFindBtn.focus();
}
function renderDesktopSearchResults(){
 renderSearchResults(desktopSearch,desktopSearchResults,task=>{
  closeDesktopSearch();
  openAppointmentEditor(task);
 });
}
desktopFindBtn.onclick=()=>{
 desktopSearchDialog.hidden=false;
 renderDesktopSearchResults();
 desktopSearch.focus();
};
desktopSearch.addEventListener('input',renderDesktopSearchResults);
desktopSearchDialog.querySelectorAll('[data-search-cancel]').forEach(element=>element.onclick=closeDesktopSearch);
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!desktopSearchDialog.hidden){event.preventDefault();closeDesktopSearch();}
});

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
 ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(label=>{
  const weekday=document.createElement('b');
  weekday.textContent=label;
  grid.append(weekday);
 });
 const year=androidPickerMonth.getFullYear();
 const month=androidPickerMonth.getMonth();
 const firstWeekday=(new Date(year,month,1).getDay()+6)%7;
 for(let blank=0;blank<firstWeekday;blank++)grid.append(document.createElement('span'));
 const days=new Date(year,month+1,0).getDate();
 for(let date=1;date<=days;date++){
  const button=document.createElement('button');
  button.type='button';
  button.textContent=String(date);
  const dateValue=`${year}-${month+1}-${date}`;
  if(dateValue===key(new Date()))button.classList.add('today');
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
 enableHorizontalMonthSwipe(grid);
 androidPanel.append(header,grid);
}

function enableHorizontalMonthSwipe(element){
 let swipe=null;
 element.onpointerdown=event=>{
  if(!event.isPrimary)return;
  swipe={id:event.pointerId,x:event.clientX,y:event.clientY};
  try{element.setPointerCapture(event.pointerId);}catch{}
 };
 element.onpointerup=event=>{
  if(!swipe||event.pointerId!==swipe.id)return;
  const deltaX=event.clientX-swipe.x,deltaY=event.clientY-swipe.y;
  swipe=null;
  if(Math.abs(deltaX)<50||Math.abs(deltaX)<=Math.abs(deltaY)*1.25)return;
  event.preventDefault();
  androidPickerMonth.setMonth(androidPickerMonth.getMonth()+(deltaX>0?-1:1));
  renderAndroidCalendar();
 };
 element.onpointercancel=()=>{swipe=null;};
}

androidCal.onclick=()=>{
 if(!androidPanel.hidden&&androidPanel.querySelector('.android-calendar-grid')){
  closeAndroidPanel();
  return;
 }
 moveToToday();
 androidPickerMonth=new Date(mobileAgendaStart.getFullYear(),mobileAgendaStart.getMonth(),1);
 renderAndroidCalendar();
 requestAnimationFrame(()=>androidPanel.scrollIntoView({block:'start'}));
};

androidAbout.onclick=()=>{
 if(!androidPanel.hidden&&androidPanel.querySelector('.android-about')){closeAndroidPanel();return;}
 androidPanel.hidden=false;
 androidPanel.innerHTML='<div class="android-about">DayFlow v0.8-m17</div>';
};
prev.onclick=()=>{m--;if(m<0){m=11;y--;}drawCal();}
next.onclick=()=>{m++;if(m>11){m=0;y++;}drawCal();}
function moveToToday(){
 t=new Date();
 y=t.getFullYear();
 m=t.getMonth();
 sel=new Date(t);
 mobileAgendaStart=new Date(t);
 mobileAgendaStart.setHours(0,0,0,0);
 mobileAgendaDayCount=10;
 drawCal();
 renderSelectedDay();
 renderMobileAgenda();
}

todayBtn.onclick=moveToToday;
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
  const headingOffset=document.createElement('span');
  headingOffset.className='agenda-day-offset';
  headingOffset.textContent=String(daysFromToday(date));
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
   const appointments=tasks.filter(task=>task.date===dateKey&&task.time!=null&&taskOccupiesHour(task,hour)).sort(compareTaskStartTimes);
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
 if(swipe.scrolling){ignoreTaskClickUntil=Date.now()+500;return;}
 if(!swipe.active)return;
 ignoreTaskClickUntil=Date.now()+500;
 swipe.element.style.transition='transform .18s ease, opacity .18s ease';
 if(!cancelled&&swipe.element.getBoundingClientRect().left<=1){
  swipe.element.style.transform='translateX(-110vw)';
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
 swipeDelete={pointerId:event.pointerId,taskId,startX,startY,lastY:startY,currentX:startX,active:false,scrolling:false,element:taskElement};
 try{taskElement.setPointerCapture(event.pointerId);}catch{}
 touchDrag.timer=setTimeout(()=>{
 if(!touchDrag||touchDrag.pointerId!==event.pointerId)return;
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
  if(swipeDelete.scrolling||(!swipeDelete.active&&!touchDrag?.active&&Math.abs(deltaY)>8&&Math.abs(deltaY)>Math.abs(deltaX)*1.2)){
   swipeDelete.scrolling=true;
   if(touchDrag){clearTimeout(touchDrag.timer);touchDrag=null;}
   event.preventDefault();
   window.scrollBy(0,swipeDelete.lastY-event.clientY);
   swipeDelete.lastY=event.clientY;
   return;
  }
  if(swipeDelete.active||(deltaX<-8&&Math.abs(deltaX)>Math.abs(deltaY)*1.2)){
   swipeDelete.active=true;
   swipeDelete.currentX=event.clientX;
   if(touchDrag){
    clearTimeout(touchDrag.timer);
    if(touchDrag.active){
     cancelAnimationFrame(touchDrag.scrollFrame);
     touchDrag.dropTarget?.classList.remove('touch-drop-target');
     touchDrag.ghost?.remove();
     document.body.classList.remove('touch-dragging');
    }
    touchDrag=null;
   }
   event.preventDefault();
   swipeDelete.element.style.transform=`translateX(${Math.min(0,deltaX)}px)`;
   swipeDelete.element.style.opacity=String(Math.max(.25,1-Math.max(0,-deltaX)/window.innerWidth));
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
 tasks.filter(x=>x.date===key(sel)&&x.time!=null).sort(compareTaskStartTimes).forEach(task=>{
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

function minutesUntilStart(startTime,now=new Date()){
 const [hour,minute]=startTime.split(':').map(Number);
 const start=new Date(now.getFullYear(),now.getMonth(),now.getDate(),hour,minute);
 return Math.ceil((start-now)/60000);
}

function updateMinutesUntil(){
 const now=new Date();
 document.querySelectorAll('.minutes-until').forEach(element=>{
  const minutes=minutesUntilStart(element.dataset.startTime,now);
  const isToday=element.dataset.date===key(now);
  element.textContent=isToday&&minutes>0?String(minutes):'';
  element.hidden=!isToday||minutes<=0;
 });
}

setInterval(updateMinutesUntil,30000);
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden)updateMinutesUntil();
});

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
 appointmentForm.classList.toggle('is-editing',Boolean(task));
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

const accountBtn=document.getElementById('accountBtn'),authDialog=document.getElementById('authDialog'),authForm=document.getElementById('authForm');
const authEmail=document.getElementById('authEmail'),authPassword=document.getElementById('authPassword'),authError=document.getElementById('authError');
const signUpBtn=document.getElementById('signUpBtn'),signOutBtn=document.getElementById('signOutBtn'),changePasswordBtn=document.getElementById('changePasswordBtn');
const changePasswordFields=document.getElementById('changePasswordFields'),newPassword=document.getElementById('newPassword'),confirmNewPassword=document.getElementById('confirmNewPassword'),saveNewPasswordBtn=document.getElementById('saveNewPasswordBtn'),cancelChangePasswordBtn=document.getElementById('cancelChangePasswordBtn');
const downloadBackupBtn=document.getElementById('downloadBackupBtn'),restoreBackupBtn=document.getElementById('restoreBackupBtn'),restoreSnapshotBtn=document.getElementById('restoreSnapshotBtn'),restoreBackupFile=document.getElementById('restoreBackupFile');
const confirmationDialog=document.getElementById('confirmationDialog'),confirmationMessage=document.getElementById('confirmationMessage'),confirmationYes=document.getElementById('confirmationYes');
let confirmationResolver=null,confirmationReturnFocus=null;

function finishConfirmation(confirmed){
 if(!confirmationResolver)return;
 const resolve=confirmationResolver;
 confirmationResolver=null;
 confirmationDialog.hidden=true;
 resolve(confirmed);
 confirmationReturnFocus?.focus();
 confirmationReturnFocus=null;
}
function requestConfirmation(message){
 confirmationMessage.textContent=message;
 confirmationReturnFocus=document.activeElement;
 confirmationDialog.hidden=false;
 confirmationYes.focus();
 return new Promise(resolve=>{confirmationResolver=resolve;});
}
confirmationYes.onclick=()=>finishConfirmation(true);
confirmationDialog.querySelectorAll('[data-confirm-no]').forEach(button=>button.onclick=()=>finishConfirmation(false));
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!confirmationDialog.hidden){event.preventDefault();finishConfirmation(false);}
});

function mergeRestoredTasks(imported){
 createTaskSnapshot('before backup restore');
 const merged=new Map(tasks.map(task=>[String(task.id),task]));
 imported.forEach(task=>merged.set(String(task.id),{...task,id:String(task.id)}));
 tasks=[...merged.values()];save();renderEverything();
}

downloadBackupBtn.onclick=async()=>{
 if(!await requestConfirmation('Do you want to download a backup now?'))return;
 const backup={format:'dayflow-backup',version:1,exportedAt:new Date().toISOString(),tasks};
 const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=`dayflow-backup-${new Date().toISOString().slice(0,10)}.json`;
 document.body.append(link);link.click();link.remove();URL.revokeObjectURL(url);
 authError.textContent=`Backup downloaded with ${tasks.length} tasks.`;
};
restoreBackupBtn.onclick=async()=>{
 if(await requestConfirmation('Do you want to choose a backup file to restore?'))restoreBackupFile.click();
};
restoreSnapshotBtn.onclick=async()=>{
 if(!await requestConfirmation('Do you want to restore the latest device snapshot?'))return;
 const snapshots=JSON.parse(localStorage.getItem(snapshotStorageKey())||'[]');
 if(!snapshots.length){authError.textContent='No automatic snapshot is available on this device yet.';return;}
 mergeRestoredTasks(snapshots[0].tasks);
 authError.textContent=`Restored the latest device snapshot; ${tasks.length} total tasks.`;
};
restoreBackupFile.onchange=async()=>{
 const file=restoreBackupFile.files?.[0];
 if(!file)return;
 try{
  const parsed=JSON.parse(await file.text());
  const imported=Array.isArray(parsed)?parsed:parsed.tasks;
  if(!Array.isArray(imported)||imported.some(task=>!task||task.id==null||typeof task.title!=='string'))throw new Error('This is not a valid DayFlow backup.');
  mergeRestoredTasks(imported);
  authError.textContent=`Restored ${imported.length} tasks; ${tasks.length} total.`;
 }catch(error){authError.textContent=error.message||'Could not restore this backup.';}
 finally{restoreBackupFile.value='';}
};
function updateAccountUi(){
 accountBtn.textContent=currentUser?currentUser.email:'Connect';signOutBtn.hidden=!currentUser;changePasswordBtn.hidden=!currentUser;signUpBtn.hidden=Boolean(currentUser);
 authPassword.closest('label').hidden=Boolean(currentUser);authEmail.closest('label').hidden=Boolean(currentUser);
 authForm.querySelector('button[type="submit"]').hidden=Boolean(currentUser);
 if(!currentUser)closeChangePasswordFields();
}
function closeChangePasswordFields(){changePasswordFields.hidden=true;newPassword.value='';confirmNewPassword.value='';}
changePasswordBtn.onclick=()=>{authError.textContent='';changePasswordFields.hidden=false;newPassword.focus();};
cancelChangePasswordBtn.onclick=closeChangePasswordFields;
saveNewPasswordBtn.onclick=async()=>{
 const password=newPassword.value;
 if(password.length<6){authError.textContent='The new password must be at least 6 characters.';newPassword.focus();return;}
 if(password!==confirmNewPassword.value){authError.textContent='The new passwords do not match.';confirmNewPassword.focus();return;}
 saveNewPasswordBtn.disabled=true;authError.textContent='Changing password…';
 const {error}=await supabaseClient.auth.updateUser({password});
 saveNewPasswordBtn.disabled=false;
 if(error){authError.textContent=error.message;return;}
 closeChangePasswordFields();authError.textContent='Password changed successfully.';
};
function openAuthDialog(){authError.textContent=supabaseClient?'':'Add your Supabase URL and publishable key to supabase-config.js first.';updateAccountUi();authDialog.hidden=false;if(!currentUser)authEmail.focus();}
function closeAuthDialog(){authDialog.hidden=true;authError.textContent='';closeChangePasswordFields();}
accountBtn.onclick=openAuthDialog;
androidAccount.onclick=openAuthDialog;
authDialog.querySelectorAll('[data-auth-cancel]').forEach(button=>button.onclick=closeAuthDialog);
authForm.addEventListener('submit',async event=>{
 event.preventDefault();if(!supabaseClient)return openAuthDialog();authError.textContent='Signing in…';
 const {error}=await supabaseClient.auth.signInWithPassword({email:authEmail.value.trim(),password:authPassword.value});
 if(error)authError.textContent=error.message;else closeAuthDialog();
});
signUpBtn.onclick=async()=>{
 if(!supabaseClient)return openAuthDialog();authError.textContent='Creating account…';
 const {data,error}=await supabaseClient.auth.signUp({email:authEmail.value.trim(),password:authPassword.value});
 authError.textContent=error?error.message:(data.session?'Account created.':'Check your email to confirm your account, then sign in.');
};
signOutBtn.onclick=async()=>{await supabaseClient?.auth.signOut();closeAuthDialog();};
async function applySession(session){
 const nextUser=session?.user||null;if(nextUser?.id===currentUser?.id)return;
 currentUser=nextUser;remoteTaskIds=new Set();
 if(taskChannel){await supabaseClient.removeChannel(taskChannel);taskChannel=null;}
 updateAccountUi();
 if(!currentUser){tasks=[];renderEverything();setSyncStatus(supabaseClient?'Not signed in':'Local only');return;}
 const cachedTasks=localStorage.getItem(`df6:${currentUser.id}`);
 if(cachedTasks){tasks=JSON.parse(cachedTasks);deduplicateSeededTimeSlots();renderEverything();}
 try{
  await loadRemoteTasks();
  taskChannel=supabaseClient.channel(`tasks:${currentUser.id}`).on('postgres_changes',{event:'*',schema:'public',table:'tasks',filter:`user_id=eq.${currentUser.id}`},()=>{
   clearTimeout(syncTimer);syncTimer=setTimeout(loadRemoteTasks,350);
  }).subscribe();
 }catch(error){console.error('Could not load DayFlow tasks',error);}
}
if(supabaseClient){
 supabaseClient.auth.onAuthStateChange((_event,session)=>setTimeout(()=>applySession(session),0));
 supabaseClient.auth.getSession().then(({data})=>applySession(data.session));
}else setSyncStatus('Local only');
