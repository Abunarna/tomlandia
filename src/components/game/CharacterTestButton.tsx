/**
 * TEMPORARY internal review entry point.
 * Opens the character-creation review screen from the gameplay HUD.
 * Not the production character onboarding flow.
 */
import { Link } from "@tanstack/react-router";
import { UserRoundCog } from "lucide-react";

export function CharacterTestButton() {
  return (
    <div className="pointer-events-auto absolute left-2 top-24 z-40 text-xs">
      <Link
        to="/character-creation"
        aria-label="Open character creation review screen"
        className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/90 px-2 py-1 font-semibold text-foreground backdrop-blur-md sm:px-2.5 sm:py-1.5"
      >
        <UserRoundCog className="size-3.5 shrink-0" />
        <span className="whitespace-nowrap">Character test</span>
      </Link>
    </div>
  );
}
