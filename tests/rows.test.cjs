const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
function setup(tasks){
 const element=tag=>({tag,children:[],hidden:true,append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},setAttribute(){},scrollIntoView(){},focus(){}});
 const context={tasks,rowsList:element('div'),rowsPanel:element('section'),mainLayout:element('main'),androidAbout:element('button'),document:{createElement:element,createTextNode:text=>({textContent:text})},
  timeToMinutes:time=>Number(time.split(':')[0])*60+Number(time.split(':')[1]),formatTimeRange:(start,end)=>end?`${start}–${end}`:start,
  setScheduleOpen(){},setCalendarLayoutOpen(){},closeAndroidPanel(){},showAndroidButtons(){}};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function compareTaskTitles('),source.indexOf('function seedWeeklyItemsOnce(')),context);
 vm.runInContext(source.slice(source.indexOf('function renderRows('),source.indexOf('function compareDateKeys(')),context);
 return context;
}
test('rows group all dated items chronologically and sort each date by start time',()=>{
 const app=setup([
  {date:'2026-10-1',time:'19:30',title:'Late',endTime:'20:00'},
  {date:'2026-9-24',time:'15:00',title:'Swim'},
  {date:'2026-10-1',time:'08:00',title:'<Early>'},
  {date:null,title:'Inbox'},
  {date:'2026-10-1',time:null,title:'All day task'},
  {date:'2027-1-2',time:'09:00',title:'Next year'}
 ]);
 app.renderRows();
 const rows=app.rowsList.children[0].children[0].children;
 assert.deepEqual(Array.from(rows,row=>row.children[0].textContent),['09/24 Thu','10/01 Thu','01/02 Sat']);
 assert.deepEqual(Array.from(rows[1].children[1].children,item=>item.textContent),['All day All day task',',  ','08:00 <Early>',',  ','19:30–20:00 Late']);
 assert.equal(rows[1].children[1].children[2].tag,'button');
});
test('empty rows and closing the view restore the main display',()=>{
 const app=setup([{title:'Inbox'}]);
 app.setRowsOpen(true);
 assert.equal(app.rowsPanel.hidden,false);
 assert.equal(app.mainLayout.hidden,true);
 assert.equal(app.rowsList.children[0].textContent,'No dated items.');
 app.setRowsOpen(false);
 assert.equal(app.rowsPanel.hidden,true);
 assert.equal(app.mainLayout.hidden,false);
});
