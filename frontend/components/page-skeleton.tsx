interface PageSkeletonProps {
  /** Which layout shape to render. */
  variant?: "list" | "form" | "reader" | "editor";
}

export function PageSkeleton({ variant = "list" }: PageSkeletonProps) {
  if (variant === "form") {
    return (
      <div className="max-w-2xl mx-auto animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-4 w-64 bg-muted rounded" />
          </div>
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-10 w-full bg-muted rounded-lg" />
            </div>
          ))}
          <div className="h-24 w-full bg-muted rounded-lg" />
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <div className="h-10 w-20 bg-muted rounded-md" />
            <div className="h-10 w-28 bg-muted rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "reader") {
    return (
      <div className="flex flex-col min-h-screen bg-background animate-pulse">
        {/* Mobile header skeleton */}
        <div className="lg:hidden h-14 bg-card border-b border-border" />

        <div className="flex flex-1 lg:flex-row min-h-0">
          {/* Contents sidebar skeleton (desktop) */}
          <aside className="hidden lg:flex lg:flex-col lg:w-80 lg:shrink-0 bg-card border-r border-border lg:h-screen">
            <div className="p-6 border-b border-border space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted" />
                <div className="h-4 w-24 bg-muted rounded" />
              </div>
              <div className="h-6 w-48 bg-muted rounded" />
              <div className="flex items-center gap-2">
                <div className="h-5 w-20 bg-muted rounded" />
                <div className="h-4 w-24 bg-muted rounded" />
              </div>
            </div>
            <div className="p-4 space-y-2">
              <div className="h-3 w-16 bg-muted rounded mb-3 ml-2" />
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-9 w-full bg-muted rounded-md" />
              ))}
            </div>
          </aside>

          {/* Reading pane skeleton */}
          <section className="flex-1 min-w-0 px-6 lg:px-12 pt-6 lg:pt-12 pb-12">
            <div className="max-w-3xl mx-auto w-full space-y-4">
              <div className="h-3 w-20 bg-muted rounded mb-6" />
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="h-4 bg-muted rounded"
                  style={{ width: `${60 + (i % 3) * 15}%` }}
                />
              ))}
              <div className="h-4 bg-muted rounded w-1/3 mt-8" />
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (variant === "editor") {
    return (
      <div className="flex flex-col min-h-screen bg-background animate-pulse">
        {/* Mobile header skeleton */}
        <div className="lg:hidden h-14 bg-card border-b border-border" />

        <div className="flex flex-1 lg:flex-row min-h-0">
          {/* Pages sidebar skeleton (desktop) */}
          <aside className="hidden lg:flex lg:flex-col lg:w-80 lg:shrink-0 bg-card border-r border-border lg:h-screen">
            <div className="p-6 border-b border-border space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted" />
                <div className="h-4 w-24 bg-muted rounded" />
              </div>
              <div className="h-6 w-56 bg-muted rounded" />
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
            <div className="p-4 space-y-2">
              <div className="h-3 w-20 bg-muted rounded mb-3 ml-2" />
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-9 w-full bg-muted rounded-md" />
              ))}
              <div className="h-9 w-full bg-muted rounded-md mt-4" />
            </div>
          </aside>

          {/* Form pane skeleton */}
          <section className="flex-1 min-w-0 px-6 lg:px-12 py-6 lg:py-12">
            <div className="max-w-4xl mx-auto w-full space-y-6">
              {/* Topic form card */}
              <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                <div className="h-5 w-32 bg-muted rounded border-b border-border pb-4" />
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 w-20 bg-muted rounded" />
                    <div className="h-10 w-full bg-muted rounded-lg" />
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 bg-muted rounded" />
                  <div className="h-4 w-20 bg-muted rounded" />
                </div>
              </div>
              {/* Empty-state card */}
              <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center space-y-3">
                <div className="h-5 w-48 bg-muted rounded mx-auto" />
                <div className="h-4 w-64 bg-muted rounded mx-auto" />
                <div className="h-10 w-28 bg-muted rounded-md mx-auto mt-4" />
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // Default: "list"
  return (
    <div className="animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="space-y-2">
          <div className="h-8 w-40 bg-muted rounded" />
          <div className="h-4 w-72 bg-muted rounded" />
        </div>
        <div className="h-10 w-36 bg-muted rounded-md" />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="h-10 w-full sm:w-72 bg-muted rounded-lg" />
        <div className="h-4 w-24 bg-muted rounded" />
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}