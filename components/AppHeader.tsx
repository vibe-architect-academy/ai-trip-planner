import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { getViewer } from "@/lib/auth";
import { getLocale, translator } from "@/lib/i18n";
import LanguagePicker from "./LanguagePicker";

export default async function AppHeader() {
  const viewer = await getViewer();
  const locale = await getLocale();
  const t = translator(locale);

  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
          <Link href="/" className="focus-ring rounded">
            {t("app.name")}{" "}
            <span className="text-indigo-600 dark:text-indigo-400" aria-hidden="true">
              &#10022;
            </span>
          </Link>
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">{t("app.tagline")}</p>
      </div>

      {/*
        min-h-11 is 44px, which is the smallest thing a finger reliably hits.
        A 28px text link is fine with a mouse and a coin toss on a phone.
      */}
      <nav className="flex shrink-0 items-center gap-1">
        {viewer && (
          <Link
            href="/trips"
            className="focus-ring inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400"
          >
            {t("nav.trips")}
          </Link>
        )}
        {viewer?.role === "admin" && (
          <Link
            href="/admin"
            className="focus-ring inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400"
          >
            {t("nav.admin")}
          </Link>
        )}
        {viewer && (
          <Link
            href="/settings"
            className="focus-ring inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400"
          >
            Settings
          </Link>
        )}
        <LanguagePicker locale={locale} label={t("language.label")} />
        <div className="ml-1 flex min-h-11 items-center">
          <UserButton />
        </div>
      </nav>
    </header>
  );
}
