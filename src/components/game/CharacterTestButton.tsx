import { UserRoundSearch } from "lucide-react";

/** Temporary entry point for reviewing the candidate character customisation UI. */
export function CharacterTestButton() {
  return (
    <div className="pointer-events-auto absolute left-2 top-24 z-40">
      <a
        href="/character-test"
        aria-label="Open character test"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/90 px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <UserRoundSearch className="size-3.5" aria-hidden="true" />
        Character test
      </a>
    </div>
  );
}
