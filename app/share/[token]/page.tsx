import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DayCard from "@/components/DayCard";
import { getSharedTrip } from "@/lib/db/trips";
import { isDatabaseConfigured } from "@/lib/db";
import { siteUrl } from "@/lib/site";

/**
 * The page a travel partner opens.
 *
 * No account, no sign-in, read-only. It is also the only page in this app a
 * stranger can reach, which is why the token is the credential and why
 * unsharing clears it: revoking has to actually revoke.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  if (!isDatabaseConfigured()) return { title: "Shared trip" };

  const { token } = await params;
  const trip = await getSharedTrip(token);
  if (!trip) return { title: "Shared trip", robots: { index: false, follow: false } };

  const title = trip.title ?? `Trip to ${trip.destination}`;
  const description = `A ${trip.dayCount}-day itinerary for ${trip.destination}.`;

  return {
    title,
    description,
    // This one is meant to be shared, so the preview card matters. It is still
    // noindex: it is someone's holiday, not public content to be catalogued.
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "article",
      url: `${siteUrl}/share/${token}`,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharedTripPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  if (!isDatabaseConfigured()) notFound();

  const { token } = await params;
  const trip = await getSharedTrip(token);
  // Covers a wrong token, a revoked one, and a trip that was unshared. All
  // the same answer, because distinguishing them tells a stranger something.
  if (!trip) notFound();

  const title = trip.title ?? `Trip to ${trip.destination}`;

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 sm:py-14 lg:max-w-5xl">
      <header className="mb-8">
        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
          Shared with you
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          {trip.dayCount} {trip.dayCount === 1 ? "day" : "days"} in {trip.destination}
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-5 sm:p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
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

      <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
        <Link
          href="/"
          className="focus-ring rounded font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Plan your own trip
        </Link>
      </p>
    </main>
  );
}
