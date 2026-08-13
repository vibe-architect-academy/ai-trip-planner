"use client";

/**
 * The conductor.
 *
 * This file no longer knows how a form is laid out or how a day is drawn. It
 * holds the state, calls /api/generate, and hands the answer to whichever
 * component is responsible for showing it.
 */

import { useState } from "react";
import SearchForm from "@/components/SearchForm";
import TripResults from "@/components/TripResults";

export default function Home() {
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState("3");
  const [trip, setTrip] = useState<{ destination: string; itinerary: string } | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [error, setError] = useState("");

  async function planTrip() {
    setIsPlanning(true);
    setError("");
    setTrip(null);

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
      setTrip({ destination: data.destination, itinerary: data.itinerary });
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

      <SearchForm
        destination={destination}
        days={days}
        isPlanning={isPlanning}
        onDestinationChange={setDestination}
        onDaysChange={setDays}
        onSubmit={planTrip}
      />

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-800 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {trip && <TripResults destination={trip.destination} itinerary={trip.itinerary} />}
    </main>
  );
}
