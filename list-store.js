(()=>{
 window.createDayFlowListStore=(changed,report)=>{
  let client=null,user=null,channel=null,timer=null,generation=0,records=[],pending={},busy=false,again=false;
  const storageKey=()=>`dayflow:list-cache:${user?.id||'device'}`;
  const visible=()=>records.filter(row=>!row.deleted).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
  function cache(){try{localStorage.setItem(storageKey(),JSON.stringify({records,pending}));}catch{report('Could not save the local list.');}}
  function emit(){changed(visible());}
  function load(){
   try{const saved=JSON.parse(localStorage.getItem(storageKey())||'null');records=saved?.records||[];pending=saved?.pending||{};
    if(!saved&&!user){const old=JSON.parse(localStorage.getItem('dayflow:list')||'null')||(localStorage.getItem('dayflow:page')||'').split(/\r?\n/).filter(text=>text.trim());records=old.map((text,position)=>({id:crypto.randomUUID(),text,position,deleted:false}));cache();}
   }catch{records=[];pending={};report('Could not load the saved list.');}emit();
  }
  function schedule(){clearTimeout(timer);if(client&&user){report('Saving…');timer=setTimeout(sync,250);}else report('Saved on this device. Connect an account to sync.');}
  function update(row){records=records.filter(item=>item.id!==row.id);records.push(row);pending[row.id]=row;cache();emit();schedule();}
  async function sync(){
   if(!client||!user)return;
   if(busy){again=true;return;}busy=true;
   const token=generation,owner=user.id,db=client;
   try{
    const batch={...pending};
    if(Object.keys(batch).length){const {error}=await db.from('list_items').upsert(Object.values(batch).map(row=>({...row,user_id:owner})),{onConflict:'user_id,id'});if(error)throw error;}
    if(token!==generation)return;
    for(const [id,row] of Object.entries(batch))if(pending[id]===row)delete pending[id];
    cache();
    const {data,error}=await db.from('list_items').select('id,text,position,deleted').eq('user_id',owner);if(error)throw error;
    if(token!==generation)return;
    const merged=new Map((data||[]).map(row=>[row.id,row]));for(const row of Object.values(pending))merged.set(row.id,row);
    records=[...merged.values()];cache();emit();report(Object.keys(pending).length?'Saving…':'Synced');
   }catch{if(token===generation)report('List sync failed. Changes are saved locally; reconnect to retry.');}
   finally{busy=false;if(again){again=false;sync();}}
  }
  async function connect(db,nextUser){
   if(client===db&&user?.id===nextUser?.id)return;
   generation++;clearTimeout(timer);if(channel){client.removeChannel(channel);channel=null;}
   client=db;user=nextUser;load();
   if(!client||!user)return;
   // Import the device list once per account, with stable IDs so retries cannot duplicate items.
   const marker=`dayflow:list-imported:${user.id}`;
   try{if(!localStorage.getItem(marker)){
    const device=JSON.parse(localStorage.getItem('dayflow:list-cache:device')||'null');
    const known=new Set(records.map(row=>row.id));let position=visible().length;
    for(const row of device?.records||[])if(!row.deleted&&!known.has(row.id)){const imported={...row,position:position++};records.push(imported);pending[row.id]=imported;}
    cache();localStorage.setItem(marker,'1');emit();
   }}catch{report('Could not import the device list.');}
   const owner=user.id;
   channel=client.channel(`list:${owner}`).on('postgres_changes',{event:'*',schema:'public',table:'list_items',filter:`user_id=eq.${owner}`},()=>{clearTimeout(timer);timer=setTimeout(sync,350);}).subscribe();
   await sync();
  }
  load();
  window.addEventListener?.('online',sync);
  window.addEventListener?.('focus',sync);
  return {connect,sync,
   add(text){const rows=visible();update({id:crypto.randomUUID(),text,position:(rows.at(-1)?.position??-1)+1,deleted:false});},
   edit(id,text){const row=records.find(item=>item.id===id);if(row&&!row.deleted)update({...row,text});},
   remove(id){const row=records.find(item=>item.id===id);if(row)update({...row,deleted:true});},
   move(from,to){const rows=visible();const row=rows.splice(from,1)[0];if(!row)return;rows.splice(to,0,row);const before=rows[to-1]?.position,after=rows[to+1]?.position;update({...row,position:before===undefined?(after??0)-1:after===undefined?before+1:(before+after)/2});}
  };
 };
})();
