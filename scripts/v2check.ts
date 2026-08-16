import * as D from "../src/game/data";
import { CELL_W, CELL_H, COLS, ROWS } from "../src/game/presence";
import { worldCellId } from "../src/game/world";
const {WORLD_W,WORLD_H,BIOMES,biomeAt,blockedAt,NODE_SPAWNS,MONSTER_SPAWNS,FISHING_SPOTS,NPCS,BUILDINGS,BRIDGES,LAKES,TOWN_CENTERS}=D as any;
console.log("world",WORLD_W,WORLD_H,"biomes",BIOMES.length,"cells",COLS,"x",ROWS,"cover",COLS*CELL_W>=WORLD_W,ROWS*CELL_H>=WORLD_H);
// partition check: every sample belongs to exactly one biome (by construction of CELL_OWNER) + all 5 ids present
const ids=new Map<string,number>();
for(let y=10;y<WORLD_H;y+=50)for(let x=10;x<WORLD_W;x+=50){const b=biomeAt(x,y);ids.set(b.id,(ids.get(b.id)??0)+1);}
console.log("coverage",[...ids.entries()]);
console.log("keys unique",new Set(BIOMES.map((b:any)=>b.key)).size===BIOMES.length);
console.log("nodes",NODE_SPAWNS.length,"mobs",MONSTER_SPAWNS.length,"spots",FISHING_SPOTS.length,"bridges",BRIDGES.length,"lakes",LAKES.length);
const badNpc=NPCS.filter((n:any)=>blockedAt(n.x,n.y,10)||n.x<0||n.y<0||n.x>WORLD_W||n.y>WORLD_H);
console.log("blocked NPCs",badNpc.map((n:any)=>[n.id,n.x,n.y]));
const badSpot=FISHING_SPOTS.filter((s:any)=>s.x<0||s.y<0||s.x>WORLD_W||s.y>WORLD_H);
console.log("out-of-bounds spots",badSpot.length);
const badB=BUILDINGS.filter((b:any)=>b.x<0||b.y<0||b.x+b.w>WORLD_W||b.y+b.h>WORLD_H);
console.log("out-of-bounds buildings",badB.length);
console.log("towns",TOWN_CENTERS, TOWN_CENTERS.map((c:any)=>biomeAt(c.x,c.y).id));
// flood fill reachability from Grand Haven
const S=25,W=Math.floor(WORLD_W/S),H=Math.floor(WORLD_H/S);
const open=new Uint8Array(W*H);
for(let j=0;j<H;j++)for(let i=0;i<W;i++)open[j*W+i]=blockedAt(i*S+S/2,j*S+S/2,12)?0:1;
const seen=new Uint8Array(W*H);const st=[Math.floor(2400/S)*W+Math.floor(700/S)];seen[st[0]!]=1;
while(st.length){const c=st.pop()!;const cx=c%W,cy=(c-cx)/W;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const ni=ny*W+nx;if(seen[ni]||!open[ni])continue;seen[ni]=1;st.push(ni);} }
const reach=(x:number,y:number)=>!!seen[Math.floor(y/S)*W+Math.floor(x/S)];
console.log("towns reachable",TOWN_CENTERS.map((c:any)=>reach(c.x,c.y)));
const perBiome:Record<string,{tot:number,ok:number}>={};
for(let y=60;y<WORLD_H-60;y+=100)for(let x=60;x<WORLD_W-60;x+=100){const id=biomeAt(x,y).id;if(blockedAt(x,y,12))continue;perBiome[id]??={tot:0,ok:0};perBiome[id]!.tot++;if(reach(x,y))perBiome[id]!.ok++;}
console.log("reachable fraction per biome",Object.fromEntries(Object.entries(perBiome).map(([k,v])=>[k,(v.ok/v.tot).toFixed(3)])));
console.log("nodes reachable",NODE_SPAWNS.filter((n:any)=>reach(n.x,n.y)).length,"/",NODE_SPAWNS.length);
console.log("spots reachable",FISHING_SPOTS.filter((s:any)=>reach(s.x,s.y)).length,"/",FISHING_SPOTS.length);
console.log("npcs reachable",NPCS.filter((n:any)=>reach(n.x,n.y)).length,"/",NPCS.length);
console.log("sample cells", worldCellId(0,0), worldCellId(WORLD_W-1,WORLD_H-1));
