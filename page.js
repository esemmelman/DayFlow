(()=>{
 const dialog=document.getElementById('pageDialog');
 const frame=document.getElementById('simplistFrame');
 let returnFocus=null;
 window.openDayFlowPage=opener=>{
  returnFocus=opener||document.activeElement;
  // Keep the embedded app alive between openings to preserve unsaved edits.
  if(!frame.getAttribute('src'))frame.setAttribute('src',frame.dataset.src);
  if(!dialog.open)dialog.showModal();
  document.getElementById('pageClose').focus();
 };
 document.getElementById('pageClose').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>returnFocus?.focus());
})();
