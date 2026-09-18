import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { characterTestAvatarManifest } from "@/game/avatar-character-test-manifest";
import {
  loadCharacterCreationDraft,
  saveCharacterCreationDraft,
} from "@/game/avatar-creation-draft";
import {
  PlayerAvatarRenderer,
  type AvatarModel,
  type PlayerVisualState,
} from "@/game/player-avatar";

export const Route = createFileRoute("/character-test")({
  head: () => ({
    meta: [
      { title: "Create your adventurer — Tomlandia" },
      { name: "description", content: "Choose your Tomlandia adventurer's appearance." },
    ],
  }),
  component: CharacterCreationRoute,
});

const skinTones = [
  { name: "Light", value: "#f2c9a5" },
  { name: "Warm light", value: "#dca77e" },
  { name: "Warm medium", value: "#bb7b58" },
  { name: "Deep", value: "#8b5138" },
  { name: "Rich deep", value: "#5b3328" },
] as const;
const hairColours = [
  { name: "Black", value: "#35251e" },
  { name: "Brown", value: "#70452d" },
  { name: "Auburn", value: "#b66a35" },
  { name: "Blonde", value: "#d3b168" },
  { name: "Silver", value: "#d7d4cb" },
  { name: "Burgundy", value: "#722f3e" },
  { name: "Ocean blue", value: "#385b66" },
  { name: "Violet", value: "#6b467f" },
] as const;

function CharacterCreationRoute() {
  return <CharacterCreator />;
}

function AvatarPreview({ state }: { state: PlayerVisualState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useMemo(() => new PlayerAvatarRenderer(characterTestAvatarManifest), []);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void renderer.preload().then(() => active && setReady(renderer.loadState === "ready"));
    return () => {
      active = false;
    };
  }, [renderer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#d9c8ef");
    gradient.addColorStop(0.62, "#b8d89f");
    gradient.addColorStop(1, "#78985f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(65, 53, 70, 0.2)";
    ctx.beginPath();
    ctx.ellipse(160, 270, 66, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    if (ready) renderer.draw(ctx, state, 160, 270, 300);
  }, [ready, renderer, state]);

  return (
    <div className="relative overflow-hidden rounded-[2rem] border-4 border-[#fff5d6] bg-[#b8d89f] shadow-[0_24px_60px_rgba(46,35,57,0.28)]">
      <canvas
        ref={canvasRef}
        width={320}
        height={320}
        className="block aspect-square w-full [image-rendering:pixelated]"
        aria-label="Character preview"
      />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-[#30283d]/70 font-bold text-white">
          Preparing preview…
        </div>
      )}
      <div className="absolute inset-x-4 bottom-4 rounded-full bg-[#fff9e9]/90 px-4 py-2 text-center text-xs font-black uppercase tracking-[0.15em] text-[#604e66] shadow">
        Live avatar preview
      </div>
    </div>
  );
}

function Swatches({
  label,
  colours,
  value,
  onChange,
}: {
  label: string;
  colours: readonly { name: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-black text-[#4c3d52]">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {colours.map((colour) => (
          <button
            key={colour.value}
            type="button"
            onClick={() => onChange(colour.value)}
            aria-label={`${label}: ${colour.name}`}
            title={colour.name}
            aria-pressed={value === colour.value}
            className={`h-11 w-11 rounded-full border-4 shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6e4f78] ${value === colour.value ? "border-[#6e4f78] ring-2 ring-[#d5b4dd]" : "border-white"}`}
            style={{ backgroundColor: colour.value }}
          />
        ))}
      </div>
    </fieldset>
  );
}

