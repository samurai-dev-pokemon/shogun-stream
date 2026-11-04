"use client";

import { useEffect } from "react";
import { ACCENTS, useSettings } from "@/lib/store";

export default function AccentApplier() {
  const { settings } = useSettings();
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", ACCENTS[settings.accent]?.color ?? ACCENTS.crimson.color);
  }, [settings.accent]);
  return null;
}
