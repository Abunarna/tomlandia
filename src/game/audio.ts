/**
 * Phase 3 sound-effect hooks.
 * Placeholder synthesised blips via WebAudio — no external assets.
 * Swap `TONES` for sample playback later without touching call sites.
 */

export type SfxId = "hit" | "crit" | "gather" | "level" | "coin" | "craft" | "error";

const TONES: Record<SfxId, { freq: number; to: number; dur: number; type: OscillatorType; gain: number }> = {
  hit: { freq: 220, to: 140, dur: 0.09, type: "triangle", gain: 0.05 },
  crit: { freq: 320, to: 120, dur: 0.16, type: "sawtooth", gain: 0.05 },
  gather: { freq: 520, to: 660, dur: 0.08, type: "sine", gain: 0.04 },
  level: { freq: 520, to: 1040, dur: 0.34, type: "sine", gain: 0.06 },
  coin: { freq: 880, to: 1180, dur: 0.11, type: "square", gain: 0.03 },
  craft: { freq: 300, to: 440, dur: 0.18, type: "triangle", gain: 0.05 },
  error: { freq: 200, to: 120, dur: 0.14, type: "square", gain: 0.04 },
};

class Sfx {
  private ctx: AudioContext | null = null;
  enabled = true;

  /** Must be called from a user gesture on mobile browsers. */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  play(id: SfxId) {
    if (!this.enabled || !this.ctx || this.ctx.state !== "running") return;
    const t = TONES[id];
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = t.type;
    osc.frequency.setValueAtTime(t.freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, t.to), now + t.dur);
    gain.gain.setValueAtTime(t.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + t.dur + 0.02);
  }
}

export const sfx = new Sfx();

/* ---------- looped background music ---------- */

import trackAsset from "@/assets/tomlandia-theme.mp3.asset.json";

class Music {
  private el: HTMLAudioElement | null = null;
  private started = false;

  /** Call from a user gesture; safe to call repeatedly. */
  start() {
    if (typeof window === "undefined") return;
    if (!this.el) {
      const el = new Audio(trackAsset.url);
      el.loop = true;
      el.volume = 0.35;
      el.preload = "auto";
      this.el = el;
    }
    if (!sfx.enabled) return;
    void this.el.play().then(() => {
      this.started = true;
    }).catch(() => {
      /* autoplay blocked — a later gesture retries */
    });
  }

  setEnabled(on: boolean) {
    if (!this.el) {
      if (on) this.start();
      return;
    }
    if (on) this.start();
    else this.el.pause();
  }

  stop() {
    this.el?.pause();
    if (this.el) this.el.currentTime = 0;
    this.started = false;
  }

  get playing() {
    return this.started;
  }
}

export const music = new Music();
