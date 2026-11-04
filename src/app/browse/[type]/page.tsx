import Link from "next/link";
import { notFound } from "next/navigation";
import { ANIME_GENRES, MOVIE_GENRES, getAnimeList, getCatalog } from "@/lib/catalog";
import { AnimeCard, Grid, ItemCard } from "@/components/media";

export const dynamic = "force-dynamic";

const TITLES: Record<string, string> = { movie: "Movies", series: "Series", anime: "Anime" };
const PAGE = 50;

export default async function Browse({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ genre?: string; page?: string }>;
}) {
  const { type } = await params;
  const sp = await searchParams;
  if (!TITLES[type]) notFound();
  const page = Math.max(1, Number(sp.page) || 1);
  const genre = sp.genre;
  const genres = type === "anime" ? ANIME_GENRES : MOVIE_GENRES;

  let cards: React.ReactNode[] = [];
  if (type === "anime") {
    const list = await getAnimeList({ genre, page, perPage: 30 });
    cards = list.map((a) => <AnimeCard key={a.id} anime={a} />);
  } else {
    const list = await getCatalog(type as "movie" | "series", { genre, skip: (page - 1) * PAGE });
    cards = list.map((i) => <ItemCard key={i.id} item={i} />);
  }

  const href = (g?: string, p?: number) => {
    const q = new URLSearchParams();
    if (g) q.set("genre", g);
    if (p && p > 1) q.set("page", String(p));
    const s = q.toString();
    return `/browse/${type}${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-white">{TITLES[type]}</h1>
      <p className="mt-1 text-sm text-white/45">{genre ? `${genre} · page ${page}` : `Popular right now · page ${page}`}</p>

      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-2">
        <Link href={href()} className="chip" data-active={!genre}>All</Link>
        {genres.map((g) => (
          <Link key={g} href={href(g)} className="chip" data-active={genre === g}>{g}</Link>
        ))}
      </div>

      <div className="mt-8">
        {cards.length ? <Grid>{cards}</Grid> : <div className="glass rounded-3xl p-10 text-center text-sm text-white/50">Nothing found.</div>}
      </div>

      <div className="mt-12 flex justify-center gap-3">
        {page > 1 && <Link href={href(genre, page - 1)} className="btn">← Previous</Link>}
        {cards.length >= 20 && <Link href={href(genre, page + 1)} className="btn">Next →</Link>}
      </div>
    </div>
  );
}
