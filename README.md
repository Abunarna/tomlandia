# Cozy Canvas

# TOMLANDIA — Prompt for Lovable



## Vision



Build a cozy, mobile-first fantasy idle RPG called **Tomlandia**, using React, Tailwind CSS, HTML5 Canvas, and Lucide icons.



Think *Old School RuneScape skilling* crossed with *Animal Crossing* charm — cute, magical, relaxing, never dark or gruesome. The player wanders a small living pixel world where every action gives a tiny bit of visible progress. The goal is "just five more minutes," not grinding.



**Build this in phases. Get Phase 1 fully working and polished before adding anything from Phase 2 or 3.** A smaller game that feels great beats a large one that's half-wired.



---



## Phase 1 — Core Loop (build this first, completely)



- One biome: **Peaceful Fields** (bright green, levels 1–15)

- One town: **Grand Haven**, with a Forge and a Market stall

- Player movement: virtual joystick or tap-to-move on canvas

- One gathering skill: **Mining** (copper) and **Woodcutting** (oak) — tap a node, auto-harvest over a few seconds, node depletes and respawns

- XP and leveling using `XP(level) = 100 × 1.15^level`, no level cap

- Basic automatic combat: tap a monster (goblins, chickens), player walks over, combat resolves automatically

- Combat formula (keep simple): each tick, `damage = max(1, attack - defense/2)`; whoever hits 0 HP first loses

- Inventory: 20 slots, stackable resources

- Equipment: one weapon slot and one armor slot, no upgrading yet

- HUD: HP, level, XP bar, gold, region name

- Save to localStorage every 30 seconds



Nail this loop — movement, gather, fight, level up, feel good — before touching anything below.



---



## Phase 2 — Expand the World



- Add remaining biomes in order: Lush Forest (15–40), Sunscorch Desert (40–70), Evil Woods (70–100), Winter Mountain (100+) — each with its own palette, resources, and monsters (see reference table below)

- Add second capital **Sunspire** (magic crafting, golden pastel) and 2–3 small villages with an inn/merchant/bank

- Add remaining skills: **Gathering** (fiber/herbs/berries), **Smithing** (ore → ingots → gear), **Skinning** (carcasses → leather), **Tailoring** (fiber/leather → cloth gear)

- Add equipment upgrading: +1 to +25 (not +100 — see "cut" list), each level +5% stat, cost roughly doubles every 5 levels

- Auto-eat: consume equipped food when HP < 30%



## Phase 3 — Economy & Polish



- Global marketplace: list items, buy/search/filter, 5% transaction fee

- Simulated background NPC trades to keep the market feeling alive

- Ambient life: wandering town NPCs, butterflies, drifting leaves, day/night tint shift

- Sound-effect hooks (placeholders are fine) for hits, level-ups, gathering



---



## Explicitly Do NOT Build (avoid scope creep)



- No real-time multiplayer or server backend — everything is local/simulated

- No upgrade tiers beyond +25 (500,000-ingot +100 gear is a number nobody will ever reach and isn't worth the dev time)

- No full crafting trees beyond what's listed above

- No quest system, dialogue trees, or story content unless asked later

- No skill list beyond the six named — don't invent extra skills



---



## Art Direction



16-bit pixel aesthetic, pastel palette, oversized-head characters, soft shadows, gentle bloom. Monsters look mischievous, not scary. Damage numbers bounce gently; XP appears as small orbs that float to the player. Resources sparkle faintly when harvestable. No screen shake, no gore, no harsh reds.



---



## Mobile Layout (strict portrait)



- **Top HUD** — HP, Mana, Gold, Level, active skill XP bar, region name. Rounded, minimal.

- **Center canvas (~60% height)** — player, NPCs, monsters, resource nodes, buildings, floating text, particles. Camera follows player smoothly.

- **Bottom dock (~30% height)**, tabbed, large touch targets:

  - 🗺️ World — joystick / tap-to-move, region map

  - 🎒 Inventory — 20 slots, equipped gear

  - 🔨 Skills — levels, XP bars, active crafting

  - ⚖️ Market — buy/sell (Phase 3)



---



## Biome Reference (for Phase 2)



| Biome | Level | Palette | Resources | Monsters |

|---|---|---|---|---|

| Peaceful Fields | 1–15 | bright green | copper, oak | chickens, goblins |

| Lush Forest | 15–40 | deep emerald | iron, willow, maple | wolves, bears |

| Sunscorch Desert | 40–70 | warm gold | sandstone, mithril | serpents, bandits |

| Evil Woods | 70–100 | mysterious violet | cursed bark | wraiths, shadow beasts |

| Winter Mountain | 100+ | icy blue | runite, tungsten | yetis, frost giants |



---



## Technical Notes



- React + Tailwind + HTML5 Canvas + Lucide icons, TypeScript where practical

- No image assets — render sprites as simple procedural shapes/gradients on canvas

- Target 60 FPS, keep the render loop lightweight (avoid re-rendering React on every animation frame — drive canvas animation outside React state where possible)

- Modular components; avoid pulling in extra libraries beyond what's listed

- localStorage au

tosave every 30 seconds, covering player, inventory, skills, equipment, gold, and world state

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://tomlandia.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/10d00f6b-da27-43c4-a205-c0b7841a64fc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
