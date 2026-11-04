"use client";

import { useSyncExternalStore } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebase";

export type LibType = "movie" | "series" | "anime";

export const ACCENTS = {
  crimson: {
    label: "Crimson",
    name: "Crimson",
    color: "#e11d48",
    hex: "#e11d48",
    accent: "#e11d48",
    accent2: "#ff3358",
    soft: "rgba(225, 29, 72, 0.22)",
    glow: "rgba(225, 29, 72, 0.35)",
  },
  gold: {
    label: "Kintsugi Gold",
    name: "Kintsugi Gold",
    color: "#f59e0b",
    hex: "#f59e0b",
    accent: "#f59e0b",
    accent2: "#fbbf24",
    soft: "rgba(245, 158, 11, 0.22)",
    glow: "rgba(245, 158, 11, 0.35)",
  },
  jade: {
    label: "Jade",
    name: "Jade",
    color: "#10b981",
    hex: "#10b981",
    accent: "#10b981",
    accent2: "#34d399",
    soft: "rgba(16, 185, 129, 0.22)",
    glow: "rgba(16, 185, 129, 0.35)",
  },
  indigo: {
    label: "Indigo",
    name: "Indigo",
    color: "#6366f1",
    hex: "#6366f1",
    accent: "#6366f1",
    accent2: "#818cf8",
    soft: "rgba(99, 102, 241, 0.22)",
    glow: "rgba(99, 102, 241, 0.35)",
  },
  sakura: {
    label: "Sakura",
    name: "Sakura",
    color: "#ec4899",
    hex: "#ec4899",
    accent: "#ec4899",
    accent2: "#f472b6",
    soft: "rgba(236, 72, 153, 0.22)",
    glow: "rgba(236, 72, 153, 0.35)",
  },
} as const;

export type AccentKey = keyof typeof ACCENTS;

export type ProgressItem = {
  id: string;
  type: LibType;
  title: string;
  poster?: string;
  backdrop?: string;
  year?: string | number;
  rating?: number | string;
  season?: number;
  episode?: number;
  epTitle?: string;
  episodeTitle?: string;
  server?: string;
  subOrDub?: "sub" | "dub";
  dub?: boolean;
  position: number;
  progress?: number;
  duration: number;
  updatedAt: number;
  malId?: number;
  anilistId?: number;
};

export type HistoryEntry = ProgressItem;

export type MediaItem = {
  id: string;
  type: LibType;
  title: string;
  poster?: string;
  backdrop?: string;
  year?: string | number;
  rating?: number | string;
  genres?: string[];
  overview?: string;
  addedAt?: number;
  malId?: number;
  anilistId?: number;
};

export type ListEntry = MediaItem;

export type Settings = {
  accent: AccentKey;
  server: string;
  autoplay: boolean;
  autonext: boolean;
  nextEpisode: boolean;
  dub: boolean;
  subOrDub: "sub" | "dub";
  defaultSub: string;
  hide: string[];
  theater: boolean;
  defaultMovieServer: string;
  defaultAnimeServer: string;
  defaultAnimeCategory: "sub" | "dub";
  autoplayNext: boolean;
  skipIntro: boolean;
  subtitleLang: string;
  accentCrimson: boolean;
  reducedMotion: boolean;
  theaterByDefault: boolean;
  adultFilter: boolean;
};

export type UserProfile = {
  uid: string | null;
  email: string | null;
  displayName: string | null;
  avatar: string | null;
};

export const defaultSettings: Settings = {
  accent: "crimson",
  server: "auto",
  autoplay: true,
  autonext: true,
  nextEpisode: true,
  dub: false,
  subOrDub: "sub",
  defaultSub: "en",
  hide: [],
  theater: false,
  defaultMovieServer: "vidsrc-cc",
  defaultAnimeServer: "hianime-hd1",
  defaultAnimeCategory: "sub",
  autoplayNext: true,
  skipIntro: true,
  subtitleLang: "English",
  accentCrimson: true,
  reducedMotion: false,
  theaterByDefault: false,
  adultFilter: true,
};

export const defaultProfile: UserProfile = {
  uid: null,
  email: null,
  displayName: null,
  avatar: null,
};

const EMPTY_HISTORY: ProgressItem[] = [];
const EMPTY_LIST: MediaItem[] = [];

const getServerHistory = () => EMPTY_HISTORY;
const getServerList = () => EMPTY_LIST;
const getServerProfile = () => defaultProfile;

const HISTORY_KEY = "shogun:history";
const LIST_KEY = "shogun:list";
const SETTINGS_KEY = "shogun:settings";
const PROFILE_KEY = "shogun:profile";

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

function emit(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

function subscribe(key: string, fn: Listener) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(fn);
  return () => {
    listeners.get(key)?.delete(fn);
  };
}

const subscribeSettings = (cb: Listener) => subscribe(SETTINGS_KEY, cb);
const subscribeHistory = (cb: Listener) => subscribe(HISTORY_KEY, cb);
const subscribeList = (cb: Listener) => subscribe(LIST_KEY, cb);
const subscribeProfile = (cb: Listener) => subscribe(PROFILE_KEY, cb);

