import React from 'react';
import {Alert,StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import Svg,{Circle} from 'react-native-svg';
import type {StrengthIdentity} from '../lib/api';

export function PhysicalScoreCard({score,identity,minutes,activities}:{score:number|null;identity:StrengthIdentity|null;minutes:number;activities:number}){
 const value=score==null?null:Math.max(0,Math.min(100,Math.round(score)));
 const levelStart=identity?identity.levelIndex**2*100:0;
 const next=identity?.nextLevel;
 const remaining=Math.max(0,identity?.xpToNext??0);
 const span=identity?((identity.levelIndex+1)**2*100-levelStart):1;
 const progress=identity?(next?Math.max(0,Math.min(1,1-remaining/span)):1):0;
 const status=value==null?'Score unavailable':value===0?'Ready when you are':value>=75?'Crushing it':value>=50?'Building momentum':value>=25?'Wavering':'Below potential';
 const color=value==null||value===0?'#A9AD9C':value<25?'#EF5350':value<75?'#EBA22B':'#B8F23A';
 const circumference=2*Math.PI*44;
 return <LinearGradient colors={['#303B17','#171A11','#171A11']} start={{x:1,y:0}} end={{x:0,y:1}} style={s.card}>
  <TouchableOpacity disabled={!identity} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={identity?`${identity.levelName}. ${next?`${Math.ceil(remaining)} XP to ${next}`:'Highest level reached'}. View level details`:'Level unavailable'} onPress={()=>Alert.alert(identity!.levelName,`Your level grows with XP from saved physical activity.\n\n${next?`${Math.ceil(remaining)} XP to ${next}.`:'You have reached the highest level.'}\n\nTotal XP: ${Math.floor(identity!.totalXP)}`)} style={s.level}>
   <View style={s.row}><Text style={s.title}>{identity?.levelName??'Level unavailable'}</Text>{identity&&<Ionicons name="chevron-forward" size={16} color="#AAA99C"/>}</View>
   <View accessibilityRole="progressbar" accessibilityLabel="Identity level progress" accessibilityValue={{min:0,max:100,now:Math.round(progress*100)}} style={s.track}><View style={[s.fill,{width:`${progress*100}%`}]}/></View>
   <Text style={s.caption}>{identity?(next?`${Math.ceil(remaining)} XP to ${next}`:'Highest level reached'):'Pull to refresh your level'}</Text>
  </TouchableOpacity>
  <View style={s.body}>
   <View style={s.copy}><Text accessibilityLabel={value==null?'Activity score unavailable':`Activity score ${value} out of 100`} style={[s.score,{color}]}>{value??'—'}<Text style={s.denominator}> /100</Text></Text><Text style={s.status}>{status}</Text>{activities>0&&<Text style={s.summary}>{minutes>0?`${Math.round(minutes)} min · `:''}{activities} {activities===1?'activity':'activities'}</Text>}</View>
   <View style={s.ring} accessible accessibilityLabel={value==null?'Score unavailable':`${value} percent`}><Svg width={108} height={108} viewBox="0 0 108 108"><Circle cx={54} cy={54} r={44} fill="none" stroke="#393D2D" strokeWidth={10}/>{value!=null&&value>0&&<Circle cx={54} cy={54} r={44} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" strokeDasharray={`${circumference*value/100} ${circumference}`} rotation={-90} origin="54,54"/>}</Svg><View style={s.ringLabel}><Text style={s.percent}>{value==null?'—':`${value}%`}</Text></View></View>
  </View>
 </LinearGradient>
}
const s=StyleSheet.create({
 card:{marginHorizontal:16,marginBottom:18,padding:22,borderRadius:20,borderWidth:1,borderColor:'#373B2A'},
 level:{marginBottom:24,minHeight:64},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
 title:{fontSize:21,fontFamily:'Inter_800ExtraBold',color:'#FAF9F3',flex:1},track:{height:4,borderRadius:8,backgroundColor:'#393D2D',overflow:'hidden',marginTop:12},fill:{height:4,backgroundColor:'#B8F23A',borderRadius:8},caption:{fontSize:11,color:'#A9AD9C',marginTop:8,fontFamily:'Inter_500Medium'},
 body:{flexDirection:'row',alignItems:'center',gap:12},copy:{flex:1},score:{fontSize:60,lineHeight:68,letterSpacing:-3,fontFamily:'Inter_800ExtraBold'},denominator:{fontSize:14,letterSpacing:0,color:'#929787',fontFamily:'Inter_500Medium'},status:{fontSize:21,lineHeight:25,fontFamily:'Inter_800ExtraBold',letterSpacing:-0.5,color:'#FAF9F3',marginTop:12},summary:{fontSize:13,lineHeight:19,color:'#A9AD9C',marginTop:7},ring:{width:108,height:108,alignSelf:'flex-start',marginTop:8},ringLabel:{position:'absolute',inset:0,alignItems:'center',justifyContent:'center'},percent:{fontSize:25,fontFamily:'Inter_800ExtraBold',color:'#FAF9F3',letterSpacing:-1}
});
