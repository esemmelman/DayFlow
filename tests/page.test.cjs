const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('page.js','utf8');
function setup(storage){
 const elements=new Map();
 const element=id=>{
  if(!elements.has(id))elements.set(id,{value:'',textContent:'',listeners:{},
   addEventListener(name,fn){this.listeners[name]=fn;},focus(){},
   showModal(){this.open=true;},close(){this.open=false;this.listeners.close();}});
  return elements.get(id);
 };
 const context={document:{getElementById:element},window:{},localStorage:storage};
 vm.runInNewContext(source,context);
 return {element,open:context.window.openDayFlowPage};
}
test('free-form text persists immediately, across reopening and reload, including clearing',()=>{
 const values=new Map();
 const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 let app=setup(storage);
 app.open();
 const draft='Ideas\n\n  Keep spacing & <text> 😀';
 app.element('pageText').value=draft;
 app.element('pageText').listeners.input();
 assert.equal(values.get('dayflow:page'),draft);
 app.element('pageClose').listeners.click();
 app.open();
 assert.equal(app.element('pageText').value,draft);
 app=setup(storage);
 app.open();
 assert.equal(app.element('pageText').value,draft);
 app.element('pageText').value='';
 app.element('pageText').listeners.input();
 app=setup(storage);app.open();
 assert.equal(app.element('pageText').value,'');
});
test('storage failure keeps the draft and reports failure; typing retries the save',()=>{
 let fail=true;
 const app=setup({getItem:()=>'',setItem(){if(fail)throw Error('Storage full');}});
 app.open();
 app.element('pageText').value='Keep this draft';
 app.element('pageText').listeners.input();
 assert.match(app.element('pageStatus').textContent,/Could not save/);
 assert.equal(app.element('pageText').value,'Keep this draft');
 fail=false;
 app.element('pageText').listeners.input();
 assert.match(app.element('pageStatus').textContent,/Saved/);
});
