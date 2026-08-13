import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { getViewer } from "@/lib/auth";
import { listTrips } from "@/lib/db/trips";
import { isDatabaseConfigured } from "@/lib/db";
import { getLocale, translator } from "@/lib/i18n";
import StateBadge from "@/components/StateBadge";
import { isTripState } from "@/lib/trip-state";

export const metadata = { title: "Your trips", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");

  const trips = isDatabaseConfigured() ? await listTrips(viewer.userId) : [];
  const locale = await getLocale();
  const t = translator(locale);

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 sm:py-14 lg:max-w-5xl">
      <AppHeader />

      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">{t("trips.heading")}</h2>
        <Link
          href="/"
          className="focus-ring rounded text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {t("trips.planAnother")}
        </Link>
      </div>

      {trips.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400">
          {t("trips.empty")}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link
                href={`/trips/${trip.id}`}
                className="focus-ring flex min-h-20 flex-col justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-4 transition-colors hover:border-indigo-400 dark:hover:border-indigo-500"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{trip.title ?? trip.destination}</span>
                  <StateBadge state={isTripState(trip.state) ? trip.state : "draft"} />
                </span>
                <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">
                  {t("trip.days", { count: trip.dayCount, destination: trip.destination })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
