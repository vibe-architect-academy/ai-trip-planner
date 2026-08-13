import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { getViewer } from "@/lib/auth";
import { listTrips } from "@/lib/db/trips";
import { isDatabaseConfigured } from "@/lib/db";

export const metadata = { title: "Your trips" };
export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");

  const trips = isDatabaseConfigured() ? await listTrips(viewer.userId) : [];

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10 sm:py-16">
      <AppHeader />

      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Your trips</h2>
        <Link
          href="/"
          className="focus-ring rounded text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Plan another
        </Link>
      </div>

      {trips.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400">
          No trips yet. Plan one and it will be here when you come back.
        </p>
      ) : (
        <ul className="space-y-3">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link
                href={`/trips/${trip.id}`}
                className="focus-ring block rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-4 transition-colors hover:border-indigo-400 dark:hover:border-indigo-500"
              >
                <span className="font-semibold">{trip.title ?? trip.destination}</span>
                <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">
                  {trip.dayCount} {trip.dayCount === 1 ? "day" : "days"} in{" "}
                  {trip.destination}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
