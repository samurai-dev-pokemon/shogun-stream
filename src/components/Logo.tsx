export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      alt="Shogun Stream"
      style={{ height: size, width: "auto" }}
      className="shrink-0 bg-transparent select-none object-contain"
    />
  );
}

export function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center select-none ${className}`}>
      <LogoMark size={size} />
    </span>
  );
}