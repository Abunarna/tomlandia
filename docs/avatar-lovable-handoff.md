# Lovable avatar handoff

The connected Lovable project must receive the complete avatar change set, not
an individual development commit hash. The authoritative tree contains:

- `src/routes/character-test.tsx`;
- `src/game/avatar-character-test-manifest.ts`;
- `tests/contracts/avatar-character-test-entry.test.mjs`;
- `tests/contracts/avatar-character-test-manifest.test.ts`; and
- `public/assets/avatar/candidate-v1/review/`, including eight fitted face PNGs
  and ten fitted hairstyle PNGs.

After the GitHub pull request containing this tree is merged into the branch
connected to Lovable, run `bun run avatar:character-test-check`. Do not ask
Lovable to reproduce missing files, invent labels, generate replacement art, or
perform a visual inspection. A missing-file result means the GitHub change set
has not reached Lovable's connected branch yet.
