import Link from "next/link";

export function Wordmark({
  href = "/",
  size = "md",
}: {
  href?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const title =
    size === "lg"
      ? "font-display text-5xl font-medium italic leading-none tracking-tight md:text-6xl"
      : size === "sm"
        ? "font-display text-[1.35rem] font-medium italic leading-none tracking-tight"
        : "font-display text-[1.55rem] font-medium italic leading-none tracking-tight";

  const inner = (
    <span className="inline-flex flex-col">
      <span className={title}>
        Cuan Yuk <span className="text-gold not-italic">Guys</span>
      </span>
      {size !== "sm" ? (
        <span className="mt-1.5 text-[10px] uppercase tracking-[0.34em] text-mute">Private market desk</span>
      ) : null}
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="hover:text-gold">
      {inner}
    </Link>
  );
}