const cache = new Map<string, { raw: string | null; parsed: unknown }>();

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (cache.has(key) && cache.get(key)!.raw === raw) {
      return cache.get(key)!.parsed as T;
    }
    const parsed = raw ? (JSON.parse(raw) as T) : fallback;
    cache.set(key, { raw, parsed });
    return parsed;
  } catch {
    return fallback;
  }
}

function readMerged<T extends object>(key: string, defaults: T): T {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(key);
    if (cache.has(key) && cache.get(key)!.raw === raw) {
      return cache.get(key)!.parsed as T;
    }
    const parsed = raw
      ? ({ ...defaults, ...(JSON.parse(raw) as Partial<T>) } as T)
      : defaults;
    cache.set(key, { raw, parsed });
    return parsed;
  } catch {
    return defaults;
  }
}

function writeLocalOnly<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify(value);
    localStorage.setItem(key, raw);
    cache.set(key, { raw, parsed: value });
    emit(key);
  } catch {}
}

// --- Firestore Cloud Sync State ---
let currentUid: string | null = null;
let unsubscribeSnapshot: (() => void) | null = null;
let pendingSignupProfile: { displayName?: string; avatar?: string | null } | null = null;

export function setPendingSignupProfile(data: {
  displayName?: string;
  avatar?: string | null;
}) {
  pendingSignupProfile = data;
}

async function pushToCloud(data: Record<string, unknown>) {
  if (!currentUid || !isFirebaseConfigured) return;
  try {
    const userRef = doc(db, "users", currentUid);
    await setDoc(userRef, { ...data, updatedAt: Date.now() }, { merge: true });
  } catch (err) {
    console.error("Failed to sync with Firestore:", err);
  }
}

function writeJSON<T>(key: string, value: T) {
  writeLocalOnly(key, value);

  if (currentUid && isFirebaseConfigured) {
    if (key === SETTINGS_KEY) pushToCloud({ settings: value });
    if (key === HISTORY_KEY) pushToCloud({ history: value });
    if (key === LIST_KEY) pushToCloud({ list: value });
  }
}

// Initialize Auth + Real-Time Firestore Listener on Client
if (typeof window !== "undefined" && isFirebaseConfigured) {
  onAuthStateChanged(auth, async (user) => {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }

    if (user) {
      currentUid = user.uid;
      const userRef = doc(db, "users", user.uid);

      if (pendingSignupProfile) {
        const initialProfile: UserProfile = {
          uid: user.uid,
          email: user.email,
          displayName:
            pendingSignupProfile.displayName ||
            user.displayName ||
            user.email?.split("@")[0] ||
            "Ronin",
          avatar: pendingSignupProfile.avatar || user.photoURL || null,
        };
        pendingSignupProfile = null;
        writeLocalOnly(PROFILE_KEY, initialProfile);
        await pushToCloud({
          email: initialProfile.email,
          displayName: initialProfile.displayName,
          avatar: initialProfile.avatar,
          settings: getSettings(),
          history: getHistory(),
          list: getMyList(),
        });
      }

      unsubscribeSnapshot = onSnapshot(
        userRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();

            if (data.settings) {
              writeLocalOnly(SETTINGS_KEY, {
                ...defaultSettings,
                ...data.settings,
              });
            }
            if (Array.isArray(data.history)) {
              writeLocalOnly(HISTORY_KEY, data.history);
            }
            if (Array.isArray(data.list)) {
              writeLocalOnly(LIST_KEY, data.list);
            }

            const syncedProfile: UserProfile = {
              uid: user.uid,
              email: user.email,
              displayName:
                data.displayName ||
                user.displayName ||
                user.email?.split("@")[0] ||
                "Ronin",
              avatar: data.avatar || user.photoURL || null,
            };
            writeLocalOnly(PROFILE_KEY, syncedProfile);
          } else {
            const initialProfile: UserProfile = {
              uid: user.uid,
              email: user.email,
              displayName:
                user.displayName || user.email?.split("@")[0] || "Ronin",
              avatar: user.photoURL || null,
            };
            writeLocalOnly(PROFILE_KEY, initialProfile);
            pushToCloud({
              email: initialProfile.email,
              displayName: initialProfile.displayName,
              avatar: initialProfile.avatar,
              settings: getSettings(),
              history: getHistory(),
              list: getMyList(),
            });
          }
        },
        (err) => {
          console.error("Firestore user listener error:", err);
        }
      );
    } else {
      currentUid = null;
      writeLocalOnly(PROFILE_KEY, defaultProfile);
    }
  });
}

// --- Avatar Compression Helper ---
export function compressAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const size = 200;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas context unavailable"));

        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;

        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

        let dataUrl = canvas.toDataURL("image/webp", 0.82);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Invalid image file"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function updateUserAvatar(avatarDataUrl: string | null) {
  const current = getUserProfile();
  const next: UserProfile = { ...current, avatar: avatarDataUrl };
  writeLocalOnly(PROFILE_KEY, next);
  if (currentUid && isFirebaseConfigured) {
    await pushToCloud({ avatar: avatarDataUrl });
  }
}

