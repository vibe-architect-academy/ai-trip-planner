import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import DayCard from "@/components/DayCard";
import { getViewer } from "@/lib/auth";
import { getTrip } from "@/lib/db/trips";
import { isDatabaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");

  const { id } = await params;
  if (!isDatabaseConfigured()) notFound();

  // The viewer's id is part of the lookup, so someone else's trip id lands
  // here as "no such trip" rather than as a page with a permission check
  // bolted on afterwards.
  const trip = await getTrip(id, viewer.userId);
  if (!trip) notFound();

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10 sm:py-16">
      <AppHeader />

      <Link
        href="/trips"
        className="focus-ring rounded text-sm text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
      >
        Back to your trips
      </Link>

      <h2 className="mt-3 text-2xl font-bold tracking-tight">
        {trip.title ?? trip.destination}
      </h2>

      <section className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-5 sm:p-6 shadow-sm">
        <div className="space-y-5">
          {trip.days.map((day) => (
            <DayCard
              key={day.id}
              day={{
                heading: day.heading,
                items: day.activities.map((activity) => ({
                  label: activity.label,
                  text: activity.description,
                })),
              }}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
