import { cookies, headers } from "next/headers";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./locales";

export { LOCALES, LOCALE_NAMES, LOCALE_COOKIE, DEFAULT_LOCALE } from "./locales";
export type { Locale } from "./locales";

/**
 * Translation, and the formatting that comes with it.
 *
 * Adding a language is adding a JSON file and one line in MESSAGES. Nothing
 * else in the app should ever need to know which languages exist.
 *
 * The part people forget is that translation is the easy half. 25/12/2024 and
 * 12/25/2024 are the same day written by two people who each think the other
 * is wrong, and no amount of translated button labels fixes a date that reads
 * as a different month.
 */

const MESSAGES: Record<Locale, Record<string, string>> = { en, fr };

/**
 * Which language to use.
 *
 * An explicit choice wins, because someone who picked a language meant it.
 * Otherwise fall back to what the browser asked for in Accept-Language, and
 * then to English.
 */
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;

  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    // "fr-CA;q=0.9" -> "fr"
    const tag = part.trim().split(";")[0].split("-")[0].toLowerCase();
    if (isLocale(tag)) return tag;
  }

  return DEFAULT_LOCALE;
}

/**
 * Looks up a message and fills in its placeholders.
 *
 * Falls back to English for a missing key rather than rendering the key
 * itself, because a half-translated file should look unfinished, not broken.
 */
export function translator(locale: Locale) {
  return function t(key: string, values: Record<string, string | number> = {}): string {
    const template = MESSAGES[locale][key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;

    return template
      // {count, plural, one {# day} other {# days}}
      .replace(
        /\{(\w+), plural, one \{([^}]*)\} other \{([^}]*)\}\}/g,
        (_match, name: string, one: string, other: string) => {
          const count = Number(values[name] ?? 0);
          return (count === 1 ? one : other).replace("#", String(count));
        },
      )
      .replace(/\{(\w+)\}/g, (_match, name: string) =>
        name in values ? String(values[name]) : `{${name}}`,
      );
  };
}

/** Dates in the reader's convention, not the server's. */
export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date);
}

/**
 * Money in the reader's convention, keeping its own currency.
 *
 * Formatting is not conversion. 10 EUR shown to an American reader is still
 * ten euros, written the way they expect to read it.
 */
export function formatMoney(amount: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}

/** The language name to hand the AI, so the itinerary comes back in it. */
export function languageForPrompt(locale: Locale): string {
  return { en: "English", fr: "French" }[locale];
}
