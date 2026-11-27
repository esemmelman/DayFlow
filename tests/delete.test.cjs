const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');

function setup(){
 const context={tasks:[{id:'a',title:'Dentist'},{id:'b',title:'Lunch'}],editingAppointmentId:'a',editorDelete:{},closed:0,saved:0,
  closeAppointmentEditor(){context.closed++;},refreshAppointments(){context.saved++;},
  requestConfirmation(message){context.message=message;return new Promise(resolve=>{context.answer=resolve;});},
  setTimeout(fn){fn();},Date,ignoreTaskClickUntil:0};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function isWeeklyOccurrence('),source.indexOf('function updateEditorRecurrenceFields(')),context);
 vm.runInContext(source.slice(source.indexOf('async function confirmTaskDeletion('),source.indexOf('editorAllDay.onchange=')),context);
 vm.runInContext(source.slice(source.indexOf('async function finishSwipeDelete('),source.indexOf('function positionTouchGhost(')),context);
 return context;
}

for(const confirmed of [false,true]){
 test(`editor delete ${confirmed?'confirmed':'canceled'}`,async()=>{
  const app=setup();
  const pending=app.editorDelete.onclick();
  assert.equal(app.tasks.length,2);
  assert.match(app.message,/Dentist/);
  app.answer(confirmed);await pending;
  assert.equal(app.tasks.length,confirmed?1:2);
  assert.equal(app.closed,confirmed?1:0);
  assert.equal(app.saved,confirmed?1:0);
 });
 test(`swipe delete ${confirmed?'confirmed':'canceled'}`,async()=>{
  const app=setup();
  const element={style:{transform:'translateX(-500px)',opacity:'0.25'},getBoundingClientRect:()=>({left:0})};
  app.swipeDelete={pointerId:1,taskId:'a',active:true,element};
  const pending=app.finishSwipeDelete({pointerId:1});
  assert.equal(app.tasks.length,2);
  assert.equal(element.style.transform,'');
  assert.equal(element.style.opacity,'');
  app.answer(confirmed);await pending;
  assert.equal(app.tasks.length,confirmed?1:2);
  assert.equal(app.saved,confirmed?1:0);
 });
}

test('confirmation deletes the requested item even if the task list changes',async()=>{
 const app=setup();
 const pending=app.editorDelete.onclick();
 app.tasks.reverse();
 app.answer(true);await pending;
 assert.equal(app.tasks[0].id,'b');
});

test('canceled pointer gesture does not request deletion',async()=>{
 const app=setup();
 app.swipeDelete={pointerId:1,taskId:'a',active:true,element:{style:{},getBoundingClientRect:()=>({left:0})}};
 await app.finishSwipeDelete({pointerId:1},true);
 assert.equal(app.message,undefined);
 assert.equal(app.tasks.length,2);
});

test('deleting a weekly occurrence preserves the rest of its series',async()=>{
 const app=setup();
 app.tasks=[
  {id:'weekly:series:2026-11-26',title:'Dentist'},
  {id:'weekly:series:2026-12-3',title:'Dentist'},
  {id:'weekly:series:2026-12-10',title:'Dentist'}
 ];
 app.editingAppointmentId=app.tasks[1].id;
 const pending=app.editorDelete.onclick();
 assert.match(app.message,/this occurrence/);
 app.answer(true);
 await pending;
 assert.deepEqual(app.tasks.map(task=>task.id),['weekly:series:2026-11-26','weekly:series:2026-12-10']);
});

test('weekly dates keep the weekday across the daylight saving transition',()=>{
 const app=setup();
 app.key=date=>`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
 assert.equal(JSON.stringify(app.weeklyDates('2026-10-29','2026-11-12')),
  '["2026-11-5","2026-11-12"]');
 assert.equal(app.weeklyDates('2026-10-29','2026-11-04').length,0);
});
