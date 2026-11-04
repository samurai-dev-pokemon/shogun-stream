export default function Loading() {
  return (
    <div className="fade-up space-y-10">
      {/* Hero Banner Skeleton */}
      <section className="relative flex min-h-[25rem] flex-col justify-end overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0c0c0e] p-6 sm:min-h-[29rem] sm:p-10">
        {/* Ambient background shimmer */}
        <div className="skeleton absolute inset-0 !rounded-none opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/60 to-transparent" />

        <div className="relative z-10 space-y-4">
          {/* Featured Badge */}
          <div className="skeleton h-6 w-36 !rounded-md" />

          {/* Title */}
          <div className="skeleton h-10 w-64 sm:h-12 sm:w-96 !rounded-xl" />

          {/* Metadata (Year · Rating · Genres) */}
          <div className="flex items-center gap-2 pt-1">
            <div className="skeleton h-4 w-12 !rounded" />
            <div className="skeleton h-4 w-14 !rounded" />
            <div className="skeleton h-4 w-28 !rounded" />
          </div>

          {/* Description lines */}
          <div className="space-y-2 pt-1">
            <div className="skeleton h-3.5 w-full max-w-lg !rounded" />
            <div className="skeleton h-3.5 w-4/5 max-w-md !rounded" />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-3">
            <div className="skeleton h-10 w-32 !rounded-xl" />
            <div className="skeleton h-10 w-28 !rounded-full" />
          </div>
        </div>
      </section>

      {/* Media Rows Skeleton */}
      {[1, 2, 3].map((row) => (
        <section key={row}>
          <div className="mb-4 flex items-center justify-between">
            <div className="skeleton h-5 w-40 !rounded-md" />
            <div className="skeleton h-4 w-14 !rounded-md" />
          </div>

          <div className="no-scrollbar -mx-4 flex gap-4 overflow-hidden px-4 sm:-mx-6 sm:px-6">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="w-[8.5rem] shrink-0 sm:w-40 lg:w-44">
                <div
                  className="skeleton aspect-[2/3] w-full !rounded-xl border border-white/[0.05]"
                  style={{ animationDelay: `${i * 90}ms` }}
                />
                <div className="mt-2.5 space-y-1.5">
                  <div className="skeleton h-3.5 w-3/4 !rounded" />
                  <div className="skeleton h-3 w-1/2 !rounded opacity-60" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}