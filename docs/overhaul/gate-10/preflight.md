# Gate 10 — player and market migration preflight

Status: **read-only production preflight complete; no player or market row has been changed.**

## Captured cutover values

| Retired ID | Current unit value |
| --- | ---: |
| `wooden_club` | 15 |
| `bronze_dagger` | 40 |
| `sunspire_wand` | 700 |
| `tungsten_maul` | 1500 |
| `tungsten_ore` | 150 |
| `tungsten_bar` | 380 |

## Current aggregate impact

- 15 equipped Wooden Clubs will become equipped Copper Swords preserving `plus`.
- One unequipped Wooden Club will receive 15 gold exactly once.
- No other retired ID or retired market listing was found.
- No `plus > 100`, non-positive stack, or retired gear stack greater than one was found.

The executable migration must re-read values and ownership/listing aggregates only after maintenance begins. This preflight is evidence, not a production constant.
