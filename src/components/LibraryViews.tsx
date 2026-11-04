"use client";

import Link from "next/link";
import { clearHistory, clearList, removeHistory, toggleList, useHistory, useMyList, type HistoryEntry } from "@/lib/store";
import { Grid, PosterCard, SectionHeader } from "./media";

export function historyHref(h: HistoryEntry) {
  const q = h.season && h.episode ? `?s=${h.season}&e=${h.episode}` : h.type === "anime" && h.episode ? `?e=${h.episode}` : "";
  return `/watch/${h.type}/${h.id}${q}`;
}

function histSub(h: HistoryEntry) {
  if (h.type === "series") return `S${h.season} · E${h.episode}`;
  if (h.type === "anime" && h.episode) return `Episode ${h.episode}`;
  return "Movie";
}

export function ContinueRow() {
  const history = useHistory();
  const items = history.filter((h) => h.duration > 0 && h.currentTime / h.duration < 0.95);
  if (!items.length) return null;
  return (
    <section className="mt-12">
      <SectionHeader title="Continue watching" href="/library" />
      <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        {items.slice(0, 12).map((h) => (
          <div key={`${h.type}:${h.id}`} className="w-[8.5rem] shrink-0 sm:w-40 lg:w-44">
            <PosterCard href={historyHref(h)} title={h.name} poster={h.poster} sub={histSub(h)} progress={(h.currentTime / h.duration) * 100} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function LibraryView() {
  const history = useHistory();
  const list = useMyList();

  return (
    <div className="space-y-14">
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-medium text-white">Continue watching</h2>
          {history.length > 0 && (
            <button className="text-xs text-white/50 hover:text-white" onClick={clearHistory}>
              Clear history
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <Empty text="Nothing here yet. Start something and it will pick up where you left off." />
        ) : (
          <Grid>
            {history.map((h) => (
              <div key={`${h.type}:${h.id}`} className="group relative">
                <PosterCard
                  href={historyHref(h)}
                  title={h.name}
                  poster={h.poster}
                  sub={histSub(h)}
                  progress={h.duration ? (h.currentTime / h.duration) * 100 : undefined}
                />
                <button
                  aria-label="Remove"
                  onClick={() => removeHistory(h.type, h.id)}
                  className="glass glass-strong absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-white/70 opacity-0 transition hover:text-white group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))}
          </Grid>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-medium text-white">My List</h2>
          {list.length > 0 && (
            <button className="text-xs text-white/50 hover:text-white" onClick={clearList}>
              Clear list
            </button>
          )}
        </div>
        {list.length === 0 ? (
          <Empty text="Add titles with the My List button and they will show up here." />
        ) : (
          <Grid>
            {list.map((l) => (
              <div key={`${l.type}:${l.id}`} className="group relative">
                <PosterCard href={`/watch/${l.type}/${l.id}`} title={l.name} poster={l.poster} sub={l.year} />
                <button
                  aria-label="Remove"
                  onClick={() => toggleList(l)}
                  className="glass glass-strong absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-white/70 opacity-0 transition hover:text-white group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))}
          </Grid>
        )}
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="glass rounded-3xl px-6 py-10 text-center text-sm text-white/50">
      {text}
      <div className="mt-4">
        <Link href="/" className="btn">Browse titles</Link>
      </div>
    </div>
  );
}
