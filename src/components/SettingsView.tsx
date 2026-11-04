"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { FONT_OPTIONS, HIDE_OPTIONS, buildEmbedUrl } from "@/lib/embed";
import { ACCENTS, clearHistory, clearList, useHistory, useMyList, useSettings, type AccentKey } from "@/lib/store";

const HIDE_LABELS: Record<string, string> = {
  progress: "Progress bar",
  play: "Play / pause",
  volume: "Volume",
  skip: "Skip buttons",
  time: "Time",
  title: "Title",
  server: "Server",
  next: "Next episode",
  episodes: "Episodes",
  subtitles: "Subtitles",
  settings: "Settings",
  lock: "Lock",
  pip: "Picture in picture",
  cast: "Cast",
  fullscreen: "Fullscreen",
  gradient: "Shading",
  pausecard: "Pause card",
};

type SectionId = "general" | "interface" | "subtitles" | "data";

const NAV_ITEMS: { id: SectionId; label: string; desc: string }[] = [
  { id: "general", label: "General & Playback", desc: "Theme accent, autoplay & quality" },
  { id: "interface", label: "Player Interface", desc: "Layout, scale & visible controls" },
  { id: "subtitles", label: "Subtitles", desc: "Caption styling & live preview" },
  { id: "data", label: "Embed & Data", desc: "Generated URL & local storage" },
];

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-zinc-900/50 p-5 sm:p-6">
      <div className="border-b border-white/[0.06] pb-4">
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
        {desc ? <p className="mt-0.5 text-xs text-zinc-400">{desc}</p> : null}
      </div>
      <div className="divide-y divide-white/[0.05]">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 pr-4">
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-zinc-500">{hint}</p> : null}
      </div>
      <div className=" flex shrink-0 items-center sm:justify-end">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors ${
        on
          ? "border-transparent bg-[var(--accent)]"
          : "border-white/10 bg-zinc-800 hover:bg-zinc-700"
      }`}
    >
      <span
        className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-all ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

const noop = () => () => {};

export default function SettingsView() {
  const { settings: s, update, reset } = useSettings();
  const history = useHistory();
  const list = useMyList();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<SectionId>("general");
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");

  const toggleHide = (k: string) =>
    update({ hide: s.hide.includes(k) ? s.hide.filter((x) => x !== k) : [...s.hide, k] });

  const preview = useMemo(
    () =>
      buildEmbedUrl({
        target: { kind: "movie", tmdbId: 1440098 },
        settings: s,
        title: "Drawn Together",
        origin,
      }),
    [s, origin],
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Settings</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Preferences are saved locally on this device and applied to every player.
          </p>
        </div>
        <button type="button" className="btn self-start sm:self-auto" onClick={reset}>
          Reset defaults
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-[220px_1fr] lg:gap-8">
        {/* Sidebar Navigation */}
        <aside className="flex gap-1.5 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`group flex shrink-0 flex-col rounded-xl border px-3.5 py-2.5 text-left transition ${
                  isActive
                    ? "border-white/12 bg-white/[0.07] text-white"
                    : "border-transparent text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
                }`}
              >
                <span className="text-sm font-medium">{item.label}</span>
                <span className="mt-0.5 hidden text-[11px] text-zinc-500 md:block">{item.desc}</span>
              </button>
            );
          })}
        </aside>

        {/* Main Content Panel */}
        <div className="min-w-0 space-y-6">
          {activeTab === "general" && (
            <>
              <Card title="Appearance" desc="Customize the accent color used across switches, indicators, and the player.">
                <Row label="Accent color" hint="Colors the player progress bar, active indicators, and toggles.">
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(ACCENTS) as AccentKey[]).map((k) => {
                      const selected = s.accent === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          title={ACCENTS[k].label}
                          aria-label={ACCENTS[k].label}
                          onClick={() => update({ accent: k })}
                          className={` flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                            selected
                              ? "border-white/30 bg-white/10 text-white"
                              : "border-white/[0.07] bg-white/[0.02] text-zinc-400 hover:border-white/15 hover:text-zinc-200"
                          }`}
                        >
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ background: ACCENTS[k].color }}
                          />
                          {ACCENTS[k].label}
                        </button>
                      );
                    })}
                  </div>
                </Row>
              </Card>

              <Card title="Playback" desc="Control how streams initialize and progress.">
                <Row label="Autoplay" hint="Start playing immediately when a video source is ready.">
                  <Toggle on={s.autoplay} onChange={(v) => update({ autoplay: v })} label="Autoplay" />
                </Row>
                <Row label="Start muted" hint="Audio stays muted until you click the speaker icon.">
                  <Toggle on={s.muted} onChange={(v) => update({ muted: v })} label="Start muted" />
                </Row>
                <Row label="Resume playback" hint="Pick up where you left off using saved progress events.">
                  <Toggle on={s.resume} onChange={(v) => update({ resume: v })} label="Resume" />
                </Row>
                <Row label="Prefer English dub" hint="Anime opened via AniList ID defaults to the dub server.">
                  <Toggle on={s.preferDub} onChange={(v) => update({ preferDub: v })} label="Prefer dub" />
                </Row>
                <Row label="Page handles Up Next" hint="Let Shogun Stream automatically queue and load the next episode.">
                  <Toggle on={s.pageDrivesEpisodes} onChange={(v) => update({ pageDrivesEpisodes: v })} label="Page drives episodes" />
                </Row>
                <Row label="Default playback speed">
                  <select
                    className="field !w-36 !py-1.5"
                    value={s.speed}
                    onChange={(e) => update({ speed: Number(e.target.value) })}
                  >
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((v) => (
                      <option key={v} value={v}>
                        {v}× {v === 1 ? "(Normal)" : ""}
                      </option>
                    ))}
                  </select>
                </Row>
                <Row label="Preferred quality" hint="Applied automatically when supported by the stream.">
                  <select
                    className="field !w-36 !py-1.5"
                    value={s.quality}
                    onChange={(e) => update({ quality: e.target.value })}
                  >
                    {["auto", "1080p", "720p", "480p", "360p"].map((v) => (
                      <option key={v} value={v}>
                        {v === "auto" ? "Auto" : v}
                      </option>
                    ))}
                  </select>
                </Row>
              </Card>
            </>
          )}

          {activeTab === "interface" && (
            <>
              <Card title="Player interface" desc="Customize the video player chrome and layout.">
                <Row
                  label={`Interface scale · ${s.uiScale.toFixed(2)}×`}
                  hint="Use 1.5× for TV screens or 0.85× for compact windows."
                >
                  <div className="w-48">
                    <input
                      type="range"
                      min={0.5}
                      max={2.5}
                      step={0.05}
                      value={s.uiScale}
                      onChange={(e) => update({ uiScale: Number(e.target.value) })}
                    />
                  </div>
                </Row>
                <Row label="Typeface" hint="Font family used inside the video player.">
                  <select
                    className="field !w-44 !py-1.5"
                    value={s.font}
                    onChange={(e) => update({ font: e.target.value })}
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f || "Player default"}
                      </option>
                    ))}
                  </select>
                </Row>
                <Row label="Solid control bar" hint="Flat dark bar instead of a gradient fade. Easier to read on bright video.">
                  <Toggle on={s.solidControls} onChange={(v) => update({ solidControls: v })} label="Solid controls" />
                </Row>
                <Row label="Always show title bar" hint="Show the media title even when not in fullscreen.">
                  <Toggle on={s.showTitle} onChange={(v) => update({ showTitle: v })} label="Show title" />
                </Row>
                <Row label="Uppercase labels" hint="Render small player badges and labels in uppercase.">
                  <Toggle on={s.uppercaseLabels} onChange={(v) => update({ uppercaseLabels: v })} label="Uppercase labels" />
                </Row>
                <Row label="Use side panel for menus" hint="Move Settings, Subtitles, and Server menus to the panel beside the video.">
                  <Toggle on={s.sidebarControls} onChange={(v) => update({ sidebarControls: v })} label="Side panel" />
                </Row>
                <Row label="Logo watermark" hint="Display a subtle corner watermark when controls fade out.">
                  <Toggle on={s.watermark} onChange={(v) => update({ watermark: v })} label="Watermark" />
                </Row>
              </Card>

              <Card
                title="Hidden controls"
                desc="Select controls to hide from the player bar. Keyboard shortcuts remain active."
              >
                <div className="pt-4">
                  <div className="flex flex-wrap gap-2">
                    {HIDE_OPTIONS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        className="chip"
                        data-active={s.hide.includes(k)}
                        onClick={() => toggleHide(k)}
                      >
                        {HIDE_LABELS[k]}
                      </button>
                    ))}
                  </div>
                  {s.hide.length > 0 && (
                    <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-3 text-xs text-zinc-400">
                      <span>{s.hide.length} control(s) hidden</span>
                      <button
                        type="button"
                        onClick={() => update({ hide: [] })}
                        className="text-zinc-300 underline hover:text-white"
                      >
                        Show all controls
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}

          {activeTab === "subtitles" && (
            <Card title="Subtitles" desc="Applied automatically to every title when the player loads.">
              <div className="py-4">
                <div className="relative flex h-28 items-end justify-center overflow-hidden rounded-xl border border-white/[0.07] bg-zinc-950 pb-4">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.06),transparent_70%)]" />
                  <span
                    className="relative rounded px-2.5 py-0.5 transition-all"
                    style={{
                      fontSize: `${(s.subtitleSize / 100) * 1.05}rem`,
                      color: s.subtitleColor,
                      background: s.subtitleBackground === "box" ? "rgba(0,0,0,0.75)" : "transparent",
                      textShadow:
                        s.subtitleBackground === "shadow" ? "0 1px 4px #000, 0 0 2px #000" : "none",
                      fontFamily:
                        s.subtitleFont === "serif"
                          ? "Georgia, serif"
                          : s.subtitleFont === "system"
                            ? "system-ui"
                            : "inherit",
                      transform: `translateY(-${s.subtitlePosition * 0.4}px)`,
                    }}
                  >
                    The quick brown fox jumps over the lazy dog
                  </span>
                </div>
              </div>

              <Row label={`Caption size · ${s.subtitleSize}%`}>
                <div className="w-48">
                  <input
                    type="range"
                    min={50}
                    max={200}
                    step={10}
                    value={s.subtitleSize}
                    onChange={(e) => update({ subtitleSize: Number(e.target.value) })}
                  />
                </div>
              </Row>

              <Row label="Text color">
                <div className="flex gap-2">
                  {[
                    { hex: "#ffffff", name: "White" },
                    { hex: "#e8e2c8", name: "Warm" },
                    { hex: "#c9c9c9", name: "Silver" },
                    { hex: "#d9a7a7", name: "Rose" },
                  ].map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.name}
                      aria-label={c.name}
                      onClick={() => update({ subtitleColor: c.hex })}
                      className={`h-7 w-7 rounded-full border-2 transition ${
                        s.subtitleColor === c.hex ? "scale-105 border-white" : "border-white/15 hover:border-white/40"
                      }`}
                      style={{ background: c.hex }}
                    />
                  ))}
                </div>
              </Row>

              <Row label="Background style">
                <div className="flex gap-1.5">
                  {(["box", "shadow"] as const).map((b) => (
                    <button
                      key={b}
                      type="button"
                      className="chip capitalize"
                      data-active={s.subtitleBackground === b}
                      onClick={() => update({ subtitleBackground: b })}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </Row>

              <Row label="Font style">
                <select
                  className="field !w-36 !py-1.5"
                  value={s.subtitleFont}
                  onChange={(e) => update({ subtitleFont: e.target.value as typeof s.subtitleFont })}
                >
                  <option value="default">Default</option>
                  <option value="system">System</option>
                  <option value="serif">Serif</option>
                </select>
              </Row>

              <Row label={`Vertical offset · ${s.subtitlePosition}`}>
                <div className="w-48">
                  <input
                    type="range"
                    min={0}
                    max={40}
                    step={1}
                    value={s.subtitlePosition}
                    onChange={(e) => update({ subtitlePosition: Number(e.target.value) })}
                  />
                </div>
              </Row>
            </Card>
          )}

          {activeTab === "data" && (
            <>
              <Card title="Live Embed URL" desc="The exact player URL generated from your current configuration.">
                <div className="pt-4">
                  <code className="block max-h-36 overflow-auto break-all rounded-xl border border-white/[0.07] bg-black/50 p-3.5 font-mono text-xs leading-relaxed text-zinc-400">
                    {preview}
                  </code>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        navigator.clipboard?.writeText(preview).then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        });
                      }}
                    >
                      {copied ? "Copied to clipboard" : "Copy URL"}
                    </button>
                  </div>
                </div>
              </Card>

              <Card title="Local Browser Data" desc="Manage your locally stored watch history and saved list.">
                <Row label="Watch history" hint={`${history.length} item(s) recorded on this browser.`}>
                  <button type="button" className="btn" onClick={clearHistory} disabled={!history.length}>
                    Clear history
                  </button>
                </Row>
                <Row label="My List" hint={`${list.length} title(s) saved to your watchlist.`}>
                  <button type="button" className="btn" onClick={clearList} disabled={!list.length}>
                    Clear list
                  </button>
                </Row>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}