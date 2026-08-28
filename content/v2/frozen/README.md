# Frozen V2-cut world source

`data.ts` and `city.ts` here are byte-identical copies of `src/game/data.ts` and
`src/game/city.ts` as they existed at the V2 content cut (commit `4ce6890`).

| file | sha256 |
| --- | --- |
| `data.ts` | `0babb7e09063dbe1d7973c8ec6e584df38f1fa362312df72baf12f8f8c16cf8f` |
| `city.ts` | `49e00aeef143d77c05448c48b4dda066c8440ddb724eb2a053c3270bfde1f4e5` |

They are the canonical generator input for content version `v2` / spawn set `v2`
(manifest hash `8b2b3877…f76ee9`, spawn hash `24130e87…2d31fa`, 369 node spawns,
361 monster spawns).

Rules:

- Never edit these files. Gameplay/terrain changes belong in `src/game/`.
- A released content version must never be re-derived from mutable runtime
  source; doing so silently re-rolls spawn placement and breaks the live hashes.
- A future content version (v3+) gets its own frozen snapshot directory.

`types.ts` is a type-only re-export of `src/game/types.ts` so `data.ts` can keep
its original `./types` import and remain byte-identical.
