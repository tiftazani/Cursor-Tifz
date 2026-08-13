import { LoginForm } from "./login-form";
import { Wordmark } from "@/components/brand";

export const metadata = { title: "Masuk" };

export default async function MasukPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const q = await searchParams;
  return (
    <div className="relative flex min-h-full items-center justify-center px-4 py-20">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[18%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-gold/10 blur-[120px]" />
      </div>
      <div className="relative w-full max-w-lg">
        <p className="text-center text-[11px] uppercase tracking-[0.42em] text-gold">Akses privat</p>
        <div className="mt-6 text-center">
          <Wordmark href={null} size="lg" />
        </div>
        <div className="hairline mx-auto my-8 max-w-48" />
        <div className="card px-8 py-9">
          <p className="text-center text-base leading-7 text-mute">
            Desk harian IHSG dan reksadana. Masuk untuk melihat pilihan saham, robot analisa, dan berita pasar.
          </p>
          <LoginForm next={q.next?.startsWith("/") ? q.next : "/"} error={q.error} />
        </div>
        <p className="mt-6 text-center text-sm tracking-wide text-mute">
          Copyright by Tiftazani · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
