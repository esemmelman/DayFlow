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
  ['Buy milk','Buy milk',null,null,null],
  ['Add dentist tomorrow at 3 PM','dentist','2026-9-10','15:00',null],
  ['Remind me to call Sam Friday at noon','call Sam','2026-9-11','12:00',null],
  ['Lunch tomorrow from 1 PM to 2 PM','Lunch','2026-9-10','13:00','14:00'],
  ['Pick up groceries tomorrow','Pick up groceries','2026-9-10',null,null],
  ['Call Sam at 3 PM','Call Sam','2026-9-9','15:00',null],
  ['Dentist on September 15 at 9 AM','Dentist','2026-9-15','09:00',null]
 ]){
  const result=parse(text);
  assert.deepEqual([result.title,result.date,result.time,result.endTime],[title,date,time,endTime],text);
 }
 assert.throws(()=>parse(''),/task first/);
 assert.throws(()=>parse('tomorrow'),/task name/);
 assert.throws(()=>parse('Trip September 15 to September 18'),/each day separately/);
});
test('final speech saves once; interim speech and late results do not save',()=>{
 const {context,element,Recognition}=setup();
 context.openNat();
 const recognition=Recognition.latest;
 const result=[{transcript:'Buy milk'}];result.isFinal=false;
 recognition.onresult({results:[result]});
 assert.equal(context.tasks.length,0);
 result.isFinal=true;
 recognition.onresult({results:[result]});
 recognition.onresult({results:[result]});
 assert.equal(context.tasks.length,1);
 assert.equal(context.saves,1);
 assert.match(element('natStatus').textContent,/Added/);
 assert.equal(element('natListen').disabled,false);
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
