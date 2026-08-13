import { AppNav } from "@/components/nav";
import { Disclaimer } from "@/components/disclaimer";

export const dynamic = "force-dynamic";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <AppNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</main>
      <footer className="mx-auto w-full max-w-7xl px-4 pb-10">
        <Disclaimer />
        <p className="mt-3 text-[11px] text-mute">Cuan · rekomendasi harian IHSG & reksadana · {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
