import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { KNIGHT_ANIMS, KnightRig, preloadKnight } from "@/game/knight";

export const Route = createFileRoute("/knight-test")({
  component: KnightTest,
  head: () => ({ meta: [{ title: "Knight sprite test" }] }),
});

function KnightTest() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    preloadKnight();
    // eslint-disable-next-line no-console
    console.log("KNIGHT_URL", KNIGHT_ANIMS.idle.url);
    const rig = new KnightRig();
    rig.setLocomotion(true);
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      rig.update(dt);
      ctx.clearRect(0, 0, cv.width, cv.height);
      rig.draw(ctx, 160, 200, 1, 144, "#39D353", "#39D353");
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} width={320} height={240} className="bg-muted" />;
}
