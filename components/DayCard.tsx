import type { Day } from "@/lib/itinerary";

export default function DayCard({ day }: { day: Day }) {
  return (
    /*
      Each card is self-contained. The old version leaned on a top border to
      separate stacked days, which stops meaning anything the moment they sit
      side by side in a grid.
    */
    <article className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 p-4">
      <h3 className="text-base font-semibold text-indigo-700 dark:text-indigo-400">
        {day.heading}
      </h3>
      <ul className="mt-2 space-y-2">
        {day.items.map((item, index) => (
          <li
            key={index}
            className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300"
          >
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
