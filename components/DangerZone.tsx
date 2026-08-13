"use client";

import { useState } from "react";

export default function DangerZone() {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function deleteEverything() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) setError(data.error ?? "That did not work.");
      else setResult(data.next ?? "Deleted.");
    } catch {
      setError("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-red-200 bg-red-50/60 p-5 dark:border-red-900 dark:bg-red-950/20 sm:p-6">
      <h3 className="font-semibold text-red-900 dark:text-red-200">Delete everything</h3>
      <p className="mt-1 text-sm text-red-800 dark:text-red-300">
        Every trip and every photo, permanently. There is no undo and no copy
        kept. Download your data first if you want it.
      </p>

      {result ? (
        <p className="mt-4 text-sm font-medium text-red-900 dark:text-red-200">{result}</p>
      ) : (
        <>
          <label
            htmlFor="confirm-delete"
            className="mt-4 block text-sm font-medium text-red-900 dark:text-red-200"
          >
            Type DELETE to confirm
          </label>
          <input
            id="confirm-delete"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="off"
            className="focus-ring mt-1.5 w-full max-w-xs rounded-lg border border-red-300 bg-white px-3 py-2.5 text-base dark:border-red-800 dark:bg-slate-900"
          />
          <button
            type="button"
            onClick={deleteEverything}
            disabled={busy || confirm !== "DELETE"}
            className="focus-ring mt-3 block min-h-11 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "Deleting..." : "Delete my data"}
          </button>
        </>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-800 dark:text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
