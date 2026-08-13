import { parseItinerary } from "@/lib/itinerary";
import DayCard from "./DayCard";

export default function TripResults({
  destination,
  itinerary,
}: {
  destination: string;
  itinerary: string;
}) {
  const days = parseItinerary(itinerary);

  return (
    <section
      aria-live="polite"
      className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-5 sm:p-6 shadow-sm"
    >
      <h2 className="sr-only">Your itinerary for {destination}</h2>
      <div className="space-y-5">
        {days.map((day, index) => (
          <DayCard key={index} day={day} />
        ))}
      </div>
    </section>
  );
}
