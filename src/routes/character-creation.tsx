import { createFileRoute, redirect } from "@tanstack/react-router";

/** Keep old published review links from landing on the obsolete animation screen. */
export const Route = createFileRoute("/character-creation")({
  beforeLoad: () => {
    throw redirect({ to: "/character-test", replace: true });
  },
});
