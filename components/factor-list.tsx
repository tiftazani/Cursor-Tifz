import type { Factor } from "@/lib/types";
import { clsx, num } from "@/lib/format";

export function FactorList({ factors }: { factors: Factor[] }) {
  return (
    <div className="space-y-3">
      {factors.map((f) => {
        const width = Math.min(100, Math.abs(f.contribution) * 140);
        const pos = f.contribution >= 0;
        return (
          <div key={f.key}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-mute">{f.label}</span>
              <span className="num text-foreground">{f.display}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className={clsx("h-full rounded-full", pos ? "bg-mint" : "bg-rose")}
                style={{ width: `${Math.max(6, width)}%` }}
              />
            </div>
            <p className="mt-0.5 text-[11px] text-mute">
              z {num(f.z, 2)} · kontribusi {num(f.contribution, 2)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
