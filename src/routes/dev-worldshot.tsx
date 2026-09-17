import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { GameEngine } from "@/game/engine";

export const Route = createFileRoute("/dev-worldshot")({
  component: DevWorldShot,
  head: () => ({
    meta: [
      { title: "World snapshot tool" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function DevWorldShot() {
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    canvas.style.width = "800px";
    canvas.style.height = "600px";
    document.body.appendChild(canvas);
    const engine = new GameEngine(canvas, () => {});
    engine.useServerWorld();
    const t = window.setTimeout(() => {
      (window as unknown as { __worldShot?: string }).__worldShot =
        engine.renderWorldSnapshot(1);
    }, 4000);
    return () => window.clearTimeout(t);
  }, []);
  return <div id="worldshot-root">world snapshot tool</div>;
}
