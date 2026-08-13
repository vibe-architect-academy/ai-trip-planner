import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { getViewer } from "@/lib/auth";

export default async function AppHeader() {
  const viewer = await getViewer();

  return (
    <header className="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          <Link href="/" className="focus-ring rounded">
            AI Trip Planner{" "}
            <span className="text-indigo-600 dark:text-indigo-400" aria-hidden="true">
              &#10022;
            </span>
          </Link>
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Describe the trip. Get a real plan, day by day.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3 pt-1">
        {viewer?.role === "admin" && (
          <Link
            href="/admin"
            className="focus-ring rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400"
          >
            Admin
          </Link>
        )}
        <UserButton />
      </div>
    </header>
  );
}
