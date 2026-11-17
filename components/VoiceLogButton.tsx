import React,{Component,useState} from 'react';
import {Modal,Text,TouchableOpacity,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useTheme,AppTheme} from './ThemeContext';
import type {VoiceDomain,VoiceSaved} from '../lib/voiceApi';
type Props={domain:VoiceDomain;date:string;token:string|null;disabled?:boolean;onSaved:(saved:VoiceSaved)=>void};
class VoiceBoundary extends Component<{children:React.ReactNode;onClose:()=>void;theme:AppTheme},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true}}render(){if(this.state.failed)return <View style={{padding:24,gap:20}}><Text style={{fontSize:18,color:this.props.theme.text}}>Voice recording needs an updated GRITTT iPhone build. You can still log manually.</Text><TouchableOpacity accessibilityRole="button" onPress={this.props.onClose}><Text style={{color:this.props.theme.text}}>Close</Text></TouchableOpacity></View>;return this.props.children}}
// Delay loading the native recorder until inside the boundary, so older builds keep their manual loggers.
function Recorder(props:Props&{onClose:()=>void}){const {VoiceRecorder}=require('./VoiceRecorder');return <VoiceRecorder {...props}/>}
export function VoiceLogButton(props:Props){const {theme}=useTheme();const [open,setOpen]=useState(false);return <>
 <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voice Log" accessibilityState={{disabled:!!props.disabled||!props.token}} disabled={props.disabled||!props.token} onPress={()=>setOpen(true)} activeOpacity={0.8} style={{flexDirection:'row',alignItems:'center',gap:5,minHeight:36,paddingHorizontal:10,borderRadius:18,backgroundColor:theme.accent,opacity:props.disabled||!props.token?0.45:1}}><Ionicons name="mic-outline" size={15} color={theme.accentText}/><Text maxFontSizeMultiplier={1.3} style={{fontSize:12,fontFamily:'Inter_700Bold',color:theme.accentText}}>Voice Log</Text></TouchableOpacity>
 {open&&<Modal visible animationType="slide" presentationStyle="pageSheet" allowSwipeDismissal={false} onRequestClose={()=>{}}><View style={{flex:1,backgroundColor:theme.bg}}><VoiceBoundary onClose={()=>setOpen(false)} theme={theme}><Recorder {...props} onClose={()=>setOpen(false)}/></VoiceBoundary></View></Modal>}
 </>}
