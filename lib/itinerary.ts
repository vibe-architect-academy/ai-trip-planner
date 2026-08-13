/**
 * Turns the AI's markdown into structure the components can render.
 *
 * Parsing here rather than injecting HTML into the page is deliberate. The
 * itinerary is text a model wrote, and model output is never something to hand
 * to the browser as markup. Once it is parsed into plain data, every component
 * downstream renders it as text and there is nothing to inject.
 */

export type DayItem = {
  /** "Morning", "Dinner", and so on. Empty when the model skipped the label. */
  label: string;
  text: string;
};

export type Day = {
  heading: string;
  items: DayItem[];
};

const HEADING = /^#{1,3}\s+(.*)$/;
const BULLET = /^\s*[-*]\s+(.*)$/;
const LABELLED = /^\*\*(.+?):?\*\*:?\s*(.*)$/;

/** Strips the markdown emphasis markers the model sprinkles through the text. */
function stripEmphasis(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").trim();
}

export function parseItinerary(markdown: string): Day[] {
  const days: Day[] = [];
  let current: Day | null = null;

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = line.match(HEADING);
    if (heading) {
      current = { heading: stripEmphasis(heading[1]), items: [] };
      days.push(current);
      continue;
    }

    const bullet = line.match(BULLET);
    if (bullet) {
      // A day's bullets can arrive before any heading if the model ignores the
      // format. Give them somewhere to live rather than dropping them.
      if (!current) {
        current = { heading: "Your trip", items: [] };
        days.push(current);
      }
      const labelled = bullet[1].match(LABELLED);
      current.items.push(
        labelled
          ? { label: stripEmphasis(labelled[1]), text: stripEmphasis(labelled[2]) }
          : { label: "", text: stripEmphasis(bullet[1]) },
      );
    }
  }

  return days;
}
