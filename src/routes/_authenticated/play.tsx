import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Backpack, Hammer, Map as MapIcon, Maximize, Minimize, Music, Music2, Trophy, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GameEngine, clearLegacySave, readLegacySave, type SyncAck } from "@/game/engine";
import { PresenceNet } from "@/game/presence";
import { WorldNet } from "@/game/world";
import {
  attackBoss,
  attackMonster,
  bankGold,
  bankItem,
  craftItem,
  dropSlotAction,
  sellSlotAction,
  equipSlotAction,
  fishCast,
  harvestNode,
  upgradeGear,
  usePotion,
} from "@/lib/world.functions";
import { browseMarket, buyFromMarket, cancelMarketListing, listOnMarket } from "@/lib/market.functions";
import { NPCS, type NpcRole } from "@/game/data";
import type { HudSnapshot, ItemId, SaveState } from "@/game/types";
import type { Json } from "@/integrations/supabase/types";
import { Hud } from "@/components/game/Hud";
import { AutoEat } from "@/components/game/AutoEat";
import { AutoPotion } from "@/components/game/AutoPotion";
import { KnightDebug } from "@/components/game/KnightDebug";

import { Panel, type PanelId } from "@/components/game/Panel";
import { NpcDialog } from "@/components/game/NpcDialog";
import { WorldMap } from "@/components/game/WorldMap";


export const Route = createFileRoute("/_authenticated/play")({
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
  component: Game,
});

const blank = { level: 1, xp: 0, progress: 0, into: 0, need: 115 };

const EMPTY: HudSnapshot = {
  hp: 30,
  maxHp: 30,
  gold: 0,
  level: 1,
  region: "Peaceful Fields",
  regionLevel: "1-15",
  px: 700,
  py: 2400,
  skills: {
    mining: { ...blank },
    woodcutting: { ...blank },
    combat: { ...blank },
    gathering: { ...blank },
    fishing: { ...blank },
    cooking: { ...blank },
    alchemy: { ...blank },

    smithing: { ...blank },
    skinning: { ...blank },
    tailoring: { ...blank },
  },
  inv: new Array(20).fill(null),
  bank: { gold: 0, items: new Array(60).fill(null) },
  weapon: { id: "wooden_club", plus: 0 },
  armor: { id: "cloth_tunic", plus: 0 },
  food: null,
  autoPotionState: { on: false, item: null, qty: 0, hits: 0, maxHits: 0, firedAt: 0 },
  autoEat: { threshold: 0.5, qty: 0, firedAt: 0, cooldownUntil: 0 },
  activity: "Wandering",
  activityProgress: 0,
  quest: null,
  completed: [],
  discovered: ["fields"],
  attack: 6,
  defense: 2,
  attackInterval: 1,
  timeOfDay: 0.35,
  phase: "Day",
  market: { listings: [], log: [], fee: 0.05, lastSold: {} },
  soundOn: true,
  musicOn: false,
  name: "Adventurer",
  nearby: 0,
  buff: null,
  death: null,
  boss: {
    name: "DESOLATUS",
    level: 150,
    alive: true,
    hp: 45000,
    maxHp: 45000,
    dist: 99999,
    warn: 0,
    engaged: false,
    respawnAt: 0,
  },
};


