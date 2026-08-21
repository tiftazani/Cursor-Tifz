import type { MarketStatus } from "./types";

const WIB = "Asia/Jakarta";

export function wibDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatWibLong(date: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatWibClock(date: Date | string = new Date()): string {
  const t = new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(date));
  return `${t} WIB`;
}

export function formatWibDate(date: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function wibParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: WIB,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
  };
}

export function marketStatus(date = new Date()): MarketStatus {
  const { weekday, hour, minute } = wibParts(date);
  if (weekday === "Sat" || weekday === "Sun") return "weekend";
  const mins = hour * 60 + minute;
  if (mins >= 9 * 60 && mins < 15 * 60 + 50) return "open";
  return "closed";
}

export function marketStatusLabel(status: MarketStatus): string {
  if (status === "open") return "Bursa buka";
  if (status === "weekend") return "Akhir pekan";
  return "Bursa tutup";
}

export function formatNewsTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function tradingDatesBack(count: number, end = new Date()): string[] {
  const dates: string[] = [];
  const d = new Date(end);
  while (dates.length < count) {
    const { weekday } = wibParts(d);
    if (weekday !== "Sat" && weekday !== "Sun") {
      dates.push(wibDateKey(d));
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return dates.reverse();
}
