import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { animeEpisodeCount, getAnime, getAnimeList, getCatalog, getMeta, type Episode } from "@/lib/catalog";
import Player from "@/components/Player";
import ListButton from "@/components/ListButton";
import { AnimeCard, ItemCard, Row } from "@/components/media";

export const dynamic = "force-dynamic";

type P = { type: string; id: string };

export async function generateMetadata({ params }: { params: Promise<P> }): Promise<Metadata> {
  const { type, id } = await params;
  if (type === "anime") {
    const a = await getAnime(Number(id));
    return { title: a ? `Watch ${a.title}` : "Watch" };
  }
  if (type === "movie" || type === "series") {
    const m = await getMeta(type, id);
    return { title: m ? `Watch ${m.name}` : "Watch" };
  }
  return { title: "Watch" };
}

function Pills({ items }: { items: (string | number | null | undefined)[] }) {
  const list = items.filter(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/55">
      {list.map((x, i) => (
        <span key={i}>
          {i > 0 ? "· " : ""}
          {x}
        </span>
      ))}
    </div>
  );
}

export default async function Watch({
  params,
  searchParams,
}: {
  params: Promise<P>;
  searchParams: Promise<{ s?: string; e?: string }>;
}) {
  const { type, id } = await params;
  const sp = await searchParams;
  const e = Number(sp.e);
  const s = Number(sp.s);

  if (type === "anime") {
    const anime = await getAnime(Number(id));
    if (!anime) notFound();
    const count = animeEpisodeCount(anime);
    const episodes: Episode[] = Array.from({ length: count }, (_, i) => ({ season: 1, episode: i + 1, name: `Episode ${i + 1}` }));
    const initial = e > 0 && e <= Math.max(count, 1) ? { season: 1, episode: e } : undefined;
    const similar = anime.genres[0] ? (await getAnimeList({ genre: anime.genres[0], perPage: 16 })).filter((a) => a.id !== anime.id) : [];

    return (
      <>
        <Player
          kind="anime"
          id={String(anime.id)}
          title={anime.title}
          poster={anime.cover}
          background={anime.banner ?? undefined}
          isAnimeMovie={anime.format === "MOVIE"}
          episodes={episodes}
          initial={initial}
        >
          <h1 className="text-3xl font-semibold tracking-tight text-white">{anime.title}</h1>
          <div className="mt-2">
            <Pills items={[anime.year, anime.format === "MOVIE" ? "Movie" : "Anime", anime.score ? `★ ${(anime.score / 10).toFixed(1)}` : null, count ? `${count} episodes` : null, anime.status?.toLowerCase().replace("_", " ")]} />
          </div>
          {anime.description ? <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/60">{anime.description}</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            {anime.genres.map((g) => (
              <span key={g} className="chip">{g}</span>
            ))}
          </div>
          <div className="mt-6">
            <ListButton entry={{ type: "anime", id: String(anime.id), name: anime.title, poster: anime.cover, year: anime.year ? String(anime.year) : undefined }} />
          </div>
        </Player>
        {similar.length > 0 && (
          <Row title="More like this">
            {similar.map((a) => <AnimeCard key={a.id} anime={a} />)}
          </Row>
        )}
      </>
    );
  }

  if (type !== "movie" && type !== "series") notFound();
  const meta = await getMeta(type, id);
  if (!meta) notFound();

  const initial =
    type === "series" && s > 0 && e > 0 && meta.episodes.some((x) => x.season === s && x.episode === e) ? { season: s, episode: e } : undefined;
  const similar = meta.genres[0] ? (await getCatalog(type, { genre: meta.genres[0] })).filter((i) => i.id !== meta.id).slice(0, 18) : [];

  return (
    <>
      <Player
        kind={type}
        id={meta.id}
        tmdbId={meta.tmdbId}
        title={meta.name}
        poster={meta.poster}
        background={meta.background}
        episodes={meta.episodes}
        initial={initial}
      >
        <h1 className="text-3xl font-semibold tracking-tight text-white">{meta.name}</h1>
        <div className="mt-2">
          <Pills items={[meta.year, type === "movie" ? "Movie" : "Series", meta.rating ? `★ ${meta.rating}` : null, meta.runtime, meta.status]} />
        </div>
        {meta.description ? <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/60">{meta.description}</p> : null}
        <div className="mt-5 flex flex-wrap gap-2">
          {meta.genres.map((g) => (
            <span key={g} className="chip">{g}</span>
          ))}
        </div>
        {(meta.cast.length > 0 || meta.director.length > 0) && (
          <dl className="mt-6 space-y-2 text-sm">
            {meta.director.length > 0 && (
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-white/35">Director</dt><dd className="text-white/70">{meta.director.join(", ")}</dd></div>
            )}
            {meta.cast.length > 0 && (
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-white/35">Cast</dt><dd className="text-white/70">{meta.cast.slice(0, 6).join(", ")}</dd></div>
            )}
          </dl>
        )}
        <div className="mt-6">
          <ListButton entry={{ type, id: meta.id, name: meta.name, poster: meta.poster, year: meta.year }} />
        </div>
      </Player>
      {similar.length > 0 && (
        <Row title="More like this">
          {similar.map((i) => <ItemCard key={i.id} item={i} />)}
        </Row>
      )}
    </>
  );
}
