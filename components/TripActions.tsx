"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { canShare, canArchive, type TripState } from "@/lib/trip-state";

/**
 * Share, unshare, archive, unarchive.
 *
 * The buttons hide when an action is not available, and that is a courtesy
 * rather than the enforcement. The server refuses the same moves regardless,
 * which is the only reason this is safe: hiding a button stops an honest
 * person doing the wrong thing, and stops nobody else.
 */
export default function TripActions({
  tripId,
  state,
}: {
  tripId: string;
  state: TripState;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  async function act(action: string) {
    setError("");
    const response = await fetch(`/api/trips/${tripId}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null);

    if (!response) {
      setError("We could not reach the server.");
      return;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // 409 carries the real explanation from the state machine, so show that
      // rather than a generic failure.
      setError(data.error ?? "That did not work.");
      return;
    }

    startTransition(() => router.refresh());
  }

  const button =
    "focus-ring inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800";

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {canShare(state) && (
          <button type="button" disabled={isPending} onClick={() => act("share")} className={button}>
            Share with a travel partner
          </button>
        )}
        {state === "shared" && (
          <button type="button" disabled={isPending} onClick={() => act("unshare")} className={button}>
            Stop sharing
          </button>
        )}
        {canArchive(state) && (
          <button type="button" disabled={isPending} onClick={() => act("archive")} className={button}>
            Archive
          </button>
        )}
        {state === "archived" && (
          <button type="button" disabled={isPending} onClick={() => act("unarchive")} className={button}>
            Unarchive
          </button>
        )}
      </div>

      {state === "shared" && (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Shared trips are read-only. Stop sharing to edit this one again.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
