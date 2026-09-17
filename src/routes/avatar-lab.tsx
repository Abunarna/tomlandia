import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import armourerAsset from "@/assets/npc-armourer.png.asset.json";
import smithAsset from "@/assets/npc-smith.png.asset.json";
import tannerAsset from "@/assets/npc-tanner.png.asset.json";
import weaponsmithAsset from "@/assets/npc-weaponsmith.png.asset.json";
import {
  AVATAR_CATALOGUE_EXPECTATION,
  referenceAvatarManifest,
} from "@/game/avatar-reference-manifest";
import { validateAvatarCatalogue } from "@/game/avatar-catalogue-validation";
import { loadAvatarManifest } from "@/game/avatar-manifest-loader";
import { AVATAR_REGISTRATION_MAP, type AvatarBoundary } from "@/game/avatar-registration";
import {
  AVATAR_FOOT_Y,
  AVATAR_PIVOT_X,
  PlayerAvatarRenderer,
  validateAvatarManifest,
  type AvatarModel,
  type AvatarAssetManifest,
  type AvatarRasterLayer,
  type PlayerActivity,
  type PlayerVisualState,
} from "@/game/player-avatar";

export const Route = createFileRoute("/avatar-lab")({
  head: () => ({
    meta: [
      { title: "Avatar Lab — Tomlandia" },
      { name: "description", content: "Development preview for Tomlandia player avatars." },
    ],
  }),
  component: AvatarLabRoute,
});

type PreviewBackground = "checker" | "light" | "dark" | "world";

const backgroundFill: Record<Exclude<PreviewBackground, "checker">, string> = {
  light: "#f6f0df",
  dark: "#29243b",
  world: "#9fc977",
};

function checker(ctx: CanvasRenderingContext2D, width: number, height: number, cell = 16) {
  for (let y = 0; y < height; y += cell) {
    for (let x = 0; x < width; x += cell) {
      ctx.fillStyle = (x / cell + y / cell) % 2 ? "#d9d3df" : "#f3eff5";
      ctx.fillRect(x, y, cell, cell);
    }
  }
}

