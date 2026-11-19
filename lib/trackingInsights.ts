import {plansCoachRequest} from './plansCoachApi';
export type Counts={logs:number;grams:number;measuredLogs:number;minutes:number;sets:number;amount?:number};
export type FoodInsight={from:string;to:string;top:null|{name:string;foodId:string|null;imageKey:string|null;recentItemId:string;unit:'g'|'pieces';week:Counts;overall:Counts}};
export type Muscle='chest'|'back'|'shoulders'|'legs'|'biceps'|'triceps'|'abs';
export type MuscleStats=Record<Muscle,{weekSets:number;overallSets:number;weekSessions:number;overallSessions:number}>;
export type PhysicalInsight={from:string;to:string;top:null|{name:string;category:string;week:Counts;overall:Counts};muscles:MuscleStats;unmappedSets:number};
export type FoodPattern={from:string;to:string;totalMeals:number;excludedEntries:number;basis:'logged_meal_slots';foods:{key:string;name:string;imageKey:string|null;mealCount:number;percent:number}[]};
export const trackingInsights={pattern:(t:string,date:string)=>plansCoachRequest<FoodPattern>(t,`/tracking-insights/food-pattern?endDate=${date}`),food:(t:string,date:string)=>plansCoachRequest<FoodInsight>(t,`/tracking-insights/food?endDate=${date}`),physical:(t:string,date:string)=>plansCoachRequest<PhysicalInsight>(t,`/tracking-insights/physical?endDate=${date}`)};
