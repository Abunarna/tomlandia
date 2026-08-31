# Production rollback runbook — V3 → V2

Canonical project only.

- Lovable project ID: `10d00f6b-da27-43c4-a205-c0b7841a64fc`
- Supabase project ref: `fhelsfnbvrmnxuynyoqu`
- Production URL: `https://tomlandia.lovable.app`

## Release identity (full hashes, no ellipses)

| Release | Content-manifest SHA-256 | World-spawn SHA-256 |
| --- | --- | --- |
| V3 (currently active) | `f8bc150f0edd4abfdec405dd7f58007d3e9da699100f2ec54cf2ecbd9fa03a0a` | `38d2615e5ce144f70ffe8bf791603afae42b16b0c87fae1da0a1a886d7a8acba` |
| V2 (retired, rollback target) | `8b2b3877e7ae3e7f5202ddfbf703c9f29ccd663d36baf38e5ed4c56352f76ee9` | `24130e8725da5f6e339d5037a40e81f5bcc1052a47fc29b056b36b8d8b2d31fa` |

Both releases keep their own full content, spawn and world rows (369 nodes,
361 monsters each), so rollback is a control-flip only — no data is recreated.

## Order of operations

1. Enable maintenance mode (step 1 SQL) — optional but recommended.
2. Roll the **database** back to V2 (step 2 SQL, single transaction).
3. Republish the **V2 client** (step 3) so no player runs a V3 client against
   V2 data.
4. Clear maintenance mode (step 4).
5. Verify player saves and market listings (step 5).

Database first, client second: the version gate rejects a client whose
`CONTENT_VERSION` is older than `minimum_client_content_version`, so lowering
that value before publishing keeps both the old V3 client and the new V2 client
able to connect during the publish window.

## Step 1 — maintenance mode on (safe, reversible)

```sql
BEGIN;

UPDATE public.game_release_control
SET maintenance_mode = true,
    maintenance_message = 'Tomlandia is briefly offline while we roll back to the previous release.',
    updated_at = now()
WHERE singleton;

COMMIT;
```

## Step 2 — atomic database rollback

```sql
BEGIN;

-- Preconditions: V3 must be the active release, V2 must be present and intact.
DO $rollback_guard$
BEGIN
  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> 'v3' THEN
    RAISE EXCEPTION 'Rollback aborted: v3 is not the active content version';
  END IF;
  IF (SELECT active_spawn_set_version FROM public.game_content_control WHERE singleton) <> 'v3' THEN
    RAISE EXCEPTION 'Rollback aborted: v3 is not the active spawn set';
  END IF;
  IF (SELECT status FROM public.game_content_versions WHERE content_version = 'v2') IS DISTINCT FROM 'retired' THEN
    RAISE EXCEPTION 'Rollback aborted: v2 is not present as a retired release';
  END IF;
  IF (SELECT manifest_hash FROM public.game_content_versions WHERE content_version = 'v2')
     <> '8b2b3877e7ae3e7f5202ddfbf703c9f29ccd663d36baf38e5ed4c56352f76ee9' THEN
    RAISE EXCEPTION 'Rollback aborted: v2 manifest hash does not match the released artifact';
  END IF;
  IF (SELECT spawn_hash FROM public.game_world_spawn_sets
      WHERE content_version = 'v2' AND spawn_set_version = 'v2')
     <> '24130e8725da5f6e339d5037a40e81f5bcc1052a47fc29b056b36b8d8b2d31fa' THEN
    RAISE EXCEPTION 'Rollback aborted: v2 spawn hash does not match the released artifact';
  END IF;
  IF (SELECT count(*) FROM public.game_content_spawns WHERE content_version = 'v2') <> 730 THEN
    RAISE EXCEPTION 'Rollback aborted: v2 spawn set is incomplete';
  END IF;
  IF (SELECT count(*) FROM public.game_world_nodes WHERE content_version = 'v2') <> 369
     OR (SELECT count(*) FROM public.game_world_monsters WHERE content_version = 'v2') <> 361 THEN
    RAISE EXCEPTION 'Rollback aborted: v2 world state is incomplete';
  END IF;
END
$rollback_guard$;

-- Only one row may hold status 'active' (game_content_versions_one_active_idx),
-- so v3 must be retired BEFORE v2 is re-activated, inside this transaction.
UPDATE public.game_content_versions
SET status = 'retired'
WHERE content_version = 'v3';

UPDATE public.game_content_versions
SET status = 'active'
WHERE content_version = 'v2';

-- Matching content + spawn-set control values, flipped together.
UPDATE public.game_content_control
SET active_content_version = 'v2',
    active_spawn_set_version = 'v2',
    minimum_client_content_version = 'v2',
    manifest_hash = '8b2b3877e7ae3e7f5202ddfbf703c9f29ccd663d36baf38e5ed4c56352f76ee9',
    activation_timestamp = now(),
    migration_run_id = 'v3-rollback-to-v2'
WHERE singleton;

UPDATE public.game_release_control
SET minimum_client_content_version = 'v2',
    updated_at = now()
WHERE singleton;

-- Postconditions.
DO $rollback_exit$
BEGIN
  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> 'v2'
     OR (SELECT active_spawn_set_version FROM public.game_content_control WHERE singleton) <> 'v2'
     OR (SELECT minimum_client_content_version FROM public.game_content_control WHERE singleton) <> 'v2' THEN
    RAISE EXCEPTION 'Rollback failed: control row did not repoint to v2';
  END IF;
  IF (SELECT status FROM public.game_content_versions WHERE content_version = 'v2') <> 'active' THEN
    RAISE EXCEPTION 'Rollback failed: v2 is not active';
  END IF;
  IF (SELECT status FROM public.game_content_versions WHERE content_version = 'v3') <> 'retired' THEN
    RAISE EXCEPTION 'Rollback failed: v3 is not retired';
  END IF;
  IF (SELECT count(*) FROM public.game_content_versions WHERE status = 'active') <> 1 THEN
    RAISE EXCEPTION 'Rollback failed: exactly one active release is required';
  END IF;
  IF (SELECT count(*) FROM public.game_content_spawns WHERE content_version = 'v3') <> 730 THEN
    RAISE EXCEPTION 'Rollback failed: v3 rollback-forward data was modified';
  END IF;
END
$rollback_exit$;

COMMIT;
```

