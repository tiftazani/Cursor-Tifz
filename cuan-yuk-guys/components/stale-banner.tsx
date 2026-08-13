import { Card } from "./ui";

export function StaleBanner({ stale, notes }: { stale: boolean; notes: string[] }) {
  if (!stale && notes.length === 0) return null;
  return (
    <Card className={stale ? "mb-6 border-gold/30" : "mb-6"}>
      <p className="text-sm text-gold">{stale ? "Data tertunda — memakai snapshot cadangan." : "Catatan data"}</p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-mute">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </Card>
  );
}
