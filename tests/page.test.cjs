const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(values=new Map()){
 const elements=new Map(),timers=new Map();let timer=0;
 function element(){return {value:'',children:[],listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},setAttribute(){},focus(){},append(...nodes){this.children.push(...nodes);},replaceChildren(){this.children=[];},showModal(){},close(){this.listeners.close();}};}
 const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const sessions=[];
 class Speech{constructor(){sessions.push(this);}start(){this.onstart();}abort(){this.onend?.();}}
 const context={document:{getElementById:get,createElement:element},window:{SpeechRecognition:Speech},navigator:{language:'en-US'},localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},setTimeout(fn,delay){timers.set(++timer,{fn,delay});return timer;},clearTimeout(id){timers.delete(id);}};
 vm.runInNewContext(fs.readFileSync('page.js','utf8'),context);
 return {get,values,sessions,open:context.window.openDayFlowPage,run(delay){for(const [id,t] of [...timers])if(t.delay===delay){timers.delete(id);t.fn();}}};
}
const event={preventDefault(){}};
test('legacy page text becomes items; adding and ordering persist across reload',()=>{
 const app=setup(new Map([['dayflow:page','First\nSecond']]));app.open();
 assert.equal(app.get('listItems').children.length,2);
 app.get('listEntry').value='Third';app.get('listForm').listeners.submit(event);
 app.get('listItems').children[2].children[2].onclick();
 assert.deepEqual(JSON.parse(app.values.get('dayflow:list')),['First','Third','Second']);
 const reload=setup(app.values);reload.open();assert.equal(reload.get('listItems').children[1].children[1].textContent,'Third');
});
test('speech adds one item after three seconds; double click cancels voice startup',()=>{
 const app=setup();app.open();const entry=app.get('listEntry');
 entry.listeners.click({detail:1});app.run(350);
 app.sessions[0].onresult({results:[[{transcript:'Buy milk'}]]});
 assert.equal(app.get('listItems').children.length,0);app.run(3000);
 assert.deepEqual(JSON.parse(app.values.get('dayflow:list')),['Buy milk']);
 entry.listeners.click({detail:1});entry.listeners.dblclick();app.run(350);
 assert.equal(app.sessions.length,1);assert.equal(entry.readOnly,false);
});
test('closing cancels a pending dictated item',()=>{
 const app=setup();app.open();app.get('listEntry').listeners.click({detail:1});app.run(350);
 app.sessions[0].onresult({results:[[{transcript:'Draft'}]]});app.get('pageClose').listeners.click();app.run(3000);
 assert.equal(app.get('listItems').children.length,0);
});
