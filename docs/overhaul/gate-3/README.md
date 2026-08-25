# Gate 3 — deterministic balance proposal

- Status: **OWNER APPROVED FOR GATE 4 — RUNTIME NOT ACTIVE**
- Model: `tomlandia-v2-gate3-proposal-1`
- Hash: `e1fbe19aac61014b38885ce38cd16d9a12e3852f24858301a2588c65fba4a640`

This gate contains balance data and deterministic evidence only. It changes no client content, SQL migration, production row, deployment, or Lovable project. The immutable proposal snapshot retains its pre-approval guard; `approval-record.json` separately approves this exact hash for Gate 4 implementation only. Runtime activation remains forbidden.

## Proposed active-play targets

Targets apply to each benchmark skill independently; effective action cycles include the modeled travel, respawn, retarget, menu, and material overhead recorded in the JSON.

| Level reached | Cumulative active hours | Minutes per level in preceding band |
|---:|---:|---:|
| 1 | 0.00 | 0.0 |
| 10 | 0.50 | 3.3 |
| 20 | 1.50 | 6.0 |
| 30 | 3.00 | 9.0 |
| 40 | 5.50 | 15.0 |
| 50 | 9.50 | 24.0 |
| 60 | 14.50 | 30.0 |
| 70 | 21.50 | 42.0 |
| 80 | 31.50 | 60.0 |
| 90 | 44.50 | 78.0 |
| 100 | 60.50 | 96.0 |
| 110 | 80.50 | 120.0 |
| 120 | 104.50 | 144.0 |
| 130 | 132.50 | 168.0 |
| 140 | 164.50 | 192.0 |
| 150 | 200.50 | 216.0 |

## Proposed tier table

Light cells are `defense / attack / speed`. Level 150 uses level 149's XP requirement as its reward reference because 150 is the cap.

| Tier index | Level | Theme | XP reference | Weapon atk | Heavy def | Light def/atk/speed | Heavy TTK | Heavy TTD | Food heal | Potion |
|---:|---:|---|---:|---:|---:|---|---:|---:|---:|---|
| 1 | 1 | Copper | 114 | 6 | 5 | 3.3 / 1 / 4% | 3.0s | 24.0s | 15 | +2 × 8 |
| 2 | 10 | Bronze | 404 | 11 | 31 | 20.2 / 7 / 7% | 12.0s | 19.0s | 45 | +3 × 25 |
| 3 | 20 | Iron | 1,636 | 21 | 58 | 37.7 / 13 / 10% | 13.0s | 20.0s | 120 | +5 × 30 |
| 4 | 30 | Steel | 6,621 | 32 | 78 | 50.7 / 18 / 13% | 13.0s | 21.0s | 135 | +7 × 30 |
| 5 | 40 | Mithril | 26,786 | 40 | 100 | 65 / 23 / 16% | 14.0s | 22.0s | 155 | +10 × 30 |
| 6 | 50 | Sunsteel | 108,365 | 44 | 116 | 75.4 / 26 / 19% | 15.0s | 22.0s | 180 | +12 × 33 |
| 7 | 60 | Runite | 269,220 | 51 | 132 | 85.8 / 30 / 22% | 15.0s | 23.0s | 210 | +14 × 33 |
| 8 | 70 | Shadowsteel | 432,000 | 57 | 148 | 96.2 / 34 / 25% | 16.0s | 24.0s | 245 | +18 × 35 |
| 9 | 80 | Froststeel | 641,160 | 63 | 161 | 104.7 / 37 / 25% | 16.0s | 25.0s | 300 | +19 × 35 |
| 10 | 90 | Wyrmsteel | 884,008 | 70 | 173 | 112.5 / 39 / 25% | 16.0s | 26.0s | 340 | +22 × 35 |
| 11 | 100 | Glacial | 1,224,000 | 77 | 182 | 118.3 / 41 / 25% | 16.0s | 26.0s | 650 | +30 × 35 |
| 12 | 110 | Starsteel | 1,610,678 | 85 | 194 | 126.1 / 44 / 25% | 16.0s | 27.0s | 700 | +31 × 35 |
| 13 | 120 | Voidsteel | 2,039,874 | 94 | 205 | 133.3 / 47 / 25% | 16.0s | 28.0s | 755 | +33 × 35 |
| 14 | 130 | Wyrmforged | 2,530,762 | 104 | 218 | 141.7 / 50 / 25% | 16.0s | 29.0s | 815 | +38 × 35 |
| 15 | 140 | Ancient | 3,090,619 | 115 | 233 | 151.5 / 53 / 25% | 16.0s | 30.0s | 880 | +43 × 35 |
| 16 | 150 | Ascendant | 3,327,992 | 127 | 245 | 159.3 / 56 / 25% | 15.0s | 30.0s | 950 | +48 × 35 |

