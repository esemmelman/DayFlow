const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function device(database,values=new Map()){
 let rows,status,online=true;const events={};
 const context={crypto:require('node:crypto'),window:{addEventListener(){}},localStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},setTimeout(){},clearTimeout(){}};
 vm.runInNewContext(fs.readFileSync('list-store.js','utf8'),context);
 const client={from(){return {async upsert(batch){if(!online)return {error:Error('Offline')};for(const row of batch)database.set(row.user_id+row.id,{...row});return {};},select(){return {async eq(_,owner){return online?{data:[...database.values()].filter(row=>row.user_id===owner).map(({user_id,...row})=>row)}:{error:Error('Offline')};}};}};},channel(){return {on(_,filter,callback){events.refresh=callback;return this;},subscribe(){return this;}};},removeChannel(){}};
 const store=context.window.createDayFlowListStore(value=>rows=value,message=>status=message);
 return {store,client,values,get rows(){return rows;},get status(){return status;},set online(value){online=value;}};
}
test('two devices sync additions, edits, reorder and tombstone deletion without losing unrelated items',async()=>{
 const db=new Map(),a=device(db),b=device(db);await a.store.connect(a.client,{id:'owner'});await b.store.connect(b.client,{id:'owner'});
 a.store.add('First');await a.store.sync();await b.store.sync();assert.equal(b.rows[0].text,'First');
 b.store.add('Second');a.store.edit(a.rows[0].id,'Changed');await b.store.sync();await a.store.sync();assert.equal(a.rows.length,2);
 a.store.move(1,0);await a.store.sync();await b.store.sync();assert.deepEqual(Array.from(b.rows,row=>row.text),['Second','Changed']);
 a.store.remove(a.rows[1].id);await a.store.sync();await b.store.sync();assert.deepEqual(Array.from(b.rows,row=>row.text),['Second']);
});
test('offline changes survive reload and retry; account switches isolate lists',async()=>{
 const db=new Map(),a=device(db);await a.store.connect(a.client,{id:'owner'});a.online=false;a.store.add('Offline');await a.store.sync();assert.match(a.status,/sync failed/);
 const reload=device(db,a.values);await reload.store.connect(reload.client,{id:'owner'});assert.equal(reload.rows[0].text,'Offline');assert.equal(db.size,1);
 await reload.store.connect(reload.client,{id:'other'});assert.equal(reload.rows.length,0);await reload.store.connect(reload.client,{id:'owner'});assert.equal(reload.rows[0].text,'Offline');
});
test('imports local items once; deleted imported items do not return on reconnect',async()=>{
 const db=new Map(),a=device(db,new Map([['dayflow:list','["Legacy"]']]));await a.store.connect(a.client,{id:'owner'});assert.equal(a.rows.length,1);
 a.store.remove(a.rows[0].id);await a.store.sync();await a.store.connect(a.client,null);await a.store.connect(a.client,{id:'owner'});assert.equal(a.rows.length,0);
});
