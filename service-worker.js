self.addEventListener('push',event=>{
 const data=event.data?.json()||{};
 event.waitUntil(self.registration.showNotification(data.title||'DayFlow reminder',{
  body:data.body||'An appointment is coming up.',
  tag:data.tag||'dayflow-reminder',
  data:{url:data.url||'./'}
 }));
});

self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=new URL(event.notification.data?.url||'./',self.location.origin).href;
 event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{
  const existing=windows.find(windowClient=>windowClient.url.startsWith(self.location.origin));
  if(existing){existing.navigate(url);return existing.focus();}
  return clients.openWindow(url);
 }));
});
