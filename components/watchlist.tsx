"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "cuan-watchlist";
const EVENT = "cuan-watchlist";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function getSnapshot(): string {
  try {
    return localStorage.getItem(KEY) || "[]";
  } catch {
    return "[]";
  }
}

function getServerSnapshot(): string {
  return "[]";
}

export function useWatchlist() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const tickers: string[] = JSON.parse(raw) as string[];

  const persist = useCallback((next: string[]) => {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return {
    tickers,
    has: (ticker: string) => tickers.includes(ticker),
    toggle: (ticker: string) => {
      persist(tickers.includes(ticker) ? tickers.filter((t) => t !== ticker) : [...tickers, ticker]);
    },
  };
}

export function WatchButton({ ticker }: { ticker: string }) {
  const { has, toggle } = useWatchlist();
  const on = has(ticker);
  return (
    <button
      type="button"
      onClick={() => toggle(ticker)}
      className={
        on
          ? "rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-xs text-gold"
          : "rounded-full border border-line px-3 py-1 text-xs text-mute hover:text-foreground"
      }
    >
      {on ? "Di watchlist" : "Tambah watchlist"}
    </button>
  );
}
