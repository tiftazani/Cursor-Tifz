"use client";

import { useEffect, useRef, useState } from "react";
import { num } from "@/lib/format";
import { ihsgPollMs } from "@/lib/time";
import type { MarketStatus } from "@/lib/types";
import { Card, Change, LiveBadge, Stat } from "@/components/ui";
import { IhsgChart } from "@/components/charts";

type Tick = {
  last: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  chart: { date: string; value: number }[];
  chartKind: "intraday" | "daily";
  marketStatus: MarketStatus;
  clock: string;
};

type Props = Tick & {
  ret1m: number;
  stale?: boolean;
  generatedAt: string;
  className?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function IhsgLivePanel({
  last,
  changePct,
  ret1m,
  open,
  high,
  low,
  chart,
  chartKind,
  marketStatus,
  stale,
  generatedAt,
  clock: initialClock = "",
  className,
}: Props) {
  const [tick, setTick] = useState<Tick>({
    last,
    changePct,
    open,
    high,
    low,
    chart,
    chartKind,
    marketStatus,
    clock: initialClock,
  });
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const liveRef = useRef(false);
  const lastRef = useRef(last);

  useEffect(() => {
    let cancelled = false;
    let flashTimer: ReturnType<typeof setTimeout> | undefined;

    const pull = async () => {
      try {
        const res = await fetch("/api/ihsg", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as Tick;
        if (cancelled || !Number.isFinite(next.last)) return;
        liveRef.current = true;
        const prev = lastRef.current;
        if (Math.abs(next.last - prev) >= 0.01) {
          setFlash(next.last > prev ? "up" : "down");
          clearTimeout(flashTimer);
          flashTimer = setTimeout(() => setFlash(null), 700);
        }
        lastRef.current = next.last;
        setTick(next);
      } catch {
        /* keep last tick */
      }
    };

    const loop = async () => {
      await pull();
      while (!cancelled) {
        await sleep(ihsgPollMs());
        if (cancelled) break;
        if (document.visibilityState === "hidden") continue;
        await pull();
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void pull();
    };

    void loop();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(flashTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (liveRef.current) return;
    lastRef.current = last;
    setTick({
      last,
      changePct,
      open,
      high,
      low,
      chart,
      chartKind,
      marketStatus,
      clock: initialClock,
    });
  }, [last, changePct, open, high, low, chart, chartKind, marketStatus, generatedAt, initialClock]);

  const color = tick.changePct >= 0 ? "#9cba8a" : "#d46a6a";
  const chartLabel = tick.chartKind === "intraday" ? "Hari ini · live" : "60 hari terakhir";
  const priceClass =
    flash === "up" ? "text-up" : flash === "down" ? "text-down" : "text-foreground";

  return (
    <Card className={className}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold">IHSG</p>
          <p className={`num mt-2 text-5xl font-semibold transition-colors duration-300 ${priceClass}`}>
            {num(tick.last, 2)}
          </p>
          <p className="mt-2 text-base">
            <Change value={tick.changePct} /> · 1 bln <Change value={ret1m} />
          </p>
        </div>
        <div className="text-right">
          <LiveBadge marketStatus={tick.marketStatus} stale={stale} clock={tick.clock} />
          <p className="mt-2 text-sm text-mute">{chartLabel}</p>
        </div>
      </div>
      <IhsgChart data={tick.chart} color={color} />
      <div className="mt-6 grid grid-cols-3 gap-3 text-base">
        <Stat label="Open" value={num(tick.open, 2)} />
        <Stat label="High" value={num(tick.high, 2)} />
        <Stat label="Low" value={num(tick.low, 2)} />
      </div>
    </Card>
  );
}
