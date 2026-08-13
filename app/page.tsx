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
        }}
      />
    </main>
  );
}
