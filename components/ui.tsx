import Link from "next/link";
import { clsx } from "@/lib/format";
import { LABEL_STYLE } from "@/lib/labels";
import type { RecLabel } from "@/lib/types";

export function Card({
  children,
  className,
  hover,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return <div className={clsx("card p-5", hover && "card-hover", className)}>{children}</div>;
}

export function PageHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="mb-10">
      <p className="text-[11px] uppercase tracking-[0.32em] text-gold">{kicker}</p>
      <h1 className="font-display mt-3 text-4xl font-medium italic leading-[1.05] tracking-tight md:text-5xl">
        {title}
      </h1>
      <div className="hairline my-5 max-w-xs" />
      <p className="max-w-2xl text-sm leading-7 text-mute">{subtitle}</p>
    </header>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "up" | "down" | "neutral";
}) {
  const color = tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-foreground";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-mute">{label}</p>
      <p className={clsx("mt-1.5 num text-xl font-medium", color)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-mute">{hint}</p> : null}
    </div>
  );
}

export function LabelBadge({ label }: { label: RecLabel }) {
  return (
    <span className={clsx("rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]", LABEL_STYLE[label])}>
      {label}
    </span>
  );
}

export function ScorePill({ score }: { score: number }) {
  const tone = score >= 70 ? "text-gold" : score >= 50 ? "text-foreground" : "text-rose";
  return <span className={clsx("num text-lg font-medium", tone)}>{Math.round(score)}</span>;
}

export function Change({ value, digits = 2 }: { value: number; digits?: number }) {
  const formatted = new Intl.NumberFormat("id-ID", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: "exceptZero",
  }).format(value);
  const tone = value > 0 ? "text-up" : value < 0 ? "text-down" : "text-mute";
  return <span className={clsx("num", tone)}>{formatted}</span>;
}

export function AsOf({ date, source }: { date: string; source?: string }) {
  return (
    <p className="text-xs text-mute">
      As-of {date}
      {source ? ` · sumber ${source}` : ""}
    </p>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm text-gold hover:underline">
      {children}
    </Link>
  );
}
