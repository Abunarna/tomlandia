# V4 Armour Overhaul — Phase 1–4 Audit (read-only)

Canonical identity verified: project `10d00f6b-da27-43c4-a205-c0b7841a64fc`,
backend ref `fhelsfnbvrmnxuynyoqu`, production `https://tomlandia.lovable.app`.
Active release `v3` (manifest `f8bc150f…`, spawns `38d2615e…`). V3 untouched.

## Phase 1 — Item & recipe audit

- 32 armour items exist: exactly 16 Heavy (attack 0) and 16 Light (attack > 0),
  one of each per tier 1–16, level requirements 1, 10, 20 … 150. No gaps.
- All 32 have a live craft recipe (16 `smithing`, 16 `tailoring`).
- All 46 distinct ingredients resolve to a live acquisition path (ore/tree/herb
  nodes, monster drops at 35–45%, or intermediate recipes). No dead ingredients.
- Server authority resolves items through the `game_runtime_items` /
  `game_runtime_recipes` views, which follow the active content version. The
  legacy `game_items` / `game_recipes` tables are only read on the `v1` path,
  so they are **not** a blocker.

### Naming drift (visibility problem, not a data problem)
Nine armour names do not match their tier theme, which is why the set reads as
"missing" in the Armourer:

| Tier | Theme | Heavy name | Light name |
|---|---|---|---|
| 4 | Steel | Iron Mail | Steel Light Armour |
| 6 | Sunsteel | Mithril Plate | Sunsteel Light Armour |
| 8 | Shadowsteel | Shadowsteel Heavy Armour | Mystic Robe |
| 9 | Froststeel | Runite Plate | Froststeel Light Armour |
| 12 | Starsteel | Frostguard Plate | Starsteel Light Armour |
| 13 | Voidsteel | Wyrmscale Plate | Voidsteel Light Armour |

Tiers 1–3 also use legacy names (Cloth Tunic, Leather Vest, Linen Robe).

## Phase 3 — Recipe economy findings

- Heavy recipes are `bar ×4–6 + trophy ×1`. They contain **no leather**, so
  Skinning is decoupled from Heavy progression entirely.
- Light recipes are inconsistent: some are pure cloth, some pure leather, some
  cloth + bar. There is no single readable pattern.
- Four trophies are sourced from monsters far below the armour's own level, so
  the gate is meaningless: T4 Heavy uses `boar_tusk` (lv 2 monster), T5 Heavy
  uses `jackal_fang` (lv 10), T1 Heavy uses `ram_horn` (lv 1), T2 Heavy uses
  `goblin_charm` (lv 1).

## Phase 4 — Authoritative balance simulation

Formulas extracted from live `attack_monster_v2` / `equip_stat` / `player_max_hp`:

```
attack_stat  = round(3 + combat_level + weapon_attack + armour_attack + buff)
defense_stat = round(floor(combat_level / 2) + armour_defense)
hit          = max(1, floor(attack_stat * (0.6 + rand*0.6) - monster.defense * 0.4))
taken        = max(0, floor(monster.attack * (0.5 + rand*0.7) - defense_stat * 0.5))
swing_secs   = max(0.5, 1 - armour_speed) - 0.15
max_hp       = 30 + (combat_level - 1) * 6
plus scaling = defense 1 + 0.1%·p · light attack 1 + 5%·min(p,20) + 1%·max(p-20,0)
```

4 000 trials per matchup, tier-appropriate weapon, `plus 0`, tier-median monster.
Full output: `docs/overhaul/v4/v3-baseline-simulation.json`.

### Result: Heavy armour is strictly dominated at every one of the 16 tiers

| Tier | Heavy kill / HP lost / kills survived | Light kill / HP lost / kills survived | Light XP/min advantage |
|---|---|---|---|
| 2 | 16.5 s / 201 / 0.4 | 10.5 s / 213 / 0.4 | +57 % |
| 5 | 12.6 s / 205 / 1.3 | 7.6 s / 313 / 0.8 | +65 % |
| 9 | 15.6 s / 491 / 1.0 | 8.4 s / 710 / 0.7 | +86 % |
| 13 | 13.7 s / 438 / 1.7 | 7.7 s / 717 / 1.0 | +78 % |
| 16 | 13.3 s / 491 / 1.9 | 7.6 s / 827 / 1.1 | +74 % |

Three structural faults:

1. **Mitigation is too weak to pay for the lost speed.** Heavy trades ~45 % of
   its kill speed for only ~0.4–0.9 extra kills of survivability. Light wins on
   XP/min by 57–86 % at every tier, so Heavy is never the correct choice.
2. **Speed differentiation dies at tier 9.** Light armour `speed` is capped at
   0.25 from T9 up, and heavy is 0.00 everywhere, so swing time is frozen at
   0.60 s vs 0.85 s for the whole top half of the game.
3. **Upgrading Heavy is near-worthless.** Defense scales at 0.1 % per `plus`
   (+100 → +10 % defense) while Light attack scales 5 % per `plus` to +20.
   Gold spent on Heavy `plus` levels returns almost nothing.

Tiers 2 and 3 are additionally unsurvivable at their own level (0.4–0.8 kills
before death at 84–144 max HP), which forces food spam through the early game.

## Status

Phases 1, 3 and 4 are complete and read-only. Nothing in production changed.
Phases 2 and 5–8 are blocked pending the owner ingredient matrix and sign-off
on the balance direction above.
