"use client";

import { useState } from "react";

export default function SmartImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`${className ?? ""} flex items-center justify-center bg-white/[0.03] p-3 text-center text-xs text-white/30`}>
        {alt || ""}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" className={className} onError={() => setFailed(true)} />;
}
