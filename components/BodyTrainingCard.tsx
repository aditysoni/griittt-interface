import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Alert,PanResponder,Text,TouchableOpacity,View} from 'react-native';
import {HumanBodyView} from './HumanBodyView';
import {useTheme} from './ThemeContext';
import {useAuth} from '../lib/auth';
import type {BodyModel} from '../lib/bodyGeometry';
import type {Muscle,MuscleStats} from '../lib/trackingInsights';
const title=(s:string)=>s[0].toUpperCase()+s.slice(1);
export function BodyTrainingCard({muscles,unmappedSets,available=true}:{muscles:MuscleStats;unmappedSets:number;available?:boolean}){
 const {theme}=useTheme(),{user,updateProfile}=useAuth();const model=user?.bodyModel??'neutral';
 const [yaw,setYaw]=useState(0),[selected,setSelected]=useState<Muscle|null>(null),[saving,setSaving]=useState(false);const angle=useRef(0),start=useRef(0),frame=useRef<number|null>(null);
 useEffect(()=>()=>{if(frame.current!==null)cancelAnimationFrame(frame.current)},[]);
 const gesture=useMemo(()=>PanResponder.create({onMoveShouldSetPanResponder:(_,g)=>Math.abs(g.dx)>8&&Math.abs(g.dx)>Math.abs(g.dy),onPanResponderGrant:()=>{start.current=angle.current},onPanResponderMove:(_,g)=>{angle.current=start.current+g.dx/90;if(frame.current===null)frame.current=requestAnimationFrame(()=>{setYaw(angle.current);frame.current=null})},onPanResponderRelease:()=>{setYaw(angle.current)}}),[]);
 const entries=Object.entries(muscles) as [Muscle,MuscleStats[Muscle]][];entries.sort((a,b)=>b[1].weekSets-a[1].weekSets||a[0].localeCompare(b[0]));const max=Math.max(1,...entries.map(([,v])=>v.weekSets));const active=selected??(entries[0]?.[1].weekSets?entries[0][0]:null);
 async function change(next:BodyModel){if(saving)return;setSaving(true);try{await updateProfile({bodyModel:next})}catch(e:any){Alert.alert('Could not save body model',e.message??'Please try again')}finally{setSaving(false)}}
 const rotate=(next:number)=>{angle.current=next;setYaw(next)};
 return <View style={{marginHorizontal:16,marginBottom:16,padding:18,borderRadius:20,borderWidth:1,borderColor:theme.border,backgroundColor:theme.card}}>
 <Text style={{fontSize:20,fontFamily:'Inter_800ExtraBold',color:theme.text}}>Training balance</Text><Text style={{fontSize:12,color:theme.textSecondary,marginTop:5}}>Past 7 days · logged strength sets</Text>
 <View style={{flexDirection:'row',gap:6,marginTop:14,flexWrap:'wrap'}}>{(['neutral','male','female'] as const).map(value=><TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{checked:model===value,disabled:saving}} accessibilityLabel={`${title(value)} body model`} disabled={saving} onPress={()=>void change(value)} style={{minHeight:44,paddingHorizontal:12,justifyContent:'center',borderRadius:22,backgroundColor:model===value?theme.inverse:theme.surface}}><Text style={{fontSize:12,fontFamily:'Inter_700Bold',color:model===value?theme.inverseText:theme.text}}>{title(value)}</Text></TouchableOpacity>)}{saving&&<ActivityIndicator color={theme.text}/>}</View>
 <View {...gesture.panHandlers} style={{alignItems:'center',marginTop:4}} accessible accessibilityLabel={`${model} three dimensional training model. ${active?`${title(active)}, ${muscles[active].weekSets} sets this week.`:'No strength sets logged.'} Use muscle buttons below for details.`}>
 <HumanBodyView model={model} yaw={yaw} muscles={muscles} onSelect={setSelected}/>
 </View>
 <View style={{flexDirection:'row',gap:8,justifyContent:'center'}}>{[['Front',0],['Back',Math.PI]] .map(([label,value])=><TouchableOpacity key={String(label)} accessibilityRole="button" onPress={()=>rotate(Number(value))} style={{minHeight:44,paddingHorizontal:16,justifyContent:'center'}}><Text style={{color:theme.text,fontSize:12,fontFamily:'Inter_700Bold'}}>{label}</Text></TouchableOpacity>)}</View>
 <Text style={{fontSize:11,color:theme.textSecondary,textAlign:'center',marginBottom:14}}>Drag to rotate · darker green means more sets</Text>
 <Text accessibilityLiveRegion="polite" style={{fontSize:16,fontFamily:'Inter_800ExtraBold',color:theme.text,marginBottom:12}}>{!available?'Training counts are unavailable':active?`${title(active)} · ${muscles[active].weekSets} sets this week`:'Log a strength workout to see your balance'}</Text>
 <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>{entries.map(([part,value])=><TouchableOpacity key={part} accessibilityRole="button" accessibilityLabel={`${part}, ${value.weekSets} sets this week, ${value.overallSets} overall`} onPress={()=>setSelected(part)} style={{minHeight:44,borderRadius:14,padding:10,backgroundColor:active===part?theme.inverse:theme.surface}}><Text style={{fontSize:12,color:active===part?theme.inverseText:theme.text}}>{title(part)}{available?` · ${value.weekSets}`:''}</Text></TouchableOpacity>)}</View>
 {available&&active&&<Text style={{fontSize:12,color:theme.textSecondary,marginTop:12}}>{muscles[active].overallSets} sets overall</Text>}
 {!!unmappedSets&&<Text style={{fontSize:11,color:theme.textSecondary,marginTop:10}}>{unmappedSets} sets without a muscle group aren’t mapped.</Text>}
 </View>
}
