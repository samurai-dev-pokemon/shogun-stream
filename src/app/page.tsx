import { getAnimeList, getCatalog } from "@/lib/catalog";
import { AnimeCard, Hero, ItemCard, Row } from "@/components/media";
import { ContinueRow } from "@/components/LibraryViews";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [movies, series, anime, scifi, drama, action] = await Promise.all([
    getCatalog("movie"),
    getCatalog("series"),
    getAnimeList({ perPage: 20 }),
    getCatalog("movie", { genre: "Sci-Fi" }),
    getCatalog("series", { genre: "Drama" }),
    getCatalog("movie", { genre: "Action" }),
  ]);

  const featured = movies.find((m) => m.description && m.background) ?? movies[0];

  return (
    <div>
      {featured ? (
        <Hero item={featured} />
      ) : (
        <div className="glass rounded-3xl p-10 text-center text-white/60">Catalog is unavailable right now. Please try again shortly.</div>
      )}

      <ContinueRow />

      {movies.length > 0 && (
        <Row title="Popular movies" href="/browse/movie">
          {movies.slice(0, 18).map((i) => <ItemCard key={i.id} item={i} />)}
        </Row>
      )}
      {series.length > 0 && (
        <Row title="Popular series" href="/browse/series">
          {series.slice(0, 18).map((i) => <ItemCard key={i.id} item={i} />)}
        </Row>
      )}
      {anime.length > 0 && (
        <Row title="Trending anime" href="/browse/anime">
          {anime.map((a) => <AnimeCard key={a.id} anime={a} />)}
        </Row>
      )}
      {scifi.length > 0 && (
        <Row title="Science fiction" href="/browse/movie?genre=Sci-Fi">
          {scifi.slice(0, 18).map((i) => <ItemCard key={i.id} item={i} />)}
        </Row>
      )}
      {drama.length > 0 && (
        <Row title="Drama series" href="/browse/series?genre=Drama">
          {drama.slice(0, 18).map((i) => <ItemCard key={i.id} item={i} />)}
        </Row>
      )}
      {action.length > 0 && (
        <Row title="Action" href="/browse/movie?genre=Action">
          {action.slice(0, 18).map((i) => <ItemCard key={i.id} item={i} />)}
        </Row>
      )}
    </div>
  );
}
