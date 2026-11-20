import {useIsFocused} from '@react-navigation/native';
import React,{Component,useEffect,useState} from 'react';
import {AppState,Image,Text,View} from 'react-native';
import {useTheme} from './ThemeContext';
import type {BodyModel} from '../lib/bodyGeometry';
import type {Muscle,MuscleStats} from '../lib/trackingInsights';
export const bodyPictures={male:require('../assets/models/male.png'),female:require('../assets/models/female.png'),neutral:require('../assets/models/neutral.png')};
type Props={model:BodyModel;yaw:number;width?:number;height?:number;muscles?:MuscleStats;onSelect?:(part:Muscle)=>void};
class Boundary extends Component<{children:React.ReactNode;fallback:React.ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true}}render(){return this.state.failed?this.props.fallback:this.props.children}}
function NativeBody(props:Props){const {FilamentBodyScene}=require('./FilamentBodyScene');return <FilamentBodyScene {...props}/>}
export function HumanBodyView(props:Props){const {theme}=useTheme();const focused=useIsFocused();const [foreground,setForeground]=useState(AppState.currentState==='active');useEffect(()=>{const sub=AppState.addEventListener('change',state=>setForeground(state==='active'));return()=>sub.remove()},[]);if(!focused||!foreground)return <Image source={bodyPictures[props.model]} resizeMode="contain" style={{width:props.width??220,height:props.height??340}}/>;return <Boundary fallback={<View style={{alignItems:'center'}}><Image source={bodyPictures[props.model]} resizeMode="contain" style={{width:props.width??220,height:props.height??320}}/><Text style={{fontSize:11,color:theme.textSecondary}}>3D rotation needs the updated iOS build.</Text></View>}><NativeBody {...props}/></Boundary>}
