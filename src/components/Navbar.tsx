"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import {
  compressAvatarFile,
  setPendingSignupProfile,
  updateUserAvatar,
  updateUserDisplayName,
  useUserProfile,
} from "@/lib/store";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/browse/movie", label: "Movies" },
  { href: "/browse/series", label: "Series" },
  { href: "/browse/anime", label: "Anime" },
  { href: "/library", label: "Library" },
];

const icon = "h-[15px] w-[15px] shrink-0";

type SearchResult = {
  id: string;
  type: "movie" | "series" | "anime";
  title: string;
  poster: string;
  year?: string | number;
  rating?: string | number;
};

function formatAuthError(code?: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/popup-closed-by-user":
      return "Sign-in popup was closed.";
    default:
      return "Authentication failed. Please try again.";
  }
}

async function fetchRecommendations(query: string, signal: AbortSignal): Promise<SearchResult[]> {
  const q = query.trim();

  if (!q) {
    const res = await fetch("https://v3-cinemeta.strem.io/catalog/movie/top.json", { signal });
    const data = await res.json();
    return (data?.metas ?? []).slice(0, 6).map((m: any) => ({
      id: m.id,
      type: "movie" as const,
      title: m.name,
      poster: m.poster || `https://images.metahub.space/poster/small/${m.id}/img`,
      year: m.releaseInfo ? String(m.releaseInfo).slice(0, 4) : undefined,
      rating: m.imdbRating,
    }));
  }

  const encoded = encodeURIComponent(q);
  const [moviesRes, seriesRes, animeRes] = await Promise.allSettled([
    fetch(`https://v3-cinemeta.strem.io/catalog/movie/top/search=${encoded}.json`, { signal }).then((r) => r.json()),
    fetch(`https://v3-cinemeta.strem.io/catalog/series/top/search=${encoded}.json`, { signal }).then((r) => r.json()),
    fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query ($search: String) {
            Page(perPage: 4) {
              media(type: ANIME, search: $search, sort: [POPULARITY_DESC], isAdult: false) {
                id
                title { english romaji }
                coverImage { medium large }
                seasonYear
                averageScore
              }
            }
          }
        `,
        variables: { search: q },
      }),
      signal,
    }).then((r) => r.json()),
  ]);

  const results: SearchResult[] = [];

  if (moviesRes.status === "fulfilled") {
    for (const m of (moviesRes.value?.metas ?? []).slice(0, 4)) {
      results.push({
        id: m.id,
        type: "movie",
        title: m.name,
        poster: m.poster || `https://images.metahub.space/poster/small/${m.id}/img`,
        year: m.releaseInfo ? String(m.releaseInfo).slice(0, 4) : undefined,
        rating: m.imdbRating,
      });
    }
  }

  if (seriesRes.status === "fulfilled") {
    for (const s of (seriesRes.value?.metas ?? []).slice(0, 3)) {
      results.push({
        id: s.id,
        type: "series",
        title: s.name,
        poster: s.poster || `https://images.metahub.space/poster/small/${s.id}/img`,
        year: s.releaseInfo ? String(s.releaseInfo).slice(0, 4) : undefined,
        rating: s.imdbRating,
      });
    }
  }

  if (animeRes.status === "fulfilled") {
    for (const a of animeRes.value?.data?.Page?.media ?? []) {
      results.push({
        id: String(a.id),
        type: "anime",
        title: a.title?.english || a.title?.romaji || "Untitled",
        poster: a.coverImage?.large || a.coverImage?.medium || "",
        year: a.seasonYear,
        rating: a.averageScore ? (a.averageScore / 10).toFixed(1) : undefined,
      });
    }
  }

  return results.slice(0, 8);
}

