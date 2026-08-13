import type { TripState } from "@/lib/trip-state";

const LOOK: Record<TripState, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  generating: {
    label: "Generating",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  ready: {
    label: "Ready",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  shared: {
    label: "Shared",
    className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  },
  archived: {
    label: "Archived",
    className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  },
};

export default function StateBadge({ state }: { state: TripState }) {
  const look = LOOK[state] ?? LOOK.draft;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${look.className}`}
    >
      {state === "generating" && (
        <span
          className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse"
          aria-hidden="true"
        />
      )}
      {look.label}
    </span>
  );
}
