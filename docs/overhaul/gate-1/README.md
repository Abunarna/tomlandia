# Gate 1 — test and contract foundation

Status: implemented on an isolated Gate 1 branch; not approved for production or `main`.

## What this gate establishes

- Runtime Zod schemas for all 18 application-invoked PostgreSQL RPC requests and responses.
- Strict response parsing at every RPC boundary, including `player_sync`.
- A reviewed contract snapshot tied to the Gate 0 +100 upgrade ceiling.
- Deterministic property-style save fixtures for legacy and edge states.
- A local-only, zero-to-head Supabase migration reset and pgTAP inspection path.
- Authenticated/anonymous execute-privilege tests.
- Explicit red probes for defects that Gate 2, not Gate 1, must repair.

## Commands

```bash
bun install --frozen-lockfile
bun run test
bun run typecheck

supabase start
supabase db reset --local
bun run test:db:foundation
bun run test:db:known-defects
supabase stop --no-backup
```

`test`, `typecheck`, and `test:db:foundation` are expected to be green. `test:db:known-defects` is intentionally red at the Gate 1 baseline. It proves the current database still:

1. returns `levelup`/`save` instead of canonical `leveled`/`state`/`buff` from `attack_monster`;
2. leaves all five live potion metadata rows without non-zero `dmg_boost` and `boost_hits`;
3. exposes the new `leaderboard` routine through the default `PUBLIC` execute grant; and
4. lets `authenticated` callers invoke the internal `track_position(uid, ...)` helper directly.

Those red probes must not be weakened or marked `continue-on-error`. Gate 2 makes them green by correcting SQL and grants.

## Safety boundary

The migration harness uses only the ephemeral local Supabase stack. The workflow never links a hosted project, never reads production secrets, and never runs `db push`, `migration up --linked`, or remote SQL.
