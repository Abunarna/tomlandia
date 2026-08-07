import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Backpack, Hammer, LogOut, Store, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GameEngine } from "@/game/engine";
import type { NpcRole } from "@/game/data";
import type { HudSnapshot, ItemId } from "@/game/types";
import { Hud } from "@/components/game/Hud";
import { Panel, type PanelId } from "@/components/game/Panel";
import { NpcDialog } from "@/components/game/NpcDialog";
import { Joystick } from "@/components/game/Joystick";


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
  skills: {
    mining: { ...blank },
    woodcutting: { ...blank },
    combat: { ...blank },
    gathering: { ...blank },
    smithing: { ...blank },
    skinning: { ...blank },
    tailoring: { ...blank },
  },
  inv: new Array(20).fill(null),
  weapon: { id: "wooden_club", plus: 0 },
  armor: { id: "cloth_tunic", plus: 0 },
  food: null,
  activity: "Wandering",
  activityProgress: 0,
  quest: null,
  completed: [],
  discovered: ["fields"],
  attack: 6,
  defense: 2,
  timeOfDay: 0.35,
  phase: "Day",
  market: { listings: [], log: [], fee: 0.05 },
  soundOn: true,
};


function Game() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [username, setUsername] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(EMPTY);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [npc, setNpc] = useState<NpcRole | null>(null);
  const [ready, setReady] = useState(false);
  const [claimable, setClaimable] = useState<SaveState | null>(null);

  const persist = useCallback(
    (s: SaveState) => {
      void supabase
        .from("player_saves")
        .upsert({ user_id: user.id, data: s as unknown as Json, updated_at: new Date().toISOString() });
    },
    [user.id],
  );

  // Load the cloud save first, then boot the engine with it.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: GameEngine | null = null;
    let cancelled = false;
    const onResize = () => engine?.resize();

    void (async () => {
      const { data } = await supabase
        .from("player_saves")
        .select("data")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;

      const cloudSave = (data?.data as unknown as SaveState | undefined) ?? null;
      engine = new GameEngine(canvas, setHud, { initialSave: cloudSave, onPersist: persist });
      engineRef.current = engine;
      engine.onInteract = (id) => {
        setPanel(null);
        setNpc(id);
      };
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

  const signOut = async () => {
    engineRef.current?.save();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const onJoystick = useCallback((dx: number, dy: number, active: boolean) => {
    const e = engineRef.current;
    if (!e) return;
    e.joystick = { active, dx, dy };
  }, []);


  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <h1 className="sr-only">Tomlandia — a cozy pixel idle RPG</h1>
      {username && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border/60 bg-card/85 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur-md">
          {username}
        </div>
      )}

      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          engineRef.current?.unlockAudio();
          engineRef.current?.tapWorld(e.clientX, e.clientY);
        }}
        className="absolute inset-0 size-full touch-none"
      />

      {/* overlays */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <Hud hud={hud} />

        <div className="flex-1" />

        <div className="pointer-events-none flex items-end justify-between gap-3 p-3">
          <div className="pointer-events-auto">
            <Joystick onChange={onJoystick} />
          </div>
          <div className="pointer-events-auto flex flex-col gap-2">
            <OverlayButton label={`Sign out of ${username || "your account"}`} active={false} onClick={signOut}>
              <LogOut className="size-5" />
            </OverlayButton>
            <OverlayButton
              label={hud.soundOn ? "Mute sound" : "Unmute sound"}
              active={hud.soundOn}
              onClick={() => engineRef.current?.toggleSound()}
            >
              {hud.soundOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </OverlayButton>
            <OverlayButton
              label="Market"
              active={panel === "market"}
              onClick={() => setPanel((p) => (p === "market" ? null : "market"))}
            >
              <Store className="size-5" />
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

        {panel && (
          <Panel
            panel={panel}
            hud={hud}
            onClose={() => setPanel(null)}
            onEquip={(i) => engineRef.current?.equipSlot(i)}
            onSell={(i) => engineRef.current?.sellSlot(i)}
            onUse={(i) => engineRef.current?.useSlot(i)}
            onBuyListing={(id) => {
              engineRef.current?.buyListing(id);
            }}
            onCancelListing={(id) => {
              engineRef.current?.cancelListing(id);
            }}
            onList={(i, qty, price) => {
              engineRef.current?.listSlot(i, qty, price);
            }}
            suggestPrice={(id) => engineRef.current?.suggestPrice(id) ?? 1}
          />
        )}
      </div>


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
          onAccept={(id) => engineRef.current?.acceptQuest(id)}
          onClaim={() => {
            engineRef.current?.claimQuest();
          }}
          onAbandon={() => engineRef.current?.abandonQuest()}
          onCraft={(id) => {
            engineRef.current?.craft(id);
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