## Benchmark and new-monster values

Rows marked `benchmark only` constrain the curve without creating another monster.

| Tier index | Level | New monster ID | HP | Attack | Defense | XP | Gold |
|---:|---:|---|---:|---:|---:|---:|---:|
| 1 | 1 | benchmark only | 22 | 5 | 2 | 34 | 4–12 |
| 2 | 10 | goblin_brute | 184 | 26 | 13 | 300 | 31–68 |
| 3 | 20 | ironback_boar | 377 | 47 | 24 | 609 | 80–179 |
| 4 | 30 | mithril_stalker | 576 | 64 | 32 | 913 | 113–238 |
| 5 | 40 | benchmark only | 797 | 82 | 41 | 1,264 | 156–312 |
| 6 | 50 | desert_raider | 996 | 97 | 48 | 1,583 | 192–374 |
| 7 | 60 | dune_devourer | 1,206 | 111 | 54 | 1,923 | 229–436 |
| 8 | 70 | cursed_knight | 1,426 | 125 | 60 | 2,280 | 267–499 |
| 9 | 80 | frost_troll | 1,640 | 137 | 66 | 2,603 | 304–572 |
| 10 | 90 | frost_revenant | 1,858 | 148 | 71 | 2,916 | 342–652 |
| 11 | 100 | benchmark only | 2,080 | 159 | 77 | 3,230 | 380–735 |
| 12 | 110 | glacial_guardian | 2,292 | 170 | 82 | 3,542 | 417–813 |
| 13 | 120 | wyrm_knight | 2,488 | 180 | 85 | 3,845 | 452–882 |
| 14 | 130 | void_wraith | 2,701 | 191 | 89 | 4,174 | 491–958 |
| 15 | 140 | benchmark only | 2,932 | 203 | 93 | 4,531 | 533–1,040 |
| 16 | 150 | ascendant_wyrm | 3,183 | 215 | 97 | 4,919 | 579–1,128 |

## Economy and upgrade sinks

Item-value cells are `weapon/armour/food/potion`; upgrade cells show weapon `+31/+100`. The complete weapon and armour schedules are in the JSON and tier CSV.

