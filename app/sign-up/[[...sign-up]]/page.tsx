import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-5 py-10">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">
        AI Trip Planner{" "}
        <span className="text-indigo-600 dark:text-indigo-400" aria-hidden="true">
          &#10022;
        </span>
      </h1>
      <SignUp />
    </main>
  );
}
