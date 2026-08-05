import { useRef, useState } from "react";

export function Joystick({ onChange }: { onChange: (dx: number, dy: number, active: boolean) => void }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const handle = (e: React.PointerEvent) => {
    const el = base.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = r.width / 2 - 12;
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    setKnob({ x: dx, y: dy });
    onChange(dx / max, dy / max, true);
  };

  const end = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setKnob({ x: 0, y: 0 });
    onChange(0, 0, false);
  };

  return (
    <div
      ref={base}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        handle(e);
      }}
      onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && handle(e)}
      onPointerUp={end}
      onPointerCancel={end}
      className="relative size-32 shrink-0 touch-none rounded-full border-2 border-border bg-muted/70 shadow-inner"
    >
      <div
        className="absolute left-1/2 top-1/2 size-14 rounded-full bg-primary/80 shadow-soft"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}
