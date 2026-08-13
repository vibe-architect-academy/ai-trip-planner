"use client";

import { useEffect, useState } from "react";

/**
 * A speed readout, in development only.
 *
 * The production build strips this entirely, so it costs real users nothing.
 * It exists because "the app feels slow" is not a number, and you cannot fix
 * what you will not measure.
 */
export default function PerfBanner() {
  const [stats, setStats] = useState<{ load: number; requests: number } | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    function measure() {
      const [navigation] = performance.getEntriesByType(
        "navigation",
      ) as PerformanceNavigationTiming[];
      if (!navigation) return;

      setStats({
        // loadEventEnd is 0 until the load event has actually finished.
        load: Math.round(navigation.loadEventEnd || navigation.responseEnd),
        requests: performance.getEntriesByType("resource").length + 1,
      });
    }

    if (document.readyState === "complete") measure();
    else window.addEventListener("load", measure, { once: true });
  }, []);

  if (process.env.NODE_ENV !== "development" || !stats) return null;

  return (
    <div className="fixed bottom-3 left-3 z-50 rounded-lg bg-slate-900/90 px-3 py-1.5 font-mono text-xs text-slate-100 shadow-lg dark:bg-slate-100/90 dark:text-slate-900">
      {stats.load}ms &middot; {stats.requests} requests
    </div>
  );
}
