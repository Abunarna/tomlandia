import { createFileRoute, redirect } from "@tanstack/react-router";

/** Compatibility route: the reviewer now lives at /character-test. */
export const Route = createFileRoute("/character-creation")({
  beforeLoad: () => {
    throw redirect({ to: "/character-test", replace: true });
  },
});
