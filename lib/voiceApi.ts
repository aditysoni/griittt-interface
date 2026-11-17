import * as FileSystem from 'expo-file-system/legacy';
const BASE=`${process.env.EXPO_PUBLIC_API_BASE ?? 'http://192.168.1.6:3001'}/api/voice`;
export type EditableNumber = number | string | null;
export type VoiceDomain='food'|'physical';
export type VoiceFood={name:string;portion:string;mealTime:'morning'|'brunch'|'lunch'|'evening'|'dinner'|'snacks'|null;calories:EditableNumber;protein:EditableNumber;carbs:EditableNumber;fat:EditableNumber;fibre:EditableNumber};
export type VoiceWorkout={category:'strength'|'cardio'|'games';activity:string;bodyPart:string|null;durationMins:EditableNumber;distanceKm:EditableNumber;intensity:EditableNumber;exercises:{name:string;sets:{reps:EditableNumber;weight:EditableNumber}[]}[]};
export type VoiceEntries={foodItems:VoiceFood[];workouts:VoiceWorkout[];clarifications:string[]};
export type VoiceDraft=VoiceEntries&{draftId:string;domain:VoiceDomain;date:string;transcript?:string};
export type VoiceSaved={ok:true;domain:VoiceDomain;date:string;saved:{id:string;portion?:string;score?:number}[]};
export function requestId(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return (c==='x'?r:(r&3)|8).toString(16)});}
async function json<T>(path:string,token:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 const controller=new AbortController();const abort=()=>controller.abort();signal?.addEventListener('abort',abort);const timer=setTimeout(abort,90000);
 try{if(signal?.aborted)controller.abort();const res=await fetch(BASE+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error||'Voice logging is unavailable. Please log manually.');return data as T;}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export const voiceApi={
 capabilities:(token:string,signal?:AbortSignal)=>json<{enabled:boolean;maxSeconds:number;disclosureVersion:string}>('/capabilities',token,undefined,signal),
 upload:(token:string,uri:string,domain:VoiceDomain,date:string)=>{
  const query=new URLSearchParams({domain,date,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',requestId:requestId(),consentVersion:'voice-v1'});
  const task=FileSystem.createUploadTask(`${BASE}/parse?${query}`,uri,{httpMethod:'POST',uploadType:FileSystem.FileSystemUploadType.BINARY_CONTENT,headers:{Authorization:`Bearer ${token}`,'Content-Type':'audio/mp4'}});
  return {cancel:()=>task.cancelAsync(),result:async():Promise<VoiceDraft>=>{const timer=setTimeout(()=>{void task.cancelAsync()},100000);try{const res=await task.uploadAsync();if(!res)throw Error('Upload cancelled. Your recording has not been saved.');const data=JSON.parse(res.body);if(res.status<200||res.status>=300)throw Error(data.error||'Could not process your recording.');return data as VoiceDraft;}finally{clearTimeout(timer);}}};
 },
 confirm:(token:string,draft:VoiceDraft,date:string,entries:VoiceEntries)=>json<VoiceSaved>('/confirm',token,{draftId:draft.draftId,date,entries}),
};
