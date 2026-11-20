import React from 'react';
import {View,ActivityIndicator} from 'react-native';
import {FilamentScene,FilamentView,Model,Camera,DefaultLight,EntitySelector,useFilamentContext} from 'react-native-filament';
import type {BodyModel} from '../lib/bodyGeometry';
import type {Muscle,MuscleStats} from '../lib/trackingInsights';
const sources={male:require('../assets/models/male.glb'),female:require('../assets/models/female.glb'),neutral:require('../assets/models/neutral.glb')};
const parts:Muscle[]=['chest','back','shoulders','legs','biceps','triceps','abs'];
type Props={model:BodyModel;yaw:number;width?:number;height?:number;muscles?:MuscleStats;onSelect?:(part:Muscle)=>void};
function Scene({model,yaw,muscles,onSelect,width=220,height=340}:Props){const {nameComponentManager}=useFilamentContext();const max=Math.max(1,...parts.map(p=>muscles?.[p].weekSets??0));return <FilamentView style={{width,height}} enableTransparentRendering>
 <Camera cameraPosition={[0,0,3.3]} cameraTarget={[0,0,0]} focalLengthInMillimeters={35}/><DefaultLight/>
 <Model key={model} source={sources[model]} rotate={[0,yaw,0]} multiplyWithCurrentTransform={false} onPress={entity=>{try{const part=nameComponentManager.getEntityName(entity) as Muscle;if(parts.includes(part))onSelect?.(part)}catch{/* The labelled muscle controls remain available. */}}}>
 {parts.map(part=>{const weight=(muscles?.[part].weekSets??0)/max;const rgb: [number,number,number,number]=weight>0?[.65+.08*weight,.76+.1*weight,.30-.08*weight,1]:[.56,.57,.53,1];return <EntitySelector key={part} byName={part} materialParameters={{index:0,parameters:{baseColorFactor:rgb,roughnessFactor:.72,metallicFactor:0}}}/>})}
 </Model></FilamentView>}
export function FilamentBodyScene(props:Props){return <FilamentScene fallback={<View style={{height:props.height??340,justifyContent:'center'}}><ActivityIndicator/></View>} frameRateOptions={{interval:2}}><Scene {...props}/></FilamentScene>}
