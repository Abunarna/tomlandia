/**
 * Knight player sprite — Canvas 2D layered sprite rig.
 *
 * Layers (always identical position / scale / anchor / animation / frame):
 *   0. base      — the full-colour knight frames (shipped)
 *   1. armor     — greyscale mask of recolourable armour pixels (tinted by armour colour)
 *   2. weapon    — greyscale mask of recolourable sword pixels (tinted by weapon colour)
 *
 * The armour/weapon overlay strips are OPTIONAL: if the PNGs are absent the rig
 * simply renders the base layer. Drop them into `public/knight/` with the names
 * listed in `OVERLAY_PATHS` to activate independent tinting.
 */

import idleAsset from "@/assets/knight/idle_strip.png.asset.json";
import walkAsset from "@/assets/knight/walk_strip.png.asset.json";
import attackAsset from "@/assets/knight/attack_strip.png.asset.json";
import mineAsset from "@/assets/knight/mine_strip.png.asset.json";
import chopAsset from "@/assets/knight/chop_strip.png.asset.json";
import lootAsset from "@/assets/knight/loot_strip.png.asset.json";

export type KnightAnim = "idle" | "walk" | "attack" | "mine" | "chop" | "loot";

export const FRAME_W = 384;
export const FRAME_H = 384;

interface AnimDef {
  frames: number;
  fps: number;
  loop: boolean;
  url: string;
}

/** From the supplied animation_manifest.json. */
export const KNIGHT_ANIMS: Record<KnightAnim, AnimDef> = {
  idle: { frames: 4, fps: 2, loop: true, url: idleAsset.url },
  walk: { frames: 6, fps: 8, loop: true, url: walkAsset.url },
  attack: { frames: 6, fps: 12, loop: false, url: attackAsset.url },
  mine: { frames: 6, fps: 10, loop: false, url: mineAsset.url },
  chop: { frames: 6, fps: 10, loop: false, url: chopAsset.url },
  loot: { frames: 5, fps: 7, loop: false, url: lootAsset.url },
};

/**
 * Shared foot baseline (y, in source-frame pixels) for every animation.
 * The new pack uses one uniform 384x384 cell with a common anchor.
 */
export const FOOT_Y: Record<KnightAnim, number> = {
  idle: 300,
  walk: 300,
  attack: 300,
  mine: 300,
  chop: 300,
  loot: 300,
};

/** Fixed horizontal pivot (source-frame pixels). */
const PIVOT_X = 192;

/** Global multiplier applied to every knight animation's FPS. 0.75 = 75% speed. */
const KNIGHT_ANIMATION_SPEED = 0.75;

/** Renderer-side scale applied to the requested draw size. */
const KNIGHT_RENDER_SCALE = 1.34;
const SCALE = KNIGHT_RENDER_SCALE;



/** Overlay masks you still need to supply (served from /public). */
export const OVERLAY_PATHS: Record<"armor" | "weapon", Record<KnightAnim, string>> = {
  armor: {
    idle: "/knight/idle_armor_strip.png",
    walk: "/knight/walk_armor_strip.png",
    attack: "/knight/attack_armor_strip.png",
    mine: "/knight/mine_armor_strip.png",
    chop: "/knight/chop_armor_strip.png",
    loot: "/knight/loot_armor_strip.png",
  },
  weapon: {
    idle: "/knight/idle_weapon_strip.png",
    walk: "/knight/walk_weapon_strip.png",
    attack: "/knight/attack_weapon_strip.png",
    mine: "/knight/mine_weapon_strip.png",
    chop: "/knight/chop_weapon_strip.png",
    loot: "/knight/loot_weapon_strip.png",
  },
};

type Layer = "base" | "armor" | "weapon";

const IMAGES = new Map<string, HTMLImageElement>();
const READY = new Set<string>();
const FAILED = new Set<string>();

function load(url: string): HTMLImageElement | null {
  if (typeof document === "undefined") return null;
  if (FAILED.has(url)) return null;
  let img = IMAGES.get(url);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.onload = () => READY.add(url);
    img.onerror = () => FAILED.add(url);
    img.src = url;
    IMAGES.set(url, img);
  }
  return READY.has(url) ? img : null;
}

/** Kick off loading of every base strip (overlays are probed lazily). */
export function preloadKnight() {
  for (const a of Object.keys(KNIGHT_ANIMS) as KnightAnim[]) {
    load(KNIGHT_ANIMS[a].url);
    load(OVERLAY_PATHS.armor[a]);
    load(OVERLAY_PATHS.weapon[a]);
  }
}

/** True when at least one armour/weapon overlay strip has actually loaded. */
export function overlaysAvailable(kind: "armor" | "weapon"): boolean {
  return (Object.keys(KNIGHT_ANIMS) as KnightAnim[]).some((a) => READY.has(OVERLAY_PATHS[kind][a]));
}

/* ---------------- tinting ---------------- */

