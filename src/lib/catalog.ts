// Keyless metadata sources:
//  - Cinemeta (movies / series) -> returns IMDb id + TMDB id (`moviedb_id`)
//  - Wikidata as a fallback IMDb -> TMDB id resolver
//  - AniList (anime) -> AniList ids, which the embed accepts directly
// If TMDB_API_KEY is configured it is used first to resolve TMDB ids.

export type MediaType = "movie" | "series";

export type Item = {
  id: string; // IMDb id
  type: MediaType;
  name: string;
  poster: string;
  background?: string;
  logo?: string;
  year?: string;
  rating?: string;
  genres: string[];
  description?: string;
};

export type Episode = {
  season: number;
  episode: number;
  name: string;
  thumbnail?: string;
  overview?: string;
  released?: string;
};

export type Meta = Item & {
  runtime?: string;
  cast: string[];
  director: string[];
  status?: string;
  tmdbId?: number;
  episodes: Episode[];
};

export type Anime = {
  id: number;
  title: string;
  cover: string;
  banner?: string | null;
  score?: number | null;
  year?: number | null;
  genres: string[];
  episodes: number | null;
  format?: string | null;
  status?: string | null;
  description?: string;
  nextEp?: number | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

const CINEMETA = "https://v3-cinemeta.strem.io";

async function getJson(url: string, init?: RequestInit & { next?: { revalidate: number } }): Promise<Raw | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 }, ...init });
    if (!res.ok) return null;
    return (await res.json()) as Raw;
  } catch {
    return null;
  }
}

function toItem(raw: Raw, type: MediaType): Item | null {
  const id = raw.imdb_id || raw.id;
  if (!id || typeof id !== "string" || !id.startsWith("tt") || !raw.name) return null;
  return {
    id,
    type,
    name: raw.name,
    poster: raw.poster || `https://images.metahub.space/poster/medium/${id}/img`,
    background: raw.background || undefined,
    logo: raw.logo || undefined,
    year: raw.releaseInfo || raw.year || undefined,
    rating: raw.imdbRating || undefined,
    genres: raw.genres || raw.genre || [],
    description: raw.description || undefined,
  };
}

export async function getCatalog(
  type: MediaType,
  opts: { genre?: string; search?: string; skip?: number } = {},
): Promise<Item[]> {
  const extras = [
    opts.genre ? `genre=${encodeURIComponent(opts.genre)}` : "",
    opts.search ? `search=${encodeURIComponent(opts.search)}` : "",
    opts.skip ? `skip=${opts.skip}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const data = await getJson(`${CINEMETA}/catalog/${type}/top${extras ? `/${extras}` : ""}.json`);
  const metas: Raw[] = data?.metas ?? [];
  return metas.map((m) => toItem(m, type)).filter((x): x is Item => !!x);
}

async function wikidataTmdb(imdb: string, type: MediaType): Promise<number | undefined> {
  const prop = type === "movie" ? "P4947" : "P4983";
  const query = `SELECT ?t WHERE { ?i wdt:P345 '${imdb}'. ?i wdt:${prop} ?t } LIMIT 1`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const data = await getJson(url, {
    headers: { Accept: "application/sparql-results+json", "User-Agent": "ShogunStream/1.0" },
    next: { revalidate: 86400 },
  });
  const v = data?.results?.bindings?.[0]?.t?.value;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function tmdbFind(imdb: string, type: MediaType): Promise<number | undefined> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return undefined;
  const data = await getJson(
    `https://api.themoviedb.org/3/find/${imdb}?external_source=imdb_id&api_key=${encodeURIComponent(key)}`,
    { next: { revalidate: 86400 } },
  );
  const list: Raw[] = (type === "movie" ? data?.movie_results : data?.tv_results) ?? [];
  return list[0]?.id;
}

