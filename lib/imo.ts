import data from "@/data/imo-analytics.json";

export type ImoAnalytics = typeof data;
export type ImoMember = ImoAnalytics["members"][number];
export type ImoTopic = ImoAnalytics["topics"][number];

export const imo: ImoAnalytics = data;

export function idNum(value: number, digits = 0): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const idx = Number(m) - 1;
  return `${names[idx] ?? m} ${y.slice(2)}`;
}

export function dateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function humans(): ImoMember[] {
  return imo.members.filter((m) => !m.bot);
}
