// One-off: render a zoomed-out picture of the whole world (terrain, rivers,
// lakes, roads, bridges, towns) with no nodes, monsters or NPCs.
import { writeFileSync } from "node:fs";

import {
  BARRIERS,
  BRIDGES,
  BIOMES,
  BUILDINGS,
  STREETS,
  LAKES,
  ROAD_RUNS,
  WORLD_H,
  WORLD_W,
} from "../../src/game/data";
import { CITIES, cityWallR } from "../../src/game/city";

const p = (pts: [number, number][] | number[][]) =>
  pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");

const out: string[] = [];
out.push(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${WORLD_W}" height="${WORLD_H}" viewBox="0 0 ${WORLD_W} ${WORLD_H}">`,
);
out.push("<defs>");
for (const b of BIOMES) {
  out.push(
    `<linearGradient id="bg-${b.key}" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0%" stop-color="${b.top}"/><stop offset="100%" stop-color="${b.bottom}"/></linearGradient>`,
  );
}
out.push("</defs>");
out.push(`<rect width="${WORLD_W}" height="${WORLD_H}" fill="#1b1620"/>`);

for (const b of BIOMES) {
  out.push(`<path d="${p(b.poly)} Z" fill="url(#bg-${b.key})" stroke="rgba(70,55,70,0.20)" stroke-width="2"/>`);
}

const river = (d: string, w: number) =>
  `<g fill="none" stroke-linecap="round" stroke-linejoin="round">` +
  `<path d="${d}" stroke="#3f6f83" stroke-width="${w * 1.16}"/>` +
  `<path d="${d}" stroke="#6fa9c9" stroke-width="${w}"/>` +
  `<path d="${d}" stroke="#9fd8ee" stroke-width="${w * 0.45}" opacity="0.75"/></g>`;

for (const bar of BARRIERS) out.push(river(p(bar.pts), bar.width * 0.9));

for (const c of CITIES.filter((c) => c.moatW > 0)) {
  const pts: string[] = [];
  for (let i = 0; i <= 192; i++) {
    const a = (i / 192) * Math.PI * 2;
    const r = cityWallR(a, c) + c.moatGap + c.moatW / 2;
    pts.push(`${i === 0 ? "M" : "L"}${c.cx + Math.cos(a) * r},${c.cy + Math.sin(a) * r}`);
  }
  out.push(river(`${pts.join(" ")} Z`, c.moatW));
}

for (const l of LAKES) {
  const fill = l.style === "winter" ? "#a9d8ea" : l.style === "evil" ? "#3f5c62" : "#5fb2d6";
  out.push(`<path d="${p(l.poly)} Z" fill="${fill}" stroke="rgba(30,60,80,0.45)" stroke-width="2"/>`);
  for (const j of l.jetties) {
    out.push(
      `<line x1="${j.x1}" y1="${j.y1}" x2="${j.x2}" y2="${j.y2}" stroke="#a9793f" stroke-width="${Math.max(3, j.hw)}" stroke-linecap="round"/>`,
    );
  }
}

for (const r of ROAD_RUNS) {
  out.push(
    `<path d="${p(r.pts)}" fill="none" stroke="${r.trail ? "#93805d" : "#a8a5a0"}" stroke-width="${r.width}"${
      r.trail ? ' stroke-dasharray="18 12"' : ""
    } stroke-linecap="round" stroke-linejoin="round"/>`,
  );
}

for (const s of STREETS) {
  out.push(`<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="#c4a67c"/>`);
}

for (const br of BRIDGES) {
  const len = br.len + 28;
  out.push(
    `<rect x="${br.x - br.width / 2}" y="${br.y - len / 2}" width="${br.width}" height="${len}" fill="#a9793f" stroke="#6f4a2a" stroke-width="2" transform="rotate(${(br.angle * 180) / Math.PI} ${br.x} ${br.y})"/>`,
  );
}

for (const b of BUILDINGS) {
  out.push(
    `<g><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${b.wall}" rx="3"/>` +
      `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${Math.min(b.h, 6)}" fill="${b.roof}"/></g>`,
  );
}

out.push("</svg>");
writeFileSync("/mnt/documents/abunaria-world-map.svg", out.join("\n"));
console.log(`world ${WORLD_W}x${WORLD_H}`);
