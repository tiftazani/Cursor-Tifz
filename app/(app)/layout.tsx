import { AppNav } from "@/components/nav";
import { Disclaimer } from "@/components/disclaimer";

export const dynamic = "force-dynamic";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <AppNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10">{children}</main>
      <footer className="mx-auto w-full max-w-7xl px-4 pb-12">
        <div className="hairline mb-6" />
        <Disclaimer />
        <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-mute">
          Cuan Yuk Guys · desk harian IHSG & reksadana · {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
