"use client";

import { useSyncExternalStore } from "react";
import { onAuthStateChanged, updateProfile, type User } from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

function createStore<T>(
  key: string,
  defaults: T,
  parse: (raw: unknown) => T,
  onAfterSet?: (val: T) => void,
) {
  let rawCache: string | null | undefined;
  let cache: T = defaults;
  const listeners = new Set<() => void>();

  const getSnapshot = (): T => {
    if (typeof window === "undefined") return defaults;
    const raw = window.localStorage.getItem(key);
    if (raw !== rawCache) {
      rawCache = raw;
      try {
        cache = raw ? parse(JSON.parse(raw)) : defaults;
      } catch {
        cache = defaults;
      }
    }
    return cache;
  };

  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) cb();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  };

  const set = (value: T, skipCloud = false) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
    listeners.forEach((l) => l());
    if (!skipCloud && onAfterSet) {
      onAfterSet(value);
    }
  };

  return { getSnapshot, subscribe, set, getServerSnapshot: () => defaults };
}

/* ---------------------------- Firestore Helper --------------------------- */

async function saveToFirestore(patch: Record<string, unknown>, explicitUid?: string) {
  const uid = explicitUid || auth?.currentUser?.uid;
  if (!uid || !db) return;
  try {
    const ref = doc(db, "users", uid);
    await setDoc(ref, { ...patch, updatedAt: Date.now() }, { merge: true });
  } catch (err) {
    console.error("Firestore sync error:", err);
  }
}

/* ------------------------------- Settings ------------------------------- */

export const ACCENTS = {
  crimson: { label: "Crimson", color: "#b13a41" },
  brick: { label: "Brick", color: "#9c4137" },
  rose: { label: "Rose", color: "#a8505c" },
  ember: { label: "Ember", color: "#b0563a" },
} as const;

export type AccentKey = keyof typeof ACCENTS;

export type Settings = {
  accent: AccentKey;
  autoplay: boolean;
  muted: boolean;
  resume: boolean;
  preferDub: boolean;
  speed: number;
  quality: string;
  pageDrivesEpisodes: boolean;
  uiScale: number;
  uppercaseLabels: boolean;
  solidControls: boolean;
  font: string;
  showTitle: boolean;
  watermark: boolean;
  sidebarControls: boolean;
  hide: string[];
  subtitleSize: number;
  subtitleColor: string;
  subtitleBackground: "box" | "shadow";
  subtitleFont: "default" | "system" | "serif";
  subtitlePosition: number;
};

export const DEFAULT_SETTINGS: Settings = {
  accent: "crimson",
  autoplay: true,
  muted: false,
  resume: true,
  preferDub: false,
  speed: 1,
  quality: "auto",
  pageDrivesEpisodes: false,
  uiScale: 1,
  uppercaseLabels: false,
  solidControls: false,
  font: "",
  showTitle: false,
  watermark: true,
  sidebarControls: false,
  hide: [],
  subtitleSize: 100,
  subtitleColor: "#ffffff",
  subtitleBackground: "box",
  subtitleFont: "default",
  subtitlePosition: 0,
};

const settingsStore = createStore<Settings>(
  "shogun:settings",
  DEFAULT_SETTINGS,
  (raw) => ({
    ...DEFAULT_SETTINGS,
    ...(raw as Partial<Settings>),
  }),
  (val) => saveToFirestore({ settings: val }),
);

export function useSettings() {
  const settings = useSyncExternalStore(
    settingsStore.subscribe,
    settingsStore.getSnapshot,
    settingsStore.getServerSnapshot,
  );
  const update = (patch: Partial<Settings>) =>
    settingsStore.set({ ...settingsStore.getSnapshot(), ...patch });
  const reset = () => settingsStore.set(DEFAULT_SETTINGS);
  return { settings, update, reset };
}

/* -------------------------------- Library -------------------------------- */

export type LibType = "movie" | "series" | "anime";

export type HistoryEntry = {
  type: LibType;
  id: string;
  name: string;
  poster: string;
  season?: number;
  episode?: number;
  currentTime: number;
  duration: number;
  updatedAt: number;
};

export type ListEntry = {
  type: LibType;
  id: string;
  name: string;
  poster: string;
  year?: string;
};

const arr = <T,>(raw: unknown): T[] => (Array.isArray(raw) ? (raw as T[]) : []);
const EMPTY_H: HistoryEntry[] = [];
const EMPTY_L: ListEntry[] = [];

const historyStore = createStore<HistoryEntry[]>(
  "shogun:history",
  EMPTY_H,
  (r) => arr<HistoryEntry>(r),
  (val) => saveToFirestore({ history: val }),
);

const listStore = createStore<ListEntry[]>(
  "shogun:list",
  EMPTY_L,
  (r) => arr<ListEntry>(r),
  (val) => saveToFirestore({ list: val }),
);

export const useHistory = () =>
  useSyncExternalStore(historyStore.subscribe, historyStore.getSnapshot, historyStore.getServerSnapshot);
export const useMyList = () =>
  useSyncExternalStore(listStore.subscribe, listStore.getSnapshot, listStore.getServerSnapshot);

export function getHistoryEntry(type: LibType, id: string) {
  return historyStore.getSnapshot().find((h) => h.type === type && h.id === id);
}

export function upsertHistory(entry: HistoryEntry) {
  const rest = historyStore.getSnapshot().filter((h) => !(h.type === entry.type && h.id === entry.id));
  historyStore.set([entry, ...rest].slice(0, 40));
}

export function removeHistory(type: LibType, id: string) {
  historyStore.set(historyStore.getSnapshot().filter((h) => !(h.type === type && h.id === id)));
}

export function clearHistory() {
  historyStore.set([]);
}

