export async function reminderRequestGate(request: Request, config: {cronSecret?: string; emailConfigured: boolean}) {
 if(request.method!=='POST')return {blocked:new Response('Method not allowed',{status:405}),dryRun:false};
 if(!config.cronSecret||request.headers.get('authorization')!==`Bearer ${config.cronSecret}`)return {blocked:new Response('Unauthorized',{status:401}),dryRun:false};
 if(!config.emailConfigured)return {blocked:Response.json({error:'Email reminders are not configured'},{status:503}),dryRun:false};
 const body=await request.json().catch(()=>({}));
 return {blocked:null,dryRun:body?.dry_run===true};
}
