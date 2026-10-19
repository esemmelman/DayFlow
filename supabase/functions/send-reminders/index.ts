import { createClient } from 'npm:@supabase/supabase-js@2';
import { DateTime } from 'npm:luxon@3';
import { reminderRequestGate } from './request-guard.ts';

const supabaseUrl=Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey=Deno.env.get('RESEND_API_KEY')!;
const emailFrom=Deno.env.get('REMINDER_EMAIL_FROM')!;
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
   from:emailFrom,to:[data.user.email],subject:`${task.title} in ${task.reminder_minutes} minutes`,
   html:`<h2>${escapeHtml(task.title)}</h2><p>Starts ${escapeHtml(start.toLocaleString(DateTime.DATETIME_FULL))}.</p><p>This is your ${task.reminder_minutes}-minute DayFlow reminder.</p>`
  })});
  if(!response.ok)throw new Error(`Resend ${response.status}: ${await response.text()}`);
  return true;
 }catch(error){await release(task,'email',scheduledFor);throw error;}
}

Deno.serve(async request=>{
 const gate=await reminderRequestGate(request,{cronSecret,emailConfigured:Boolean(resendApiKey&&emailFrom)});
 if(gate.blocked)return gate.blocked;
 const now=DateTime.utc();
 const from=now.minus({days:2}).toISODate(),to=now.plus({days:9}).toISODate();
 const {data,error}=await supabase.from('tasks').select('user_id,id,title,date,start_time,reminder_minutes,reminder_email,reminder_push,timezone').eq('reminder_enabled',true).not('date','is',null).not('start_time','is',null).gte('date',from).lte('date',to);
 if(error)return Response.json({error:error.message},{status:500});
 if(gate.dryRun)return Response.json({configured:true,pushEnabled:false,checked:data?.length||0,dryRun:true});
 const results=[];
 for(const task of (data||[]) as Task[]){
  const start=DateTime.fromISO(`${task.date}T${task.start_time}`,{zone:task.timezone||'UTC'});
  if(!start.isValid)continue;
  const scheduled=start.minus({minutes:task.reminder_minutes}).toUTC();
  if(scheduled>now.plus({minutes:1})||scheduled<now.minus({minutes:10}))continue;
  if(!task.reminder_email)continue;
  try{const sent=await sendEmail(task,start,scheduled.toISO()!);results.push({task:task.id,channel:'email',sent});}
  catch(error){console.error('email',task.id,error);results.push({task:task.id,channel:'email',error:String(error)});}
 }
 return Response.json({checked:data?.length||0,results});
});
