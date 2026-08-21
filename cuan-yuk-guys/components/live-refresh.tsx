"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

function refreshMs(now = new Date()): number {
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day = wib.getUTCDay();
  const mins = wib.getUTCHours() * 60 + wib.getUTCMinutes();
  const open = day >= 1 && day <= 5 && mins >= 9 * 60 && mins < 15 * 60 + 50;
  return open ? 20_000 : 90_000;
}

export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(() => {
        router.refresh();
        loop();
      }, refreshMs());
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    loop();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
