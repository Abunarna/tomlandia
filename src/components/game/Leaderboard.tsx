import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Loader2, Trophy } from "lucide-react";
import { SKILL_IDS } from "@/game/types";
import { fetchLeaderboard, type LeaderRow } from "@/lib/leaderboard.functions";

const CATEGORIES: { id: string; name: string }[] = [
  { id: "total", name: "Total Skill Level" },
  ...SKILL_IDS.map((id) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) })),
];

const MEDAL = ["text-amber-400", "text-slate-300", "text-amber-700"];

export function LeaderboardTab() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-1.5">
      {CATEGORIES.map((c) => (
        <Category
          key={c.id}
          id={c.id}
          name={c.name}
          open={open === c.id}
          onToggle={() => setOpen((o) => (o === c.id ? null : c.id))}
        />
      ))}
    </div>
  );
}

function Category({
  id,
  name,
  open,
  onToggle,
}: {
  id: string;
  name: string;
  open: boolean;
  onToggle: () => void;
}) {
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [me, setMe] = useState<LeaderRow | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchLeaderboard({ data: { skill: id } });
    setRows(res.ok ? (res.top ?? []) : []);
    setMe(res.ok ? (res.me ?? null) : null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (open && rows === null && !loading) void load();
  }, [open, rows, loading, load]);

  const inTop = !!me && !!rows?.some((r) => r.me);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted/40">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-3 text-left active:scale-[0.99]"
      >
        <ChevronRight
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className="flex-1 truncate text-sm font-semibold text-foreground">{name}</span>
        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </button>

      {open && (
        <div className="space-y-0.5 px-2 pb-2">
          {rows && rows.length === 0 && !loading && (
            <p className="px-2 py-3 text-xs text-muted-foreground">No rankings available yet.</p>
          )}
          {rows?.map((r, i) => <Row key={`${r.rank}-${r.name}-${i}`} row={r} />)}
          {me && !inTop && (
            <>
              <p className="px-2 text-center text-xs text-muted-foreground">…</p>
              <Row row={me} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ row }: { row: LeaderRow }) {
  const medal = row.rank <= 3 ? MEDAL[row.rank - 1] : null;
  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm ${
        row.me ? "bg-primary/15 ring-1 ring-primary/40" : ""
      }`}
    >
      <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums text-muted-foreground">
        {row.rank.toLocaleString()}
      </span>
      {medal ? (
        <Trophy className={`size-3.5 shrink-0 ${medal}`} />
      ) : (
        <span className="size-3.5 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
        {row.me ? `${row.name} (You)` : row.name}
      </span>
      <span className="shrink-0 font-bold tabular-nums text-foreground">
        {row.score.toLocaleString()}
      </span>
    </div>
  );
}
