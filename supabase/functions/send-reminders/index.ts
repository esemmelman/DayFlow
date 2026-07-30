import { createClient } from 'npm:@supabase/supabase-js@2';
import { DateTime } from 'npm:luxon@3';
import webpush from 'npm:web-push@3.6.7';

const supabaseUrl=Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey=Deno.env.get('RESEND_API_KEY')!;
const emailFrom=Deno.env.get('REMINDER_EMAIL_FROM')!;
const vapidPublicKey=Deno.env.get('VAPID_PUBLIC_KEY')!;
const vapidPrivateKey=Deno.env.get('VAPID_PRIVATE_KEY')!;
const vapidSubject=Deno.env.get('VAPID_SUBJECT')||'mailto:admin@example.com';
const cronSecret=Deno.env.get('CRON_SECRET');
const supabase=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false}});

type Task={user_id:string;id:string;title:string;date:string;start_time:string;reminder_minutes:number;reminder_email:boolean;reminder_push:boolean;timezone:string};

function escapeHtml(value:string){return value.replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]!));}

async function reserve(task:Task,channel:'email'|'push',scheduledFor:string){
 const {error}=await supabase.from('reminder_deliveries').insert({user_id:task.user_id,task_id:task.id,channel,scheduled_for:scheduledFor});
 return !error;
}

async function release(task:Task,channel:'email'|'push',scheduledFor:string){
 await supabase.from('reminder_deliveries').delete().match({user_id:task.user_id,task_id:task.id,channel,scheduled_for:scheduledFor});
}

async function sendEmail(task:Task,start:DateTime,scheduledFor:string){
 if(!await reserve(task,'email',scheduledFor))return false;
 try{
  const {data,error}=await supabase.auth.admin.getUserById(task.user_id);
  if(error||!data.user?.email)throw error||new Error('User has no email address');
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendApiKey}`,'Content-Type':'application/json'},body:JSON.stringify({
   from:emailFrom,to:[data.user.email],subject:`DayFlow: ${task.title} in ${task.reminder_minutes} minutes`,
   html:`<h2>${escapeHtml(task.title)}</h2><p>Starts ${escapeHtml(start.toLocaleString(DateTime.DATETIME_FULL))}.</p><p>This is your ${task.reminder_minutes}-minute DayFlow reminder.</p>`
  })});
  if(!response.ok)throw new Error(`Resend ${response.status}: ${await response.text()}`);
  return true;
 }catch(error){await release(task,'email',scheduledFor);throw error;}
}

async function sendPush(task:Task,start:DateTime,scheduledFor:string){
 if(!await reserve(task,'push',scheduledFor))return false;
 try{
  webpush.setVapidDetails(vapidSubject,vapidPublicKey,vapidPrivateKey);
  const {data,error}=await supabase.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id',task.user_id);
  if(error)throw error;
  if(!data?.length)throw new Error('User has no push subscription');
  const payload=JSON.stringify({title:`${task.title} in ${task.reminder_minutes} minutes`,body:`Starts at ${start.toLocaleString(DateTime.TIME_SIMPLE)}`,tag:`dayflow-${task.id}-${scheduledFor}`,url:'./'});
  let delivered=false;
  for(const subscription of data){
   try{await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},payload);delivered=true;}
   catch(error){
    const status=(error as {statusCode?:number}).statusCode;
    if(status===404||status===410)await supabase.from('push_subscriptions').delete().eq('id',subscription.id);
    else console.error('Push delivery failed',error);
   }
  }
  if(!delivered)throw new Error('No push subscription accepted the notification');
  return true;
 }catch(error){await release(task,'push',scheduledFor);throw error;}
}

Deno.serve(async request=>{
 if(cronSecret&&request.headers.get('authorization')!==`Bearer ${cronSecret}`)return new Response('Unauthorized',{status:401});
 const now=DateTime.utc();
 const from=now.minus({days:2}).toISODate(),to=now.plus({days:9}).toISODate();
 const {data,error}=await supabase.from('tasks').select('user_id,id,title,date,start_time,reminder_minutes,reminder_email,reminder_push,timezone').eq('reminder_enabled',true).not('date','is',null).not('start_time','is',null).gte('date',from).lte('date',to);
 if(error)return Response.json({error:error.message},{status:500});
 const results=[];
 for(const task of (data||[]) as Task[]){
  const start=DateTime.fromISO(`${task.date}T${task.start_time}`,{zone:task.timezone||'UTC'});
  if(!start.isValid)continue;
  const scheduled=start.minus({minutes:task.reminder_minutes}).toUTC();
  if(scheduled>now.plus({minutes:1})||scheduled<now.minus({minutes:10}))continue;
  for(const channel of ['email','push'] as const){
   if(channel==='email'&&!task.reminder_email||channel==='push'&&!task.reminder_push)continue;
   try{const sent=channel==='email'?await sendEmail(task,start,scheduled.toISO()!):await sendPush(task,start,scheduled.toISO()!);results.push({task:task.id,channel,sent});}
   catch(error){console.error(channel,task.id,error);results.push({task:task.id,channel,error:String(error)});}
  }
 }
 return Response.json({checked:data?.length||0,results});
});
