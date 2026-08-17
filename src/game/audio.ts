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

  /** Shared WebAudio context (created on first unlock). */
  get context() {
    return this.ctx;
  }

  /** Must be called from a user gesture on mobile browsers. */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    loops.warm();
    ambience.start();
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
  /** Music has its own mute, independent of SFX. Off by default. */
  enabled = false;

  /** Call from a user gesture; safe to call repeatedly. */
  start() {
    if (typeof window === "undefined") return;
    if (!this.el) {
      const el = new Audio(trackAsset.url);
      el.loop = true;
      el.volume = 0.175;
      el.preload = "auto";
      this.el = el;
    }
    if (!this.enabled) return;
    void this.el.play().then(() => {
      this.started = true;
    }).catch(() => {
      /* autoplay blocked — a later gesture retries */
    });
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!this.el) {
      if (on) this.start();
      return;
    }
    if (on) this.start();
    else {
      this.el.pause();
      this.started = false;
    }
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

/* ---------- looped activity sound effects ---------- */

import miningAsset from "@/assets/mining.mp3.asset.json";
import loggingAsset from "@/assets/logging.mp3.asset.json";
import gatherAsset from "@/assets/bush-gather.mp3.asset.json";
import fishingAsset from "@/assets/fishing.mp3.asset.json";
import fightingAsset from "@/assets/Fighting.mp3.asset.json";

/** One looping track per ongoing player action. */
export type LoopId = "mining" | "woodcutting" | "gathering" | "fishing" | "combat";

const LOOP_URLS: Record<LoopId, string> = {
  mining: miningAsset.url,
  woodcutting: loggingAsset.url,
  gathering: gatherAsset.url,
  fishing: fishingAsset.url,
  combat: fightingAsset.url,
};

/**
 * Gapless looping via WebAudio: the whole clip is decoded into a buffer and
 * played through a looping AudioBufferSourceNode. HTMLAudioElement `loop`
 * re-seeks the decoder each pass (and mp3 encoder padding adds silence), which
 * is what produced the audible break between loops.
 */
class ActivityLoops {
  private buffers = new Map<LoopId, AudioBuffer>();
  private loading = new Map<LoopId, Promise<AudioBuffer | null>>();
  private src: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  /** Fallback elements when WebAudio is unavailable. */
  private els = new Map<LoopId, HTMLAudioElement>();
  private current: LoopId | null = null;

  /** Pre-decode every loop so the first play starts instantly. */
  warm() {
    for (const id of Object.keys(LOOP_URLS) as LoopId[]) void this.buffer(id);
  }

  private buffer(id: LoopId): Promise<AudioBuffer | null> {
    const have = this.buffers.get(id);
    if (have) return Promise.resolve(have);
    let p = this.loading.get(id);
    if (!p) {
      p = (async () => {
        const ctx = sfx.context;
        if (!ctx) return null;
        try {
          const res = await fetch(LOOP_URLS[id]);
          const buf = await ctx.decodeAudioData(await res.arrayBuffer());
          this.buffers.set(id, buf);
          return buf;
        } catch {
          return null;
        }
      })();
      this.loading.set(id, p);
    }
    return p;
  }

  private stopNode() {
    if (this.src) {
      try {
        this.src.stop();
      } catch {
        /* already stopped */
      }
      this.src.disconnect();
      this.src = null;
    }
  }

  /** Start `id` (idempotent) or pass null to stop whatever is playing. */
  set(id: LoopId | null) {
    if (typeof window === "undefined") return;
    if (!sfx.enabled) id = null;
    if (id === this.current) return;

    // stop whatever is currently running (WebAudio node or fallback element)
    this.stopNode();
    if (this.current) {
      const prev = this.els.get(this.current);
      if (prev) {
        prev.pause();
        prev.currentTime = 0;
      }
    }

    this.current = id;
    if (!id) return;

    const ctx = sfx.context;
    if (!ctx) {
      this.playElement(id);
      return;
    }
    void this.buffer(id).then((buf) => {
      // player may have switched action while decoding
      if (this.current !== id) return;
      if (!buf) {
        this.playElement(id);
        return;
      }
      if (!this.gain) {
        this.gain = ctx.createGain();
        this.gain.gain.value = 0.5;
        this.gain.connect(ctx.destination);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(this.gain);
      src.start();
      this.src = src;
    });
  }

  private playElement(id: LoopId) {
    let el = this.els.get(id);
    if (!el) {
      el = new Audio(LOOP_URLS[id]);
      el.loop = true;
      el.volume = 0.5;
      el.preload = "auto";
      this.els.set(id, el);
    }
    el.currentTime = 0;
    void el.play().catch(() => {
      /* autoplay blocked until a gesture */
    });
  }

  stop() {
    this.set(null);
  }
}


export const loops = new ActivityLoops();


/* ---------- constant background ambience ---------- */

import bgmAsset from "@/assets/BGM.mp3.asset.json";

/**
 * Always-on ambient bed. Gapless (WebAudio buffer loop), plays for the whole
 * session and follows the SFX mute — not the music toggle.
 */
class Ambience {
  private src: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private buf: AudioBuffer | null = null;
  private loading = false;
  private want = false;

  start() {
    this.want = true;
    if (!sfx.enabled) return;
    const ctx = sfx.context;
    if (!ctx || this.src) return;
    if (!this.buf) {
      if (this.loading) return;
      this.loading = true;
      void (async () => {
        try {
          const res = await fetch(bgmAsset.url);
          this.buf = await ctx.decodeAudioData(await res.arrayBuffer());
        } catch {
          /* ignore */
        }
        this.loading = false;
        if (this.want) this.start();
      })();
      return;
    }
    if (!this.gain) {
      this.gain = ctx.createGain();
      this.gain.gain.value = 0.3;
      this.gain.connect(ctx.destination);
    }
    const src = ctx.createBufferSource();
    src.buffer = this.buf;
    src.loop = true;
    src.connect(this.gain);
    src.start();
    this.src = src;
  }

  stop() {
    this.want = false;
    if (this.src) {
      try {
        this.src.stop();
      } catch {
        /* already stopped */
      }
      this.src.disconnect();
      this.src = null;
    }
  }

  setEnabled(on: boolean) {
    if (on) this.start();
    else this.stop();
  }
}

export const ambience = new Ambience();
