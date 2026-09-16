import { createFileRoute, Link } from "@tanstack/react-router";
import { KNIGHT_ANIMS, type KnightAnim } from "@/game/knight";

export const Route = createFileRoute("/character-creation")({
  head: () => ({
    meta: [
      { title: "Character Creation Review — Abunaria" },
      {
        name: "description",
        content:
          "Internal review screen for the Abunaria character creation flow, showing the knight animation set.",
      },
      { property: "og:title", content: "Character Creation Review — Abunaria" },
      {
        property: "og:description",
        content:
          "Internal review screen for the Abunaria character creation flow, showing the knight animation set.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CharacterCreationReview,
});

const ANIMS: KnightAnim[] = ["idle", "walk", "attack", "mine", "chop", "loot"];

function CharacterCreationReview() {
  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Internal review
          </p>
          <h1 className="text-2xl font-black sm:text-3xl">Character creation</h1>
          <p className="text-sm text-muted-foreground">
            Temporary review screen for the character setup flow. This is not the production
            onboarding experience.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          {ANIMS.map((anim) => (
            <div
              key={anim}
              className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-soft"
            >
              <p className="text-sm font-bold capitalize">{anim}</p>
              <p className="text-xs text-muted-foreground">
                {KNIGHT_ANIMS[anim].frames} frames · {KNIGHT_ANIMS[anim].fps} fps
              </p>
            </div>
          ))}
        </section>

        <Link
          to="/play"
          className="inline-flex items-center rounded-xl border border-border/60 bg-card/80 px-4 py-2 text-sm font-bold"
        >
          Back to game
        </Link>
      </div>
    </main>
  );
}
