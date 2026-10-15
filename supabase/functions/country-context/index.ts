import { createClient } from 'npm:@supabase/supabase-js@2';
const allowedOrigin=Deno.env.get('TAFU_ALLOWED_ORIGIN')??'http://127.0.0.1:5173';
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
let cache:{at:number;data:Record<string,unknown>}|undefined;
Deno.serve(async(req:Request)=>{
 if(req.headers.get('origin')&&req.headers.get('origin')!==allowedOrigin)return reply({error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const auth=req.headers.get('Authorization');if(!auth)return reply({error:'Sign in required'},401);
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});
 const {data:{user},error}=await client.auth.getUser();if(error||!user)return reply({error:'Sign in required'},401);
 const {data:membership}=await client.from('memberships').select('user_id').eq('user_id',user.id).maybeSingle();
 if(!membership)return reply({error:'TAFU membership required'},403);
 if(cache&&Date.now()-cache.at<3600000)return reply({...cache.data,status:'cached'});
 const url='https://api.worldbank.org/v2/country/TZA/indicator/SH.STA.MMRT?format=json&mrnev=5';
 const source={source:'World Bank Indicators API',url,indicator:'Maternal mortality ratio (modeled estimate, per 100,000 live births)',retrieved_at:new Date().toISOString()};
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(6000)});if(!response.ok)throw new Error('Unavailable');const data=await response.json();
  if(!Array.isArray(data)||!Array.isArray(data[1]))throw new Error('Unexpected format');
  const row=data[1].filter((r:{date:unknown;value:unknown;indicator?:{id:string}})=>typeof r.date==='string'&&typeof r.value==='number'&&Number.isFinite(r.value)&&r.indicator?.id==='SH.STA.MMRT').sort((a:{date:string},b:{date:string})=>Number(b.date)-Number(a.date))[0];
  if(!row)throw new Error('No observations');const result={...source,status:'live',value:row.value,year:row.date};cache={at:Date.now(),data:result};return reply(result);
 }catch{return reply({...source,status:'unavailable',value:null,year:null});}
});
