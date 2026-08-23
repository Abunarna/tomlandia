# Expected-red baseline

Gate 1 is a detection gate. Its CI database job is expected to fail until Gate 2 repairs the following authoritative routines/data.

| Probe | Current evidence | Gate 2 success condition |
|---|---|---|
| `attack_monster` canonical response | Final migration emits `levelup`, `level`, and `save`; it omits response keys `leveled`, `state`, and `buff`. | Final return emits canonical keys and the runtime schema accepts it. |
| Potion effects | Five current `kind = 'potion'` rows have null `dmg_boost`/`boost_hits`. | Each current potion ID has positive, reviewed effect metadata. |
| Anonymous leaderboard execution | `leaderboard(text)` was granted to `authenticated` without first revoking the default `PUBLIC` execute privilege. | Anonymous and `PUBLIC` cannot execute it; authenticated can. |
| Position helper boundary | `track_position(uuid,numeric,numeric)` is directly executable by `authenticated`. | The helper is internal and binds identity to `auth.uid()`. |

The first two rows are mandatory Gate 1 exit evidence. The latter two are the role-test evidence for already documented Gate 2 security work.
