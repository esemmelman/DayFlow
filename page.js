(()=>{
 const dialog=document.getElementById('pageDialog');
 const text=document.getElementById('pageText');
 const status=document.getElementById('pageStatus');
 const key='dayflow:page';
 let returnFocus=null,loaded=false;
 function savePage(){
  try{
   localStorage.setItem(key,text.value);
   status.textContent='Saved in this browser';
   return true;
  }catch{
   status.textContent='Could not save. Keep this page open and copy your text before leaving.';
   return false;
  }
 }
 window.openDayFlowPage=opener=>{
  returnFocus=opener||document.activeElement;
  if(!loaded){
   try{
    text.value=localStorage.getItem(key)||'';
    loaded=true;
    status.textContent='Saves automatically in this browser';
   }catch{
    status.textContent='Browser storage is unavailable. Your text cannot be saved.';
   }
  }
  dialog.showModal();
  text.focus();
 };
 text.addEventListener('input',savePage);
 document.getElementById('pageClose').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>returnFocus?.focus());
})();
