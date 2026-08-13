"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { clsx } from "@/lib/format";
import { Wordmark } from "./brand";

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
    <header className="sticky top-0 z-30 border-b border-line bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-end justify-between gap-4 px-4 py-4">
        <Wordmark size="sm" />
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-[10px] uppercase tracking-[0.22em] text-mute hover:text-gold"
          >
            Keluar
          </button>
        </form>
      </div>
      <nav className="mx-auto flex max-w-7xl gap-0 overflow-x-auto px-2 pb-0">
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "whitespace-nowrap border-b px-3 py-2.5 text-[12px] uppercase tracking-[0.16em] transition",
                active
                  ? "border-gold text-gold"
                  : "border-transparent text-mute hover:border-line hover:text-foreground",
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
