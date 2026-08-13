"use client";

import { useFormStatus } from "react-dom";
import { loginAction } from "@/app/actions/auth";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-6 w-full border border-gold/50 bg-gold px-4 py-3.5 text-[11px] font-medium uppercase tracking-[0.28em] text-background transition hover:bg-transparent hover:text-gold disabled:opacity-60"
    >
      {pending ? "Memeriksa…" : "Masuk ke desk"}
    </button>
  );
}

export function LoginForm({ next, error }: { next: string; error?: string }) {
  const message =
    error === "limit"
      ? "Terlalu banyak percobaan. Coba lagi 15 menit."
      : error
        ? "Password tidak sesuai."
        : null;
  return (
    <form action={loginAction} className="mt-8">
      <input type="hidden" name="next" value={next} />
      <label className="text-[10px] uppercase tracking-[0.22em] text-mute" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoFocus
        required
        className="mt-2 w-full border border-line bg-black/40 px-4 py-3.5 text-foreground outline-none transition focus:border-gold/60"
        placeholder="••••••••"
      />
      {message ? <p className="mt-3 text-sm text-rose">{message}</p> : null}
      <Submit />
    </form>
  );
}
