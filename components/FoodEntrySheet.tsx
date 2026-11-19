import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ai, fuel, FoodItem, MealTime } from '../lib/api';
import type { AppTheme } from './ThemeContext';
import { FoodDetail, foodDetailStorage, NUTRIENTS, NutritionDraft, nutritionFromItem, parseNutrition } from '../lib/foodDetails';
import { formatShortDate } from '../lib/today';
const MEALS: Array<{ value: MealTime; label: string }> = [{value:'morning',label:'Breakfast'},{value:'brunch',label:'Brunch'},{value:'lunch',label:'Lunch'},{value:'evening',label:'Evening'},{value:'dinner',label:'Dinner'},{value:'snacks',label:'Snack'}];
type Photo = { uri: string; base64?: string | null; mimeType?: string | null };
export function FoodEntrySheet({ open, token, userId, date, item, detail, recentFoods, theme, onClose, onSaved }: {
  open: boolean; token: string; userId: string; date: string; item: FoodItem | null; detail?: FoodDetail; recentFoods: FoodItem[];
  theme: AppTheme; onClose: () => void; onSaved: () => void;
}) {
  const [name,setName]=useState(''),[portion,setPortion]=useState(''),[meal,setMeal]=useState<MealTime>('morning');
  const [nutrition,setNutrition]=useState<NutritionDraft>(()=>nutritionFromItem());
  const [photo,setPhoto]=useState<Photo|null>(null),[source,setSource]=useState<FoodDetail['source']>('manual');
  const [saving,setSaving]=useState(false),[estimating,setEstimating]=useState(false),[picking,setPicking]=useState(false);
  const [inputError,setInputError]=useState('');
  const scan=useRef<AbortController|null>(null);
  const busy=saving||estimating||picking;
  useEffect(()=>{
    if(!open)return;
    setName(item?.name??''); setMeal(item?.mealTime??'morning'); setPortion(detail?.portion??'');
    setNutrition(nutritionFromItem(item)); setPhoto(detail?.photoUri?{uri:detail.photoUri}:null);setSource(detail?.source??'manual');setInputError('');
    return ()=>{scan.current?.abort();};
  },[open,item?.id,date]);
  const dirty=name!==(item?.name??'')||portion!==(detail?.portion??'')||meal!==(item?.mealTime??'morning')||JSON.stringify(nutrition)!==JSON.stringify(nutritionFromItem(item))||(photo?.uri??'')!==(detail?.photoUri??'');
  function close(){
    if(saving||picking)return;
    scan.current?.abort();setEstimating(false);
    if(dirty){Alert.alert('Discard this draft?','Your unsaved photo, food name and nutrition will not be added.',[{text:'Keep editing',style:'cancel'},{text:'Discard draft',style:'destructive',onPress:onClose}]);}else onClose();
  }
  async function choosePhoto(from:'camera'|'library'){
    if(busy)return;setPicking(true);setInputError('');
    try{
      const permission=from==='camera'?await ImagePicker.requestCameraPermissionsAsync():await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted){Alert.alert('Photo access is off','You can allow access in Settings, or enter the food and nutrition yourself.');return;}
      const result=await (from==='camera'?ImagePicker.launchCameraAsync:ImagePicker.launchImageLibraryAsync)({mediaTypes:['images'],quality:0.7,base64:true,allowsEditing:true,aspect:[4,3]});
      if(!result.canceled&&result.assets[0]){setPhoto(result.assets[0]);setSource('manual');}
    }catch{Alert.alert('Photo unavailable','The camera or photo library could not be opened. Try choosing a photo, or enter the food manually.');}
    finally{setPicking(false);}
  }
  async function estimate(){
    if(!photo?.base64||busy)return;const controller=new AbortController();scan.current=controller;setEstimating(true);setInputError('');
    try{
      const data=await ai.snapTrack(token,`data:${photo.mimeType||'image/jpeg'};base64,${photo.base64}`,controller.signal);
      if(controller.signal.aborted)return;
      if(!data.name?.trim()||data.name.toLowerCase()==='unknown food'){setInputError('Food could not be identified. Try another photo or enter the details yourself.');return;}
      setName(data.name);setSource('photo');if(!portion.trim()&&data.servingNote)setPortion(data.servingNote.slice(0,140));
      const fat=(data as {fat?:number}).fat??data.fats;
      setNutrition(previous=>({...previous,...Object.fromEntries(([["calories",data.calories],["protein",data.protein],["carbs",data.carbs],["fat",fat]] as const).filter(([,value])=>typeof value==='number'&&Number.isFinite(value)&&value>=0).map(([key,value])=>[key,String(Math.round(value*10)/10)]))}));
    }catch(error:any){if(!controller.signal.aborted)setInputError(error.message?'The estimate could not be completed. Your photo is still here; try again or enter nutrition manually.':'Nutrition estimation is unavailable. You can still enter the values yourself.');}
    finally{if(scan.current===controller){setEstimating(false);scan.current=null;}}
  }
  function useRecent(food:FoodItem){setName(food.name);setMeal(food.mealTime);setNutrition(nutritionFromItem(food));setSource('previous');setPortion('');setPhoto(null);setInputError('');}
  async function save(){
    if(busy)return;if(!name.trim()){setInputError('Add a food name before saving.');return;}
    let values:ReturnType<typeof parseNutrition>;
    try{values=parseNutrition(nutrition);}catch(error:any){setInputError(error.message);return;}
    setSaving(true);setInputError('');
    try{
      // Send only nutrition fields the user changed, so a portion edit can
      // recalculate catalog estimates instead of treating old estimates as overrides.
      const editedValues=item?Object.fromEntries(Object.entries(values).filter(([key,value])=>value!==(item[key as keyof FoodItem]==null?null:Number(item[key as keyof FoodItem])))):values;
      const nameChanged=!!item&&name.trim()!==item.name;
      const result=item?await fuel.editItem(token,item.id,{...(nameChanged?{name:name.trim()}:{}),...(portion!==(detail?.portion??'')||nameChanged&&!!portion?{portion}:{}),mealTime:meal,...editedValues}):await fuel.addItem(token,{date,name:name.trim(),portion,mealTime:meal,...Object.fromEntries(Object.entries(values).filter(([,value])=>value!==null))});
      try{
        await foodDetailStorage.set(userId,result.id,{portion,photoUri:photo?.uri===detail?.photoUri?detail?.photoUri:undefined,source,updatedAt:new Date().toISOString()},photo&&photo.uri!==detail?.photoUri?photo:undefined);
      }catch{Alert.alert('Food saved','The food and nutrition were saved to your account, but the photo or portion note could not be saved on this device. Do not add the food again; you can edit this entry later.');}
      onSaved();
    }catch{setInputError('The save could not be confirmed. Your draft is still here. Check your food entries before retrying if the connection dropped.');}
    finally{setSaving(false);}
  }
  return <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}><KeyboardAvoidingView style={[s.sheet,{backgroundColor:theme.bg}]} behavior={Platform.OS==='ios'?'padding':undefined}>
    <View style={[s.header,{borderBottomColor:theme.border}]}><View style={{flex:1}}><Text style={[s.title,{color:theme.text}]}>{item?'Edit food':'Add food'}</Text><Text style={[s.small,{color:theme.textSecondary}]}>{formatShortDate(date)} · review before saving</Text></View><TouchableOpacity onPress={close} disabled={saving||picking} style={s.iconButton} accessibilityRole="button" accessibilityLabel="Close food entry"><Ionicons name="close" size={23} color={theme.text}/></TouchableOpacity></View>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={s.body}>
      <View style={[s.photoArea,{backgroundColor:theme.card,borderColor:theme.border}]}>{photo?<><Image source={{uri:photo.uri}} style={s.photo} accessibilityLabel="Selected food photo"/><View style={s.photoCaption}><Text style={[s.small,{color:theme.textSecondary}]}>Photo saved on this device</Text><TouchableOpacity onPress={()=>setPhoto(null)} disabled={busy} style={s.removePhoto} accessibilityRole="button" accessibilityLabel="Remove photo from draft"><Text style={[s.link,{color:theme.text}]}>Remove</Text></TouchableOpacity></View></>:<View style={s.photoEmpty}><Ionicons name="camera-outline" size={31} color={theme.textSecondary}/><Text style={[s.photoTitle,{color:theme.text}]}>Start with a photo, if you like.</Text><Text style={[s.small,{color:theme.textSecondary}]}>You can always enter everything manually.</Text></View>}
      <View style={s.photoActions}><TouchableOpacity style={[s.photoButton,{borderColor:theme.borderStrong}]} onPress={()=>choosePhoto('camera')} disabled={busy} accessibilityRole="button" accessibilityLabel="Take food photo"><Ionicons name="camera-outline" size={18} color={theme.text}/><Text style={[s.link,{color:theme.text}]}>Take photo</Text></TouchableOpacity><TouchableOpacity style={[s.photoButton,{borderColor:theme.borderStrong}]} onPress={()=>choosePhoto('library')} disabled={busy} accessibilityRole="button" accessibilityLabel="Choose food photo"><Ionicons name="images-outline" size={18} color={theme.text}/><Text style={[s.link,{color:theme.text}]}>Choose photo</Text></TouchableOpacity></View>
      {!!photo?.base64&&<><TouchableOpacity onPress={estimate} disabled={busy} accessibilityRole="button" accessibilityLabel="Estimate nutrition from selected photo" style={[s.estimateButton,{backgroundColor:theme.inverse,opacity:busy?0.65:1}]}>{estimating?<ActivityIndicator color={theme.inverseText}/>:<Ionicons name="sparkles-outline" size={17} color={theme.inverseText}/>}<Text style={[s.link,{color:theme.inverseText}]}>{estimating?'Estimating…':'Estimate nutrition'}</Text></TouchableOpacity><Text style={[s.photoDisclosure,{color:theme.textSecondary}]}>Estimate nutrition sends this photo to GRITTT’s AI service. Estimates can be inaccurate; review all values.</Text>{estimating&&<TouchableOpacity onPress={()=>{scan.current?.abort();setEstimating(false);}} style={s.cancelEstimate} accessibilityRole="button"><Text style={[s.link,{color:theme.text}]}>Cancel estimate</Text></TouchableOpacity>}</>}
      </View>
      {source!=='manual'&&<View style={[s.estimateNote,{backgroundColor:theme.surface}]}><Ionicons name="information-circle-outline" size={18} color={theme.textSecondary}/><Text style={[s.small,{color:theme.textSecondary,flex:1}]}>{source==='photo'?'Photo estimate ready. Check the name, portion and nutrition.':'Copied from a previous entry. Check today’s portion and nutrition.'}</Text></View>}
      <Text style={[s.label,{color:theme.text}]}>Food name</Text><TextInput style={[s.input,{color:theme.text,backgroundColor:theme.card,borderColor:theme.border}]} value={name} onChangeText={setName} maxLength={200} placeholder="What did you eat?" placeholderTextColor={theme.textSecondary} accessibilityLabel="Food name" editable={!busy} autoCapitalize="words"/>
      <Text style={[s.label,{color:theme.text}]}>Portion <Text style={{color:theme.textSecondary}}>· optional</Text></Text><TextInput style={[s.input,{color:theme.text,backgroundColor:theme.card,borderColor:theme.border}]} value={portion} onChangeText={setPortion} maxLength={140} placeholder="e.g. 1 bowl or 2 pieces" placeholderTextColor={theme.textSecondary} accessibilityLabel="Portion note" editable={!busy}/>
      <Text style={[s.label,{color:theme.text}]}>Meal</Text><View style={s.meals} accessibilityRole="radiogroup" accessibilityLabel="Meal time">{MEALS.map(option=><TouchableOpacity key={option.value} disabled={busy} onPress={()=>setMeal(option.value)} style={[s.meal,{backgroundColor:meal===option.value?theme.inverse:theme.card,borderColor:meal===option.value?theme.inverse:theme.borderStrong}]} accessibilityRole="radio" accessibilityState={{checked:meal===option.value}} accessibilityLabel={option.label}><Text style={[s.mealText,{color:meal===option.value?theme.inverseText:theme.text}]}>{option.label}</Text></TouchableOpacity>)}</View>
      <Text style={[s.label,{color:theme.text}]}>Nutrition <Text style={{color:theme.textSecondary}}>· optional</Text></Text><Text style={[s.small,{color:theme.textSecondary,marginBottom:12}]}>Enter totals for the portion above. Leave anything you don’t know blank.</Text>
      <View style={s.nutritionGrid}>{NUTRIENTS.map(n=><View key={n.key} style={[s.nutritionField,{backgroundColor:theme.card,borderColor:theme.border}]}><Text style={[s.small,{color:theme.textSecondary}]}>{n.label}</Text><View style={s.valueRow}><TextInput style={[s.nutritionInput,{color:theme.text}]} value={nutrition[n.key]} onChangeText={value=>setNutrition(previous=>({...previous,[n.key]:value}))} placeholder="—" placeholderTextColor={theme.textSecondary} keyboardType="decimal-pad" accessibilityLabel={`${n.label} in ${n.unit}`} editable={!busy} maxLength={12}/><Text style={[s.small,{color:theme.textSecondary}]}>{n.unit}</Text></View></View>)}</View>
      {!item&&recentFoods.length>0&&<><Text style={[s.label,{color:theme.text}]}>Use a recent food</Text><Text style={[s.small,{color:theme.textSecondary}]}>Creates a draft to review, not a completed entry.</Text><View style={s.meals}>{recentFoods.slice(0,5).map(food=><TouchableOpacity key={food.id} onPress={()=>useRecent(food)} disabled={busy} style={[s.recent,{backgroundColor:theme.card,borderColor:theme.border}]} accessibilityRole="button" accessibilityLabel={`Use ${food.name} as a draft`}><Ionicons name="time-outline" size={15} color={theme.textSecondary}/><Text style={[s.mealText,{color:theme.text}]}>{food.name}</Text></TouchableOpacity>)}</View></>}
      {!!inputError&&<Text style={[s.error,{color:theme.danger}]} accessibilityRole="alert">{inputError}</Text>}
    </ScrollView>
    <SafeAreaView edges={['bottom']} style={[s.footer,{backgroundColor:theme.bg,borderTopColor:theme.border}]}><TouchableOpacity onPress={save} disabled={busy||!name.trim()} style={[s.saveButton,{backgroundColor:theme.inverse,opacity:busy||!name.trim()?0.5:1}]} accessibilityRole="button" accessibilityLabel={item?'Save food changes':'Save food'} accessibilityState={{disabled:busy||!name.trim(),busy:saving}}>{saving&&<ActivityIndicator color={theme.inverseText}/>}<Text style={[s.saveText,{color:theme.inverseText}]}>{saving?'Saving…':item?'Save changes':'Save food'}</Text></TouchableOpacity></SafeAreaView>
  </KeyboardAvoidingView></Modal>;
}
const s=StyleSheet.create({
  sheet:{flex:1,paddingTop:12},header:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:20,paddingBottom:16,borderBottomWidth:1},title:{fontSize:24,fontFamily:'BricolageGrotesque_800ExtraBold'},small:{fontSize:12,lineHeight:18,fontFamily:'Inter_500Medium',marginTop:3},iconButton:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},body:{padding:16,paddingBottom:28},photoArea:{borderRadius:18,borderWidth:1,padding:14,marginBottom:18,overflow:'hidden'},photo:{width:'100%',aspectRatio:4/3,borderRadius:12},photoEmpty:{alignItems:'center',paddingVertical:23,gap:6},photoTitle:{fontSize:15,fontFamily:'Inter_600SemiBold',textAlign:'center',marginTop:5},photoActions:{flexDirection:'row',gap:8},photoButton:{flex:1,minHeight:46,borderRadius:12,borderWidth:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:8,paddingVertical:10},link:{fontSize:12,lineHeight:18,fontFamily:'Inter_600SemiBold',flexShrink:1},photoCaption:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},removePhoto:{minHeight:44,justifyContent:'center',paddingHorizontal:8},estimateButton:{minHeight:46,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,borderRadius:12,marginTop:12,paddingHorizontal:12},photoDisclosure:{fontSize:11,lineHeight:17,fontFamily:'Inter_400Regular',marginTop:9},cancelEstimate:{minHeight:44,alignItems:'center',justifyContent:'center'},estimateNote:{flexDirection:'row',gap:8,alignItems:'flex-start',padding:13,borderRadius:12,marginBottom:12},label:{fontSize:14,lineHeight:20,fontFamily:'Inter_600SemiBold',marginTop:12,marginBottom:8},input:{fontSize:16,lineHeight:22,fontFamily:'Inter_500Medium',borderWidth:1,borderRadius:12,minHeight:50,paddingHorizontal:14,paddingVertical:12},meals:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:4,marginBottom:8},meal:{minHeight:44,paddingHorizontal:14,paddingVertical:10,borderWidth:1,borderRadius:12,justifyContent:'center'},mealText:{fontSize:13,lineHeight:18,fontFamily:'Inter_500Medium',flexShrink:1},nutritionGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},nutritionField:{flexBasis:'45%',flexGrow:1,padding:13,borderWidth:1,borderRadius:13},valueRow:{flexDirection:'row',alignItems:'center',gap:6},nutritionInput:{flex:1,minWidth:30,minHeight:44,fontSize:22,fontFamily:'SpaceGrotesk_700Bold'},recent:{minHeight:44,paddingHorizontal:12,paddingVertical:10,borderWidth:1,borderRadius:12,flexDirection:'row',alignItems:'center',gap:6,maxWidth:'100%'},error:{fontSize:13,lineHeight:20,fontFamily:'Inter_500Medium',marginTop:16},footer:{paddingHorizontal:16,paddingTop:12,borderTopWidth:1},saveButton:{minHeight:50,paddingHorizontal:14,paddingVertical:14,borderRadius:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginBottom:8},saveText:{fontSize:15,fontFamily:'Inter_700Bold'},
});
