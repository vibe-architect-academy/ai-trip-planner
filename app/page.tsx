import AppHeader from "@/components/AppHeader";
import Planner from "@/components/Planner";

/**
 * A server component now, so the header can read the session directly instead
 * of the browser asking who it is after the page has already drawn.
 */

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 sm:py-14 lg:max-w-5xl">
      <AppHeader />
      <Planner />
    </main>
  );
}
