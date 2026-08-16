import * as D from "../src/game/data";
import { CITY, CITY_OUTER_R, cityWallR, cityGateAt, cityBlocked, cityGateApproach, cityKeepOut } from "../src/game/city";
const {WORLD_W,WORLD_H,biomeAt,blockedAt,NPCS,BUILDINGS,NODE_SPAWNS,MONSTER_SPAWNS,LAKES,FISHING_SPOTS}=D as any;
const inC=(x:number,y:number)=>Math.hypot(x-CITY.cx,y-CITY.cy);
// 1 biome containment + clearance
let bad=0,minClear=1e9;
for(let a=-Math.PI;a<Math.PI;a+=0.01){
  const r=cityWallR(a)+CITY.moatGap+CITY.moatW;
  const x=CITY.cx+Math.cos(a)*r,y=CITY.cy+Math.sin(a)*r;
  if(biomeAt(x,y).id!=="fields")bad++;
  // clearance: walk outward until biome changes
  let c=0;for(let k=4;k<400;k+=4){const px=CITY.cx+Math.cos(a)*(r+k),py=CITY.cy+Math.sin(a)*(r+k);if(px<0||py<0||px>WORLD_W||py>WORLD_H){c=k;break}if(biomeAt(px,py).id!=="fields"){c=k;break}c=k}
  minClear=Math.min(minClear,c);
}
console.log("moat outside fields pts:",bad,"min clearance to biome edge:",minClear);
// 2 wall solid
let solid=0,tot=0;
for(let a=-Math.PI;a<Math.PI;a+=0.005){tot++;const r=cityWallR(a);if(cityBlocked(CITY.cx+Math.cos(a)*r,CITY.cy+Math.sin(a)*r,8))solid++;}
console.log("wall ring blocked fraction:",(solid/tot).toFixed(3),"(gates are the gaps)");
// 3 gates open both sides + reachability flood fill
const S=12,W=Math.ceil(WORLD_W/S),H=Math.ceil(WORLD_H/S);
const open=new Uint8Array(W*H);
const x0=Math.floor((CITY.cx-CITY_OUTER_R-400)/S),x1=Math.ceil((CITY.cx+CITY_OUTER_R+400)/S);
const y0=Math.floor((CITY.cy-CITY_OUTER_R-400)/S),y1=Math.ceil((CITY.cy+CITY_OUTER_R+400)/S);
for(let j=Math.max(0,y0);j<Math.min(H,y1);j++)for(let i=Math.max(0,x0);i<Math.min(W,x1);i++)open[j*W+i]=blockedAt(i*S+S/2,j*S+S/2,12)?0:1;
const seen=new Uint8Array(W*H);const start=Math.floor(CITY.cy/S)*W+Math.floor(CITY.cx/S);
const st=[start];seen[start]=1;
while(st.length){const c=st.pop()!;const cx=c%W,cy=(c-cx)/W;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=cx+dx,ny=cy+dy;if(nx<Math.max(0,x0)||ny<Math.max(0,y0)||nx>=Math.min(W,x1)||ny>=Math.min(H,y1))continue;const ni=ny*W+nx;if(seen[ni]||!open[ni])continue;seen[ni]=1;st.push(ni);}}
const reach=(x:number,y:number)=>!!seen[Math.floor(y/S)*W+Math.floor(x/S)];
console.log("gates reachable from plaza (outside approach):",CITY.gates.map(g=>{const p=cityGateApproach(g,70);return [g.label,reach(p.x,p.y),blockedAt(p.x,p.y,12)?"blockedTerrain":"walkable"]}));
// inside coverage
let ins=0,insOk=0;
for(let a=0;a<Math.PI*2;a+=0.05)for(let r=10;r<cityWallR(a)-CITY.wallT;r+=15){const x=CITY.cx+Math.cos(a)*r,y=CITY.cy+Math.sin(a)*r;if(blockedAt(x,y,12))continue;ins++;if(reach(x,y))insOk++;}
console.log("inside-wall open ground reachable:",(insOk/ins).toFixed(3));
let out=0,outOk=0;
for(let y=CITY.cy-CITY_OUTER_R-350;y<CITY.cy+CITY_OUTER_R+350;y+=25)for(let x=CITY.cx-CITY_OUTER_R-350;x<CITY.cx+CITY_OUTER_R+350;x+=25){if(x<20||y<20||x>WORLD_W-20||y>WORLD_H-20)continue;if(inC(x,y)<CITY_OUTER_R+10)continue;if(blockedAt(x,y,12))continue;out++;if(reach(x,y))outOk++;}
console.log("outside ring open ground reachable:",(outOk/out).toFixed(3));
// 4 NPCs
const gh=NPCS.filter((n:any)=>inC(n.x,n.y)<CITY_OUTER_R);
console.log("GH npcs:",gh.length,gh.map((n:any)=>[n.role,Math.round(inC(n.x,n.y)),blockedAt(n.x,n.y,10)?"BLOCKED":"ok",reach(n.x,n.y)?"reach":"ISOLATED"]));
console.log("all npcs total",NPCS.length,"blocked:",NPCS.filter((n:any)=>blockedAt(n.x,n.y,10)).length);
// buildings inside wall
const ghB=BUILDINGS.filter((b:any)=>inC(b.x+b.w/2,b.y+b.h/2)<CITY_OUTER_R);
console.log("GH buildings:",ghB.length,"outside wall?",ghB.filter((b:any)=>inC(b.x+b.w/2,b.y+b.h/2)>cityWallR(Math.atan2(b.y+b.h/2-CITY.cy,b.x+b.w/2-CITY.cx))-CITY.wallT).length);
// 5 spawns
console.log("nodes in city:",NODE_SPAWNS.filter((n:any)=>cityKeepOut(n.x,n.y,0)).length,"mobs in city:",MONSTER_SPAWNS.filter((n:any)=>cityKeepOut(n.x,n.y,0)).length,"totals",NODE_SPAWNS.length,MONSTER_SPAWNS.length);
// 6 lake untouched
const fl=LAKES.find((l:any)=>l.key==="fields");
console.log("fields lake",fl.cx,fl.cy,"dist to city",Math.round(inC(fl.cx,fl.cy)),"outer",Math.round(CITY_OUTER_R),"jetty spots",FISHING_SPOTS.filter((s:any)=>s.lake==="fields").length);
console.log("plaza walkable",!blockedAt(CITY.cx,CITY.cy,12));