export default function Navbar() {
  const path = usePathname();
  const router = useRouter();
  const profile = useUserProfile();

  // Auth & Avatar states
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup" | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupAvatarPreview, setSignupAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Search states
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const navContainerRef = useRef<HTMLDivElement>(null);
  const signupFileRef = useRef<HTMLInputElement>(null);
  const dropdownFileRef = useRef<HTMLInputElement>(null);

  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  // Always jump to the top of the page when changing routes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    setSearchOpen(false);
    setUserMenuOpen(false);
  }, [path]);

  // Clear errors when switching auth tabs
  useEffect(() => {
    setAuthError(null);
  }, [authMode]);

  // Focus input when search expands & close dropdowns when clicking outside
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();

    const onClickOutside = (e: MouseEvent) => {
      if (navContainerRef.current && !navContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setUserMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [searchOpen, userMenuOpen]);

  // Fetch live recommendations / search results
  useEffect(() => {
    if (!searchOpen) return;

    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(() => {
      fetchRecommendations(query, controller.signal)
        .then((items) => {
          setResults(items);
          setLoading(false);
        })
        .catch((err) => {
          if (err?.name !== "AbortError") setLoading(false);
        });
    }, query.trim() ? 220 : 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, searchOpen]);

  // Close auth modal on Escape key & lock body scroll while open
  useEffect(() => {
    if (!authMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAuthMode(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [authMode]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results.length > 0) {
      const first = results[0];
      setSearchOpen(false);
      router.push(`/watch/${first.type}/${first.id}`);
    }
  };

  // Compress selected PFP inside Sign-Up modal
  const handleSignupAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressAvatarFile(file);
      setSignupAvatarPreview(compressedDataUrl);
    } catch {
      setAuthError("Could not process that image file.");
    } finally {
      e.target.value = "";
    }
  };

  // Compress and save PFP directly to Firestore from User Dropdown
  const handleDropdownAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      await updateUserAvatar(file);
    } catch (err) {
      console.error("Failed to save avatar to Firestore:", err);
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    setAuthError(null);
    setAuthLoading(true);

    try {
      if (authMode === "signup") {
        const cleanName = username.trim() || email.split("@")[0];

        setPendingSignupProfile({
          displayName: cleanName,
          avatar: signupAvatarPreview,
        });

        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

        await updateProfile(cred.user, { displayName: cleanName });
        await updateUserDisplayName(cleanName, cred.user.uid);

        if (signupAvatarPreview) {
          await updateUserAvatar(signupAvatarPreview, cred.user.uid);
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }

      setAuthMode(null);
      setUsername("");
      setEmail("");
      setPassword("");
      setSignupAvatarPreview(null);
    } catch (err: any) {
      setPendingSignupProfile(null);
      setAuthError(formatAuthError(err?.code));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!auth) return;

    setAuthError(null);
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setAuthMode(null);
    } catch (err: any) {
      setAuthError(formatAuthError(err?.code));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
    setUserMenuOpen(false);
  };

  const isLoggedIn = Boolean(profile.uid);
  const displayInitial = (profile.displayName || profile.email || "U")[0].toUpperCase();

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-2.5 sm:px-6">
        <div
          ref={navContainerRef}
          className="pointer-events-auto relative mx-auto w-fit"
        >
          <div className="glass glass-strong flex w-fit items-center gap-2 rounded-full px-3 py-1.5 sm:gap-2.5 sm:px-3.5">
            <Link
              href="/"
              aria-label="Shogun Stream home"
              className="flex shrink-0 items-center pl-0.5 opacity-95 transition hover:opacity-100"
            >
              <Logo size={32} />
            </Link>

            <div className="hidden h-4 w-px bg-white/10 md:block" />

            <nav className="hidden items-center gap-0.5 md:flex">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-full border px-3 py-1 text-[13px] font-medium transition ${
                    active(l.href)
                      ? "border-white/15 bg-white/[0.12] text-white"
                      : "border-transparent text-white/60 hover:bg-white/[0.05] hover:text-white/90"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>

            <div className="hidden h-4 w-px bg-white/10 md:block" />

            <div className="flex items-center gap-1">
              {/* Expandable Search Pill */}
              <form
                onSubmit={handleSearchSubmit}
                className={`flex h-7 items-center overflow-hidden rounded-full border transition-all duration-300 ease-out ${
                  searchOpen
                    ? "w-44 border-white/15 bg-white/[0.08] pr-2 sm:w-56"
                    : "w-7 border-transparent hover:bg-white/[0.08]"
                }`}
              >
                <button
                  type="button"
                  aria-label="Search"
                  onClick={() => {
                    setSearchOpen((prev) => !prev);
                    setUserMenuOpen(false);
                  }}
                  className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/65 transition hover:text-white"
                >
                  <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.5-3.5" />
                  </svg>
                </button>

                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search movies, anime..."
                  tabIndex={searchOpen ? 0 : -1}
                  className={`bg-transparent text-xs text-white placeholder-white/40 outline-none transition-all duration-200 ${
                    searchOpen ? "w-full pl-1 opacity-100" : "pointer-events-none w-0 p-0 opacity-0"
                  }`}
                />

                {searchOpen && query && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="ml-1 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/45 hover:text-white"
                  >
                    <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </form>

              <Link
                href="/settings"
                aria-label="Settings"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
                  active("/settings")
                    ? "border-white/15 bg-white/[0.12] text-white"
                    : "border-transparent text-white/60 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
                </svg>
              </Link>

              {/* Auth State: User Avatar Button OR Log in / Sign up */}
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen((prev) => !prev);
                    setSearchOpen(false);
                  }}
                  className="ml-0.5 flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/[0.1] py-0.5 pl-1 pr-2.5 text-xs font-medium text-white transition hover:border-white/25 hover:bg-white/[0.16]"
                >
                  {profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt=""
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
                      {displayInitial}
                    </span>
                  )}
                  <span className="max-w-[5.5rem] truncate">
                    {profile.displayName || profile.email?.split("@")[0]}
                  </span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setAuthMode("login")}
                    className="hidden cursor-pointer rounded-full px-2.5 py-1 text-[13px] font-medium text-white/65 transition hover:text-white sm:inline-flex"
                  >
                    Log in
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthMode("signup")}
                    className="inline-flex cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/[0.12] px-3 py-1 text-[13px] font-medium text-white transition hover:border-white/25 hover:bg-white/[0.18] active:scale-[0.98]"
                  >
                    Sign up
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Logged-In User Dropdown (With Firestore PFP Upload) */}
          {isLoggedIn && userMenuOpen && (
            <div className="glass glass-strong fade-up absolute right-0 top-full mt-2 w-60 rounded-2xl p-2">
              <input
                ref={dropdownFileRef}
                type="file"
                accept="image/*"
                onChange={handleDropdownAvatarChange}
                className="hidden"
              />

              <div className="flex items-center gap-3 border-b border-white/[0.08] px-2.5 py-2.5">
                <button
                  type="button"
                  disabled={avatarUploading}
                  onClick={() => dropdownFileRef.current?.click()}
                  title="Upload custom avatar"
                  className="group relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-full border border-white/15"
                >
                  {profile.avatar ? (
                    <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-[var(--accent)] text-sm font-bold text-white">
                      {displayInitial}
                    </span>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[9px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                    {avatarUploading ? "..." : "Edit"}
                  </span>
                </button>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">
                    {profile.displayName || "Shogun Member"}
                  </p>
                  <p className="truncate text-[11px] text-white/45">{profile.email}</p>
                </div>
              </div>

              <div className="mt-1 space-y-0.5">
                <button
                  type="button"
                  disabled={avatarUploading}
                  onClick={() => dropdownFileRef.current?.click()}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-xs text-white/80 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                >
                  {avatarUploading ? "Saving avatar..." : "Upload custom avatar"}
                </button>
                <Link
                  href="/library"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-white/80 transition hover:bg-white/[0.08] hover:text-white"
                >
                  My Library
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-white/80 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-xs text-rose-400 transition hover:bg-rose-500/10"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}

          {/* Live Search & Recommendations Dropdown */}
          {searchOpen && (
            <div className="glass glass-strong fade-up absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-2xl p-2 sm:w-96">
              <div className="flex items-center justify-between px-2.5 py-1.5">
                <span className="text-[11px] font-medium tracking-wider text-white/45 uppercase">
                  {query.trim() ? "Recommendations" : "Trending Picks"}
                </span>
                {loading && (
                  <span className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-white/80" />
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {results.length === 0 && !loading ? (
                  <p className="py-6 text-center text-xs text-white/45">
                    No matches found for &ldquo;{query}&rdquo;
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {results.map((item) => (
                      <Link
                        key={`${item.type}-${item.id}`}
                        href={`/watch/${item.type}/${item.id}`}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/[0.08]"
                      >
                        <div className="h-12 w-8 shrink-0 overflow-hidden rounded-md bg-white/5">
                          {item.poster ? (
                            <img
                              src={item.poster}
                              alt={item.title}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-white">
                            {item.title}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/45">
                            <span className="capitalize">{item.type}</span>
                            {item.year ? <span>· {item.year}</span> : null}
                            {item.rating ? (
                              <span className="text-amber-400/90">· ★ {item.rating}</span>
                            ) : null}
                          </div>
                        </div>

                        <svg
                          className="h-3.5 w-3.5 shrink-0 text-white/30"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Secondary Pill */}
        <nav className="no-scrollbar pointer-events-auto mx-auto mt-1.5 flex w-fit justify-center overflow-x-auto md:hidden">
          <div className="glass glass-strong flex gap-0.5 rounded-full p-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full border px-3 py-0.5 text-xs font-medium transition ${
                  active(l.href)
                    ? "border-white/15 bg-white/[0.12] text-white"
                    : "border-transparent text-white/60 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      {/* Firebase Auth Liquid Glass Modal */}
      {authMode && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-md transition-opacity"
            onClick={() => setAuthMode(null)}
          />

          <div className="glass glass-strong fade-up relative z-10 w-full max-w-sm rounded-3xl p-6">
            <button
              type="button"
              onClick={() => setAuthMode(null)}
              aria-label="Close modal"
              className="absolute right-4 top-4 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="mb-5 flex flex-col items-center text-center">
              <Logo size={36} />
              <h2 className="mt-3 text-lg font-semibold tracking-tight text-white">
                {authMode === "login" ? "Welcome back" : "Create an account"}
              </h2>
              <p className="mt-0.5 text-xs text-white/50">
                {authMode === "login"
                  ? "Sign in to sync your library and watch history."
                  : "Join Shogun Stream to save your watchlist anywhere."}
              </p>
            </div>

            <div className="mb-4 grid grid-cols-2 rounded-full border border-white/10 bg-black/30 p-1">
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`cursor-pointer rounded-full border py-1.5 text-xs font-medium transition ${
                  authMode === "login"
                    ? "border-white/15 bg-white/[0.12] text-white"
                    : "border-transparent text-white/50 hover:text-white/80"
                }`}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className={`cursor-pointer rounded-full border py-1.5 text-xs font-medium transition ${
                  authMode === "signup"
                    ? "border-white/15 bg-white/[0.12] text-white"
                    : "border-transparent text-white/50 hover:text-white/80"
                }`}
              >
                Sign up
              </button>
            </div>

            {authError && (
              <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                {authError}
              </div>
            )}

            <form className="space-y-3" onSubmit={handleEmailAuth}>
              {authMode === "signup" && (
                <>
                  {/* Custom Firestore Avatar Picker */}
                  <div className="flex flex-col items-center pb-1">
                    <input
                      ref={signupFileRef}
                      type="file"
                      accept="image/*"
                      onChange={handleSignupAvatarSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => signupFileRef.current?.click()}
                      className="group relative flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-white/25 bg-white/[0.04] transition hover:border-white/50 hover:bg-white/[0.08]"
                    >
                      {signupAvatarPreview ? (
                        <img
                          src={signupAvatarPreview}
                          alt="Avatar preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <svg
                          className="h-5 w-5 text-white/45 transition group-hover:text-white/80"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      )}
                    </button>
                    <span className="mt-1.5 text-[11px] text-white/45">
                      {signupAvatarPreview ? "Click to change avatar" : "Upload avatar (optional)"}
                    </span>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-white/70">Username</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="shogun"
                      className="field"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-white/70">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="field"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-white/70">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="field"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="mt-2 inline-flex w-full cursor-pointer items-center justify-center rounded-xl bg-white py-2.5 text-xs font-semibold text-zinc-950 shadow-sm transition hover:bg-zinc-200 active:scale-[0.99] disabled:opacity-50"
              >
                {authLoading
                  ? "Please wait..."
                  : authMode === "login"
                    ? "Log in"
                    : "Create account"}
              </button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[11px] text-white/40">or</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              disabled={authLoading}
              onClick={handleGoogleSignIn}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] py-2.5 text-xs font-medium text-white transition hover:bg-white/[0.12] disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.3 14.8c-.2-.8-.4-1.8-.4-2.8s.2-2 .4-2.8L1.6 6.4C.6 8.4 0 10.6 0 12s.6 3.6 1.6 5.6l3.7-2.8z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5L1.6 16c1.9 3.9 5.8 7 10.4 7z"
                />
              </svg>
              Continue with Google
            </button>
          </div>
        </div>
      )}
    </>
  );
}