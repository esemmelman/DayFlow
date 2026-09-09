const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(){
 const elements=new Map();
 const element=id=>{
  if(!elements.has(id))elements.set(id,{value:'',hidden:true,disabled:false,textContent:'',isConnected:true,focus(){},addEventListener(){},querySelectorAll(){return [];}});
  return elements.get(id);
 };
 class Recognition {start(){Recognition.latest=this;}abort(){this.onend?.();}}
 const context=vm.createContext({console,Date,crypto:require('node:crypto').webcrypto,
  document:{getElementById:element,addEventListener(){},activeElement:element('natBtn')},
  window:{SpeechRecognition:Recognition},tasks:[],save(){context.saves++;},saves:0,
  renderEverything(){},formatTime:value=>value});
 vm.runInContext(fs.readFileSync('vendor/chrono-en.min.js','utf8'),context);
 vm.runInContext(fs.readFileSync('nat.js','utf8'),context);
 return {context,element,Recognition,parse:text=>context.parseNaturalTask(text,new Date(2026,8,9,10))};
}
test('extracts title, relative dates, spoken times and ranges',()=>{
 const {parse}=setup();
 for(const [text,title,date,time,endTime] of [
  ['Buy milk','Buy milk','2026-9-9',null,null],
  ["Check Aubree's Bed","Check Aubree's Bed",'2026-9-9',null,null],
  ['Check Aubree’s Bed','Check Aubree’s Bed','2026-9-9',null,null],
  ['Add dentist tomorrow at 3 PM','dentist','2026-9-10','15:00','15:30'],
  ['Remind me to call Sam Friday at noon','call Sam','2026-9-11','12:00','12:30'],
  ['Lunch tomorrow from 1 PM to 2 PM','Lunch','2026-9-10','13:00','14:00'],
  ['Pick up groceries tomorrow','Pick up groceries','2026-9-10',null,null],
  ['Call Sam at 3 PM','Call Sam','2026-9-9','15:00','15:30'],
  ['Dentist on September 15 at 9 AM','Dentist','2026-9-15','09:00','09:30'],
  ['Call tomorrow at 3:45 PM','Call','2026-9-10','15:45','16:15'],
  ['Read tomorrow at 11:45 PM','Read','2026-9-10','23:45','00:15']
 ]){
  const result=parse(text);
  assert.deepEqual([result.title,result.date,result.time,result.endTime],[title,date,time,endTime],text);
 }
 assert.throws(()=>parse(''),/task first/);
 assert.throws(()=>parse('tomorrow'),/task name/);
 assert.throws(()=>parse('Trip September 15 to September 18'),/each day separately/);
});
test('preview replaces an explicit schedule with today all day for an undated task',()=>{
 const {context,element}=setup();
 context.openNat();
 assert.equal(element('natPreview').hidden,true);
 element('natText').value='Dentist September 15 at 3 PM';
 context.updateNatPreview();
 assert.equal(element('natPreviewTitle').textContent,'Dentist');
 assert.match(element('natPreviewSchedule').textContent,/Sep.*15.*15:00.*15:30/);
 assert.equal(element('natPreviewSchedule').hidden,false);
 element('natText').value='Buy milk';
 context.updateNatPreview();
 assert.equal(element('natPreviewTitle').textContent,'Buy milk');
 assert.equal(element('natPreviewSchedule').hidden,false);
 const today=new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'});
 assert.equal(element('natPreviewSchedule').textContent,`${today} · All day`);
 element('natText').value='';
 context.updateNatPreview();
 assert.equal(element('natPreview').hidden,true);
 assert.equal(context.saves,0);
});
test('Done saves the reported apostrophe title to today all day',()=>{
 const {context,element}=setup();
 context.openNat();
 element('natText').value="Check Aubree's Bed";
 element('natForm').onsubmit({preventDefault(){}});
 const now=new Date();
 assert.equal(context.tasks.length,1);
 assert.equal(context.tasks[0].title,"Check Aubree's Bed");
 assert.equal(context.tasks[0].date,`${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`);
 assert.equal(context.tasks[0].time,null);
 assert.equal(context.tasks[0].endTime,null);
 assert.equal(context.saves,1);
});
test('speech ending refreshes the preview for the reported noon phrase',()=>{
 const {context,element,Recognition}=setup();
 context.openNat();
 element('natText').value='make chicken at noon';
 Recognition.latest.onend();
 assert.equal(element('natPreview').hidden,false);
 assert.equal(element('natPreviewTitle').textContent,'make chicken');
 assert.equal(element('natPreviewSchedule').hidden,false);
 assert.match(element('natPreviewSchedule').textContent,/12:00.*12:30/);
 assert.equal(context.saves,0);
});
test('speech stays editable until Done; repeated submission and late results do not duplicate',()=>{
 const {context,element,Recognition}=setup();
 context.openNat();
 const recognition=Recognition.latest;
 const result=[{transcript:'Buy milk'}];result.isFinal=false;
 recognition.onresult({results:[result]});
 assert.equal(context.tasks.length,0);
 result.isFinal=true;
 recognition.onresult({results:[result]});
 recognition.onresult({results:[result]});
 recognition.onend();
 assert.equal(context.tasks.length,0);
 assert.equal(element('natText').value,'Buy milk');
 assert.equal(element('natDialog').hidden,false);
 element('natText').value='Buy bread';
 element('natForm').onsubmit({preventDefault(){}});
 recognition.onresult({results:[result]});
 element('natForm').onsubmit({preventDefault(){}});
 assert.equal(context.tasks.length,1);
 assert.equal(context.tasks[0].title,'Buy bread');
 assert.equal(element('natDialog').hidden,true);
 assert.equal(context.saves,1);
 assert.match(element('natStatus').textContent,/Added/);
 assert.equal(element('natListen').disabled,false);
});
test('speaking again appends to the draft without saving',()=>{
 const {context,element,Recognition}=setup();
 context.openNat();
 const result=[{transcript:'Call Sam'}];result.isFinal=true;
 Recognition.latest.onresult({results:[result]});
 Recognition.latest.onend();
 context.startNatListening();
 const continued=[{transcript:'tomorrow at noon'}];continued.isFinal=true;
 Recognition.latest.onresult({results:[continued]});
 Recognition.latest.onresult({results:[continued]});
 assert.equal(element('natText').value,'Call Sam tomorrow at noon');
 assert.equal(context.saves,0);
});
test('cancel ignores late speech; denied and unsupported voice allow typing',()=>{
 const {context,element,Recognition}=setup();
 context.openNat();
 const recognition=Recognition.latest;
 context.closeNat();
 const result=[{transcript:'Buy milk'}];result.isFinal=true;
 recognition.onresult({results:[result]});
 assert.equal(context.tasks.length,0);
 context.openNat();
 Recognition.latest.onerror({error:'not-allowed'});
 assert.match(element('natStatus').textContent,/denied/);
 context.window.SpeechRecognition=undefined;
 context.openNat();
 assert.match(element('natStatus').textContent,/unavailable/);
 element('natText').value='Buy bread';
 element('natForm').onsubmit({preventDefault(){}});
 assert.equal(context.tasks[0].title,'Buy bread');
});
