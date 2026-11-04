"use client";

import { toggleList, useMyList, type ListEntry } from "@/lib/store";

export default function ListButton({ entry }: { entry: ListEntry }) {
  const list = useMyList();
  const inList = list.some((l) => l.type === entry.type && l.id === entry.id);
  return (
    <button type="button" className="btn px-5 py-2.5" onClick={() => toggleList(entry)} aria-pressed={inList}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {inList ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M12 5v14M5 12h14" />}
      </svg>
      {inList ? "In My List" : "My List"}
    </button>
  );
}