const TINT_CACHE = new Map<string, HTMLCanvasElement>();

/** Recolour a greyscale overlay strip with `color`, preserving its luminance shading. */
function tintedStrip(url: string, color: string): HTMLCanvasElement | null {
  const key = `${url}|${color}`;
  const hit = TINT_CACHE.get(key);
  if (hit) return hit;
  const img = load(url);
  if (!img) return null;
  const cv = document.createElement("canvas");
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const c = cv.getContext("2d");
  if (!c) return null;
  c.imageSmoothingEnabled = false;
  // luminance of the mask * flat colour, clipped to the mask's alpha
  c.drawImage(img, 0, 0);
  c.globalCompositeOperation = "multiply";
  c.fillStyle = color;
  c.fillRect(0, 0, cv.width, cv.height);
  c.globalCompositeOperation = "destination-in";
  c.drawImage(img, 0, 0);
  c.globalCompositeOperation = "source-over";
  TINT_CACHE.set(key, cv);
  return cv;
}

/* ---------------- rig ---------------- */

export interface EquipVisual {
  id: string;
  color: string;
}

export class KnightRig {
  anim: KnightAnim = "idle";
  frame = 0;
  /** debug: when set, the rig holds this frame and stops advancing */
  frameOverride: number | null = null;
  private t = 0;
  /** animation returned to when a one-shot finishes */
  private base: KnightAnim = "idle";
  private oneShot = false;


  /** Loop animation driven by gameplay (idle / walk). */
  setLocomotion(moving: boolean) {
    const next: KnightAnim = moving ? "walk" : "idle";
    if (this.base === next) return;
    this.base = next;
    if (!this.oneShot) this.setAnim(next);
  }

  /** Play a one-shot (attack / loot) or a repeating action (mine / chop). */
  play(anim: KnightAnim, opts: { repeat?: boolean } = {}) {
    if (this.anim === anim && (this.oneShot || opts.repeat)) return;
    this.setAnim(anim);
    this.oneShot = !opts.repeat;
    if (opts.repeat) this.oneShot = false;
  }

  /** Cancel any action animation and fall back to idle/walk. */
  release() {
    if (this.anim !== this.base) this.setAnim(this.base);
    this.oneShot = false;
  }

  private setAnim(a: KnightAnim) {
    this.anim = a;
    this.frame = 0;
    this.t = 0;
  }

  update(dt: number) {
    if (this.frameOverride !== null) return;
    const def = KNIGHT_ANIMS[this.anim];
    this.t += dt;
    const step = 1 / (def.fps * KNIGHT_ANIMATION_SPEED);

    while (this.t >= step) {
      this.t -= step;
      this.frame++;
      if (this.frame >= def.frames) {
        if (def.loop || (!this.oneShot && this.anim !== this.base)) {
          this.frame = 0;
        } else {
          this.frame = def.frames - 1;
          this.oneShot = false;
          this.setAnim(this.base);
          return;
        }
      }
    }
  }

  /** True while a non-looping action animation is still playing. */
  get busy() {
    return this.oneShot;
  }

  /**
   * Draw all layers at the same position, scale, anchor and frame.
   * `x,y` is the player's feet/baseline; `size` is the drawn height in world px.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    facing: 1 | -1,
    size: number,
    armorColor?: string | undefined,
    weaponColor?: string | undefined,
  ): boolean {
    const def = KNIGHT_ANIMS[this.anim];
    const baseImg = load(def.url);
    if (!baseImg) return false;

    const frame = Math.min(this.frameOverride ?? this.frame, def.frames - 1);
    const sx = frame * FRAME_W;

    // one fixed cell size, one fixed pivot: horizontal centre + shared foot
    // baseline. No per-frame offsets, so nothing can jitter.
    // The render scale is expressed against a 256px reference cell so the
    // knight's on-screen pixel size is independent of the padded 384px canvas.
    const d = Math.round(size * SCALE * (FRAME_H / 256));
    const s = d / FRAME_H;
    const dx = Math.round(x - PIVOT_X * s);
    const dy = Math.round(y - FOOT_Y[this.anim] * s);

    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    // source art faces LEFT: draw as-is when facing left, mirror when facing right
    if (facing === 1) {
      ctx.translate(dx * 2 + d, 0);
      ctx.scale(-1, 1);
    }

    const drawLayer = (src: CanvasImageSource) => {
      ctx.drawImage(src, sx, 0, FRAME_W, FRAME_H, dx, dy, d, d);
    };
    drawLayer(baseImg);
    if (armorColor) {
      const s = tintedStrip(OVERLAY_PATHS.armor[this.anim], armorColor);
      if (s) drawLayer(s);
    }
    if (weaponColor) {
      const s = tintedStrip(OVERLAY_PATHS.weapon[this.anim], weaponColor);
      if (s) drawLayer(s);
    }
    ctx.restore();
    ctx.imageSmoothingEnabled = prevSmooth;
    return true;
  }
}

export type { AnimDef };
