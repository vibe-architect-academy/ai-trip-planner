import { readFileSync } from "node:fs";

/**
 * Loads .env.local for standalone scripts.
 *
 * Next does this at runtime; a script run directly gets nothing, so without it
 * a perfectly configured machine reports missing credentials.
 *
 * A real environment variable always wins over the file, so CI and the hosting
 * platform stay in charge.
 */
export function loadEnv(file = ".env.local") {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return;
  }

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    // Strip surrounding quotes, which providers include and which are not
    // part of the value.
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");

    if (!process.env[key]) process.env[key] = value;
  }
}