export async function updateUserDisplayName(displayName: string) {
  const current = getUserProfile();
  const next: UserProfile = { ...current, displayName };
  writeLocalOnly(PROFILE_KEY, next);
  if (currentUid && isFirebaseConfigured) {
    await pushToCloud({ displayName });
  }
}

export function getUserProfile(): UserProfile {
  return readMerged<UserProfile>(PROFILE_KEY, defaultProfile);
}

export function useUserProfile(): UserProfile {
  return useSyncExternalStore(
    subscribeProfile,
    getUserProfile,
    getServerProfile
  );
}

// --- History / Continue Watching ---
export function getHistory(): ProgressItem[] {
  return readJSON<ProgressItem[]>(HISTORY_KEY, EMPTY_HISTORY);
}

export function saveProgress(
  item: Omit<ProgressItem, "updatedAt" | "position" | "duration"> & {
    position?: number;
    duration?: number;
    updatedAt?: number;
  }
) {
  const list = getHistory().filter(
    (x) => !(x.id === item.id && x.type === item.type)
  );
  const next: ProgressItem[] = [
    {
      ...item,
      position: item.position ?? item.progress ?? 0,
      duration: item.duration ?? 0,
      updatedAt: item.updatedAt ?? Date.now(),
    },
    ...list,
  ].slice(0, 40);
  writeJSON(HISTORY_KEY, next);
}

export const upsertHistory = saveProgress;

export function removeProgress(
  a: string | { id: string; type?: string },
  b?: string
) {
  if (typeof a === "object" && a !== null) {
    const next = getHistory().filter(
      (x) => !(x.id === a.id && (!a.type || x.type === a.type))
    );
    writeJSON(HISTORY_KEY, next);
    return;
  }
  const next = getHistory().filter((x) => {
    if (!b) return x.id !== a && `${x.type}:${x.id}` !== a;
    return !((x.id === a && x.type === b) || (x.type === a && x.id === b));
  });
  writeJSON(HISTORY_KEY, next);
}

export const removeHistory = removeProgress;

export function clearHistory() {
  writeJSON(HISTORY_KEY, EMPTY_HISTORY);
}

export function getItemProgress(
  a: string,
  b?: string
): ProgressItem | undefined {
  const list = getHistory();
  if (!b) {
    return list.find((x) => x.id === a || `${x.type}:${x.id}` === a);
  }
  return list.find(
    (x) => (x.id === a && x.type === b) || (x.type === a && x.id === b)
  );
}

export const getHistoryEntry = getItemProgress;

// --- Watchlist ---
export function getMyList(): MediaItem[] {
  return readJSON<MediaItem[]>(LIST_KEY, EMPTY_LIST);
}

export function toggleMyList(item: MediaItem): boolean {
  const list = getMyList();
  const exists = list.some((x) => x.id === item.id && x.type === item.type);
  const next = exists
    ? list.filter((x) => !(x.id === item.id && x.type === item.type))
    : [{ ...item, addedAt: item.addedAt ?? Date.now() }, ...list];
  writeJSON(LIST_KEY, next);
  return !exists;
}

export const toggleList = toggleMyList;

export function isInMyList(id: string, type: string): boolean {
  return getMyList().some((x) => x.id === id && x.type === type);
}

export function clearMyList() {
  writeJSON(LIST_KEY, EMPTY_LIST);
}

export const clearList = clearMyList;

// --- Settings ---
export function getSettings(): Settings {
  return readMerged<Settings>(SETTINGS_KEY, defaultSettings);
}

export function updateSettings(patch: Partial<Settings>) {
  const next = { ...getSettings(), ...patch };
  writeJSON(SETTINGS_KEY, next);
}

export function resetSettings() {
  writeJSON(SETTINGS_KEY, defaultSettings);
}

export type SettingsHookResult = Settings & {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
};

let cachedSettingsRef: Settings | null = null;
let cachedSettingsSnapshot: SettingsHookResult | null = null;

function getSettingsSnapshot(): SettingsHookResult {
  const s = getSettings();
  if (cachedSettingsRef === s && cachedSettingsSnapshot) {
    return cachedSettingsSnapshot;
  }
  cachedSettingsRef = s;
  cachedSettingsSnapshot = {
    ...s,
    settings: s,
    update: updateSettings,
    reset: resetSettings,
  };
  return cachedSettingsSnapshot;
}

const SERVER_SETTINGS_SNAPSHOT: SettingsHookResult = {
  ...defaultSettings,
  settings: defaultSettings,
  update: updateSettings,
  reset: resetSettings,
};

const getServerSettingsSnapshot = () => SERVER_SETTINGS_SNAPSHOT;

// --- React Hooks ---
export function useHistory(): ProgressItem[] {
  return useSyncExternalStore(
    subscribeHistory,
    getHistory,
    getServerHistory
  );
}

export function useMyList(): MediaItem[] {
  return useSyncExternalStore(
    subscribeList,
    getMyList,
    getServerList
  );
}

export function useSettings(): SettingsHookResult {
  return useSyncExternalStore(
    subscribeSettings,
    getSettingsSnapshot,
    getServerSettingsSnapshot
  );
}