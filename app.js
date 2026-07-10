// TEST

// DayFlow v0.7

const tasks=JSON.parse(localStorage.getItem('df6')||'[]');
let t=new Date(),y=t.getFullYear(),m=t.getMonth(),sel=new Date(t);

function save(){localStorage.setItem('df6',JSON.stringify(tasks));}

function key(d){return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}

function renderInbox(){
 inbox.innerHTML='';
 tasks.filter(x=>!x.date).forEach(x=>{
  let li=document.createElement('li');
  li.className='task';
  li.textContent=x.title;
  li.draggable=true;
  li.ondragstart=e=>e.dataTransfer.setData('id',x.id);
  inbox.append(li);
 });
}

function renderAllDay(){
 allDay.innerHTML='';
 tasks.filter(x=>x.date===key(sel)&&!x.time).forEach(x=>{
   let d=document.createElement('div');
   d.className='task';
   d.textContent=x.title;
   allDay.append(d);
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
   if(sel.getFullYear()==y&&sel.getMonth()==m&&sel.getDate()==d)c.classList.add('selected');
   c.innerHTML="<b>"+d+"</b>";
   let k=`${y}-${m+1}-${d}`;
   if(tasks.some(x=>x.date===k)){let dot=document.createElement('div');dot.className='dot';c.append(dot);}
   c.onclick=()=>{sel=new Date(y,m,d);drawCal();renderSelectedDay();}
   c.ondragover=e=>e.preventDefault();
   c.ondrop=e=>{
      e.preventDefault();
      let id=e.dataTransfer.getData('id');
      let task=tasks.find(a=>a.id===id);
      if(task){
        task.date=k;
        task.time=null;
        sel=new Date(y,m,d);
        save();
        renderInbox();
        drawCal();
        renderSelectedDay();
      }
   };
   calendar.append(c);
 }
}
addBtn.onclick=()=>{
 if(!newTask.value.trim())return;
 tasks.push({id:String(Date.now()+Math.random()),title:newTask.value.trim(),date:null,time:null});
 newTask.value='';
 save();renderInbox();drawCal();
}
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
      task.date=key(sel);
      task.time=Number(slot.dataset.hour);
      save();
      renderInbox();
      drawCal();
      renderSelectedDay();
    }
  });
});

function renderTimeline(){
 document.querySelectorAll('.slot').forEach(slot=>slot.replaceChildren());
 tasks.filter(x=>x.date===key(sel)&&x.time!=null).forEach(task=>{
   const slot=document.querySelector(`.slot[data-hour="${task.time}"]`);
   if(slot){
      let items = slot.querySelector(".appointments");

if (!items) {
    items = document.createElement("div");
    items.className = "appointments";
    slot.appendChild(items);
}

const d = document.createElement("div");
d.className = "task";
d.textContent = task.title;
items.appendChild(d);
   }
 });
}

// v0.7-m2 milestone

function addScheduled(time){
 const title=prompt("Title");
 if(!title)return;
 const hour=time===null?null:Number(time);
 if(hour!==null&&!Number.isInteger(hour))return;

tasks.push({
    id:String(Date.now()+Math.random()),
    title:title,
    date:key(sel),
    time:hour
});
 save();
 renderInbox();
 drawCal();
 renderSelectedDay();
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
