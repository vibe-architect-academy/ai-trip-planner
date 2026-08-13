"use client";

import { useState } from "react";

export default function UpgradeButton() {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");

  async function upgrade() {
    setIsStarting(true);
    setError("");

    try {
      const response = await fetch("/api/billing/checkout", { method: "POST" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.url) {
        setError(data.error ?? "We could not start checkout.");
        setIsStarting(false);
        return;
      }

      // Stripe's own page. Card details never touch this app, which is most of
      // why using a payment provider is the right call: the hardest part of
      // taking money is the part you are allowed to not do yourself.
      window.location.href = data.url;
    } catch {
      setError("We could not reach the server.");
      setIsStarting(false);
    }
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={upgrade}
        disabled={isStarting}
        className="focus-ring w-full rounded-lg bg-indigo-600 px-4 py-3 text-base font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isStarting ? "Taking you to checkout..." : "Upgrade to Premium"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
