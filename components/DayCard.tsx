import type { Day } from "@/lib/itinerary";

export default function DayCard({ day }: { day: Day }) {
  return (
    <article className="border-t border-slate-200 dark:border-slate-700 pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-lg font-semibold text-indigo-700 dark:text-indigo-400">
        {day.heading}
      </h3>
      <ul className="mt-2 space-y-1.5">
        {day.items.map((item, index) => (
          <li key={index} className="text-slate-700 dark:text-slate-300">
            {item.label && (
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {item.label}:{" "}
              </span>
            )}
            {item.text}
          </li>
        ))}
      </ul>
    </article>
  );
}
