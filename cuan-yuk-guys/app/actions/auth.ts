"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, getSitePassword, rateLimit, sessionToken } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || "local";
  if (!rateLimit(ip)) {
    redirect("/masuk?error=limit");
  }
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/") || "/";
  if (password !== getSitePassword()) {
    redirect("/masuk?error=1");
  }
  const jar = await cookies();
  const https = hdrs.get("x-forwarded-proto") === "https";
  jar.set(COOKIE_NAME, await sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: https,
  });
  redirect(next.startsWith("/") ? next : "/");
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  redirect("/masuk");
}
