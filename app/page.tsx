"use client";

/**
 * The front of house.
 *
 * This runs in the browser. It knows how to ask and how to display, and
 * nothing else. There is no API key anywhere in this file, which is the
 * entire point of lesson 5: open DevTools, watch the network, and the only
 * request you will see goes to /api/generate on this same site.
 */

import { useState } from "react";

function markdownToHtml(markdown: string): string {
  return markdown
    .replace(/^### (.*)$/gm, "<h2>$1</h2>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^\*\*(.*)\*\*$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^[-*] (.*)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, "<ul>$1</ul>")
    .replace(/\n{2,}/g, "<br>");
}

export default function Home() {
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState("3");
  const [itinerary, setItinerary] = useState("");
  const [isPlanning, setIsPlanning] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsPlanning(true);
    setError("");
    setItinerary("");

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: destination.trim() || "Kyoto",
        days: Number(days) || 3,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Something went wrong.");
    } else {
      setItinerary(data.itinerary);
    }
    setIsPlanning(false);
  }

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10 sm:py-16">
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          AI Trip Planner{" "}
          <span className="text-indigo-600 dark:text-indigo-400" aria-hidden="true">
            &#10022;
          </span>
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Describe the trip. Get a real plan, day by day.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-5 sm:p-6 shadow-sm">
        <form onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label
                htmlFor="destination"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Where to?
              </label>
              <input
                id="destination"
                name="destination"
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Kyoto"
                autoComplete="off"
                className="focus-ring w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3.5 py-3 text-base placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
            <div className="sm:w-28">
              <label
                htmlFor="days"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Days
              </label>
              <input
                id="days"
                name="days"
                type="number"
                min={1}
                max={7}
                inputMode="numeric"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                autoComplete="off"
                className="focus-ring w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3.5 py-3 text-base"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPlanning}
            className="focus-ring mt-5 w-full rounded-lg bg-indigo-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 disabled:cursor-wait transition-colors"
          >
            Generate my trip
          </button>
        </form>

        {isPlanning && (
          <p
            role="status"
            aria-live="polite"
            className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
          >
            <span
              className="inline-block h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400 motion-safe:animate-pulse"
              aria-hidden="true"
            />
            Planning your days...
          </p>
        )}
      </section>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-800 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {itinerary && (
        <section
          aria-live="polite"
          className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-5 sm:p-6 shadow-sm"
        >
          <div
            className="prose-trip text-[15px] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(itinerary) }}
          />
        </section>
      )}
    </main>
  );
}
