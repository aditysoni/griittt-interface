import {today} from './api';
const BASE=`${process.env.EXPO_PUBLIC_API_BASE??'http://192.168.1.6:3001'}/api`;
export class CoachApiError extends Error {constructor(public status:number,message:string){super(message)}}
export async function plansCoachRequest<T>(token:string,path:string,body?:unknown,method=body===undefined?'GET':'POST'):Promise<T>{
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),65000);
 try{const response=await fetch(BASE+path,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:controller.signal});
 if(response.status===204)return null as T;
 const raw=await response.text();let data:any;try{data=JSON.parse(raw)}catch{data=null}
 if(!response.ok)throw new CoachApiError(response.status,response.status===404?'This feature is not available on your server yet.':data?.error||'Could not complete this request.');return data as T;
 }catch(e){if(e instanceof Error&&e.name==='AbortError')throw new Error('The request timed out. Refresh before trying again to check whether it was saved.');throw e}finally{clearTimeout(timer)}
}
export type CoachThread={id:string;title:string;preview?:string;updated_at?:string};
export type CoachMessage={id:string;role:'user'|'coach';text:string;offer:'make_plan'|'add_to_plan'|null;plan_goal:string|null;flagged?:string|null};
export type PlanActionDraft={level:number;kind:'daily'|'weekly'|'avoid'|'once';name:string;whenText?:string|null;why:string;tiny?:string|null;days?:number[]|null};
export type PlanDraft={title:string;durationDays:30|60|90;goalFamily:string;actions:PlanActionDraft[];causes:{label:string;why:string}[];timeline:{fromWeek:number;toWeek:number;text:string}[];redFlags:string[];signal?:{label:string;unit:string;direction:'up'|'down';howTo:string}|null;blocked?:boolean;reply?:string;dropped?:{item:string;reason:string}[]};
export type PlanIntake={family:string;title:string;concern:string;questions:{id:string;text:string;options:string[]}[];reply?:string};
export type Adherence={due:number;followed:number;rate:number|null};
export type PlanSummary={id:string;title:string;status:'active'|'paused'|'completed'|'ended';day:number;duration_days:number;level:number;finished:boolean;adherence:{all:Adherence;last7:Adherence}};
export type PlanDetail=PlanSummary&{goal_text:string;red_flags:string[];timeline:{fromWeek:number;toWeek:number;text:string}[];actions:{id:string;name:string;kind:PlanActionDraft['kind'];level:number;when_text:string|null;why:string;tiny:string|null;task_id:string|null;locked:boolean;dueToday:boolean;doneToday:boolean;slippedToday:boolean;done_at:string|null}[];levelUp:{eligible:boolean;reason?:string;daysLeft?:number};nextCheckpoint:{day:number;due_on:string}|null;signal?:PlanDraft['signal']};
const dateQuery=()=>`today=${today()}`;
export const coachApi={
 deleteThread:(t:string,id:string)=>plansCoachRequest<null>(t,`/coach/threads/${id}`,undefined,'DELETE'),
 threads:(t:string)=>plansCoachRequest<{threads:CoachThread[];remaining:number}>(t,'/coach/threads'),
 messages:(t:string,id:string)=>plansCoachRequest<{thread:CoachThread;messages:CoachMessage[];remaining:number}>(t,`/coach/threads/${id}/messages`),
 send:(t:string,text:string,threadId:string|null)=>plansCoachRequest<{thread:CoachThread;messages:CoachMessage[];remaining:number}>(t,'/coach/messages',{text,threadId,today:today()}),
};
export const plansApi={
 importAdvice:(t:string,id:string,sourceText:string)=>plansCoachRequest<{suggestions:(PlanActionDraft&{duplicateOf:string|null})[];dropped:{item:string;reason:string}[]}>(t,`/plans/${id}/import`,{sourceText}),
 applyAdvice:(t:string,id:string,actions:(PlanActionDraft&{when:'now'|'later'})[])=>plansCoachRequest<{plan:PlanDetail;placed:{name:string;level:number;now:boolean}[];skipped:string[]}>(t,`/plans/${id}/import/apply`,{actions,today:today()}),
 list:(t:string)=>plansCoachRequest<PlanSummary[]>(t,`/plans?${dateQuery()}`),
 detail:(t:string,id:string)=>plansCoachRequest<PlanDetail>(t,`/plans/${id}?${dateQuery()}`),
 intake:(t:string,goalText:string,sourceText:string)=>plansCoachRequest<PlanIntake>(t,'/plans/intake',{goalText,sourceText:sourceText||null}),
 draft:(t:string,goalText:string,sourceText:string,family:string,intake:Record<string,string>)=>plansCoachRequest<PlanDraft>(t,'/plans/draft',{goalText,sourceText:sourceText||null,family,intake}),
 start:(t:string,draft:PlanDraft,goalText:string,sourceText:string,intake:Record<string,string>,fromCoach:boolean)=>plansCoachRequest<PlanDetail>(t,'/plans',{...draft,goalText,sourceText:sourceText||null,intake,source:fromCoach?'coach':sourceText?'pasted':'goal',today:today()}),
 update:(t:string,id:string,body:unknown)=>plansCoachRequest<PlanDetail>(t,`/plans/${id}`,body,'PATCH'),
 done:(t:string,id:string,actionId:string,done:boolean)=>plansCoachRequest<PlanDetail>(t,`/plans/${id}/actions/${actionId}/done`,{done,today:today()}),
 levelUp:(t:string,id:string)=>plansCoachRequest<PlanDetail>(t,`/plans/${id}/level-up`,{today:today()}),
 checkpoint:(t:string,id:string,day:number,body:unknown)=>plansCoachRequest<PlanDetail>(t,`/plans/${id}/checkpoints/${day}`,body),
 finish:(t:string,id:string)=>plansCoachRequest<PlanDetail>(t,`/plans/${id}/finish`,{today:today()}),
};