export async function getMeta(type: MediaType, id: string): Promise<Meta | null> {
  if (!/^tt\d+$/.test(id)) return null;
  const data = await getJson(`${CINEMETA}/meta/${type}/${id}.json`);
  const raw: Raw | undefined = data?.meta;
  if (!raw) return null;
  const item = toItem({ ...raw, id }, type);
  if (!item) return null;

  const videos: Raw[] = raw.videos ?? [];
  const episodes: Episode[] = videos
    .map((v) => ({
      season: Number(v.season),
      episode: Number(v.episode ?? v.number),
      name: v.name || v.title || `Episode ${v.episode ?? v.number}`,
      thumbnail: v.thumbnail || undefined,
      overview: v.overview || v.description || undefined,
      released: v.released || v.firstAired || undefined,
    }))
    .filter((e) => Number.isFinite(e.season) && Number.isFinite(e.episode) && e.season > 0 && e.episode > 0)
    .sort((a, b) => a.season - b.season || a.episode - b.episode);

  let tmdbId: number | undefined = Number(raw.moviedb_id) || undefined;
  if (!tmdbId) tmdbId = await tmdbFind(id, type);
  if (!tmdbId) tmdbId = await wikidataTmdb(id, type);

  return {
    ...item,
    runtime: raw.runtime || undefined,
    cast: raw.cast || [],
    director: raw.director || [],
    status: raw.status || undefined,
    tmdbId,
    episodes,
  };
}

/* ------------------------------ AniList ------------------------------ */

const ANI_FIELDS = `id title{romaji english} coverImage{extraLarge large} bannerImage averageScore seasonYear genres episodes format status description(asHtml:false) nextAiringEpisode{episode}`;

function toAnime(m: Raw): Anime {
  return {
    id: m.id,
    title: m.title?.english || m.title?.romaji || "Untitled",
    cover: m.coverImage?.extraLarge || m.coverImage?.large || "",
    banner: m.bannerImage,
    score: m.averageScore,
    year: m.seasonYear,
    genres: m.genres || [],
    episodes: m.episodes,
    format: m.format,
    status: m.status,
    description: typeof m.description === "string" ? m.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : undefined,
    nextEp: m.nextAiringEpisode?.episode ?? null,
  };
}

async function anilist(query: string, variables: Raw): Promise<Raw | null> {
  const data = await getJson("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 3600 },
  });
  return data?.data ?? null;
}

export async function getAnimeList(opts: { search?: string; genre?: string; page?: number; perPage?: number; sort?: string } = {}): Promise<Anime[]> {
  const data = await anilist(
    `query($page:Int,$perPage:Int,$sort:[MediaSort],$search:String,$genre:String){Page(page:$page,perPage:$perPage){media(type:ANIME,sort:$sort,search:$search,genre:$genre,isAdult:false){${ANI_FIELDS}}}}`,
    {
      page: opts.page ?? 1,
      perPage: opts.perPage ?? 24,
      sort: [opts.search ? "SEARCH_MATCH" : opts.sort ?? "TRENDING_DESC"],
      search: opts.search || undefined,
      genre: opts.genre || undefined,
    },
  );
  const media: Raw[] = data?.Page?.media ?? [];
  return media.map(toAnime);
}

export async function getAnime(id: number): Promise<Anime | null> {
  const data = await anilist(`query($id:Int){Media(id:$id,type:ANIME){${ANI_FIELDS}}}`, { id });
  return data?.Media ? toAnime(data.Media) : null;
}

export function animeEpisodeCount(a: Anime): number {
  if (a.format === "MOVIE") return 0;
  if (a.episodes) return a.episodes;
  if (a.nextEp && a.nextEp > 1) return a.nextEp - 1;
  return 12;
}

export const MOVIE_GENRES = ["Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Family", "Fantasy", "History", "Horror", "Mystery", "Romance", "Sci-Fi", "Thriller", "War", "Western"];
export const ANIME_GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mecha", "Music", "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"];
