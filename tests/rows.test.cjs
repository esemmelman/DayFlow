const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
function setup(tasks){
 const element=tag=>({tag,children:[],hidden:true,append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},setAttribute(){},scrollIntoView(){},focus(){}});
 class FixedDate extends Date{constructor(...args){super(...(args.length?args:['2026-10-01T12:00:00']));}}
 const context={Date:FixedDate,usesAndroidAgenda:true,rowsBtn:element('button'),androidRows:element('button'),tasks,rowsNextItem:element('span'),rowsNextMinutes:element('span'),formatTime:time=>time,rowsList:element('div'),rowsPanel:element('section'),mainLayout:element('main'),androidAbout:element('button'),document:{createElement:element,createTextNode:text=>({textContent:text})},
  timeToMinutes:time=>Number(time.split(':')[0])*60+Number(time.split(':')[1]),formatTimeRange:(start,end)=>end?`${start}–${end}`:start,
  setScheduleOpen(){},setCalendarLayoutOpen(){},closeAndroidPanel(){},showAndroidButtons(){}};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function compareTaskTitles('),source.indexOf('function seedWeeklyItemsOnce(')),context);
 vm.runInContext(source.slice(source.indexOf('function formatRowsTime('),source.indexOf('function setScheduleOpen(')),context);
 vm.runInContext(source.slice(source.indexOf('function key('),source.indexOf('function runAllDayRollover(')),context);
 return context;
}
test('rows group all dated items chronologically and sort each date by start time',()=>{
 const app=setup([
  {date:'2026-10-1',time:'19:30',title:'Late',endTime:'20:00'},
  {date:'2026-9-24',time:'15:00',title:'Swim'},
  {date:'2026-10-1',time:'08:00',title:'<Early>'},
  {date:null,title:'Inbox'},
  {date:'2026-10-1',time:null,title:'Zebra'},
  {date:'2026-10-1',time:null,title:'Alpha'},
  {date:'2027-1-2',time:'09:00',title:'Next year'}
 ]);
 app.renderRows();
 const rows=app.rowsList.children[0].children[0].children;
 assert.equal(rows[0].children[0].textContent,'09/28 Mon');
 assert.equal(rows[rows.length-1].children[0].textContent,'01/02 Sat');
 assert.equal(rows.some(row=>row.children[0].textContent==='09/24 Thu'),false);
 assert.deepEqual(Array.from(rows[3].children[1].children,item=>item.textContent),['<Early> 8',',  ','Late 7:30\u20138',',  ','Alpha',',  ','Zebra']);
 assert.equal(rows[3].children[1].children[2].tag,'button');
 assert.equal(rows[3].className,'rows-today');
 assert.equal(rows[6].children[0].textContent,'10/04 Sun');
 assert.equal(rows[7].className,'rows-week-gap');
 assert.equal(rows[8].children[0].textContent,'10/05 Mon');
});
test('empty rows and closing the view restore the main display',()=>{
 const app=setup([{title:'Inbox'}]);
 app.setRowsOpen(true);
 assert.equal(app.rowsPanel.hidden,false);
 assert.equal(app.mainLayout.hidden,true);
 assert.equal(app.rowsList.children[0].children[0].children.length,8);
 assert.equal(app.rowsList.children[0].children[0].children[0].children[0].textContent,'09/28 Mon');
 app.setRowsOpen(false);
 assert.equal(app.rowsPanel.hidden,true);
 assert.equal(app.mainLayout.hidden,false);
});

test('Rw times omit periods and zero minutes',()=>{
 const app=setup([]);
 assert.equal(app.formatRowsTime('00:00'),'12');
 assert.equal(app.formatRowsTime('12:00'),'12');
 assert.equal(app.formatRowsTime('13:05'),'1:05');
});

test('Rows heading shows the next timed item and minutes, then advances after its start',()=>{
 const app=setup([
  {date:'2026-10-1',time:'11:00',title:'Past'},
  {date:'2026-10-1',time:null,title:'All day'},
  {date:'2026-10-2',time:'09:00',title:'Tomorrow'},
  {date:'2026-10-1',time:'12:05',title:'Next'}
 ]);
 app.renderRows();
 assert.equal(app.rowsNextItem.textContent,' - 12:05 Next');
 assert.equal(app.rowsNextMinutes.textContent,'  5');
 app.updateRowsNextItem(new Date('2026-10-01T12:05:00'));
 assert.equal(app.rowsNextItem.textContent,' - 9 Tomorrow');
 assert.equal(app.rowsNextMinutes.textContent,'  1255');
 app.updateRowsNextItem(new Date('2026-10-02T09:00:00'));
 assert.equal(app.rowsNextItem.textContent,'');
 assert.equal(app.rowsNextMinutes.textContent,'');
});
