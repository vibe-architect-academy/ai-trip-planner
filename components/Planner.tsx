"use client";

/**
 * The conductor.
 *
 * Holds the state, calls /api/generate, and hands the answer to whichever
 * component shows it. It knows nothing about how a form is laid out or how a
 * day is drawn.
 *
 * It is also the only interactive part of the page, which is why it is the
 * only part marked "use client". The page around it stays on the server, where
 * it can read the session without shipping anything extra to the browser.
 */

import { useState } from "react";
import Link from "next/link";
import SearchForm from "@/components/SearchForm";
import TripResults from "@/components/TripResults";

export default function Planner() {
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState("3");
  const [trip, setTrip] = useState<{ destination: string; itinerary: string } | null>(null);
  const [tripId, setTripId] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [error, setError] = useState("");

  async function planTrip() {
    setIsPlanning(true);
    setError("");
    setTrip(null);
    setTripId("");
    setIsSaved(false);

    const asked = destination.trim() || "Kyoto";

    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: asked, days: Number(days) || 3 }),
      });

      // Anything rejected before the stream starts still answers in one piece.
      // A server that fell over hard answers with HTML, not JSON, and parsing
      // that is its own crash, so read the body defensively.
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }

      // From here the answer arrives a few words at a time. Each line is one
      // JSON object, and a network chunk can end mid-line, so hold the
      // fragment back until the rest of it turns up.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let itinerary = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const raw of lines) {
          if (!raw.trim()) continue;
          let event: { text?: string; error?: string; tripId?: string; saved?: boolean };
          try {
            event = JSON.parse(raw);
          } catch {
            continue;
          }
          if (event.error) {
            setError(event.error);
            continue;
          }
          // The id arrives before the first word, so the trip is linkable
          // while it is still being written.
          if (event.tripId) setTripId(event.tripId);
          if (event.saved) setIsSaved(true);
          if (event.text) {
            itinerary += event.text;
            // Hand it over on every chunk. This is the whole point: the days
            // fill in while the model is still writing them.
            setTrip({ destination: asked, itinerary });
          }
        }
      }
    } catch {
      // fetch only rejects when the request never completed: the connection
      // dropped, the user went offline, the tab lost the network.
      setError("We could not reach the server. Check your connection and try again.");
    } finally {
      // In `finally` on purpose. Every path above has to put the button back,
      // and the one that forgets is the one that leaves someone staring at a
      // spinner that will never stop.
      setIsPlanning(false);
    }
  }

  return (
    <>
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

      {isSaved && tripId && (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          Saved.{" "}
          <Link
            href={`/trips/${tripId}`}
            className="focus-ring rounded font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            This trip has its own page now
          </Link>
          , and it will still be there tomorrow.
        </p>
      )}
    </>
  );
}
