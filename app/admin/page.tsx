import Link from "next/link";
import { clerkClient } from "@clerk/nextjs/server";
import { getViewer } from "@/lib/auth";

/**
 * The admin area.
 *
 * The middleware already turned away anyone who is not an admin, and this
 * checks again anyway. Two checks is not paranoia: the middleware protects the
 * route, this protects the data, and the day someone changes a matcher pattern
 * is the day only one of them is still doing its job.
 */

export const metadata = { title: "Admin" };

// Reads live user state, so there is nothing here worth prerendering.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const viewer = await getViewer();
  if (viewer?.role !== "admin") {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-16">
        <p className="text-slate-600 dark:text-slate-400">Not found.</p>
      </main>
    );
  }

  const clerk = await clerkClient();
  const { data: users } = await clerk.users.getUserList({ limit: 100 });

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-16">
      <div className="mb-8 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <Link
          href="/"
          className="focus-ring rounded text-sm text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
        >
          Back to the app
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Person</th>
              <th scope="col" className="px-4 py-3 font-medium">Role</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {users.map((user) => {
              const metadata = user.publicMetadata as { role?: string; banned?: boolean };
              return (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    {user.primaryEmailAddress?.emailAddress ?? user.username ?? user.id}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {metadata.role === "admin" ? "Admin" : "User"}
                  </td>
                  <td className="px-4 py-3">
                    {metadata.banned ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                        Suspended
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Active
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
        Trip counts arrive with the database in lesson 12.
      </p>
    </main>
  );
}