function Game() {
  const { user } = Route.useRouteContext();
  
  const [username, setUsername] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(EMPTY);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [npc, setNpc] = useState<NpcRole | null>(null);
  const [ready, setReady] = useState(false);
  const [claimable, setClaimable] = useState<SaveState | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFsPrompt, setShowFsPrompt] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const pendingSave = useRef<PromiseLike<unknown> | null>(null);
  const panelRef = useRef<PanelId | null>(null);


  const persist = useCallback(
    (s: SaveState, rev: number | null): PromiseLike<SyncAck | null> => {
      // Row-locking merge: the server keeps its own economy fields when our
      // copy is stale, instead of us blindly overwriting the row.
      const req = supabase
        .rpc("player_sync", rev === null ? { _data: s as unknown as Json } : { _data: s as unknown as Json, _rev: rev })
        .then(({ data, error }) => {
          if (error) {
            console.error("Save failed", error.message);
            return null;
          }
          return (data ?? null) as unknown as SyncAck | null;
        });
      pendingSave.current = req;
      return req;
    },
    [],
  );

  // Two-finger pinch zoom on the gameplay canvas.
  type P = { x: number; y: number };
  const pinchPts = useRef(new Map<number, P>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  const pinchDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pinchPts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchPts.current.size >= 2) {
      const [a, b] = [...pinchPts.current.values()] as [P, P];
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: engineRef.current?.getZoom() ?? 1,
      };
    }
  };

  const pinchMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pinchPts.current.has(e.pointerId)) return;
    pinchPts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = pinch.current;
    if (!g || pinchPts.current.size < 2) return;
    const [a, b] = [...pinchPts.current.values()] as [P, P];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (g.dist > 0 && dist > 0) engineRef.current?.setZoom(g.zoom * (dist / g.dist));
  };

  const pinchUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pinchPts.current.delete(e.pointerId);
    if (pinchPts.current.size < 2) pinch.current = null;
  };


  // Load the cloud save first, then boot the engine with it.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: GameEngine | null = null;
    let cancelled = false;
    const onResize = () => engine?.resize();

    void (async () => {
      // Never start the game on a failed read: booting with an empty save and
      // then autosaving is how a character could be overwritten. Retry first.
      type SaveRow = { data: unknown; rev: number | null };
      let row: SaveRow | null = null;
      let readOk = false;
      for (let attempt = 0; attempt < 4 && !readOk; attempt++) {
        const { data, error } = await supabase
          .from("player_saves")
          .select("data, rev")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (!error) {
          readOk = true;
          row = (data as SaveRow | null) ?? null;
        } else {
          console.error("Save load failed", error.message);
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          if (cancelled) return;
        }
      }
      if (!readOk) {
        setLoadFailed(true);
        return;
      }

      const cloudSave = (row?.data as unknown as SaveState | undefined) ?? null;
      engine = new GameEngine(canvas, setHud, {
        initialSave: cloudSave,
        // A missing/unreadable save must never look "up to date" to the server.
        initialRev: cloudSave && typeof row?.rev === "number" ? row.rev : null,
        onPersist: persist,
      });

      engineRef.current = engine;
      // Phase 9 — the server resolves every world action and owns the rewards.
      engine.userId = user.id;
      engine.onHarvest = (id, x, y) => harvestNode({ data: { id, x, y } });
      engine.onAttack = (id, x, y) => attackMonster({ data: { id, x, y } });
      engine.onBossAttack = (x, y, bx, by, passive) => attackBoss({ data: { x, y, bx, by, passive } });
      engine.onFish = (id, x, y) => fishCast({ data: { id, x, y } });
      engine.onPotion = (itemId) => usePotion({ data: { item: itemId } });
      engine.onCraft = (recipe) => craftItem({ data: { recipe } });
      // Gear, bag and bank changes are settled server-side under a row lock so
      // equipped (and upgraded) items can never be lost to a concurrent reward.
      engine.onEquip = (index) => equipSlotAction({ data: { index } });
      engine.onUpgrade = (which) => upgradeGear({ data: { which } });
      engine.onDrop = (index) => dropSlotAction({ data: { index } });
      engine.onSell = (index) => sellSlotAction({ data: { index } });
      engine.onBankGold = (dir, amount) => bankGold({ data: { dir, amount } });
      engine.onBankItem = (dir, index, qty) => bankItem({ data: { dir, index, qty } });

      // The exchange is a 100% player-driven shared order book.
      engine.onMarketBrowse = () => browseMarket();
      engine.onMarketList = (item, qty, price, plus) => listOnMarket({ data: { item, qty, price, plus } });
      engine.onMarketBuy = (id, qty) => buyFromMarket({ data: { id, qty } });
      engine.onMarketCancel = (id) => cancelMarketListing({ data: { id } });
      void engine.refreshMarket();
      // The server writes rewards into the save row, so it has to exist first.
      if (!cloudSave) engine.save();
      engine.onInteract = (id) => {
        // Grand Market clerks open the exchange directly, not a conversation.
        if (NPCS.find((n) => n.id === id)?.services.includes("exchange")) {
          setNpc(null);
          setPanel("market");
          void engineRef.current?.refreshMarket();
          return;
        }
        setPanel(null);
        setNpc(id);
      };
      // Dev-only handle for debugging/automated checks.
      if (import.meta.env.DEV) (window as unknown as { __tom?: GameEngine }).__tom = engine;
      engine.emitHud(true);
      engine.start();
      window.addEventListener("resize", onResize);
      setReady(true);

      // First login with no cloud save: offer to claim pre-account local progress.
      const legacy = readLegacySave();
      if (!cloudSave && legacy) setClaimable(legacy);
      else if (legacy) clearLegacySave();
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      engine?.save();
      engine?.stop();
      engineRef.current = null;
    };
  }, [user.id, persist]);

  // Never lose progress when the tab closes or is backgrounded.
  useEffect(() => {
    const flush = () => engineRef.current?.save();
    const onVisible = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Keep the engine + realtime handler aware of which panel is open.
  useEffect(() => {
    panelRef.current = panel;
    if (engineRef.current) engineRef.current.marketVisible = panel === "market";
  }, [panel]);

  // Phase 10 — shared marketplace: listings and trades update live for everyone.
  useEffect(() => {
    if (!ready) return;
    let queued = false;
    const bump = () => {
      if (panelRef.current !== "market") return;
      if (queued) return;
      queued = true;
      window.setTimeout(() => {
        queued = false;
        if (panelRef.current !== "market") return;
        void engineRef.current?.refreshMarket();
      }, 400);
    };
    const channel = supabase
      .channel("market")
      .on("postgres_changes", { event: "*", schema: "public", table: "market_listings" }, bump)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "market_trades" }, bump)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ready]);


  // Phase 8 — shared world state: follow node/monster changes in nearby cells.
  useEffect(() => {
    if (!ready) return;
    const engine = engineRef.current;
    if (!engine) return;
    const net = new WorldNet({
      position: () => ({ x: engine.px, y: engine.py }),
      onNodes: (rows, full) => engine.applyNodeRows(rows, full),
      onMonsters: (rows, full) => engine.applyMonsterRows(rows, full),
      onBoss: (row) => engine.applyBossRow(row),
    });
    void net.start();
    return () => net.stop();
  }, [ready]);

  // Phase 7 — shared presence: broadcast to our map cell, listen to neighbours.
  useEffect(() => {
    if (!ready || !username) return;
    const engine = engineRef.current;
    if (!engine) return;
    engine.playerName = username;
    const net = new PresenceNet(
      user.id,
      () => engine.presenceState(),
      (p) => engine.applyPresence(p),
      (id) => engine.removeRemote(id),
    );
    net.start();
    const bye = () => net.farewell();
    window.addEventListener("pagehide", bye);
    return () => {
      window.removeEventListener("pagehide", bye);
      net.farewell();
      net.stop();
      engine.remotes.clear();
    };
  }, [ready, username, user.id]);

  useEffect(() => {
    let alive = true;
    void supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (alive && data?.username) setUsername(data.username);
      });
    return () => {
      alive = false;
    };
  }, [user.id]);

  // Fullscreen helpers — request/exit the browser Fullscreen API on the whole
  // document and keep our icon state in sync with user-initiated changes too.
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Some browsers reject fullscreen without a user gesture or on unsupported
      // platforms — fail silently rather than breaking the game.
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Offer fullscreen once the game has finished loading.
  useEffect(() => {
    if (!ready) return;
    const dismissed = window.sessionStorage.getItem("tom_fs_prompt");
    if (!dismissed && !document.fullscreenElement) setShowFsPrompt(true);
  }, [ready]);

  // Death overlay: show for 3 seconds whenever a new death event arrives.
  const [death, setDeath] = useState<HudSnapshot["death"]>(null);
  useEffect(() => {
    if (!hud.death) return;
    setDeath(hud.death);
    const t = window.setTimeout(() => {
      engineRef.current?.acknowledgeDeath();
      setDeath(null);
    }, 3000);
    return () => window.clearTimeout(t);
  }, [hud.death?.at]);




  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <h1 className="sr-only">Tomlandia — a cozy pixel idle RPG</h1>
      {username && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1">
          <div className="rounded-full border border-border/60 bg-card/85 px-3 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground backdrop-blur-md">
            {hud.px}, {hud.py}
          </div>
          <div className="rounded-full border border-border/60 bg-card/85 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur-md">
            {username}
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          engineRef.current?.unlockAudio();
          pinchDown(e);
          if (pinchPts.current.size === 1) engineRef.current?.tapWorld(e.clientX, e.clientY);
        }}
        onPointerMove={pinchMove}
        onPointerUp={pinchUp}
        onPointerCancel={pinchUp}
        onPointerLeave={pinchUp}
        className="absolute inset-0 size-full touch-none"
      />


      {/* overlays */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <Hud hud={hud} />
        <KnightDebug
          onAnim={(a) => engineRef.current?.setDebugAnim(a)}
          onColor={(k, c) => engineRef.current?.setDebugColor(k, c)}
          onFrame={(f) => engineRef.current?.setDebugFrame(f)}
        />



        {!panel && (
          <div className="pointer-events-none px-3 pt-1">
            <div className="flex items-center gap-3">
              <AutoEat hud={hud} onCycle={() => engineRef.current?.cycleAutoEat()} />
              <AutoPotion hud={hud} onToggle={() => engineRef.current?.toggleAutoPotion()} />
            </div>
          </div>
        )}

        {panel ? (
          <>
            {/* Tap anywhere outside the sheet to close it. */}
            <div
              className="fixed inset-0 z-10 pointer-events-auto"
              onClick={() => setPanel(null)}
            />
            {/* Menu fills all space below the HUD; right-side buttons are hidden. */}
            <div className="pointer-events-auto z-30 min-h-0 flex-1">
              <Panel
                panel={panel}
                hud={hud}
                onClose={() => setPanel(null)}
                onEquip={(i) => engineRef.current?.equipSlot(i)}
                onUse={(i) => engineRef.current?.useSlot(i)}
                onDrop={(i) => engineRef.current?.dropSlot(i)}
                onSetFood={(i) => engineRef.current?.equipSlot(i)}
                onClearFood={() => engineRef.current?.clearAutoSnack()}

                onBuyListing={(id, qty) => {
                  void engineRef.current?.buyListing(id, qty);
                }}
                onCancelListing={(id) => {
                  void engineRef.current?.cancelListing(id);
                }}
                onList={(i, qty, price) => {
                  void engineRef.current?.listSlot(i, qty, price);
                }}
                suggestPrice={(id) => engineRef.current?.suggestPrice(id) ?? 1}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex-1" />

            <div className="pointer-events-none flex items-end justify-end gap-3 p-3">
              <div className="pointer-events-auto z-20 flex flex-col gap-2">
                <OverlayButton
                  label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  active={isFullscreen}
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
                </OverlayButton>
                <OverlayButton
                  label={hud.musicOn ? "Mute music" : "Unmute music"}
                  active={hud.musicOn}
                  onClick={() => engineRef.current?.toggleMusic()}
                >
                  {hud.musicOn ? <Music2 className="size-5" /> : <Music className="size-5" />}
                </OverlayButton>
                <OverlayButton
                  label={hud.soundOn ? "Mute sound" : "Unmute sound"}
                  active={hud.soundOn}
                  onClick={() => engineRef.current?.toggleSound()}
                >
                  {hud.soundOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
                </OverlayButton>
                <OverlayButton
                  label="World map"
                  active={mapOpen}
                  onClick={() => setMapOpen(true)}
                >
                  <MapIcon className="size-5" />
                </OverlayButton>
                <OverlayButton
                  label="Leaderboards"
                  active={panel === "leaderboard"}
                  onClick={() => setPanel((p) => (p === "leaderboard" ? null : "leaderboard"))}
                >
                  <Trophy className="size-5" />
                </OverlayButton>
                <OverlayButton
                  label="Bag"
                  active={panel === "inventory"}
                  onClick={() => setPanel((p) => (p === "inventory" ? null : "inventory"))}
                >
                  <Backpack className="size-5" />
                </OverlayButton>
                <OverlayButton
                  label="Skills"
                  active={panel === "skills"}
                  onClick={() => setPanel((p) => (p === "skills" ? null : "skills"))}
                >
                  <Hammer className="size-5" />
                </OverlayButton>
              </div>
            </div>
          </>
        )}
      </div>


      {/* DESOLATUS proximity dread — fades smoothly with distance. */}
      {hud.boss.warn > 0 && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <div
            className="absolute inset-0 transition-opacity duration-500"
            style={{
              opacity: hud.boss.warn,
              background:
                "radial-gradient(circle at 50% 50%, rgba(120,0,12,0.12) 20%, rgba(150,10,20,0.55) 100%)",
            }}
          />
          <div
            className="absolute left-0 right-0 top-[18%] text-center transition-opacity duration-500"
            style={{ opacity: Math.min(1, hud.boss.warn * 1.4) }}
          >
            <p className="animate-pulse font-display text-2xl font-black tracking-[0.2em] text-red-100 drop-shadow-[0_2px_10px_rgba(120,0,10,0.9)]">
              {hud.boss.name} IS NEAR
            </p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-red-200/80">
              {hud.boss.dist}m away · {Math.round((hud.boss.hp / hud.boss.maxHp) * 100)}% hp
            </p>
          </div>
        </div>
      )}

      {death && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-red-950/70 px-6 text-center backdrop-blur-sm animate-in fade-in duration-300">
          <div>
            <p className="font-display text-4xl font-black tracking-wide text-red-100 drop-shadow">You died</p>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-red-200/90">{death.reason}</p>
            <button
              type="button"
              onClick={() => {
                engineRef.current?.acknowledgeDeath();
                setDeath(null);
              }}
              className="mt-6 rounded-full border border-red-200/40 bg-red-100/10 px-8 py-2.5 text-sm font-bold tracking-wide text-red-50 transition active:scale-95 hover:bg-red-100/20"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {!ready && !loadFailed && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-background">
          <p className="text-sm text-muted-foreground">Loading your adventure…</p>
        </div>
      )}

      {loadFailed && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-background p-6 text-center">
          <div className="max-w-xs">
            <h2 className="font-display text-lg font-bold text-foreground">Couldn't reach your save</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We stopped the game rather than risk your progress. Check your connection and try again.
            </p>
            <button
              className="mt-4 rounded-2xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      )}


      {claimable && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-background/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
            <h2 className="font-display text-lg font-bold text-foreground">Claim old progress?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We found progress saved on this device from before accounts existed
              ({claimable.gold ?? 0} gold). Claim it for <strong>{username || "this account"}</strong>?
              This is a one-time offer and will overwrite your fresh start.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  engineRef.current?.applySave(claimable);
                  clearLegacySave();
                  setClaimable(null);
                }}
                className="flex-1 rounded-2xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
              >
                Claim it
              </button>
              <button
                onClick={() => {
                  clearLegacySave();
                  setClaimable(null);
                }}
                className="flex-1 rounded-2xl border border-border/60 px-4 py-3 font-semibold text-foreground"
              >
                Start fresh
              </button>
            </div>
          </div>
        </div>
      )}

      {showFsPrompt && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-background/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
            <h2 className="font-display text-lg font-bold text-foreground">Play in fullscreen?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Immerse yourself in Tomlandia. You can toggle fullscreen anytime with the button in the corner.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  void toggleFullscreen();
                  window.sessionStorage.setItem("tom_fs_prompt", "1");
                  setShowFsPrompt(false);
                }}
                className="flex-1 rounded-2xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
              >
                Go fullscreen
              </button>
              <button
                onClick={() => {
                  window.sessionStorage.setItem("tom_fs_prompt", "1");
                  setShowFsPrompt(false);
                }}
                className="flex-1 rounded-2xl border border-border/60 px-4 py-3 font-semibold text-foreground"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {mapOpen && (
        <WorldMap
          position={() => ({
            x: engineRef.current?.px ?? 0,
            y: engineRef.current?.py ?? 0,
          })}
          onClose={() => setMapOpen(false)}
        />
      )}

      {npc && (
        <NpcDialog
          npc={npc}
          hud={hud}
          onClose={() => setNpc(null)}
          onBuy={(who, id: ItemId) => {
            engineRef.current?.buyItem(who, id);
          }}
          onSellAll={() => {
            engineRef.current?.sellAllResources();
          }}
          onSellItem={(i) => engineRef.current?.sellSlot(i)}
          onDepositGold={(n) => engineRef.current?.depositGold(n)}
          onWithdrawGold={(n) => engineRef.current?.withdrawGold(n)}
          onDepositItem={(i, q) => engineRef.current?.depositItem(i, q)}
          onWithdrawItem={(i, q) => engineRef.current?.withdrawItem(i, q)}
          onAccept={(id) => engineRef.current?.acceptQuest(id)}
          onClaim={() => {
            engineRef.current?.claimQuest();
          }}
          onAbandon={() => engineRef.current?.abandonQuest()}
          onCraft={(id) => {
            engineRef.current?.craft(id);
          }}
          onCraftAll={(id) => {
            engineRef.current?.craftAll(id);
          }}

          onUpgrade={(which) => {
            engineRef.current?.upgradeEquipped(which);
          }}
          upgradeCosts={{
            weapon: engineRef.current?.upgradeCostFor("weapon") ?? null,
            armor: engineRef.current?.upgradeCostFor("armor") ?? null,
          }}
        />
      )}
    </main>
  );
}

function OverlayButton({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`grid size-12 place-items-center rounded-2xl border border-border/60 shadow-soft backdrop-blur-md active:scale-95 ${
        active ? "bg-primary text-primary-foreground" : "bg-card/85 text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
