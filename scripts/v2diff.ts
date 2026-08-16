import { NODE_SPAWNS, MONSTER_SPAWNS } from "../src/game/data";
import { readFileSync } from "node:fs";
const load = (p: string) => new Map(readFileSync(p, "utf8").trim().split("\n").map((l) => { const [id, kind, x, y] = l.split(","); return [Number(id), { kind, x: Number(x), y: Number(y) }] as const; }));
const dn = load("/tmp/v2/dbn.csv"), dm = load("/tmp/v2/dbm.csv");
const diff = (spawns: any[], db: Map<number, any>) => spawns.map((s, i) => ({ i, s, d: db.get(i) })).filter(({ s, d }) => !d || d.kind !== s.kind || d.x !== s.x || d.y !== s.y);
const dnode = diff(NODE_SPAWNS as any, dn), dmob = diff(MONSTER_SPAWNS as any, dm);
console.log("node changes", dnode.length, "of", NODE_SPAWNS.length, "| mob changes", dmob.length, "of", MONSTER_SPAWNS.length);
console.log("NODEROWS", dnode.map(({ i, s }) => `(${i},'${s.kind}',${s.x},${s.y})`).join(","));
console.log("MOBROWS", dmob.map(({ i, s }) => `(${i},'${s.kind}',${s.x},${s.y})`).join(","));
