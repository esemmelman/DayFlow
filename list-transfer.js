(()=>{
 const frame=document.getElementById('simplistFrame');
 const origin=new URL(frame.dataset.src).origin;
 const storageKey='dayflow:list-transfers';
 let state={copied:null,pending:{},done:{}};
 try { const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved)state={...state,...saved}; } catch {}
 const persist=()=>{try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{}};
 const flush=()=>{
  if(!Object.keys(state.pending).length)return;
  if(!frame.getAttribute('src')){frame.setAttribute('src',frame.dataset.src);return;}
  for(const copy of Object.values(state.pending))frame.contentWindow?.postMessage({type:'dayflow:remove-copied-item',copy},origin);
 };
 window.retryDayFlowListTransfers=flush;
 window.getDayFlowListCopy=text=>state.copied?.text.trim()===text.trim()?{...state.copied}:undefined;
 window.completeDayFlowListPaste=copy=>{
  if(!copy?.token||state.done[copy.token])return;
  state.pending[copy.token]=copy;persist();flush();
 };
 window.addEventListener('message',event=>{
  if(event.origin!==origin||event.source!==frame.contentWindow)return;
  const data=event.data;
  if(data?.type==='simplist:copied'){
   const copy=data.copy;
   if(!copy||!['token','id','userId','title','notesHtml','text'].every(key=>typeof copy[key]==='string'))return;
   state.copied=copy;persist();
  }
  if(data?.type==='simplist:removed'&&state.pending[data.token]){
   delete state.pending[data.token];state.done[data.token]=true;
   if(state.copied?.token===data.token)state.copied=null;
   persist();
  }
  if(data?.type==='simplist:ready')flush();
 });
 frame.addEventListener('load',flush);
 document.getElementById('pageDialog').addEventListener('close',flush);
 window.addEventListener('online',flush);
})();
