import { LoginForm } from "./login-form";

export const metadata = { title: "Masuk" };

export default async function MasukPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const q = await searchParams;
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <div className="card w-full max-w-md p-8">
        <p className="text-xs uppercase tracking-[0.22em] text-gold">Akses terbatas</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Cuan<span className="text-gold">.</span>
        </h1>
        <p className="mt-2 text-sm leading-6 text-mute">
          Terminal rekomendasi harian saham IHSG dan reksadana. Dilindungi password bersama — bukan akun
          personal.
        </p>
        <LoginForm next={q.next?.startsWith("/") ? q.next : "/"} error={q.error} />
      </div>
    </div>
  );
}
