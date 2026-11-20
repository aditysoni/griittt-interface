import React from 'react';
import Svg,{G,Image,Path} from 'react-native-svg';
import type {BodyModel} from '../lib/bodyGeometry';
import type {Muscle,MuscleStats} from '../lib/trackingInsights';
export type BodySide='front'|'back';
const pictures={
 male:{front:require('../assets/body-illustrations/male-front.png'),back:require('../assets/body-illustrations/male-back.png')},
 female:{front:require('../assets/body-illustrations/female-front.png'),back:require('../assets/body-illustrations/female-back.png')},
};
// Paths follow these fixed 1024×1536 illustrations, not a user's anatomy.
// Each paired region is mirrored about the centre of the artwork.
const regions:Record<'male'|'female',Record<BodySide,Partial<Record<Muscle,string>>>>={
 male:{front:{
 chest:'M 366 303 C 407 288 466 291 506 311 L 502 412 C 454 439 399 427 358 399 C 346 367 349 333 366 303 Z',
 shoulders:'M 341 285 C 305 290 279 317 280 353 L 292 403 C 313 405 333 389 344 365 L 360 309 Z',
 biceps:'M 280 405 C 263 424 246 463 237 505 L 271 530 C 300 508 317 464 317 420 Z',
 abs:'M 422 440 C 450 445 481 442 505 438 L 505 637 C 477 647 447 643 423 627 C 411 566 407 499 422 440 Z',
 legs:'M 345 869 C 375 878 429 880 482 877 C 503 933 494 1007 472 1065 C 455 1114 449 1148 447 1189 L 423 1409 L 370 1404 C 362 1306 355 1244 351 1180 C 346 1123 325 1081 323 1012 C 319 961 328 913 345 869 Z',
 },back:{
 back:'M 434 228 C 415 251 389 267 362 291 C 339 336 348 390 366 420 C 382 464 395 519 405 575 L 499 615 L 504 280 Z',
 shoulders:'M 341 289 C 302 294 278 324 279 355 L 288 400 C 309 413 336 390 350 364 L 364 310 Z',
 triceps:'M 281 407 C 263 435 246 470 238 512 L 273 545 C 302 516 319 464 317 421 Z',
 legs:'M 343 867 C 388 881 435 880 481 873 C 492 939 483 1006 463 1065 L 447 1155 C 466 1218 448 1329 427 1443 L 366 1448 C 354 1374 352 1310 354 1247 L 350 1155 C 326 1090 317 1027 324 963 Z',
 }},
 female:{front:{
 chest:'M 415 304 C 441 311 474 317 505 316 L 504 423 L 402 420 L 387 351 Z',
 shoulders:'M 362 294 C 336 292 310 313 307 342 L 311 388 C 335 390 356 367 365 345 L 375 313 Z',
 biceps:'M 309 396 C 290 418 275 457 267 495 L 292 518 C 321 492 340 453 339 410 Z',
 abs:'M 434 486 C 454 480 480 481 506 481 L 506 623 C 482 641 456 641 432 627 C 420 585 422 532 434 486 Z',
 legs:'M 359 808 C 399 815 442 819 486 815 C 500 894 486 976 467 1045 C 451 1093 446 1124 447 1169 L 425 1418 L 370 1415 C 358 1317 352 1248 355 1183 C 350 1119 326 1055 328 982 C 327 921 341 853 359 808 Z',
 },back:{
 back:'M 443 244 C 419 265 397 284 379 307 L 405 346 L 448 363 L 470 465 L 409 499 L 418 570 L 503 602 L 505 287 Z',
 shoulders:'M 361 298 C 335 292 309 316 307 345 L 312 388 C 336 392 357 365 367 341 L 375 315 Z',
 triceps:'M 309 399 C 289 424 273 462 266 502 L 296 526 C 321 496 339 454 338 411 Z',
 legs:'M 357 807 C 402 818 445 819 485 816 C 494 892 480 971 465 1040 L 448 1159 C 461 1236 444 1337 427 1441 L 369 1445 C 355 1359 354 1303 356 1237 L 353 1153 C 331 1088 323 1018 329 956 Z',
 }},
};
export function BodyIllustration({model,side,width,height,muscles,onSelect}:{model:BodyModel;side:BodySide;width:number;height:number;muscles:MuscleStats;onSelect:(part:Muscle)=>void}){
 const variant=model==='female'?'female':'male';
 const max=Math.max(1,...Object.values(muscles).map(value=>value.weekSets));
 return <Svg width={width} height={height} viewBox="0 0 1024 1536" accessibilityLabel={`${side} view of ${variant} training illustration`}>
  <Image href={pictures[variant][side]} width={1024} height={1536}/>
  {(Object.entries(regions[variant][side]) as [Muscle,string][]).map(([part,path])=>{
   const sets=muscles[part]?.weekSets??0;
   if(sets<=0)return null;
   return <G key={part} fill="#B5DD48" opacity={.24+.34*(sets/max)} onPress={()=>onSelect(part)}>
    <Path d={path}/><Path d={path} transform="translate(1024 0) scale(-1 1)"/>
   </G>;
  })}
 </Svg>;
}
