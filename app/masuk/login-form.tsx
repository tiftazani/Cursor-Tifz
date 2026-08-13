"use client";

import { useFormStatus } from "react-dom";
import { loginAction } from "@/app/actions/auth";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-5 w-full rounded-xl bg-mint px-4 py-3 text-sm font-semibold text-background disabled:opacity-60"
    >
      {pending ? "Memeriksa…" : "Masuk ke Cuan"}
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
      <label className="text-xs uppercase tracking-wider text-mute" htmlFor="password">
        Password akses
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoFocus
        required
        className="mt-2 w-full rounded-xl border border-line bg-background/60 px-4 py-3 text-foreground outline-none ring-mint/40 focus:ring-2"
        placeholder="Masukkan password"
      />
      {message ? <p className="mt-3 text-sm text-rose">{message}</p> : null}
      <Submit />
    </form>
  );
}
