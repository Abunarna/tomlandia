import { useMemo } from "react";
import {
  FACES,
  HAIRSTYLES,
  type CharacterDraft,
} from "@/game/avatar";

function shade(hex: string, amount: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * amount);
  const g = clamp(((n >> 8) & 255) * amount);
  const b = clamp((n & 255) * amount);
  return `rgb(${r}, ${g}, ${b})`;
}

export function AvatarPreview({ draft }: { draft: CharacterDraft }) {
  const face = useMemo(
    () => FACES[draft.model].find((f) => f.id === draft.faceId) ?? FACES[draft.model][0]!,
    [draft.model, draft.faceId],
  );
  const hair = useMemo(
    () => HAIRSTYLES.find((h) => h.id === draft.hairId) ?? HAIRSTYLES[0]!,
    [draft.hairId],
  );

  const skinShadow = shade(draft.skin, 0.86);
  const hairShine = shade(draft.hairColor, 1.25);

  const eyeRy = face.eye === "narrow" ? 1.6 : face.eye === "wide" ? 4 : face.eye === "soft" ? 2.6 : 3.2;
  const browY = face.brow === "low" ? 68 : face.brow === "flat" ? 65 : 63;
  const browPath =
    face.brow === "arched"
      ? `M82 ${browY} q7 -5 14 0`
      : face.brow === "angled"
        ? `M82 ${browY + 3} l14 -5`
        : `M82 ${browY} h14`;
  const browPathR =
    face.brow === "arched"
      ? `M104 ${browY} q7 -5 14 0`
      : face.brow === "angled"
        ? `M118 ${browY + 3} l-14 -5`
        : `M104 ${browY} h14`;

  const mouth =
    face.mouth === "smile"
      ? "M90 92 q10 8 20 0"
      : face.mouth === "smirk"
        ? "M90 92 q10 5 20 -2"
        : face.mouth === "open"
          ? "M92 90 q8 12 16 0 q-8 4 -16 0"
          : "M91 92 h18";

  const isFemale = draft.model === "female";

  return (
    <svg
      viewBox="0 0 200 260"
      role="img"
      aria-label="Live character preview"
      className="h-full w-full"
      shapeRendering="geometricPrecision"
    >
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity="0.5" />
          <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <rect width="200" height="260" rx="18" fill="url(#bg)" />

      {/* hair back layer */}
      {hair.back && <path d={hair.back} fill={draft.hairColor} />}

      {/* torso */}
      {isFemale ? (
        <path
          d="M100 112c-20 0-34 12-40 34-4 16-6 34-6 52h92c0-18-2-36-6-52-6-22-20-34-40-34z"
          fill="hsl(var(--primary))"
        />
      ) : (
        <path
          d="M100 112c-24 0-40 14-44 38-3 16-4 32-4 48h96c0-16-1-32-4-48-4-24-20-38-44-38z"
          fill="hsl(var(--primary))"
        />
      )}
      {/* neck */}
      <rect
        x={isFemale ? 92 : 89}
        y={100}
        width={isFemale ? 16 : 22}
        height={18}
        rx="7"
        fill={skinShadow}
      />

      {/* head */}
      <ellipse
        cx="100"
        cy="76"
        rx={isFemale ? 31 : 34}
        ry={isFemale ? 36 : 38}
        fill={draft.skin}
      />
      {/* ears */}
      <ellipse cx={isFemale ? 69 : 66} cy="80" rx="5" ry="8" fill={skinShadow} />
      <ellipse cx={isFemale ? 131 : 134} cy="80" rx="5" ry="8" fill={skinShadow} />

      {/* eyes */}
      <ellipse cx="89" cy="78" rx="4.2" ry={eyeRy} fill="#2b2320" />
      <ellipse cx="111" cy="78" rx="4.2" ry={eyeRy} fill="#2b2320" />
      {/* brows */}
      <path d={browPath} stroke={shade(draft.hairColor, 0.8)} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d={browPathR} stroke={shade(draft.hairColor, 0.8)} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* nose + mouth */}
      <path d="M100 80 v8 l-4 2" stroke={skinShadow} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d={mouth} stroke="#8a4a46" strokeWidth="2.4" fill="none" strokeLinecap="round" />

      {/* hair front layer */}
      <path d={hair.path} fill={draft.hairColor} />
      <path d={hair.path} fill={hairShine} opacity="0.25" transform="translate(-3 -2) scale(1)" />
    </svg>
  );
}
