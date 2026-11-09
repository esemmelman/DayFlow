const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
for(const date of [undefined,'2026-12-25'])test(`paste into ${date||'selected day'} preserves title, notes and hour`,()=>{
 const context={tasks:[],crypto:require('node:crypto'),sel:{},key:()=> '2026-11-10',save(){context.saved=true;},renderEverything(){context.rendered=true;}};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function enableSlotPaste('),source.indexOf('function addSlotButton(')),context);
 const events={};const slot={dataset:{hour:'14',...(date?{date}:{})},setAttribute(){},addEventListener(name,fn){events[name]=fn;}};
 context.enableSlotPaste(slot);
 let prevented=false;
 events.paste({target:slot,clipboardData:{getData:()=> 'Call dentist\nAsk about appointment'},preventDefault(){prevented=true;}});
 assert.equal(context.tasks.length,1);
 assert.equal(context.tasks[0].title,'Call dentist');
 assert.equal(context.tasks[0].notes,'Ask about appointment');
 assert.equal(context.tasks[0].date,date||'2026-11-10');
 assert.equal(context.tasks[0].time,14);
 assert.ok(prevented&&context.saved&&context.rendered);
 events.paste({target:slot,clipboardData:{getData:()=> '  '}});
 assert.equal(context.tasks.length,1);
});

test('long press offers clipboard paste; scrolling cancels the hold',async()=>{
 let timer,cleared=false;
 const elements=[];
 const context={tasks:[],crypto:require('node:crypto'),sel:{},key:()=> '2026-11-10',save(){},renderEverything(){},formatTime:()=> '2:00 PM',
  setTimeout(fn){timer=fn;return 1;},clearTimeout(){cleared=true;timer=null;},
  navigator:{clipboard:{async readText(){return 'Call dentist\nBring records';}}},
  document:{body:{append(){}},createElement(tag){const element={tag,listeners:{},setAttribute(){},addEventListener(name,fn){this.listeners[name]=fn;},append(){},showModal(){this.open=true;},close(){this.open=false;this.listeners.close();},remove(){},focus(){}};elements.push(element);return element;}}};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function enableSlotPaste('),source.indexOf('function addSlotButton(')),context);
 const events={};const slot={dataset:{hour:'14',date:'2026-12-25'},setAttribute(){},addEventListener(name,fn){events[name]=fn;}};
 context.enableSlotPaste(slot);
 const press={target:{closest:()=>null},button:0,clientX:10,clientY:10};
 events.pointerdown(press);
 assert.equal(typeof timer,'function');
 events.pointermove({clientX:10,clientY:40});
 assert.equal(timer,null);assert.ok(cleared);assert.equal(elements.length,0);
 events.pointerdown(press);timer();
 assert.equal(elements[0].open,true);
 const paste=elements.find(element=>element.textContent==='Paste copied item');
 await paste.onclick();
 assert.equal(context.tasks[0].date,'2026-12-25');
 assert.equal(context.tasks[0].time,14);
 assert.equal(context.tasks[0].notes,'Bring records');
 assert.equal(elements[0].open,false);
});
