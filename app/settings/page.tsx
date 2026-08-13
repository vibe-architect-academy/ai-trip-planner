import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import DangerZone from "@/components/DangerZone";
import { getViewer } from "@/lib/auth";

export const metadata = { title: "Settings", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 sm:py-14 lg:max-w-3xl">
      <AppHeader />

      <h2 className="text-xl font-semibold">Your data</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Everything this app holds about you, and how to get rid of it.
      </p>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60 sm:p-6">
        <h3 className="font-semibold">Download everything</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Every trip, day, activity and photo record we hold, as a JSON file.
        </p>
        <a
          href="/api/account/export"
          className="focus-ring mt-4 inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Download my data
        </a>
      </section>

      <DangerZone />
    </main>
  );
}