| Tier index | Level | Monster gold/h | Node floor/h | Raw/bar floor | Item values W/A/F/P | Weapon spend +31/+100 | Reach +31/+100 |
|---:|---:|---:|---:|---|---|---|---|
| 1 | 1 | 4,800 | 3,837 | 6/15 | 70/70/12/35 | 28,170 / 160,385 | 5.87h / 33.41h |
| 2 | 10 | 11,880 | 9,184 | 15/35 | 150/165/34/65 | 60,360 / 343,630 | 5.08h / 28.93h |
| 3 | 20 | 29,138 | 20,455 | 35/85 | 360/395/90/135 | 144,905 / 824,770 | 4.97h / 28.31h |
| 4 | 30 | 39,488 | 30,745 | 55/130 | 550/605/95/190 | 221,370 / 1,260,040 | 5.61h / 31.91h |
| 5 | 40 | 49,553 | 37,500 | 70/170 | 720/785/100/275 | 289,800 / 1,649,510 | 5.85h / 33.29h |
| 6 | 50 | 56,600 | 43,714 | 85/205 | 865/950/105/340 | 348,160 / 1,981,710 | 6.15h / 35.01h |
| 7 | 60 | 66,500 | 54,396 | 110/265 | 1120/1225/130/430 | 450,785 / 2,565,890 | 6.78h / 38.58h |
| 8 | 70 | 72,568 | 54,762 | 115/275 | 1165/1275/140/505 | 468,910 / 2,668,985 | 6.46h / 36.78h |
| 9 | 80 | 82,989 | 61,990 | 135/325 | 1375/1505/180/555 | 553,430 / 3,150,070 | 6.67h / 37.96h |
| 10 | 90 | 94,168 | 70,936 | 160/385 | 1630/1780/210/670 | 656,055 / 3,734,275 | 6.97h / 39.66h |
| 11 | 100 | 105,632 | 79,286 | 185/445 | 1885/2060/700/955 | 758,695 / 4,318,495 | 7.18h / 40.88h |
| 12 | 110 | 116,526 | 87,097 | 210/505 | 2135/2335/705/1015 | 859,305 / 4,891,220 | 7.37h / 41.98h |
| 13 | 120 | 126,379 | 94,420 | 235/565 | 2390/2615/710/1085 | 961,945 / 5,475,420 | 7.61h / 43.33h |
| 14 | 130 | 137,274 | 103,247 | 265/635 | 2690/2940/715/1280 | 1,082,705 / 6,162,725 | 7.89h / 44.89h |
| 15 | 140 | 149,021 | 111,555 | 295/710 | 3005/3285/720/1470 | 1,209,475 / 6,884,355 | 8.12h / 46.20h |
| 16 | 150 | 170,700 | 128,571 | 350/840 | 3555/3885/790/1775 | 1,430,850 / 8,144,385 | 8.38h / 47.71h |

## Locked mechanics and rounding

- Levels 1–50 retain `floor(100 × 1.15^level)` exactly. Levels 51–149 derive from the proposed time table, the audited combat formula, a three-second retarget allowance, and the exact monster curve.
- New-monster values use log-linear interpolation between nearest existing level anchors. Values are rounded to integers; levels beyond the final anchor use the final two anchors for extrapolation. Existing monster values are evidence and remain untouched.
- Heavy is solved against the final monster attack curve. Light defense is Heavy × 0.65 rounded to one decimal; attack is rounded Light defense × 0.35; speed uses locked decision D-11.
- Damage expectations use 4,096 fixed midpoint samples of the exact server roll ranges and floor rules, making every run deterministic.
- The +100 cap remains. Weapon upgrades grant 2% per step through +50 then 0.5%; Light armour attack grants 5% per step through +20 then 1%; defense grants 0.1% per step. These rules preserve every observed migrated effective stat without allowing ordinary +31 armour to nullify same-level damage. The cost curve uses a square-root step schedule, not the live exponential doubling formula. NPC resale recovers 40% of base value and 15% of upgrade spend.
- DESOLATUS has no guessed item drop. Its four-player reward budget is a fixed pool split by eligible damage, with a 1% max-HP contribution threshold and per-player caps; Tungsten remains absent.

## Evidence files

- `balance-model.proposed.json`: full machine-readable model, formulas, skill rewards, economy, upgrade sinks, boss, and provenance.
- `progression.proposed.csv`: all 150 level rows.
- `tier-balance.proposed.csv`: exact 16-tier owner approval surface.
- `skill-rewards.proposed.csv`: every skill's actions, XP/action, modeled minutes, and XP/hour at every tier.
- `activity-cadence.proposed.csv`: action overhead plus gathering-node respawn and cluster requirements.
- `sensitivities.proposed.csv`: no-gear, Heavy/Light +0, +31, food, and potion cases.
- `owner-approval-table.md`: compact sign-off table and explicit activation guard.

Run `bun run gate3:check` to rebuild the model in memory, verify invariants, and byte-compare every generated artifact.
