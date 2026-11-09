const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
function setup(){
 const context={};vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function timeToMinutes('),source.indexOf('function finishScheduleMove(')),context);
 vm.runInContext(source.slice(source.indexOf('function toTimeValue('),source.indexOf('function minutesUntilStart(')),context);
 return context;
}
test('half-hour slot labels and editor values preserve minutes',()=>{
 const app=setup();
 assert.deepEqual([6,6.5,7,7.5].map(app.formatTime),['6:00 AM','6:30 AM','7:00 AM','7:30 AM']);
 assert.equal(app.formatTime(12.5),'12:30 PM');
 assert.equal(app.toTimeValue(6.5),'06:30');
});
test('appointment appears only in half-hours it overlaps',()=>{
 const app=setup();const task={time:'06:30',endTime:'07:00'};
 assert.equal(app.taskOccupiesHour(task,6),false);
 assert.equal(app.taskOccupiesHour(task,6.5),true);
 assert.equal(app.taskOccupiesHour(task,7),false);
 const across={time:'06:45',endTime:'07:15'};
 assert.equal(app.taskOccupiesHour(across,6.5),true);
 assert.equal(app.taskOccupiesHour(across,7),true);
});
test('dragging into a half-hour preserves appointment duration',()=>{
 const app=setup();const task={time:'08:00',endTime:'08:45'};
 app.moveTaskToTime(task,'2026-11-10',6.5);
 assert.equal(task.time,'06:30');assert.equal(task.endTime,'07:15');
 assert.equal(task.date,'2026-11-10');
});

test('plus-button editor defaults to thirty minutes for full and half-hour starts',()=>{
 const app=setup();
 vm.runInContext(source.slice(source.indexOf('function defaultEndTime('),source.indexOf('function updateEditorTimeFields(')),app);
 assert.equal(app.defaultEndTime(6),'06:30');
 assert.equal(app.defaultEndTime(6.5),'07:00');
 assert.equal(app.defaultEndTime('11:45'),'12:15');
 assert.equal(app.defaultEndTime(null),'');
});
