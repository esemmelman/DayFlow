const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(values=new Map()){
 const elements=new Map(),timers=new Map();let timer=0;
 function element(){return {value:'',children:[],listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},setAttribute(){},focus(){},append(...nodes){this.children.push(...nodes);},replaceChildren(){this.children=[];},showModal(){this.open=true;},close(){this.open=false;this.listeners.close?.();}};}
 const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const sessions=[];
 class Speech{constructor(){sessions.push(this);}start(){this.onstart();}abort(){this.onend?.();}}
 const context={crypto:require('node:crypto'),document:{getElementById:get,createElement:element},window:{SpeechRecognition:Speech},navigator:{language:'en-US'},localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},setTimeout(fn,delay){timers.set(++timer,{fn,delay});return timer;},clearTimeout(id){timers.delete(id);}};
 vm.createContext(context);
 vm.runInContext(fs.readFileSync('list-store.js','utf8'),context);
 vm.runInContext(fs.readFileSync('page.js','utf8'),context);
 return {get,values,sessions,open:context.window.openDayFlowPage,run(delay){for(const [id,t] of [...timers])if(t.delay===delay){timers.delete(id);t.fn();}}};
}
const event={preventDefault(){}};
test('legacy page text becomes items; adding and ordering persist across reload',()=>{
 const app=setup(new Map([['dayflow:page','First\nSecond']]));app.open();
 assert.equal(app.get('listItems').children.length,2);
 app.get('listEntry').value='Third';app.get('listEntry').listeners.keydown({...event,key:'Enter'});
 const rows=app.get('listItems').children;
 rows[2].listeners.dragstart({dataTransfer:{setData(){}}});
 rows[1].listeners.drop(event);
 assert.deepEqual(JSON.parse(app.values.get('dayflow:list-cache:device')).records.filter(row=>!row.deleted).sort((a,b)=>a.position-b.position).map(row=>row.text),['First','Third','Second']);
 const reload=setup(app.values);reload.open();assert.equal(reload.get('listItems').children[1].children[1].textContent,'Third');
});
test('speech adds one item after three seconds; double click cancels voice startup',()=>{
 const app=setup();app.open();const entry=app.get('listEntry');
 entry.listeners.click({detail:1});app.run(350);
 app.sessions[0].onresult({results:[[{transcript:'Buy milk'}]]});
 assert.equal(app.get('listItems').children.length,0);app.run(3000);
 assert.deepEqual(JSON.parse(app.values.get('dayflow:list-cache:device')).records.filter(row=>!row.deleted).sort((a,b)=>a.position-b.position).map(row=>row.text),['Buy milk']);
 entry.listeners.click({detail:1});entry.listeners.dblclick();app.run(350);
 assert.equal(app.sessions.length,1);assert.equal(entry.readOnly,false);
});
test('closing cancels a pending dictated item',()=>{
 const app=setup();app.open();app.get('listEntry').listeners.click({detail:1});app.run(350);
 app.sessions[0].onresult({results:[[{transcript:'Draft'}]]});app.get('pageClose').listeners.click();app.run(3000);
 assert.equal(app.get('listItems').children.length,0);
});

test('long pressing opens edit and delete actions; movement cancels the menu',()=>{
 const app=setup(new Map([['dayflow:list','["Original"]']]));app.open();
 let row=app.get('listItems').children[0];
 row.listeners.pointerdown({target:row.children[1],clientX:0,clientY:0});
 row.listeners.pointermove({clientX:20,clientY:0});app.run(550);
 assert.notEqual(app.get('listItemMenu').open,true);
 row.listeners.pointerdown({target:row.children[1],clientX:0,clientY:0});app.run(550);
 assert.equal(app.get('listItemMenu').open,true);
 app.get('listItemEdit').listeners.click();app.get('listEditText').value='Edited';app.get('listEditForm').listeners.submit(event);
 assert.equal(app.get('listItems').children[0].children[1].textContent,'Edited');
 row=app.get('listItems').children[0];row.listeners.contextmenu(event);app.get('listItemDelete').listeners.click();
 assert.equal(app.get('listItems').children.length,0);
 const reload=setup(app.values);assert.equal(reload.get('listItems').children.length,0);
});

test('mobile cumulative phrase results replace each other instead of duplicating words',()=>{
 const app=setup();app.open();const entry=app.get('listEntry');entry.listeners.click({detail:1});app.run(350);
 const rec=app.sessions[0];assert.equal(rec.continuous,false);assert.equal(rec.interimResults,false);
 const phrases=['why','why is','why is it','why is it duplicating','why is it duplicating the first word'];
 const results=[];
 for(const transcript of phrases){results.push(Object.assign([{transcript}],{isFinal:true}));rec.onresult({results});}
 assert.equal(entry.value,'why is it duplicating the first word');
 app.run(3000);assert.equal(app.get('listItems').children[0].children[1].textContent,phrases.at(-1));
});
test('ended recognizer cannot replay text; separate utterances and intentional repetition survive',()=>{
 const app=setup();app.open();const entry=app.get('listEntry');entry.listeners.click({detail:1});app.run(350);
 const first=app.sessions[0];first.onresult({results:[[{transcript:'check sprinkler'}]]});first.onend();
 const second=app.sessions[1];first.onend();first.onresult({results:[[{transcript:'check sprinkler'}]]});
 assert.equal(app.sessions.length,2);assert.equal(entry.value,'check sprinkler');
 second.onresult({results:[[{transcript:'very very carefully'}]]});
 assert.equal(entry.value,'check sprinkler very very carefully');app.run(3000);
 assert.equal(app.get('listItems').children[0].children[1].textContent,'check sprinkler very very carefully');
});
