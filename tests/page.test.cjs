const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
test('List loads Simplist once, preserves its session, and restores focus on close',()=>{
 const elements=new Map();
 const get=id=>{
  if(!elements.has(id))elements.set(id,{dataset:{src:'https://esemmelman.github.io/simplist/'},listeners:{},attrs:{},focus(){this.focused=true;},addEventListener(name,fn){this.listeners[name]=fn;},getAttribute(name){return this.attrs[name];},setAttribute(name,value){this.attrs[name]=value;this.loads=(this.loads||0)+1;},showModal(){this.open=true;},close(){this.open=false;this.listeners.close();}});
  return elements.get(id);
 };
 const context={window:{},document:{getElementById:get}};
 vm.runInNewContext(fs.readFileSync('page.js','utf8'),context);
 const frame=get('simplistFrame'),dialog=get('pageDialog'),opener={focus(){this.focused=true;}};
 assert.equal(frame.loads,undefined);
 context.window.openDayFlowPage(opener);
 assert.equal(frame.attrs.src,'https://esemmelman.github.io/simplist/');
 assert.equal(dialog.open,true);
 get('pageClose').listeners.click();
 assert.equal(dialog.open,false);
 assert.equal(opener.focused,true);
 context.window.openDayFlowPage(opener);
 assert.equal(frame.loads,1);
});
