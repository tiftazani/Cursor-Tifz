import type { NewsItem } from "@/lib/news";
import { formatNewsTime } from "@/lib/time";

export function NewsList({ items }: { items: NewsItem[] }) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold">Berita pasar</p>
          <h2 className="font-display mt-1 text-2xl italic">Saham & reksadana</h2>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-base leading-7 text-mute">Berita sedang dimuat ulang. Coba refresh sebentar lagi.</p>
      ) : (
        <ul className="divide-y divide-line overflow-y-auto">
          {items.map((item) => (
            <li key={item.url} className="py-3.5 first:pt-0">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="group block">
                <div className="flex items-center gap-2 text-[13px] text-mute">
                  <span className="text-gold">{item.tag}</span>
                  <span>·</span>
                  <span>{item.source}</span>
                  {item.publishedAt ? (
                    <>
                      <span>·</span>
                      <span>{formatNewsTime(item.publishedAt)}</span>
                    </>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[1.05rem] leading-6 text-foreground group-hover:text-gold">
                  {item.title}
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
