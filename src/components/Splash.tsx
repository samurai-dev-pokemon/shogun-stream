"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "./Logo";

export default function Splash() {
  const [phase, setPhase] = useState<"visible" | "fading" | "hidden">("visible");

  useEffect(() => {
    // Only show splash once per browser session
    if (sessionStorage.getItem("shogun_booted")) {
      setPhase("hidden");
      return;
    }

    const fadeTimer = setTimeout(() => {
      setPhase("fading");
    }, 650);

    const hideTimer = setTimeout(() => {
      sessionStorage.setItem("shogun_booted", "1");
      setPhase("hidden");
    }, 1050);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#09090b] transition-all duration-400 ease-out ${
        phase === "fading" ? "pointer-events-none scale-[1.02] opacity-0" : "opacity-100"
      }`}
    >
      {/* Subtle ambient light behind logo */}
      <div className="pointer-events-none absolute h-56 w-56 rounded-full bg-white/[0.04] blur-3xl" />

      <div className="relative flex flex-col items-center">
        <div className="animate-[pulse-mark_1.8s_ease-in-out_infinite]">
          <LogoMark size={56} />
        </div>

        {/* Minimalist Liquid Glass Progress Track */}
        <div className="mt-7 h-[2px] w-28 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-full origin-left animate-[load-bar_0.65s_cubic-bezier(0.22,1,0.36,1)_forwards] rounded-full bg-white/80" />
        </div>
      </div>
    </div>
  );
}