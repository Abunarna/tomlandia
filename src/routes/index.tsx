import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tomlandia — Cozy Pixel Idle RPG" },
      {
        name: "description",
        content:
          "Explore the Peaceful Fields, mine copper, chop oak, battle goblins and take on quests from the folk of Grand Haven in Tomlandia.",
      },
      { property: "og:title", content: "Tomlandia — Cozy Pixel Idle RPG" },
      {
        property: "og:description",
        content: "Gather, fight and quest your way through a cozy pixel world on your phone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Title,
});

function Title() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // Never let the splash hang: if the session check is slow, show Play anyway.
    const fallback = window.setTimeout(() => {
      if (mounted.current) setChecking(false);
    }, 2500);
    void import("@/integrations/supabase/client").then(async ({ supabase }) => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted.current) return;
        if (data.session) navigate({ to: "/play", replace: true });
      } catch {
        /* fall through to the Play button */
      } finally {
        if (mounted.current) setChecking(false);
      }
    });
    return () => {
      mounted.current = false;
      window.clearTimeout(fallback);
    };
  }, [navigate]);


  const go = useCallback(() => navigate({ to: "/auth" }), [navigate]);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 text-center">
      <h1 className="font-display text-5xl font-extrabold text-foreground">Tomlandia</h1>
      <p className="mt-3 max-w-xs text-sm text-muted-foreground">
        A cozy pixel world of mining, woodcutting, crafting and gentle adventure.
      </p>
      {!checking && (
        <button
          onClick={go}
          className="mt-8 rounded-2xl bg-primary px-8 py-3 font-semibold text-primary-foreground shadow-soft active:scale-95"
        >
          Play
        </button>
      )}
    </main>
  );
}
