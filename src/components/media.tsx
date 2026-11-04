import Link from "next/link";
import type { Anime, Item } from "@/lib/catalog";
import SmartImg from "./SmartImg";
import ListButton from "./ListButton";

export function PosterCard({
  href,
  title,
  poster,
  sub,
  rating,
  progress,
}: {
  href: string;
  title: string;
  poster: string;
  sub?: string;
  rating?: string | number | null;
  progress?: number;
}) {
  return (
    <Link href={href} className="group block w-full">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/[0.07] bg-zinc-900 transition duration-300 group-hover:-translate-y-1 group-hover:border-white/20 group-hover:shadow-xl">
        <SmartImg src={poster} alt={title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-70 transition group-hover:opacity-90" />
        {rating ? (
          <span className="absolute right-2 top-2 rounded-md border border-white/10 bg-black/65 px-1.5 py-0.5 text-[0.68rem] font-medium text-zinc-200 backdrop-blur-md">
            ★ {rating}
          </span>
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition duration-200 group-hover:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-950 shadow-lg transition group-hover:scale-105">
            <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-current"><path d="M7 4.5v15l13-7.5z" /></svg>
          </span>
        </div>
        {progress !== undefined && (
          <div className="absolute inset-x-2.5 bottom-2.5 h-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-[var(--accent)]" style={{ width: `${Math.max(3, Math.min(100, progress))}%` }} />
          </div>
        )}
      </div>
      <p className="mt-2 truncate text-sm font-medium text-zinc-200 group-hover:text-white">{title}</p>
      {sub ? <p className="truncate text-xs text-zinc-500">{sub}</p> : null}
    </Link>
  );
}

export function ItemCard({ item }: { item: Item }) {
  return (
    <PosterCard
      href={`/watch/${item.type}/${item.id}`}
      title={item.name}
      poster={item.poster}
      sub={[item.year, item.type === "movie" ? "Movie" : "Series"].filter(Boolean).join(" · ")}
      rating={item.rating}
    />
  );
}

export function AnimeCard({ anime }: { anime: Anime }) {
  return (
    <PosterCard
      href={`/watch/anime/${anime.id}`}
      title={anime.title}
      poster={anime.cover}
      sub={[anime.year, anime.format === "MOVIE" ? "Movie" : "Anime"].filter(Boolean).join(" · ")}
      rating={anime.score ? (anime.score / 10).toFixed(1) : null}
    />
  );
}

export function SectionHeader({ title, href, caption }: { title: string; href?: string; caption?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-zinc-100 sm:text-lg">{title}</h2>
        {caption ? <p className="text-xs text-zinc-500">{caption}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="text-xs font-medium text-zinc-400 transition hover:text-white">
          See all →
        </Link>
      ) : null}
    </div>
  );
}

export function Row({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <SectionHeader title={title} href={href} />
      <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        {Array.isArray(children)
          ? children.map((c, i) => (
              <div key={i} className="w-[8.5rem] shrink-0 sm:w-40 lg:w-44">
                {c}
              </div>
            ))
          : children}
      </div>
    </section>
  );
}

export function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{children}</div>;
}

export function Hero({ item }: { item: Item }) {
  const bg = item.background || `https://images.metahub.space/background/medium/${item.id}/img`;
  return (
    <section className="fade-up relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0c0e] shadow-2xl">
      <SmartImg src={bg} alt="" className="absolute inset-0 h-full w-full object-cover object-center opacity-75" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#09090b] via-[#09090b]/80 via-45% to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/25 to-transparent" />

      <div className="relative flex min-h-[25rem] flex-col justify-end p-6 sm:min-h-[29rem] sm:p-10">
        <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-zinc-300 backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          Featured · {item.type === "movie" ? "Movie" : "Series"}
        </div>

        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          {item.name}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-400 sm:text-sm">
          {item.year ? <span className="text-zinc-200">{item.year}</span> : null}
          {item.rating ? (
            <span className="inline-flex items-center gap-1 text-zinc-200">
              · <span className="text-amber-400">★</span> {item.rating}
            </span>
          ) : null}
          {item.genres.slice(0, 3).map((g) => (
            <span key={g}>· {g}</span>
          ))}
        </div>

        {item.description ? (
          <p className="mt-3.5 line-clamp-3 max-w-xl text-sm leading-relaxed text-zinc-300/90">
            {item.description}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={`/watch/${item.type}/${item.id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-sm transition hover:bg-zinc-200 active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M7 4.5v15l13-7.5z" />
            </svg>
            Watch now
          </Link>
          <ListButton entry={{ type: item.type, id: item.id, name: item.name, poster: item.poster, year: item.year }} />
        </div>
      </div>
    </section>
  );
}