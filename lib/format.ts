export function idr(value: number, digits = 0): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function num(value: number, digits = 2): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function pct(value: number, digits = 2, signed = true): string {
  const formatted = new Intl.NumberFormat("id-ID", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(value);
  return formatted;
}

export function compactIdr(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `${num(value / 1_000_000_000_000, 2)} T`;
  if (abs >= 1_000_000_000) return `${num(value / 1_000_000_000, 2)} M`;
  if (abs >= 1_000_000) return `${num(value / 1_000_000, 2)} jt`;
  return num(value, 0);
}

export function compactShares(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${num(value / 1_000_000_000, 2)} M`;
  if (abs >= 1_000_000) return `${num(value / 1_000_000, 2)} jt`;
  if (abs >= 1_000) return `${num(value / 1_000, 1)} rb`;
  return num(value, 0);
}

export function clsx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function changeClass(value: number): string {
  if (value > 0.0000001) return "text-up";
  if (value < -0.0000001) return "text-down";
  return "text-mute";
}
