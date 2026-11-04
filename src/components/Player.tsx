"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { Episode } from "@/lib/catalog";
import { EMBED_ORIGIN, buildEmbedUrl, type EmbedTarget } from "@/lib/embed";
import { getHistoryEntry, upsertHistory, useSettings, type LibType } from "@/lib/store";
import SmartImg from "./SmartImg";

type Opt = { value: string; label: string; state?: string };
type PState = {
  paused: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  speed: number;
  server?: string;
  servers?: Opt[];
  source?: string;
  sources?: Opt[];
  quality?: string;
  qualities?: Opt[];
  audio?: string;
  audios?: Opt[];
  subtitle?: string;
  subtitles?: Opt[];
  subtitleOffset?: number;
  subtitleStyle?: { size?: number };
  cast?: string;
};

type Props = {
  kind: "movie" | "series" | "anime";
  id: string; // imdb or anilist id
  tmdbId?: number;
  title: string;
  poster: string;
  background?: string;
  isAnimeMovie?: boolean;
  episodes: Episode[];
  initial?: { season: number; episode: number };
  children?: React.ReactNode;
};

const fmt = (t: number) => {
  if (!Number.isFinite(t)) return "0:00";
  const s = Math.floor(t);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

const noop = () => () => {};

export default function Player(props: Props) {
  const { kind, id, tmdbId, title, poster, background, isAnimeMovie, episodes, initial } = props;
  const router = useRouter();
  const { settings } = useSettings();
  const mounted = useSyncExternalStore(noop, () => true, () => false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const firstEp = episodes[0] ?? { season: 1, episode: 1 };
  const [target, setTarget] = useState<{ season: number; episode: number; n: number } | null>(
    initial ? { ...initial, n: 0 } : kind === "movie" || isAnimeMovie ? { season: 0, episode: 0, n: 0 } : null,
  );
  const [current, setCurrent] = useState<{ season: number; episode: number } | null>(initial ?? null);
  const [pstate, setPstate] = useState<PState | null>(null);
  const [uiVisible, setUiVisible] = useState(true);
  const [isFs, setIsFs] = useState(false);
  const [toast, setToast] = useState("");
  const [seasonTab, setSeasonTab] = useState<number>(initial?.season ?? firstEp.season);

  // Resolve starting episode from watch history when the URL doesn't specify one.
  useEffect(() => {
    if (target) return;
    const h = getHistoryEntry(kind, id);
    const start = h?.episode ? { season: h.season ?? 1, episode: h.episode } : { season: firstEp.season, episode: firstEp.episode };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTarget({ ...start, n: 0 });
    setCurrent(start);
    setSeasonTab(start.season);
  }, [target, kind, id, firstEp.season, firstEp.episode]);

  const send = useCallback((msg: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(msg, EMBED_ORIGIN);
  }, []);

  const flash = useCallback((m: string) => {
    setToast(m);
    window.clearTimeout((flash as unknown as { t?: number }).t);
    (flash as unknown as { t?: number }).t = window.setTimeout(() => setToast(""), 3200);
  }, []);

  const embedTarget: EmbedTarget | null = useMemo(() => {
    if (!target) return null;
    if (kind === "movie") return tmdbId ? { kind: "movie", tmdbId } : null;
    if (kind === "series") return tmdbId ? { kind: "tv", tmdbId, season: target.season, episode: target.episode } : null;
    return { kind: "anilist", anilistId: Number(id), episode: isAnimeMovie ? undefined : target.episode };
  }, [target, kind, tmdbId, id, isAnimeMovie]);

  const src = useMemo(() => {
    if (!embedTarget || !mounted) return null;
    return buildEmbedUrl({ target: embedTarget, settings, title, poster: background || poster, origin: window.location.origin });
  }, [embedTarget, settings, title, poster, background, mounted]);

  // Keep latest values for the message handler without re-subscribing.
  const live = useRef({ current, episodes, settings, target });
  useEffect(() => {
    live.current = { current, episodes, settings, target };
  });

  const nextOf = useCallback((season: number, episode: number) => {
    const list = live.current.episodes;
    const i = list.findIndex((e) => e.season === season && e.episode === episode);
    return i >= 0 ? list[i + 1] : undefined;
  }, []);

  const goEpisode = useCallback((season: number, episode: number) => {
    setTarget({ season, episode, n: Date.now() });
    setCurrent({ season, episode });
    setSeasonTab(season);
    setPstate(null);
  }, []);

  const resumeSent = useRef<string>("");
  const qualityApplied = useRef<string>("");
  const srcKey = src ?? "";

  const onLoad = useCallback(() => {
    const s = live.current.settings;
    send({ type: "vidrift:get-state" });
    send({ type: "vidrift:fullscreen-state", on: !!document.fullscreenElement });
    const set: Record<string, unknown> = {
      type: "vidrift:set",
      subtitleStyle: { size: s.subtitleSize, color: s.subtitleColor, background: s.subtitleBackground, font: s.subtitleFont, position: s.subtitlePosition },
    };
    if (s.speed !== 1) set.speed = s.speed;
    send(set);

    if (kind === "series" && s.pageDrivesEpisodes) {
      const c = live.current.current;
      const nx = c ? nextOf(c.season, c.episode) : undefined;
      send({ type: "vidrift:nextup-info", next: nx ? { season: nx.season, episode: nx.episode, name: nx.name, still: nx.thumbnail?.startsWith("https://") ? nx.thumbnail : undefined } : null });
    }

    if (s.resume && resumeSent.current !== srcKey) {
      resumeSent.current = srcKey;
      const h = getHistoryEntry(kind, id);
      const t = live.current.target;
      const sameEp = kind === "movie" || isAnimeMovie || (h && h.season === (t?.season ?? 0) && h.episode === (t?.episode ?? 0)) || (kind === "anime" && h?.episode === t?.episode);
      if (h && sameEp && h.currentTime > 20 && h.duration - h.currentTime > 60) {
        send({ type: "vidrift:resume", currentTime: Math.floor(h.currentTime) });
      }
    }
  }, [send, kind, id, isAnimeMovie, nextOf, srcKey]);

  // Fullscreen is owned by this page (fs=parent) so episode swaps keep fullscreen.
  useEffect(() => {
    const onFs = () => {
      const on = document.fullscreenElement === wrapRef.current;
      setIsFs(on);
      send({ type: "vidrift:fullscreen-state", on });
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [send]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== EMBED_ORIGIN) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data;
      if (!d || typeof d.type !== "string") return;

      switch (d.type) {
        case "vidrift:state": {
          setPstate(d as PState);
          const s = live.current.settings;
          const qs: Opt[] = d.qualities ?? [];
          if (s.quality !== "auto" && qs.length > 1 && qualityApplied.current !== srcKey && qs.some((q) => q.label === s.quality)) {
            qualityApplied.current = srcKey;
            send({ type: "vidrift:set", quality: s.quality });
          }
          break;
        }
        case "vidrift:progress": {
          setPstate((p) => (p ? { ...p, currentTime: d.currentTime, duration: d.duration } : p));
          if (d.currentTime > 10 && d.duration > 0) {
            const season = kind === "series" ? d.season : undefined;
            const episode = kind === "series" ? d.episode : kind === "anime" ? d.anilist?.episode ?? live.current.target?.episode : undefined;
            upsertHistory({
              type: kind as LibType,
              id,
              name: title,
              poster,
              season,
              episode,
              currentTime: d.currentTime,
              duration: d.duration,
              updatedAt: Date.now(),
            });
          }
          break;
        }
        case "vidrift:paused":
          setPstate((p) => (p ? { ...p, paused: true } : p));
          break;
        case "vidrift:unpaused":
          setPstate((p) => (p ? { ...p, paused: false } : p));
          break;
        case "vidrift:ui-visible":
          setUiVisible(true);
          break;
        case "vidrift:ui-hidden":
          setUiVisible(false);
          break;
        case "vidrift:episode":
          if (kind === "series") {
            setCurrent({ season: d.season, episode: d.episode });
            setSeasonTab(d.season);
            setPstate(null);
            const u = new URL(window.location.href);
            u.searchParams.set("s", String(d.season));
            u.searchParams.set("e", String(d.episode));
            window.history.replaceState(null, "", u);
          }
          break;
        case "vidrift:nextup":
          flash("Up next is on its way");
          break;
        case "vidrift:nextup-play": {
          if (kind !== "series") break;
          const nx = nextOf(d.season, d.episode);
          if (nx) goEpisode(nx.season, nx.episode);
          break;
        }
        case "vidrift:ended":
          flash("Finished");
          break;
        case "vidrift:exit":
          if (window.history.length > 1) router.back();
          else router.push("/");
          break;
        case "vidrift:fullscreen":
          if (d.on) wrapRef.current?.requestFullscreen?.().catch(() => {});
          else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          break;
        case "vidrift:command-error":
          flash(d.reason === "click-required" ? "Click inside the player first, then try again" : `Couldn't ${String(d.command).replace("vidrift:", "")}: ${d.reason}`);
          break;
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [kind, id, title, poster, send, flash, router, nextOf, goEpisode, srcKey]);

  const setCmd = (patch: Record<string, unknown>) => {
    send({ type: "vidrift:set", ...patch });
    setPstate((p) => (p ? { ...p, ...("volume" in patch || "muted" in patch || "speed" in patch ? (patch as Partial<PState>) : {}) } : p));
  };

  const isEpisodic = kind !== "movie" && !isAnimeMovie;
  const seasons = Array.from(new Set(episodes.map((e) => e.season)));
  const shown = episodes.filter((e) => e.season === seasonTab);
  const missing = kind !== "anime" && !tmdbId;

  return (
    <div>
      {/* Player */}
      <div
        ref={wrapRef}
        className="glass relative aspect-video w-full overflow-hidden rounded-[1.75rem] bg-black [&:fullscreen]:aspect-auto [&:fullscreen]:rounded-none [&:fullscreen]:border-0"
      >
        {missing ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <p className="text-lg text-white">This title can&apos;t be played yet</p>
            <p className="max-w-md text-sm text-white/50">We couldn&apos;t find a TMDB id for it, which the player needs. Try another title.</p>
          </div>
        ) : src ? (
          <iframe
            key={`${target?.n ?? 0}-${srcKey}`}
            ref={iframeRef}
            src={src}
            onLoad={onLoad}
            title={title}
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture"
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="h-px w-40 overflow-hidden bg-white/10">
              <div className="h-full w-full bg-[var(--accent)]" style={{ animation: "load-bar 1.2s ease-in-out infinite" }} />
            </div>
          </div>
        )}

        {src && !isFs && (
          <div
            className={`pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 transition-opacity duration-300 ${uiVisible ? "opacity-100" : "opacity-0"}`}
          >
            <div className="glass glass-strong flex items-center gap-2 rounded-full px-4 py-1.5 text-xs text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              <span className="max-w-[40vw] truncate">{title}</span>
              {isEpisodic && current ? <span className="text-white/45">{kind === "series" ? `S${current.season} · E${current.episode}` : `Ep ${current.episode}`}</span> : null}
            </div>
          </div>
        )}

        {toast && (
          <div className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2">
            <div className="glass glass-strong rounded-full px-4 py-2 text-xs text-white/85">{toast}</div>
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div>{props.children}</div>
        <ControlPanel pstate={pstate} send={send} setCmd={setCmd} ready={!!src && !missing} />
      </div>

      {isEpisodic && episodes.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-white">Episodes</h2>
            {seasons.length > 1 && (
              <div className="no-scrollbar flex max-w-full gap-2 overflow-x-auto">
                {seasons.map((s) => (
                  <button key={s} className="chip" data-active={s === seasonTab} onClick={() => setSeasonTab(s)}>
                    Season {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((ep) => {
              const active = current?.season === ep.season && current?.episode === ep.episode;
              return (
                <button
                  key={`${ep.season}-${ep.episode}`}
                  onClick={() => goEpisode(ep.season, ep.episode)}
                  className={`glass flex gap-3 rounded-2xl p-2.5 text-left transition hover:border-white/20 ${active ? "!border-[color-mix(in_srgb,var(--accent)_70%,transparent)]" : ""}`}
                >
                  <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-xl bg-white/5">
                    {ep.thumbnail ? <SmartImg src={ep.thumbnail} alt="" className="h-full w-full object-cover" /> : null}
                    {active && <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[0.65rem] uppercase tracking-widest text-white">Playing</span>}
                  </div>
                  <div className="min-w-0 py-1">
                    <p className="text-xs text-white/45">Episode {ep.episode}</p>
                    <p className="truncate text-sm text-white">{ep.name}</p>
                    {ep.overview ? <p className="mt-1 line-clamp-2 text-xs text-white/40">{ep.overview}</p> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------------------------- Control panel ---------------------------- */

function ControlPanel({
  pstate,
  send,
  setCmd,
  ready,
}: {
  pstate: PState | null;
  send: (m: Record<string, unknown>) => void;
  setCmd: (p: Record<string, unknown>) => void;
  ready: boolean;
}) {
  const p = pstate;
  const disabled = !ready || !p;
  const pct = p && p.duration ? (p.currentTime / p.duration) * 100 : 0;

  return (
    <aside className="glass glass-strong h-fit rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Player controls</h3>
        <span className="text-[0.65rem] uppercase tracking-[0.2em] text-white/35">{p ? (p.paused ? "Paused" : "Playing") : "Waiting"}</span>
      </div>

      <div className="mt-4">
        <div className="h-[3px] overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[0.7rem] text-white/40">
          <span>{fmt(p?.currentTime ?? 0)}</span>
          <span>{fmt(p?.duration ?? 0)}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        <button className="btn btn-icon" disabled={disabled} onClick={() => send({ type: "vidrift:skip", seconds: -10 })} aria-label="Back 10 seconds">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
        </button>
        <button className="btn btn-accent h-11 w-11 !p-0" disabled={disabled} onClick={() => send({ type: p?.paused ? "vidrift:play" : "vidrift:pause" })} aria-label={p?.paused ? "Play" : "Pause"}>
          {p?.paused ? (
            <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-white"><path d="M7 4.5v15l13-7.5z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d="M7 5h3.5v14H7zM13.500 5H17v14h-3.500z" /></svg>
          )}
        </button>
        <button className="btn btn-icon" disabled={disabled} onClick={() => send({ type: "vidrift:skip", seconds: 10 })} aria-label="Forward 10 seconds">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
        </button>
        {p && p.cast && p.cast !== "unavailable" && (
          <button className="btn btn-icon" onClick={() => send({ type: "vidrift:cast" })} aria-label="Cast">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" /><path d="M3 12a9 9 0 0 1 9 9M3 16a5 5 0 0 1 5 5M3 20h.01" /></svg>
          </button>
        )}
      </div>

      <div className="mt-5 space-y-4">
        <Labeled label={`Volume${p?.muted ? " · muted" : ""}`}>
          <div className="flex items-center gap-3">
            <button className="text-white/50 hover:text-white" disabled={disabled} onClick={() => setCmd({ muted: !p?.muted })} aria-label="Toggle mute">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H3v6h3l5 4z" />{p?.muted ? <path d="M22 9l-6 6M16 9l6 6" /> : <path d="M15.500 8.500a5 5 0 0 1 0 7" />}</svg>
            </button>
            <input type="range" min={0} max={1} step={0.01} disabled={disabled} value={p?.volume ?? 1} onChange={(e) => setCmd({ volume: Number(e.target.value), muted: false })} />
          </div>
        </Labeled>

        <Labeled label="Speed">
          <div className="flex flex-wrap gap-1.5">
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
              <button key={s} disabled={disabled} className="chip" data-active={p?.speed === s} onClick={() => setCmd({ speed: s })}>
                {s}×
              </button>
            ))}
          </div>
        </Labeled>

        <SelectRow label="Server" value={p?.server} options={p?.servers} onPick={(v) => setCmd({ server: v })} />
        <SelectRow label="Source" value={p?.source} options={p?.sources} onPick={(v) => setCmd({ source: v })} />
        <SelectRow label="Quality" value={p?.quality} options={p?.qualities} onPick={(v) => setCmd({ quality: v })} />
        <SelectRow label="Audio" value={p?.audio} options={p?.audios} onPick={(v) => setCmd({ audio: v })} />
        <SelectRow label="Subtitles" value={p?.subtitle} options={p?.subtitles} onPick={(v) => setCmd({ subtitle: v })} />

        {p?.subtitles && p.subtitles.length > 1 && (
          <>
            <Labeled label={`Subtitle size · ${p.subtitleStyle?.size ?? 100}%`}>
              <input type="range" min={50} max={200} step={10} value={p.subtitleStyle?.size ?? 100} onChange={(e) => setCmd({ subtitleStyle: { size: Number(e.target.value) } })} />
            </Labeled>
            <Labeled label={`Sync to audio · ${(p.subtitleOffset ?? 0).toFixed(1)}s`}>
              <input type="range" min={-30} max={30} step={0.5} value={p.subtitleOffset ?? 0} onChange={(e) => setCmd({ subtitleOffset: Number(e.target.value) })} />
            </Labeled>
          </>
        )}
      </div>
    </aside>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[0.68rem] uppercase tracking-[0.18em] text-white/40">{label}</p>
      {children}
    </div>
  );
}

function SelectRow({ label, value, options, onPick }: { label: string; value?: string; options?: Opt[]; onPick: (v: string) => void }) {
  if (!options || options.length < 2) return null;
  return (
    <Labeled label={label}>
      <select className="field !py-2 text-sm" value={value ?? ""} onChange={(e) => onPick(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
            {o.state === "failed" ? " (unavailable)" : ""}
          </option>
        ))}
      </select>
    </Labeled>
  );
}
