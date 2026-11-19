import type {Muscle} from './trackingInsights';
export type BodyModel='male'|'female'|'neutral';
export type BodyFace={points:string;depth:number;light:number;muscle:Muscle|null};
type Part={x:number;y:number;z:number;rx:number;ry:number;rz:number;muscle:Muscle|null};
// A low-poly, jointed 3D training mannequin. Projection and lighting are local:
// no remote viewer, model downloads or new native rendering module is required.
export function bodyFaces(model:BodyModel,yaw:number):BodyFace[]{
 const shoulder=model==='male'?0.49:model==='female'?0.40:0.45,hip=model==='female'?0.37:0.31;
 const parts:Part[]=[];const add=(x:number,y:number,z:number,rx:number,ry:number,rz:number,muscle:Muscle|null=null)=>parts.push({x,y,z,rx,ry,rz,muscle});
 add(0,2.83,0,0.23,0.29,0.22);add(0,2.47,0,0.12,0.16,0.13);
 add(0,2.05,0,shoulder,0.43,0.23,'back');add(0,1.57,0,model==='female'?0.25:0.29,0.31,0.19,'back');add(0,1.59,0.17,model==='female'?0.21:0.25,0.28,0.07,'abs');add(0,1.17,0,hip,0.25,0.22);
 for(const side of [-1,1]){
  add(side*0.21,2.13,0.18,shoulder*0.48,0.23,0.115,'chest');
  add(side*(shoulder+0.06),2.16,0,0.15,0.19,0.17,'shoulders');
  add(side*(shoulder+0.17),1.83,0.055,0.12,0.29,0.12,'biceps');add(side*(shoulder+0.17),1.83,-0.075,0.12,0.29,0.105,'triceps');
  add(side*(shoulder+0.26),1.37,0,0.105,0.27,0.11);add(side*(shoulder+0.29),1.01,0,0.095,0.14,0.075);
  add(side*0.19,0.65,0,model==='female'?0.20:0.18,0.46,0.21,'legs');add(side*0.19,0.16,0.02,0.13,0.15,0.13,'legs');add(side*0.19,-0.25,-0.015,0.13,0.31,0.14,'legs');add(side*0.19,-0.60,0.08,0.13,0.11,0.24);
 }
 const faces:BodyFace[]=[];const c=Math.cos(yaw),s=Math.sin(yaw);
 const rotate=(x:number,y:number,z:number)=>({x:x*c+z*s,y,z:-x*s+z*c});
 const project=(v:{x:number;y:number;z:number})=>{const scale=6/(6-v.z);return `${(110+v.x*65*scale).toFixed(2)},${(165-(v.y-1)*65*scale).toFixed(2)}`};
 for(const part of parts){const vertex=(lat:number,lon:number)=>{const a=-Math.PI/2+lat*Math.PI/5,b=lon*Math.PI*2/8;return rotate(part.x+part.rx*Math.cos(a)*Math.cos(b),part.y+part.ry*Math.sin(a),part.z+part.rz*Math.cos(a)*Math.sin(b))};
  for(let lat=0;lat<5;lat++)for(let lon=0;lon<8;lon++){
   const a=vertex(lat,lon),b=vertex(lat+1,lon),d=vertex(lat,lon+1),e=vertex(lat+1,lon+1);
   for(const vertices of [[a,b,e],[a,e,d]]){const [v1,v2,v3]=vertices;const ux=v2.x-v1.x,uy=v2.y-v1.y,uz=v2.z-v1.z,vx=v3.x-v1.x,vy=v3.y-v1.y,vz=v3.z-v1.z;let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const length=Math.hypot(nx,ny,nz)||1;nx/=length;ny/=length;nz/=length;if(nz<0)continue;faces.push({points:vertices.map(project).join(' '),depth:vertices.reduce((sum,v)=>sum+v.z,0)/3,light:Math.max(0,Math.min(1,0.5+(-nx*0.35+ny*0.55+nz*0.7)*0.5)),muscle:part.muscle});}
  }
 }
 return faces.sort((a,b)=>a.depth-b.depth);
}
