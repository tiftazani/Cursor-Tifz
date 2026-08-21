"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isIdxSession } from "@/lib/time";

export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(() => {
        router.refresh();
        loop();
      }, isIdxSession() ? 20_000 : 90_000);
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
