import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AvatarPreview } from "@/components/character/AvatarPreview";
import {
  BODY_MODELS,
  DEFAULT_DRAFT,
  DRAFT_STORAGE_KEY,
  FACES,
  HAIRSTYLES,
  HAIR_COLORS,
  SKIN_TONES,
  type BodyModel,
  type CharacterDraft,
} from "@/game/avatar";

export const Route = createFileRoute("/character-test")({
  head: () => ({
    meta: [
      { title: "Character Art Reviewer — Abunaria" },
      {
        name: "description",
        content:
          "Interactive character-art reviewer for Abunaria: body models, faces, hairstyles, skin and hair colours with a live layered preview.",
      },
      { property: "og:title", content: "Character Art Reviewer — Abunaria" },
      {
        property: "og:description",
        content:
          "Interactive character-art reviewer for Abunaria: body models, faces, hairstyles, skin and hair colours with a live layered preview.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CharacterTestPage,
});

function Swatch({
  color,
  label,
  active,
  onClick,
}: {
  color: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`size-8 rounded-full border-2 transition ${
        active ? "border-primary ring-2 ring-primary/40" : "border-border/60"
      }`}
      style={{ backgroundColor: color }}
    />
  );
}

function OptionButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
        active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border/60 bg-card/70 text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function CharacterTestPage() {
  const [draft, setDraft] = useState<CharacterDraft>(DEFAULT_DRAFT);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) setDraft({ ...DEFAULT_DRAFT, ...JSON.parse(raw) });
    } catch {
      /* ignore malformed drafts */
    }
  }, []);

  const setModel = (model: BodyModel) =>
    setDraft((d) => ({ ...d, model, faceId: FACES[model][0]!.id }));

  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const saveDraft = () => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      setSaveMsg("Character draft saved on this device");
    } catch {
      setSaveMsg("Could not save the draft on this device");
    }
  };

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-8 sm:py-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Internal review
            </p>
            <h1 className="text-2xl font-black sm:text-3xl">Character art reviewer</h1>
          </div>
          <Link
            to="/play"
            className="inline-flex items-center rounded-xl border border-border/60 bg-card/80 px-4 py-2 text-sm font-bold"
          >
            Back to game
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
          <section className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-soft">
            <div className="mx-auto aspect-[200/260] w-full max-w-[280px]">
              <AvatarPreview draft={draft} />
            </div>
            <p className="mt-3 text-center text-sm font-bold">
              {draft.name.trim() || "Unnamed adventurer"}
            </p>
          </section>

          <div className="space-y-5">
            <section className="space-y-2">
              <h2 className="text-sm font-black uppercase tracking-wide">Body model</h2>
              <div className="flex flex-wrap gap-2">
                {BODY_MODELS.map((m) => (
                  <OptionButton key={m.id} active={draft.model === m.id} onClick={() => setModel(m.id)}>
                    {m.name}
                  </OptionButton>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-black uppercase tracking-wide">Face</h2>
              <div className="flex flex-wrap gap-2">
                {FACES[draft.model].map((f) => (
                  <OptionButton
                    key={f.id}
                    active={draft.faceId === f.id}
                    onClick={() => setDraft((d) => ({ ...d, faceId: f.id }))}
                  >
                    {f.name}
                  </OptionButton>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-black uppercase tracking-wide">Hairstyle</h2>
              <div className="flex flex-wrap gap-2">
                {HAIRSTYLES.map((h) => (
                  <OptionButton
                    key={h.id}
                    active={draft.hairId === h.id}
                    onClick={() => setDraft((d) => ({ ...d, hairId: h.id }))}
                  >
                    {h.name}
                  </OptionButton>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-black uppercase tracking-wide">Skin tone</h2>
              <div className="flex flex-wrap gap-2">
                {SKIN_TONES.map((s) => (
                  <Swatch
                    key={s.id}
                    color={s.color}
                    label={`Skin tone ${s.name}`}
                    active={draft.skin === s.color}
                    onClick={() => setDraft((d) => ({ ...d, skin: s.color }))}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-black uppercase tracking-wide">Hair colour</h2>
              <div className="flex flex-wrap gap-2">
                {HAIR_COLORS.map((c) => (
                  <Swatch
                    key={c.id}
                    color={c.color}
                    label={`Hair colour ${c.name}`}
                    active={draft.hairColor === c.color}
                    onClick={() => setDraft((d) => ({ ...d, hairColor: c.color }))}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <label htmlFor="character-name" className="block text-sm font-black uppercase tracking-wide">
                Character name
              </label>
              <input
                id="character-name"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                maxLength={24}
                placeholder="Name your adventurer"
                className="w-full max-w-sm rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </section>

            <button
              type="button"
              onClick={saveDraft}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground"
            >
              Save draft
            </button>
            {saveMsg && (
              <p role="status" className="text-xs font-semibold text-muted-foreground">
                {saveMsg}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
