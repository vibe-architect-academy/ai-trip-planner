"use client";

/**
 * The conductor.
 *
 * Holds the state, asks the server for an itinerary, and hands the answer to
 * whichever component shows it. It knows nothing about how a form is laid out
 * or how a day is drawn.
 *
 * It talks to one of two endpoints, and which one is the entire shape of this
 * page. Signed in, it posts to /api/trips and the result is saved as it
 * arrives. Signed out, it posts to /api/preview and the result belongs to
 * nobody until it is claimed. Same stream format, same renderer, different
 * ownership.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth, useClerk } from "@clerk/nextjs";
import SearchForm, { type SearchLabels } from "@/components/SearchForm";
import TripResults from "@/components/TripResults";

export type PlannerLabels = SearchLabels & {
  saved: string;
  savedLink: string;
  savedRest: string;
  genericError: string;
  offlineError: string;
  previewPrompt: string;
  previewSave: string;
  previewClaiming: string;
};

/**
 * Where a preview waits while its author signs in.
 *
 * Sign-in can take the whole tab away and bring it back, so this cannot live
 * in React state. sessionStorage rather than localStorage because it should
 * not outlive the tab: a preview someone abandoned last week is not something
 * to drop into their account the next time they log in.
 */
const PENDING_KEY = "trip-planner:pending-preview";

/**
 * Strings arrive as props rather than being looked up here. The server already
 * knows the language, and having the browser work it out again is how you get
 * a page that renders in English and then blinks into French.
 */
export default function Planner({ labels }: { labels: PlannerLabels }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { openSignIn } = useClerk();

  const [destination, setDestination] = useState("");
  const [days, setDays] = useState("3");
  const [trip, setTrip] = useState<{ destination: string; itinerary: string } | null>(null);
  const [tripId, setTripId] = useState("");
  const [previewId, setPreviewId] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState("");

  // Claiming is fired from an effect, and an effect can run twice. Without
  // this, one sign-in spends two trips from the allowance.
  const claimAttempted = useRef(false);

  const claim = useCallback(
    async (id: string) => {
      setIsClaiming(true);
      setError("");
      try {
        const response = await fetch("/api/trips/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ previewId: id }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          setError(data.error ?? labels.genericError);
          // Expired or refused, and retrying will not change that. Drop it, or
          // the same failure repeats on every sign-in from now on.
          sessionStorage.removeItem(PENDING_KEY);
          return;
        }

        sessionStorage.removeItem(PENDING_KEY);
        setPreviewId("");
        setTripId(data.tripId);
        setIsSaved(true);
      } catch {
        setError(labels.offlineError);
      } finally {
        setIsClaiming(false);
      }
    },
    [labels.genericError, labels.offlineError],
  );

  /*
   * Somebody signed in with a preview waiting. Finish what they asked for.
   *
   * This runs on a fresh page load as well as after a modal, because the
   * sign-in flow is allowed to navigate away and come back and the person
   * pressing "Save this trip" should not have to press it twice.
   */
  useEffect(() => {
    if (!isLoaded || !isSignedIn || claimAttempted.current) return;
    const pending = sessionStorage.getItem(PENDING_KEY);
    if (!pending) return;
    claimAttempted.current = true;
    void claim(pending);
  }, [isLoaded, isSignedIn, claim]);

  function save() {
    if (!previewId) return;
    // Written before the sign-in flow starts, because it may take the tab.
    sessionStorage.setItem(PENDING_KEY, previewId);
    // No redirect options: the modal closes onto the page it opened from, and
    // the effect above claims the preview as soon as the session appears.
    openSignIn();
  }

  async function planTrip() {
    setIsPlanning(true);
    setError("");
    setTrip(null);
    setTripId("");
    setPreviewId("");
    setIsSaved(false);
    claimAttempted.current = false;
    sessionStorage.removeItem(PENDING_KEY);

    const asked = destination.trim() || "Kyoto";
    // Signed in, this is saved as it is written. Signed out, it is a preview
    // that expires unless somebody claims it.
    const endpoint = isSignedIn ? "/api/trips" : "/api/preview";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: asked, days: Number(days) || 3 }),
      });

      // Anything rejected before the stream starts still answers in one piece.
      // A server that fell over hard answers with HTML, not JSON, and parsing
      // that is its own crash, so read the body defensively.
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? labels.genericError);
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
          let event: {
            text?: string;
            error?: string;
            tripId?: string;
            previewId?: string;
            saved?: boolean;
          };
          try {
            event = JSON.parse(raw);
          } catch {
            continue;
          }
          if (event.error) {
            setError(event.error);
            continue;
          }
          // The id arrives before the first word, so the trip is linkable, or
          // the preview claimable, while it is still being written.
          if (event.tripId) setTripId(event.tripId);
          if (event.previewId) setPreviewId(event.previewId);
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
      setError(labels.offlineError);
    } finally {
      // In `finally` on purpose. Every path above has to put the button back,
      // and the one that forgets is the one that leaves someone staring at a
      // spinner that will never stop.
      setIsPlanning(false);
    }
  }

  // Only once there is something worth keeping. Offering to save a half
  // written itinerary is offering to save a broken one.
  const canSave = Boolean(previewId) && !isPlanning && !isSaved && Boolean(trip);

  return (
    <>
      <SearchForm
        destination={destination}
        days={days}
        isPlanning={isPlanning}
        labels={labels}
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

      {canSave && (
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
          <p className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-300">
            {labels.previewPrompt}
          </p>
          <button
            type="button"
            onClick={save}
            disabled={isClaiming}
            className="focus-ring inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {isClaiming ? labels.previewClaiming : labels.previewSave}
          </button>
        </div>
      )}

      {isClaiming && !canSave && (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">{labels.previewClaiming}</p>
      )}

      {isSaved && tripId && (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          {labels.saved}{" "}
          <Link
            href={`/trips/${tripId}`}
            className="focus-ring rounded font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {labels.savedLink}
          </Link>
          {labels.savedRest}
        </p>
      )}
    </>
  );
}
