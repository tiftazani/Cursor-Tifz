"use client";

export default function ErrorView({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-20 text-center">
      <p className="text-rose">Terjadi kesalahan</p>
      <p className="mt-2 text-sm text-mute">{error.message}</p>
      <button type="button" onClick={reset} className="mt-4 text-sm text-gold">
        Coba lagi
      </button>
    </div>
  );
}
