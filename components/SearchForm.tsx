"use client";

export type SearchLabels = {
  destinationLabel: string;
  destinationPlaceholder: string;
  daysLabel: string;
  submit: string;
  planning: string;
};

export default function SearchForm({
  destination,
  days,
  isPlanning,
  labels,
  onDestinationChange,
  onDaysChange,
  onSubmit,
}: {
  destination: string;
  days: string;
  isPlanning: boolean;
  labels: SearchLabels;
  onDestinationChange: (value: string) => void;
  onDaysChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-5 sm:p-6 shadow-sm">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label
              htmlFor="destination"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              {labels.destinationLabel}
            </label>
            <input
              id="destination"
              name="destination"
              type="text"
              value={destination}
              onChange={(event) => onDestinationChange(event.target.value)}
              placeholder={labels.destinationPlaceholder}
              autoComplete="off"
              className="focus-ring w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3.5 py-3 text-base placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
          <div className="sm:w-28">
            <label
              htmlFor="days"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              {labels.daysLabel}
            </label>
            <input
              id="days"
              name="days"
              type="number"
              min={1}
              max={7}
              inputMode="numeric"
              value={days}
              onChange={(event) => onDaysChange(event.target.value)}
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
          {labels.submit}
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
          {labels.planning}
        </p>
      )}
    </section>
  );
}
