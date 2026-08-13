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
  const [partnerEmail, setPartnerEmail] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [emailed, setEmailed] = useState<boolean | null>(null);

  async function act(action: string) {
    setError("");
    const response = await fetch(`/api/trips/${tripId}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, email: action === "share" ? partnerEmail : undefined }),
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

    if (data.shareUrl) setShareUrl(data.shareUrl);
    if (action === "share") setEmailed(data.emailed ?? null);
    if (action === "unshare") {
      setShareUrl("");
      setEmailed(null);
    }

    startTransition(() => router.refresh());
  }

  const button =
    "focus-ring inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800";

  return (
    <div className="mt-4">
      {canShare(state) && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="partner-email">
            Your travel partner&apos;s email
          </label>
          <input
            id="partner-email"
            type="email"
            value={partnerEmail}
            onChange={(event) => setPartnerEmail(event.target.value)}
            placeholder="partner@email.com (optional)"
            className="focus-ring flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-base placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:placeholder:text-slate-500"
          />
        </div>
      )}

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

      {shareUrl && (
        <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900 dark:bg-indigo-950/30">
          <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
            {emailed === true
              ? "Invite sent. Here is the link as well:"
              : emailed === false
                ? "The trip is shared, but that email could not be sent. Send them this link:"
                : "Anyone with this link can see the trip:"}
          </p>
          <input
            readOnly
            value={shareUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="focus-ring mt-2 w-full rounded border border-indigo-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-indigo-800 dark:bg-slate-900"
          />
        </div>
      )}

      {state === "shared" && (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Shared trips are read-only. Stop sharing to edit this one again, which
          also stops the old link working.
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
