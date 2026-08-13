export const metadata = { title: "Account suspended" };

export default function SuspendedPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center px-5 text-center">
      <h1 className="text-2xl font-bold tracking-tight">This account is suspended</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">
        Your account has been suspended for abusing the trip planner. If you think
        that is a mistake, reply to any email we have sent you and a human will
        look at it.
      </p>
    </main>
  );
}
