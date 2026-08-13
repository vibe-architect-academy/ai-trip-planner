/**
 * The locale facts both sides of the app need.
 *
 * Kept apart from lib/i18n.ts on purpose. That module reads cookies and
 * headers, which only exist on the server, so a client component importing it
 * drags `next/headers` into the browser bundle and the build fails. The list
 * of languages is not server-only; the machinery for choosing one is.
 */

export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Names for the picker, each written in its own language. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "Français",
};

export const LOCALE_COOKIE = "locale";

export function isLocale(value: string | undefined): value is Locale {
  return Boolean(value) && LOCALES.includes(value as Locale);
}
