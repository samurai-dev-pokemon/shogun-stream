import type { Settings } from "./store";

export const EMBED_ORIGIN = "https://embed.vidrift.net";

export const HIDE_OPTIONS = [
  "progress",
  "play",
  "volume",
  "skip",
  "time",
  "title",
  "server",
  "next",
  "episodes",
  "subtitles",
  "settings",
  "lock",
  "pip",
  "cast",
  "fullscreen",
  "gradient",
  "pausecard",
] as const;

export const FONT_OPTIONS = ["", "Inter", "Manrope", "DM Sans", "Poppins", "Montserrat", "Space Grotesk", "Playfair Display"];

export type EmbedTarget =
  | { kind: "movie"; tmdbId: number }
  | { kind: "tv"; tmdbId: number; season: number; episode: number }
  | { kind: "anilist"; anilistId: number; episode?: number };

export function buildEmbedUrl(opts: {
  target: EmbedTarget;
  settings: Settings;
  title?: string;
  poster?: string;
  origin?: string;
}): string {
  const { target, settings: s, title, poster, origin } = opts;
  let path = "";
  if (target.kind === "movie") path = `/embed/movie/${target.tmdbId}`;
  else if (target.kind === "tv") path = `/embed/tv/${target.tmdbId}/${target.season}/${target.episode}`;
  else path = `/embed/anilist/${target.anilistId}${target.episode ? `/${target.episode}` : ""}`;

  const p = new URLSearchParams();
  if (title) p.set("title", title);
  p.set("brand", "Shogun Stream");
  p.set("brandColor", ({ crimson: "b13a41", brick: "9c4137", rose: "a8505c", ember: "b0563a" } as const)[s.accent]);
  if (origin && origin.startsWith("https://") && s.watermark) {
    p.set("brandLogo", `${origin}/logo.svg`);
    p.set("watermark", "1");
  }
  if (poster && poster.startsWith("https://")) p.set("poster", poster);
  if (s.showTitle) p.set("showTitle", "1");
  p.set("exit", "1");
  p.set("fs", "parent");
  if (s.uiScale !== 1) p.set("uiScale", String(s.uiScale));
  if (!s.uppercaseLabels) p.set("caps", "0");
  if (s.solidControls) p.set("controlBg", "solid");
  if (s.font) p.set("font", s.font);
  if (s.muted) p.set("muted", "1");
  if (!s.autoplay) p.set("autoplay", "0");
  if (target.kind === "anilist" && s.preferDub) p.set("dub", "1");
  const hide = new Set(s.hide);
  if (s.sidebarControls) ["settings", "subtitles", "server"].forEach((h) => hide.add(h));
  if (hide.size) p.set("hide", Array.from(hide).join(","));

  return `${EMBED_ORIGIN}${path}?${p.toString()}`;
}
