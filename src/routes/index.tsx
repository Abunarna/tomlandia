import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine } from "@/game/engine";
import type { HudSnapshot } from "@/game/types";
import { Hud } from "@/components/game/Hud";
import { Dock, type TabId } from "@/components/game/Dock";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tomlandia — Cozy Pixel Idle RPG" },
      {
        name: "description",
        content:
          "Wander Peaceful Fields in Tomlandia: mine copper, chop oak, befriend-or-fight mischievous goblins, and level up in a cozy pixel world.",
      },
      { property: "og:title", content: "Tomlandia — Cozy Pixel Idle RPG" },
      {
        property: "og:description",
        content: "A cozy mobile idle RPG: gather, fight, and level up in a soft pastel pixel world.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game,
});

const EMPTY: HudSnapshot = {
  hp: 30,
  maxHp: 30,
  gold: 0,
  level: 1,
  region: "Peaceful Fields",
  skills: {
    mining: { level: 1, xp: 0, progress: 0, into: 0, need: 115 },
    woodcutting: { level: 1, xp: 0, progress: 0, into: 0, need: 115 },
    combat: { level: 1, xp: 0, progress: 0, into: 0, need: 115 },
  },
  inv: new Array(20).fill(null),
  weapon: "wooden_club",
  armor: "cloth_tunic",
  activity: "Wandering",
  activityProgress: 0,
};

function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(EMPTY);
  const [tab, setTab] = useState<TabId>("world");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new GameEngine(canvas, setHud);
    engineRef.current = engine;
    (window as unknown as { __tomEngine?: GameEngine }).__tomEngine = engine;
    engine.emitHud(true);
    engine.start();
    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      engine.stop();
      engineRef.current = null;
    };
  }, []);

  const onJoystick = useCallback((dx: number, dy: number, active: boolean) => {
    const e = engineRef.current;
    if (!e) return;
    e.joystick = { active, dx, dy };
  }, []);

  return (
    <main className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background">
      <h1 className="sr-only">Tomlandia — a cozy pixel idle RPG</h1>
      <Hud hud={hud} />
      <div className="relative mt-2 flex-[3] px-3">
        <canvas
          ref={canvasRef}
          onPointerDown={(e) => engineRef.current?.tapWorld(e.clientX, e.clientY)}
          className="size-full touch-none rounded-3xl border border-border/60 shadow-soft"
        />
      </div>
      <div className="mt-2 flex flex-[2] min-h-0 flex-col">
        <Dock
          tab={tab}
          setTab={setTab}
          hud={hud}
          onJoystick={onJoystick}
          onEquip={(i) => engineRef.current?.equipSlot(i)}
          onSell={(i) => engineRef.current?.sellSlot(i)}
        />
      </div>
    </main>
  );
}
