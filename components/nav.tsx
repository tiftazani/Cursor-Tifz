"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { clsx } from "@/lib/format";

const LINKS = [
  { href: "/", label: "Beranda" },
  { href: "/saham", label: "Saham" },
  { href: "/reksadana", label: "Reksadana" },
  { href: "/investor", label: "Investor" },
  { href: "/analitik", label: "Analitik" },
  { href: "/screener", label: "Screener" },
  { href: "/profil-risiko", label: "Profil Risiko" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/jejak", label: "Jejak" },
  { href: "/edukasi", label: "Edukasi" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint/15 text-sm font-bold text-mint">
            C
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Cuan<span className="text-gold">.</span>
          </span>
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="text-xs text-mute hover:text-foreground">
            Keluar
          </button>
        </form>
      </div>
      <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 pb-2">
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition",
                active ? "bg-mint/15 text-mint" : "text-mute hover:bg-white/5 hover:text-foreground",
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
