# TOMLANDIA v2 — Gate 0 release lock

Status: **LOCKED on an isolated branch; not approved for merge or deployment**  
Lock date: `2026-08-23`  
Release: `tomlandia-v2`  
Release owner: `Abunarna`  

This directory is the Gate 0 implementation record for the progression overhaul. It freezes the work boundary and removes permission for later implementation steps to invent missing values. It does not change application code, database state, content, dependencies, assets, or deployment configuration.

## Hard execution boundary

- Gate 0 only.
- No production database writes.
- No merge to `main`.
- No publishing or deployment.
- No Lovable-agent prompts or credit-spending actions.
- No gameplay/content implementation until its required gate is approved.
- Balance-dependent values explicitly assigned to Gate 3 are not guesses and must not be filled by an implementation agent.

## Frozen evidence

| Evidence | Locked value |
|---|---|
| Repository | `Abunarna/tomlandia` |
| Audited code commit | `17b28162c4e83b86752a4b3de4f87792f7323165` |
| Gate 0 branch base | `d9a212196897ac85c6915f024263be46757aa1e9` |
| Delta after audit | One commit; `README.md` only; 196 additions and 11 deletions |
| Lovable project | `10d00f6b-da27-43c4-a205-c0b7841a64fc` |
| Production database | Supabase enabled; no Gate 0 query or mutation required |

The README-only delta is accepted as intentional documentation drift. The audited application, database, configuration, dependency and asset baseline is therefore still commit `17b28162c4e83b86752a4b3de4f87792f7323165`.

### Handoff hashes

| Artifact | SHA-256 |
|---|---|
| `tomlandia-full-overhaul-master.md` | `b2e6fc82eec7fb84613462e80f4dd9e2fb8c58fb1c1842d5fcf4ff6b193f9827` |
| `tomlandia-overhaul-read-only-audit.md` | `a487ecbfcb8d4f8065f3cbbdde5caf7610ccbd06fe2d0cae832cd6d2610ccc47` |
| `tomlandia-overhaul-execution-blueprint.md` | `d52b6bedba06a32121a688d33d631b5ebc083379577dba309101c308b352074e` |
| `tomlandia-tier-content-ledger.md` | `72c124e6d8bba8db278f01f3c664452e00b03e1194f3e7c730b81232f8991d40` |
| `tomlandia-creature-sprite-preparation-pack.zip` | `4867eafdcf35df6e74b054120d0084e85670bedaf4e3a2b263815b79983130e1` |

## Ownership and credentials

| Responsibility | Owner/default |
|---|---|
| Release/go-no-go owner | `Abunarna` |
| Implementation operator | Codex, on isolated `codex/*` branches only |
| Verification | Automated evidence prepared by Codex; final go/no-go remains `Abunarna` |
| Production Lovable/Supabase ownership | Confirmed through the project-owner connection |
| GitHub authority | Confirmed admin/push access to `Abunarna/tomlandia` |
| Gate 1 ephemeral database | Repository-owned disposable Supabase test environment; no production credentials |
| Gate 9 staging clone | Separate isolated Supabase project owned by `Abunarna`; provision/credential verification is a Gate 9 prerequisite |

Secrets must never be committed. A missing or unverified credential is a stop condition, not permission to reuse production credentials in staging.

## Operational defaults

- Migration run ID: `tl-v2-{env}-{YYYYMMDDTHHMMSSZ}-{release_sha8}`, where `env` is `stg` or `prd`.
- Expected maintenance window: 30 minutes.
- Hard production downtime budget: 60 minutes. Abort and return to v1 before reopening if the signed runbook cannot finish within that budget.
- Exact pre-cutover snapshot rollback is allowed only while maintenance is still enabled and no v2 play has occurred.
- After reopening, whole-database rollback is forbidden. Re-enable maintenance, switch compatible content/spawn controls if safe, and use a ledgered forward-fix.
- Keep v1 definitions and spawn rows inactive but intact for a minimum 14-day observation/rollback window; extend automatically while an incident remains open.

## Locked player language

Maintenance message:

> Tomlandia is resting while we safely prepare the progression overhaul. Your character, items, upgrades and gold are safe. Please try again soon.

Migration summary lead:

> Tomlandia's progression ladder now reaches level 150. Your existing item quantities, upgrade levels and gold were preserved. Retired equipment was replaced or compensated once. Open the migration summary to see every change made to your character.

The per-player summary must list concrete before/after IDs, quantities, `plus`, locations and compensation. Generic success text cannot replace that ledger.

## Gate 0 exit evidence

- [x] Audited commit frozen.
- [x] Every later intentional delta recorded.
- [x] Release ownership and migration-run naming locked.
- [x] Decision register resolved to `LOCKED` or an explicit future-gate owner; no later prompt may guess deferred values.
- [x] Canonical ID rules and known v2 registry locked.
- [x] Maintenance, notice, downtime and rollback defaults locked.
- [x] Production and staging authority boundaries recorded.
- [x] Gate 0 contains documentation only.

Gate 0 completion does **not** authorize Gate 1, merging, production mutation, publishing or Lovable-agent usage.