function activityBubble(
  ctx: CanvasRenderingContext2D,
  manifest: AvatarAssetManifest,
  activity: PlayerActivity,
  x: number,
  y: number,
  scale: number,
) {
  const entry = manifest.activities.find((item) => item.id === activity);
  if (!entry || activity === "idle" || activity === "walk") return;
  const radius = 18 * scale;
  ctx.save();
  ctx.fillStyle = "rgba(255, 252, 242, 0.96)";
  ctx.strokeStyle = "#5b4662";
  ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#4b3548";
  ctx.font = `700 ${Math.max(12, 20 * scale)}px "Baloo 2", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(entry.glyph, x, y + scale);
  ctx.restore();
}

function drawBoundary(
  ctx: CanvasRenderingContext2D,
  boundary: AvatarBoundary,
  scale: number,
  dx: number,
  dy: number,
) {
  ctx.strokeStyle = boundary.colour;
  ctx.beginPath();
  boundary.points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(dx + x * scale, dy + y * scale);
    else ctx.lineTo(dx + x * scale, dy + y * scale);
  });
  ctx.closePath();
  ctx.stroke();
}

function drawGuides(
  ctx: CanvasRenderingContext2D,
  model: AvatarModel,
  scale: number,
  dx: number,
  dy: number,
) {
  const x = dx + AVATAR_PIVOT_X * scale;
  const foot = dy + AVATAR_FOOT_Y * scale;
  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(208, 59, 99, 0.9)";
  ctx.beginPath();
  ctx.moveTo(x, dy);
  ctx.lineTo(x, dy + 384 * scale);
  ctx.stroke();
  ctx.strokeStyle = "rgba(31, 120, 179, 0.9)";
  ctx.beginPath();
  ctx.moveTo(dx, foot);
  ctx.lineTo(dx + 384 * scale, foot);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const boundary of [
    AVATAR_REGISTRATION_MAP.modelEnvelopes[model],
    AVATAR_REGISTRATION_MAP.face,
    AVATAR_REGISTRATION_MAP.hair,
    AVATAR_REGISTRATION_MAP.neckSeam,
    AVATAR_REGISTRATION_MAP.gripSocket,
    AVATAR_REGISTRATION_MAP.weapon,
  ]) {
    drawBoundary(ctx, boundary, scale, dx, dy);
  }
  ctx.restore();
}

function selectedBoundaryChecks(state: PlayerVisualState, manifest: AvatarAssetManifest) {
  const model = state.appearance.bodyType;
  const face = manifest.faces.find((entry) => entry.id === state.appearance.faceVariant);
  const hair = manifest.hairstyles.find((entry) => entry.id === state.appearance.hairStyle);
  const armour = manifest.armour.find((entry) => entry.id === state.equipment.armour);
  const weapon = manifest.weapons.find((entry) => entry.id === state.equipment.weapon);
  return [
    {
      url: manifest.bodies[model].skinUrl,
      boundary: AVATAR_REGISTRATION_MAP.modelEnvelopes[model],
    },
    {
      url: manifest.bodies[model].modestyUrl,
      boundary: AVATAR_REGISTRATION_MAP.modelEnvelopes[model],
    },
    { url: face?.url, boundary: AVATAR_REGISTRATION_MAP.face },
    { url: hair?.url, boundary: AVATAR_REGISTRATION_MAP.hair },
    { url: armour?.urls[model], boundary: AVATAR_REGISTRATION_MAP.modelEnvelopes[model] },
    { url: weapon?.backUrl, boundary: AVATAR_REGISTRATION_MAP.weapon },
    { url: weapon?.frontUrl, boundary: AVATAR_REGISTRATION_MAP.weapon },
  ].filter((check): check is { url: string; boundary: AvatarBoundary } => Boolean(check.url));
}

function boundaryViolationCount(renderer: PlayerAvatarRenderer, state: PlayerVisualState) {
  return selectedBoundaryChecks(state, renderer.manifest).reduce(
    (count, { url, boundary }) => count + renderer.boundaryViolations(url, boundary).length,
    0,
  );
}

function drawViolationHeatmap(
  ctx: CanvasRenderingContext2D,
  renderer: PlayerAvatarRenderer,
  state: PlayerVisualState,
  scale: number,
  dx: number,
  dy: number,
) {
  ctx.save();
  ctx.fillStyle = "rgba(255, 32, 68, 0.82)";
  const pixelSize = Math.max(1, scale);
  for (const { url, boundary } of selectedBoundaryChecks(state, renderer.manifest)) {
    for (const [x, y] of renderer.boundaryViolations(url, boundary)) {
      ctx.fillRect(dx + x * scale, dy + y * scale, pixelSize, pixelSize);
    }
  }
  ctx.restore();
}

type AvatarCanvasProps = {
  renderer: PlayerAvatarRenderer;
  state: PlayerVisualState;
  background: PreviewBackground;
  guides: boolean;
  mode: "source" | "game";
  refresh: number;
  layers: Partial<Record<AvatarRasterLayer, boolean>>;
  heatmap: boolean;
};

function AvatarCanvas({
  renderer,
  state,
  background,
  guides,
  mode,
  refresh,
  layers,
  heatmap,
}: AvatarCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (background === "checker")
      checker(ctx, canvas.width, canvas.height, mode === "source" ? 16 : 10);
    else {
      ctx.fillStyle = backgroundFill[background];
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (background === "world") {
        ctx.fillStyle = "rgba(83, 126, 65, 0.26)";
        for (let x = 4; x < canvas.width; x += 24) ctx.fillRect(x, canvas.height - 35, 10, 3);
      }
    }
    if (mode === "source") {
      renderer.draw(ctx, state, 192, 300, 384, { layers });
      if (heatmap) drawViolationHeatmap(ctx, renderer, state, 1, 0, 0);
      activityBubble(ctx, renderer.manifest, state.activity, 192, 35, 1);
      if (guides) drawGuides(ctx, state.appearance.bodyType, 1, 0, 0);
    } else {
      const height = 145;
      const scale = height / 384;
      const x = canvas.width / 2;
      const foot = canvas.height - 24;
      renderer.draw(ctx, state, x, foot, height, { layers });
      if (heatmap)
        drawViolationHeatmap(
          ctx,
          renderer,
          state,
          scale,
          x - AVATAR_PIVOT_X * scale,
          foot - AVATAR_FOOT_Y * scale,
        );
      activityBubble(ctx, renderer.manifest, state.activity, x, foot - 118, 0.72);
      if (guides)
        drawGuides(
          ctx,
          state.appearance.bodyType,
          scale,
          x - AVATAR_PIVOT_X * scale,
          foot - AVATAR_FOOT_Y * scale,
        );
    }
  }, [background, guides, heatmap, layers, mode, refresh, renderer, state]);

  return (
    <canvas
      ref={ref}
      width={mode === "source" ? 384 : 240}
      height={mode === "source" ? 384 : 210}
      className="h-auto w-full max-w-[384px] rounded-2xl border border-[#6d536c]/25 shadow-inner"
      style={{ imageRendering: "pixelated" }}
      aria-label={mode === "source" ? "384 pixel avatar source preview" : "Avatar at game scale"}
    />
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-[#665268]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-xl border border-[#c9b9c9] bg-[#fffaf0] px-3 text-sm font-bold normal-case tracking-normal text-[#443646] outline-none focus:ring-2 focus:ring-[#8f6ca0]"
      >
        {children}
      </select>
    </label>
  );
}

function ColourField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-[#665268]">
      {label}
      <span className="flex h-11 items-center gap-3 rounded-xl border border-[#c9b9c9] bg-[#fffaf0] px-3">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 w-10 cursor-pointer border-0 bg-transparent"
        />
        <span className="font-mono text-sm normal-case tracking-normal">{value}</span>
      </span>
    </label>
  );
}

function AvatarLabRoute() {
  if (!import.meta.env.DEV && import.meta.env["VITE_AVATAR_LAB"] !== "true") {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <div>
          <h1 className="text-3xl font-extrabold">Avatar Lab is disabled</h1>
          <p className="mt-2 text-muted-foreground">This development tool is not enabled here.</p>
          <Link to="/" className="mt-6 inline-block font-bold text-primary underline">
            Return to Tomlandia
          </Link>
        </div>
      </main>
    );
  }

  return <AvatarLab />;
}

function AvatarLab() {
  const [activeManifest, setActiveManifest] =
    useState<AvatarAssetManifest>(referenceAvatarManifest);
  const [manifestUrl, setManifestUrl] = useState("/assets/avatar/candidate/manifest.json");
  const [manifestMessage, setManifestMessage] = useState("Using checked-in reference manifest");
  const renderer = useMemo(() => new PlayerAvatarRenderer(activeManifest), [activeManifest]);
  const [refresh, setRefresh] = useState(0);
  const [model, setModel] = useState<AvatarModel>("female");
  const [face, setFace] = useState("female-face-1");
  const [hair, setHair] = useState("hair-bob");
  const [skinTone, setSkinTone] = useState("#d99a72");
  const [hairColor, setHairColor] = useState("#6f3f64");
  const [armour, setArmour] = useState("copper_light_armor");
  const [weapon, setWeapon] = useState("copper_sword");
  const [activity, setActivity] = useState<PlayerActivity>("attack");
  const [background, setBackground] = useState<PreviewBackground>("checker");
  const [guides, setGuides] = useState(true);
  const [heatmap, setHeatmap] = useState(false);
  const [layers, setLayers] = useState<Record<AvatarRasterLayer, boolean>>({
    weaponBack: true,
    body: true,
    face: true,
    armour: true,
    hair: true,
    weaponFront: true,
  });

  useEffect(() => {
    void renderer.preload().then(() => setRefresh((value) => value + 1));
  }, [renderer]);

  const faces = activeManifest.faces.filter((entry) => entry.model === model);
  const hairstyles = activeManifest.hairstyles.filter((entry) => entry.models.includes(model));
  const state = useMemo<PlayerVisualState>(
    () => ({
      appearance: {
        bodyType: model,
        faceVariant: face,
        skinTone,
        hairStyle: hair,
        hairColor,
      },
      equipment: { armour, weapon },
      activity,
    }),
    [activity, armour, face, hair, hairColor, model, skinTone, weapon],
  );
  const issues = validateAvatarManifest(activeManifest);
  const catalogueIssues = validateAvatarCatalogue(activeManifest, AVATAR_CATALOGUE_EXPECTATION);

  const changeModel = (next: string) => {
    const value = next as AvatarModel;
    setModel(value);
    setFace(`${value}-face-1`);
  };

  const activateManifest = (manifest: AvatarAssetManifest, message: string) => {
    setActiveManifest(manifest);
    setManifestMessage(message);
    setModel("female");
    setFace(manifest.faces.find((entry) => entry.model === "female")?.id ?? "");
    setHair(manifest.hairstyles.find((entry) => entry.models.includes("female"))?.id ?? "");
    setArmour(manifest.armour[0]?.id ?? "");
    setWeapon(manifest.weapons[0]?.id ?? "");
  };

  const loadCandidate = async () => {
    setManifestMessage("Loading candidate manifest…");
    try {
      const manifest = await loadAvatarManifest(manifestUrl);
      const candidateIssues = validateAvatarCatalogue(manifest, AVATAR_CATALOGUE_EXPECTATION);
      if (candidateIssues.length) {
        throw new Error(
          candidateIssues.map((issue) => `${issue.field}: ${issue.message}`).join(" "),
        );
      }
      const candidateRenderer = new PlayerAvatarRenderer(manifest);
      await candidateRenderer.preload();
      if (candidateRenderer.loadState !== "ready") {
        throw new Error([...candidateRenderer.errors.values()].join(" "));
      }
      activateManifest(manifest, `Loaded ${manifestUrl}`);
    } catch (error) {
      setManifestMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#f7e7ba_0,#d8e8c6_42%,#b9d2ad_100%)] px-4 py-6 text-[#443646] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/70 bg-[#fffaf0]/90 px-5 py-4 shadow-xl shadow-[#5b4662]/10 backdrop-blur sm:px-7">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-[#8a668b]">
              <span className="h-2 w-2 rounded-full bg-[#dc7c55]" /> Stage 1 · Geometry proof
            </div>
            <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">Tomlandia Avatar Lab</h1>
            <p className="mt-1 max-w-2xl text-sm font-semibold text-[#756377]">
              Reference artwork only. Test registration, layering, tinting, catalogue mapping, and
              sword occlusion before production art begins.
            </p>
          </div>
          <Link
            to="/"
            className="rounded-xl border border-[#bca9ba] bg-white/70 px-4 py-2 text-sm font-extrabold hover:bg-white"
          >
            ← Back to game
          </Link>
        </header>

        <section className="mt-5 rounded-3xl border border-white/70 bg-[#fffaf0]/95 p-4 shadow-xl shadow-[#5b4662]/10 sm:p-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[260px] flex-1 text-xs font-extrabold uppercase tracking-[0.12em] text-[#665268]">
              Candidate manifest
              <input
                value={manifestUrl}
                onChange={(event) => setManifestUrl(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-[#c9b9c9] bg-white px-3 font-mono text-sm font-semibold normal-case tracking-normal outline-none focus:ring-2 focus:ring-[#8f6ca0]"
                placeholder="/assets/avatar/candidate/manifest.json"
              />
            </label>
            <button
              type="button"
              onClick={() => void loadCandidate()}
              className="h-11 rounded-xl bg-[#6f5278] px-5 text-sm font-extrabold text-white hover:bg-[#5d4266]"
            >
              Load candidate
            </button>
            <button
              type="button"
              onClick={() =>
                activateManifest(referenceAvatarManifest, "Using checked-in reference manifest")
              }
              className="h-11 rounded-xl border border-[#bca9ba] bg-white px-5 text-sm font-extrabold"
            >
              Reset reference
            </button>
          </div>
          <p
            className={`mt-2 text-xs font-bold ${manifestMessage.startsWith("Invalid") || manifestMessage.includes("failed") ? "text-red-700" : "text-[#806f80]"}`}
          >
            {manifestMessage}
          </p>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(260px,330px)_1fr]">
          <aside className="rounded-3xl border border-white/70 bg-[#fffaf0]/95 p-5 shadow-xl shadow-[#5b4662]/10">
            <h2 className="text-xl font-extrabold">Build a character</h2>
            <div className="mt-4 grid gap-4">
              <SelectField label="Model" value={model} onChange={changeModel}>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </SelectField>
              <SelectField label="Face" value={face} onChange={setFace}>
                {faces.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Hair" value={hair} onChange={setHair}>
                {hairstyles.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </SelectField>
              <ColourField label="Skin tone" value={skinTone} onChange={setSkinTone} />
              <label className="grid gap-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-[#665268]">
                Hair colour
                <span className="flex h-11 items-center gap-3 rounded-xl border border-[#c9b9c9] bg-[#fffaf0] px-3">
                  <input
                    type="color"
                    value={hairColor}
                    onChange={(event) => setHairColor(event.target.value)}
                    className="h-7 w-10 cursor-pointer border-0 bg-transparent"
                  />
                  <span className="font-mono text-sm normal-case tracking-normal">{hairColor}</span>
                </span>
              </label>
              <SelectField label="Armour" value={armour} onChange={setArmour}>
                {[...activeManifest.armour]
                  .sort((a, b) => a.tier - b.tier)
                  .map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      T{entry.tier} · {entry.label}
                    </option>
                  ))}
              </SelectField>
              <SelectField label="Sword" value={weapon} onChange={setWeapon}>
                {[...activeManifest.weapons]
                  .sort((a, b) => a.tier - b.tier)
                  .map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      T{entry.tier} · {entry.label}
                    </option>
                  ))}
              </SelectField>
              <SelectField
                label="Activity"
                value={activity}
                onChange={(value) => setActivity(value as PlayerActivity)}
              >
                {activeManifest.activities.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </SelectField>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#665268]">
                  Visible layers
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(Object.keys(layers) as AvatarRasterLayer[]).map((layer) => (
                    <button
                      key={layer}
                      type="button"
                      onClick={() =>
                        setLayers((current) => ({ ...current, [layer]: !current[layer] }))
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${layers[layer] ? "bg-[#6f5278] text-white" : "bg-[#e4d9df] text-[#8b7889] line-through"}`}
                    >
                      {layer}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <section className="grid gap-5">
            <div className="rounded-3xl border border-white/70 bg-[#fffaf0]/95 p-5 shadow-xl shadow-[#5b4662]/10 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold">Registered composite</h2>
                  <p className="text-sm font-semibold text-[#806f80]">
                    One canvas · one anchor · no per-item offsets
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["checker", "light", "dark", "world"] as const).map((item) => (
                    <button
                      key={item}
                      onClick={() => setBackground(item)}
                      className={`rounded-full px-3 py-1.5 text-xs font-extrabold capitalize ${background === item ? "bg-[#6f5278] text-white" : "bg-[#eadfeb] text-[#655067]"}`}
                    >
                      {item}
                    </button>
                  ))}
                  <button
                    onClick={() => setGuides((value) => !value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${guides ? "bg-[#dc7c55] text-white" : "bg-[#eadfeb] text-[#655067]"}`}
                  >
                    Guides {guides ? "on" : "off"}
                  </button>
                  <button
                    onClick={() => setHeatmap((value) => !value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${heatmap ? "bg-[#d7204f] text-white" : "bg-[#eadfeb] text-[#655067]"}`}
                  >
                    Heatmap {heatmap ? "on" : "off"}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid items-end gap-6 md:grid-cols-[minmax(260px,384px)_minmax(200px,1fr)]">
                <div>
                  <div className="mb-2 flex justify-between text-xs font-extrabold uppercase tracking-[0.12em] text-[#806f80]">
                    <span>Source</span>
                    <span>384 × 384</span>
                  </div>
                  <AvatarCanvas
                    renderer={renderer}
                    state={state}
                    background={background}
                    guides={guides}
                    mode="source"
                    refresh={refresh}
                    layers={layers}
                    heatmap={heatmap}
                  />
                </div>
                <div>
                  <div className="mb-2 flex justify-between text-xs font-extrabold uppercase tracking-[0.12em] text-[#806f80]">
                    <span>Game scale</span>
                    <span>145 px cell</span>
                  </div>
                  <AvatarCanvas
                    renderer={renderer}
                    state={state}
                    background={background}
                    guides={guides}
                    mode="game"
                    refresh={refresh}
                    layers={layers}
                    heatmap={heatmap}
                  />
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-[#68566b]">
                    <div className="rounded-xl bg-[#f0e7d7] p-3">
                      <span className="block text-lg text-[#413445]">x 192</span>centre pivot
                    </div>
                    <div className="rounded-xl bg-[#f0e7d7] p-3">
                      <span className="block text-lg text-[#413445]">y 300</span>foot baseline
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <StatusCard
                label="Manifest"
                value={issues.length ? `${issues.length} issues` : "Valid"}
                good={issues.length === 0}
              />
              <StatusCard
                label="Assets"
                value={
                  renderer.loadState === "ready"
                    ? `${renderer.images.size} loaded`
                    : renderer.loadState
                }
                good={renderer.loadState === "ready"}
              />
              <StatusCard label="Artwork" value="Reference only" good={false} neutral />
            </div>
            <div className="rounded-2xl border border-white/70 bg-[#fffaf0]/95 p-4 shadow-lg shadow-[#5b4662]/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#806f80]">
                    Release coverage
                  </div>
                  <div className="mt-1 text-lg font-extrabold text-[#3f7e55]">
                    {catalogueIssues.length === 0
                      ? "32 armour · 16 swords · 8 faces · 10 hairstyles"
                      : `${catalogueIssues.length} catalogue issues`}
                  </div>
                </div>
                <span className="rounded-full bg-[#e3f0df] px-3 py-1 text-xs font-extrabold text-[#3f7e55]">
                  Gameplay IDs matched
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/70 bg-[#fffaf0]/95 p-4 text-sm font-bold shadow-lg shadow-[#5b4662]/10">
              <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#806f80]">
                Boundary scan
              </span>
              <div className="mt-1 text-lg font-extrabold text-[#443646]">
                {renderer.loadState === "ready"
                  ? `${boundaryViolationCount(renderer, state).toLocaleString()} illegal visible pixels`
                  : "Waiting for assets"}
              </div>
              <p className="mt-1 text-xs text-[#806f80]">
                Turn on Heatmap to paint every pixel outside its registered slot bright red.
              </p>
            </div>
            {renderer.errors.size > 0 && (
              <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-800">
                {[...renderer.errors.values()].join(" · ")}
              </div>
            )}
            <div className="rounded-3xl border border-white/70 bg-[#fffaf0]/95 p-5 shadow-xl shadow-[#5b4662]/10 sm:p-7">
              <h2 className="text-xl font-extrabold">Model compatibility sheet</h2>
              <p className="mt-1 text-sm font-semibold text-[#806f80]">
                One tier, tint, sword, and anchor shown on both registered bodies.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {(["female", "male"] as const).map((sheetModel) => {
                  const sheetState: PlayerVisualState = {
                    ...state,
                    appearance: {
                      ...state.appearance,
                      bodyType: sheetModel,
                      faceVariant: `${sheetModel}-face-1`,
                    },
                  };
                  return (
                    <div key={sheetModel}>
                      <div className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[#806f80]">
                        {sheetModel}
                      </div>
                      <AvatarCanvas
                        renderer={renderer}
                        state={sheetState}
                        background={background}
                        guides={false}
                        mode="game"
                        refresh={refresh}
                        layers={layers}
                        heatmap={false}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
        <TierContactSheet
          renderer={renderer}
          model={model}
          hair={hair}
          skinTone={skinTone}
          hairColor={hairColor}
          refresh={refresh}
        />
        <ProductionReadiness
          catalogueReady={catalogueIssues.length === 0}
          candidate={activeManifest.status === "production"}
        />
        <NpcReferenceBoard />
      </div>
    </main>
  );
}

function ProductionReadiness({
  catalogueReady,
  candidate,
}: {
  catalogueReady: boolean;
  candidate: boolean;
}) {
  const gates = [
    { label: "Canonical 384×384 registration", done: true },
    {
      label: "Exact release catalogue coverage",
      done: catalogueReady,
    },
    { label: "Alpha-mask and heatmap validation", done: true },
    { label: "Heavy/light and silhouette review", done: true },
    { label: "Lossless NPC source board measured", done: false },
    { label: "Candidate manifest loaded", done: candidate },
    { label: "Candidate bald body pair approved", done: false },
    { label: "Candidate masks traced and passing", done: false },
  ];
  return (
    <section className="mt-5 rounded-3xl border border-white/70 bg-[#fffaf0]/95 p-5 shadow-xl shadow-[#5b4662]/10 sm:p-7">
      <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#8a668b]">
        Stage gate
      </div>
      <h2 className="mt-1 text-2xl font-extrabold">Production readiness</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {gates.map((gate) => (
          <div
            key={gate.label}
            className={`flex items-center gap-3 rounded-2xl border p-3 text-sm font-extrabold ${gate.done ? "border-[#b9d7b5] bg-[#edf6e8] text-[#3f6e4e]" : "border-[#dbc9b7] bg-[#f6eee1] text-[#8a6648]"}`}
          >
            <span className="text-lg">{gate.done ? "✓" : "○"}</span>
            {gate.label}
          </div>
        ))}
      </div>
    </section>
  );
}

function TierContactSheet({
  renderer,
  model,
  hair,
  skinTone,
  hairColor,
  refresh,
}: {
  renderer: PlayerAvatarRenderer;
  model: AvatarModel;
  hair: string;
  skinTone: string;
  hairColor: string;
  refresh: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [family, setFamily] = useState<"heavy" | "light">("heavy");
  const [silhouette, setSilhouette] = useState(false);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ded5c1";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    const armour = renderer.manifest.armour
      .filter((entry) => entry.id.includes(family))
      .sort((a, b) => a.tier - b.tier);
    const weapons = [...renderer.manifest.weapons].sort((a, b) => a.tier - b.tier);
    for (let index = 0; index < 16; index++) {
      const column = index % 8;
      const row = Math.floor(index / 8);
      const x = column * 120;
      const y = row * 180;
      ctx.fillStyle = (column + row) % 2 ? "#eee6d4" : "#f7f0df";
      ctx.fillRect(x + 2, y + 2, 116, 176);
      const tierArmour = armour[index];
      const tierWeapon = weapons[index];
      if (tierArmour && tierWeapon) {
        renderer.draw(
          ctx,
          {
            appearance: {
              bodyType: model,
              faceVariant: `${model}-face-1`,
              skinTone,
              hairStyle: hair,
              hairColor,
            },
            equipment: { armour: tierArmour.id, weapon: tierWeapon.id },
            activity: "idle",
          },
          x + 60,
          y + 142,
          126,
        );
      }
      if (silhouette) {
        const sample = ctx.getImageData(x + 2, y + 2, 116, 150);
        const background = (column + row) % 2 ? [238, 230, 212] : [247, 240, 223];
        for (let pixel = 0; pixel < sample.data.length; pixel += 4) {
          if (
            sample.data[pixel] === background[0] &&
            sample.data[pixel + 1] === background[1] &&
            sample.data[pixel + 2] === background[2]
          )
            continue;
          sample.data[pixel] = 45;
          sample.data[pixel + 1] = 37;
          sample.data[pixel + 2] = 48;
        }
        ctx.putImageData(sample, x + 2, y + 2);
      }
      ctx.fillStyle = "#554357";
      ctx.font = '700 13px "Baloo 2", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(`T${index + 1}`, x + 60, y + 162);
    }
  }, [family, hair, hairColor, model, refresh, renderer, silhouette, skinTone]);

  return (
    <section className="mt-5 rounded-3xl border border-white/70 bg-[#fffaf0]/95 p-5 shadow-xl shadow-[#5b4662]/10 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#8a668b]">
            Progression audit
          </div>
          <h2 className="mt-1 text-2xl font-extrabold">Copper → Ascendant contact sheet</h2>
        </div>
        <div className="flex items-center gap-2">
          {(["heavy", "light"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFamily(value)}
              className={`rounded-full px-4 py-2 text-xs font-extrabold capitalize ${family === value ? "bg-[#6f5278] text-white" : "bg-[#eadfeb] text-[#655067]"}`}
            >
              {value} armour
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSilhouette((value) => !value)}
            className={`rounded-full px-4 py-2 text-xs font-extrabold ${silhouette ? "bg-[#2d2530] text-white" : "bg-[#eadfeb] text-[#655067]"}`}
          >
            Silhouette {silhouette ? "on" : "off"}
          </button>
        </div>
      </div>
      <p className="mt-2 max-w-3xl text-sm font-semibold text-[#806f80]">
        All 16 {family}-armour and sword tiers use identical scale and registration. Reference
        assets currently prove colour/catalogue flow, not final material design.
      </p>
      <div className="mt-5 overflow-x-auto rounded-2xl border border-[#d5c5cf]">
        <canvas
          ref={ref}
          width={960}
          height={360}
          className="min-w-[720px] max-w-full [image-rendering:pixelated]"
          aria-label="Sixteen tier avatar progression contact sheet"
        />
      </div>
    </section>
  );
}

const npcReferences = [
  { name: "Armourer", role: "Primary armour language", asset: armourerAsset },
  { name: "Weaponsmith", role: "Primary weapon language", asset: weaponsmithAsset },
  { name: "Smith", role: "Metal, tools, and workwear", asset: smithAsset },
  { name: "Tanner", role: "Light armour and leather", asset: tannerAsset },
] as const;

function NpcReferenceBoard() {
  return (
    <section className="mt-5 rounded-3xl border border-white/70 bg-[#fffaf0]/95 p-5 shadow-xl shadow-[#5b4662]/10 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#8a668b]">
            Style calibration
          </div>
          <h2 className="mt-1 text-2xl font-extrabold">Tomlandia NPC reference board</h2>
        </div>
        <p className="max-w-lg text-sm font-semibold text-[#806f80]">
          These establish outline, proportion, palette, and readable detail. They do not define
          player registration geometry.
        </p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {npcReferences.map(({ name, role, asset }) => (
          <figure
            key={name}
            className="overflow-hidden rounded-2xl border border-[#d5c5cf] bg-[#e9e1cd]"
          >
            <NpcReferenceImage name={name} url={asset.url} />
            <figcaption className="bg-[#fffaf0] p-3">
              <div className="font-extrabold">{name}</div>
              <div className="text-xs font-bold text-[#806f80]">{role}</div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function NpcReferenceImage({ name, url }: { name: string; url: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="grid aspect-square place-items-center bg-[#ded5c1]">
      {failed ? (
        <div className="p-4 text-center text-xs font-extrabold text-[#786678]">
          {name} asset is registered through Lovable and is unavailable in this local preview.
        </div>
      ) : (
        <img
          src={url}
          alt={`${name} NPC`}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-3 [image-rendering:pixelated]"
        />
      )}
    </div>
  );
}

function StatusCard({
  label,
  value,
  good,
  neutral = false,
}: {
  label: string;
  value: string;
  good: boolean;
  neutral?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-[#fffaf0]/95 p-4 shadow-lg shadow-[#5b4662]/10">
      <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#806f80]">
        {label}
      </div>
      <div
        className={`mt-1 text-lg font-extrabold ${neutral ? "text-[#a0673e]" : good ? "text-[#3f7e55]" : "text-[#a84444]"}`}
      >
        {value}
      </div>
    </div>
  );
}