## Step 3 — republish the V2 client

The client is pinned to a release by the generated files
`src/generated/content-manifest.ts` (`CONTENT_VERSION`, `SPAWN_SET_VERSION`,
`CONTENT_MANIFEST_HASH`) and `src/generated/world-manifest.ts`
(`SPAWN_SET_VERSION`, `WORLD_SPAWN_HASH`).

```bash
bun run identity:check                      # canonical project guard
git checkout <last-v2-client-commit> -- \
  src/generated/content-manifest.ts \
  src/generated/world-manifest.ts \
  src/generated/content-catalog.ts
bun run typecheck && bun run build
```

Then publish from the Lovable editor (Publish → Update) to
`https://tomlandia.lovable.app`. Confirm the served bundle reports
`CONTENT_VERSION = "v2"` and world-spawn hash
`24130e8725da5f6e339d5037a40e81f5bcc1052a47fc29b056b36b8d8b2d31fa`.

## Step 4 — clear maintenance mode

Only after the V2 client is live and loads past the version gate:

```sql
BEGIN;

UPDATE public.game_release_control
SET maintenance_mode = false,
    maintenance_message = '',
    updated_at = now()
WHERE singleton;

COMMIT;
```

If the smoke test fails, leave maintenance mode **on** and investigate; the
control row is already back on V2 and no player data has been touched.

## Step 5 — post-rollback verification (read-only)

```sql
SELECT active_content_version, active_spawn_set_version,
       minimum_client_content_version, maintenance_mode, manifest_hash
FROM public.game_content_control WHERE singleton;

SELECT content_version, status FROM public.game_content_versions ORDER BY content_version;

SELECT (SELECT count(*) FROM public.player_saves)    AS player_saves,
       (SELECT count(*) FROM public.market_listings) AS market_listings,
       (SELECT count(*) FROM public.game_world_nodes    WHERE content_version = 'v2') AS v2_nodes,
       (SELECT count(*) FROM public.game_world_monsters WHERE content_version = 'v2') AS v2_monsters;
```

Expected: `v2 / v2 / v2`, maintenance off, manifest hash
`8b2b3877e7ae3e7f5202ddfbf703c9f29ccd663d36baf38e5ed4c56352f76ee9`,
`v2_nodes = 369`, `v2_monsters = 361`, and player-save / market-listing counts
unchanged from the pre-rollback reading (22 saves, 18 listings at the time of
writing). Player saves and market listings are never rewritten by a rollback —
they are release-independent rows, and `market_listings.content_version`
retains the version each listing was created under.
