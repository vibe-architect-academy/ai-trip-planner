import Link from "next/link";

export const metadata = {
  title: "Privacy",
  description: "What this app stores, why, and how to get rid of it.",
};

/**
 * Written to be read, not to be survived.
 *
 * A privacy policy nobody can understand does not inform anyone, which is the
 * entire point of having one. This says what is collected, why, who else sees
 * it, and how to leave, in the fewest words that are still true.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Privacy</h1>

      <div className="mt-6 space-y-6 text-slate-700 dark:text-slate-300">
        <section>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            What this app stores
          </h2>
          <p className="mt-2">
            The trips you create: destination, number of days, and the itinerary
            the AI wrote. The photos you upload, and captions generated for them.
            Nothing else.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            What it does not store
          </h2>
          <p className="mt-2">
            Your name, email and password are held by Clerk, our sign-in
            provider. This app only ever sees an id that stands for you. It does
            not track you across other websites and it runs no advertising.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            Who else sees it
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Clerk, for sign-in.</li>
            <li>Neon, which hosts the database.</li>
            <li>Vercel, which runs the app and stores the photo files.</li>
            <li>
              Google and DeepSeek, which receive your destination and the number
              of days in order to write the itinerary, and the photo when a
              caption is generated.
            </li>
            <li>Stripe, if you upgrade. Card details never reach this app.</li>
            <li>Resend, when an email is sent on your behalf.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            Sharing a trip
          </h2>
          <p className="mt-2">
            A shared trip is readable by anyone holding its link, without an
            account. Stop sharing and the link stops working immediately.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Your rights</h2>
          <p className="mt-2">
            Download everything, or delete everything, from{" "}
            <Link
              href="/settings"
              className="focus-ring rounded font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              your settings
            </Link>
            . Deletion is immediate and permanent. No copy is kept.
          </p>
        </section>
      </div>
    </main>
  );
}