function CandidateAssetGallery() {
  const groups = [
    {
      label: "Body-layer PNGs",
      entries: [
        {
          id: "female-skin",
          label: "Female skin",
          url: characterTestAvatarManifest.bodies.female.skinUrl,
        },
        {
          id: "female-modesty",
          label: "Female modesty",
          url: characterTestAvatarManifest.bodies.female.modestyUrl,
        },
        {
          id: "male-skin",
          label: "Male skin",
          url: characterTestAvatarManifest.bodies.male.skinUrl,
        },
        {
          id: "male-modesty",
          label: "Male modesty",
          url: characterTestAvatarManifest.bodies.male.modestyUrl,
        },
      ],
    },
    {
      label: "Male face PNGs",
      entries: characterTestAvatarManifest.faces.filter((face) => face.model === "male"),
    },
    {
      label: "Female face PNGs",
      entries: characterTestAvatarManifest.faces.filter((face) => face.model === "female"),
    },
    { label: "Hairstyle PNGs", entries: characterTestAvatarManifest.hairstyles },
  ];

  return (
    <section className="mt-8 rounded-[2rem] border border-white/80 bg-[#fffaf0]/90 p-5 shadow-[0_20px_55px_rgba(72,52,79,0.12)] sm:p-7">
      <div className="max-w-3xl">
        <div className="text-xs font-black uppercase tracking-[0.2em] text-[#785f82]">
          Exact checked-in files
        </div>
        <h2 className="mt-1 text-2xl font-black">Candidate pixel-art source layers</h2>
        <p className="mt-2 text-sm font-semibold text-[#715f73]">
          These are the real transparent PNGs from <code>candidate-v1/review</code>, shown without
          redrawing or vector substitutes. The checkerboard only reveals transparency.
        </p>
      </div>

      <div className="mt-6 space-y-7">
        {groups.map((group) => (
          <div key={group.label}>
            <h3 className="mb-3 text-sm font-black uppercase tracking-wide">{group.label}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {group.entries.map((entry) => (
                <figure key={entry.id} className="rounded-2xl border border-[#d8cad8] bg-white p-2">
                  <div className="aspect-square overflow-hidden rounded-xl bg-[conic-gradient(#e5e0e7_25%,#fff_0_50%,#e5e0e7_0_75%,#fff_0)] bg-[length:16px_16px]">
                    <img
                      src={entry.url}
                      alt={`${entry.label} candidate pixel-art layer`}
                      className="size-full object-contain [image-rendering:pixelated]"
                      loading="lazy"
                    />
                  </div>
                  <figcaption className="mt-2 text-center text-xs font-black text-[#604e66]">
                    {entry.label}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CharacterCreator() {
  const [model, setModel] = useState<AvatarModel>("female");
  const [faceIndex, setFaceIndex] = useState(0);
  const [hairIndex, setHairIndex] = useState(0);
  const [skinTone, setSkinTone] = useState("#dca77e");
  const [hairColour, setHairColour] = useState("#35251e");
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const faces = characterTestAvatarManifest.faces.filter((face) => face.model === model);
  const hairs = characterTestAvatarManifest.hairstyles;
  const face = faces[faceIndex % faces.length] ?? characterTestAvatarManifest.faces[0];
  const hair = hairs[hairIndex % hairs.length] ?? characterTestAvatarManifest.hairstyles[0];
  if (!face || !hair) throw new Error("Avatar creator requires registered faces and hairstyles");

  useEffect(() => {
    const draft = loadCharacterCreationDraft(localStorage, characterTestAvatarManifest);
    if (!draft) return;
    const compatibleFaces = characterTestAvatarManifest.faces.filter(
      ({ model: faceModel }) => faceModel === draft.appearance.bodyType,
    );
    setModel(draft.appearance.bodyType);
    setFaceIndex(
      Math.max(
        0,
        compatibleFaces.findIndex(({ id }) => id === draft.appearance.faceVariant),
      ),
    );
    setHairIndex(
      Math.max(
        0,
        characterTestAvatarManifest.hairstyles.findIndex(
          ({ id }) => id === draft.appearance.hairStyle,
        ),
      ),
    );
    setSkinTone(draft.appearance.skinTone);
    setHairColour(draft.appearance.hairColor);
    setName(draft.name);
  }, []);
  const state: PlayerVisualState = {
    appearance: {
      bodyType: model,
      faceVariant: face.id,
      skinTone,
      hairStyle: hair.id,
      hairColor: hairColour,
    },
    equipment: { armour: null, weapon: null },
    activity: "idle",
  };

  const saveDraft = () => {
    saveCharacterCreationDraft(localStorage, characterTestAvatarManifest, {
      version: 1,
      name: name.trim(),
      appearance: state.appearance,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  return (
    <main className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,#eadff4_0,#d7ead0_42%,#f5ead4_100%)] px-4 py-6 text-[#3d3244] sm:px-6 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-[#785f82]">
              Tomlandia
            </div>
            <h1 className="text-3xl font-black sm:text-4xl">Candidate pixel-art test</h1>
            <p className="mt-1 text-sm font-semibold text-[#715f73]">
              Review the checked-in body, face, and hairstyle PNGs on the layered renderer.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Link
              to="/play"
              className="rounded-full border border-[#ad93b2] bg-white/75 px-4 py-2 text-center text-sm font-black text-[#624b6b]"
            >
              Back to game
            </Link>
            <Link
              to="/avatar-lab"
              className="hidden rounded-full border border-[#ad93b2] bg-white/60 px-4 py-2 text-sm font-black text-[#624b6b] sm:block"
            >
              Open Avatar Lab
            </Link>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.85fr)_minmax(420px,1.15fr)]">
          <section className="lg:sticky lg:top-8 lg:self-start">
            <AvatarPreview state={state} />
            <div className="mt-4 rounded-2xl border border-white/70 bg-white/55 p-4 text-center">
              <strong className="block text-xl">{name.trim() || "Your adventurer"}</strong>
              <span className="text-sm font-bold text-[#76647a]">
                Bald base + {hair.label} overlay
              </span>
            </div>
          </section>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveDraft();
            }}
            className="rounded-[2rem] border border-white/80 bg-[#fffaf0]/90 p-5 shadow-[0_20px_55px_rgba(72,52,79,0.16)] sm:p-7"
          >
            <label className="block text-sm font-black text-[#4c3d52]">
              Character name
              <input
                value={name}
                maxLength={18}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter a name"
                aria-describedby="character-name-hint"
                className="mt-2 h-12 w-full rounded-2xl border-2 border-[#d9c9d8] bg-white px-4 text-base font-bold outline-none transition focus:border-[#896a92] focus:ring-4 focus:ring-[#d9c6df]/60"
              />
              <span
                id="character-name-hint"
                className="mt-1 flex justify-between text-xs font-semibold text-[#847286]"
              >
                <span>Required to save this draft</span>
                <span>{name.length}/18</span>
              </span>
            </label>

            <div className="mt-6">
              <div className="mb-2 text-sm font-black">Body model</div>
              <div className="grid grid-cols-2 gap-2">
                {(["female", "male"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={model === option}
                    onClick={() => {
                      setModel(option);
                      setFaceIndex(0);
                    }}
                    className={`rounded-2xl border-2 px-4 py-3 font-black capitalize transition ${model === option ? "border-[#72577b] bg-[#80628a] text-white shadow" : "border-[#ded0dc] bg-white text-[#604e66] hover:border-[#ad93b2]"}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-black">Face</span>
                <span className="text-xs font-bold text-[#88758a]">
                  {faceIndex + 1} of {faces.length}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {faces.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={faceIndex === index}
                    onClick={() => setFaceIndex(index)}
                    className={`rounded-xl border-2 py-3 text-sm font-black ${faceIndex === index ? "border-[#72577b] bg-[#e8d7eb]" : "border-[#e2d7df] bg-white"}`}
                  >
                    Face {index + 1}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-black">Hairstyle</span>
                <span className="text-xs font-bold text-[#88758a]">{hair.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {hairs.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={hairIndex === index}
                    onClick={() => setHairIndex(index)}
                    className={`min-h-12 rounded-xl border-2 px-2 py-2 text-xs font-black ${hairIndex === index ? "border-[#72577b] bg-[#e8d7eb]" : "border-[#e2d7df] bg-white"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <Swatches
                label="Skin tone"
                colours={skinTones}
                value={skinTone}
                onChange={setSkinTone}
              />
              <Swatches
                label="Hair colour"
                colours={hairColours}
                value={hairColour}
                onChange={setHairColour}
              />
            </div>

            <div className="mt-8 border-t border-[#ded1dc] pt-5">
              <button
                type="submit"
                disabled={!name.trim()}
                className="h-14 w-full rounded-2xl bg-[#72577b] px-6 text-lg font-black text-white shadow-[0_9px_0_#4d3b54] transition enabled:hover:-translate-y-0.5 enabled:active:translate-y-1 enabled:active:shadow-[0_4px_0_#4d3b54] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {saved ? "Draft saved ✓" : "Save this adventurer"}
              </button>
              <p
                aria-live="polite"
                className="mt-3 text-center text-xs font-semibold text-[#847286]"
              >
                Prototype only—this does not replace your live character yet.
                {saved && " Draft saved in this browser."}
              </p>
            </div>
          </form>
        </div>
        <CandidateAssetGallery />
      </div>
    </main>
  );
}
