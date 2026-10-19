const {test}=require('node:test');
const assert=require('node:assert/strict');
const {reminderRequestGate}=require('../supabase/functions/send-reminders/request-guard.ts');
const req=(authorization='Bearer correct',body={})=>new Request('https://example.com',{method:'POST',headers:{authorization,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('reminder worker fails closed with no cron secret',async()=>assert.equal((await reminderRequestGate(req(),{emailConfigured:true})).blocked.status,401));
test('reminder worker rejects wrong credentials',async()=>assert.equal((await reminderRequestGate(req('Bearer wrong'),{cronSecret:'correct',emailConfigured:true})).blocked.status,401));
test('email configuration is required',async()=>assert.equal((await reminderRequestGate(req(),{cronSecret:'correct',emailConfigured:false})).blocked.status,503));
test('authenticated dry run does not request delivery',async()=>assert.equal((await reminderRequestGate(req('Bearer correct',{dry_run:true}),{cronSecret:'correct',emailConfigured:true})).dryRun,true));
test('normal cron requests proceed',async()=>{const gate=await reminderRequestGate(req(),{cronSecret:'correct',emailConfigured:true});assert.equal(gate.blocked,null);assert.equal(gate.dryRun,false)});
