import AppHeader from "@/components/AppHeader";
import Planner from "@/components/Planner";
import { getLocale, translator } from "@/lib/i18n";

/**
 * A server component, so the header can read the session directly and the
 * language is decided once, here, rather than in the browser after the page
 * has already drawn in the wrong one.
 */

export default async function Home() {
  const locale = await getLocale();
  const t = translator(locale);

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 sm:py-14 lg:max-w-5xl">
      <AppHeader />
      <Planner
        labels={{
          destinationLabel: t("form.destination.label"),
          destinationPlaceholder: t("form.destination.placeholder"),
          daysLabel: t("form.days.label"),
          submit: t("form.submit"),
          planning: t("form.planning"),
          saved: t("trip.saved"),
          savedLink: t("trip.savedLink"),
          savedRest: t("trip.savedRest"),
          genericError: t("error.generic"),
          offlineError: t("error.offline"),
          previewPrompt: t("preview.prompt"),
          previewSave: t("preview.save"),
          previewClaiming: t("preview.claiming"),
        }}
      />
      {/*
        Where this app came from. It is the worked example of a course, and a
        visitor who likes what they see should be able to find the course
        without guessing. Plain links, no tracking parameters: the referrer
        already says where they came from.
      */}
      <footer className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <p>
          {t("footer.builtWith")}{" "}
          <a
            href="https://archvibe.app/"
            className="focus-ring rounded underline hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            {t("footer.course")}
          </a>
          {" · "}
          <a
            href="https://archvibe.app/lessons/youve-outgrown-lovable/"
            className="focus-ring rounded underline hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            {t("footer.freeLesson")}
          </a>
          {" · "}
          <a
            href="https://github.com/vibe-architect-academy/ai-trip-planner"
            className="focus-ring rounded underline hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            {t("footer.source")}
          </a>
        </p>
      </footer>
    </main>
  );
}
