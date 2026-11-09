const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(storage=new Map()){
 const events={},sent=[];const frame={dataset:{src:'https://esemmelman.github.io/simplist/'},getAttribute(){return 'loaded';},addEventListener(){},contentWindow:{postMessage(message){sent.push(message);}}};
 const context={URL,window:{addEventListener(name,fn){events[name]=fn;}},localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},document:{getElementById:id=>id==='simplistFrame'?frame:{addEventListener(){}}}};
 vm.runInNewContext(fs.readFileSync('list-transfer.js','utf8'),context);
 return {window:context.window,sent,storage,send(data,overrides={}){events.message({source:frame.contentWindow,origin:'https://esemmelman.github.io',data,...overrides});}};
}
const copy={token:'copy-1',id:'item-1',userId:'user-1',title:'Dentist',notesHtml:'',text:'Dentist'};
test('matching clipboard identifies source, and only saved pastes queue deletion',()=>{
 const app=setup();app.send({type:'simplist:copied',copy});
 assert.equal(app.window.getDayFlowListCopy('Other'),undefined);
 assert.equal(app.window.getDayFlowListCopy('Dentist').id,'item-1');assert.equal(app.sent.length,0);
 app.window.completeDayFlowListPaste(copy);assert.equal(app.sent[0].type,'dayflow:remove-copied-item');
 app.send({type:'simplist:removed',token:copy.token});
 app.window.completeDayFlowListPaste(copy);assert.equal(app.sent.length,1);
});
test('unfinished removal survives reload and retries when list is ready',()=>{
 const app=setup();app.window.completeDayFlowListPaste(copy);
 const reload=setup(app.storage);reload.send({type:'simplist:ready'});
 assert.equal(reload.sent[0].copy.id,'item-1');
});
test('only the embedded list can identify a copied source',()=>{
 const app=setup();app.send({type:'simplist:copied',copy},{source:{}});
 assert.equal(app.window.getDayFlowListCopy('Dentist'),undefined);
});