export function toggleList(entry: ListEntry) {
  const cur = listStore.getSnapshot();
  const exists = cur.some((l) => l.type === entry.type && l.id === entry.id);
  listStore.set(exists ? cur.filter((l) => !(l.type === entry.type && l.id === entry.id)) : [entry, ...cur]);
}

export function clearList() {
  listStore.set([]);
}

/* --------------------- Firestore PFP & User Profile ---------------------- */

export type UserProfile = {
  uid: string | null;
  email: string | null;
  displayName: string | null;
  avatar: string | null;
};

const DEFAULT_PROFILE: UserProfile = {
  uid: null,
  email: null,
  displayName: null,
  avatar: null,
};

let pendingSignupProfile: { displayName?: string; avatar?: string | null } | null = null;

export function setPendingSignupProfile(data: { displayName?: string; avatar?: string | null } | null) {
  pendingSignupProfile = data;
}

const profileStore = createStore<UserProfile>(
  "shogun:profile",
  DEFAULT_PROFILE,
  (raw) => ({
    ...DEFAULT_PROFILE,
    ...(raw as Partial<UserProfile>),
  }),
);

export const useUserProfile = () =>
  useSyncExternalStore(profileStore.subscribe, profileStore.getSnapshot, profileStore.getServerSnapshot);

/**
 * Center-crops and compresses any uploaded image into a compact 200x200 Data URL (~18KB)
 * so it can be stored directly inside Firestore's `users/{uid}` document.
 */
export function compressAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image file"));
      img.onload = () => {
        const size = 200;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));

        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;

        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

        // Try WebP first; fallback to JPEG for older Safari/iOS
        let dataUrl = canvas.toDataURL("image/webp", 0.82);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        }
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Saves a compressed PFP directly to Firestore `users/{uid}.avatar`
 */
export async function updateUserAvatar(fileOrDataUrl: File | string, explicitUid?: string) {
  const dataUrl =
    typeof fileOrDataUrl === "string"
      ? fileOrDataUrl
      : await compressAvatarFile(fileOrDataUrl);

  const current = profileStore.getSnapshot();
  const uid = explicitUid || current.uid || auth?.currentUser?.uid || null;

  profileStore.set({ ...current, uid, avatar: dataUrl }, true);
  await saveToFirestore({ avatar: dataUrl }, uid ?? undefined);
  return dataUrl;
}

export async function updateUserDisplayName(name: string, explicitUid?: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const current = profileStore.getSnapshot();
  const uid = explicitUid || current.uid || auth?.currentUser?.uid || null;

  profileStore.set({ ...current, uid, displayName: trimmed }, true);
  if (auth?.currentUser) {
    try {
      await updateProfile(auth.currentUser, { displayName: trimmed });
    } catch {
      // Ignore auth profile error
    }
  }
  await saveToFirestore({ displayName: trimmed }, uid ?? undefined);
}

/* ---------------- Real-Time Firestore Listener on Login ------------------ */

let unsubscribeFirestore: (() => void) | null = null;

if (typeof window !== "undefined" && auth) {
  onAuthStateChanged(auth, async (user: User | null) => {
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
      unsubscribeFirestore = null;
    }

    if (!user) {
      profileStore.set(DEFAULT_PROFILE, true);
      return;
    }

    const currentSnap = profileStore.getSnapshot();
    const existingAvatar = currentSnap.uid === user.uid ? currentSnap.avatar : null;

    const initialProfile: UserProfile = {
      uid: user.uid,
      email: user.email,
      displayName:
        pendingSignupProfile?.displayName ||
        user.displayName ||
        user.email?.split("@")[0] ||
        "Shogun",
      avatar:
        pendingSignupProfile?.avatar ||
        existingAvatar ||
        user.photoURL ||
        null,
    };

    profileStore.set(initialProfile, true);

    if (!db) return;

    const userDocRef = doc(db, "users", user.uid);

    // Ensure the Firestore document exists on first login/signup
    try {
      const snap = await getDoc(userDocRef);
      if (!snap.exists()) {
        await setDoc(
          userDocRef,
          {
            email: user.email,
            displayName: initialProfile.displayName,
            avatar: initialProfile.avatar,
            settings: settingsStore.getSnapshot(),
            history: historyStore.getSnapshot(),
            list: listStore.getSnapshot(),
            updatedAt: Date.now(),
          },
          { merge: true },
        );
      } else if (pendingSignupProfile?.avatar || pendingSignupProfile?.displayName) {
        await setDoc(
          userDocRef,
          {
            ...(pendingSignupProfile.displayName ? { displayName: pendingSignupProfile.displayName } : {}),
            ...(pendingSignupProfile.avatar ? { avatar: pendingSignupProfile.avatar } : {}),
            updatedAt: Date.now(),
          },
          { merge: true },
        );
      }
    } catch {
      // Ignore if offline
    } finally {
      pendingSignupProfile = null;
    }

    // Real-time listener: any PFP, watchlist, history, or setting change in Firestore updates the UI immediately
    unsubscribeFirestore = onSnapshot(
      userDocRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();

        profileStore.set(
          {
            uid: user.uid,
            email: user.email,
            displayName: data.displayName || user.displayName || initialProfile.displayName,
            avatar: data.avatar || user.photoURL || null,
          },
          true,
        );

        if (data.settings) {
          settingsStore.set({ ...DEFAULT_SETTINGS, ...data.settings }, true);
        }
        if (Array.isArray(data.history)) {
          historyStore.set(data.history, true);
        }
        if (Array.isArray(data.list)) {
          listStore.set(data.list, true);
        }
      },
      (err) => {
        console.warn("Firestore listener warning:", err.message);
      },
    );
  });
}