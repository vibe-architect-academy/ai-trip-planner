"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALES, LOCALE_NAMES, LOCALE_COOKIE, type Locale } from "@/lib/locales";

export default function LanguagePicker({
  locale,
  label,
}: {
  locale: Locale;
  label: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function choose(next: string) {
    // A year, because a language preference is not a session preference.
    // SameSite=Lax so it survives arriving from an external link.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    // The server decides the language, so it has to render again.
    startTransition(() => router.refresh());
  }

  return (
    <label className="inline-flex min-h-11 items-center">
      <span className="sr-only">{label}</span>
      <select
        value={locale}
        disabled={isPending}
        onChange={(event) => choose(event.target.value)}
        className="focus-ring cursor-pointer rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_NAMES[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
