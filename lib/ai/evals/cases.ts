/**
 * The quality check that stands between a cost saving and a worse product.
 *
 * Switching a model or editing a prompt to save money is easy. Noticing that
 * it quietly made the itineraries worse is not, because nothing errors: the
 * app keeps working and the output is simply less good, and you find out from
 * a review months later.
 *
 * These are the cases to run before and after any such change. They are
 * deliberately few and cheap. An eval nobody runs because it costs too much
 * or takes too long is not a safety net.
 */

export type EvalCase = {
  id: string;
  destination: string;
  days: number;
  /** What a good answer looks like, in plain language. */
  expectations: string[];
  /** Words that should appear somewhere, as a shallow relevance check. */
  mustMention?: string[];
};

export const EVAL_CASES: EvalCase[] = [
  {
    id: "beach-week",
    destination: "Maui, Hawaii",
    days: 7,
    expectations: [
      "seven days, each with morning, afternoon, evening and a restaurant",
      "beach and ocean activities feature heavily",
      "real, named places rather than generic advice",
    ],
    mustMention: ["beach"],
  },
  {
    id: "budget-city-break",
    destination: "Lisbon, Portugal",
    days: 3,
    expectations: [
      "three days, fully populated",
      "affordable options, not only fine dining",
      "walkable clusters rather than criss-crossing the city",
    ],
  },
  {
    id: "family-trip",
    destination: "Copenhagen, Denmark",
    days: 4,
    expectations: [
      "four days, fully populated",
      "activities a child could actually enjoy",
      "nothing that requires a late night",
    ],
  },
  {
    id: "luxury-honeymoon",
    destination: "Kyoto, Japan",
    days: 5,
    expectations: [
      "five days, fully populated",
      "a quieter, more private tone than a standard tourist run",
      "named restaurants rather than 'a nice local place'",
    ],
  },
  {
    id: "adventure",
    destination: "Queenstown, New Zealand",
    days: 4,
    expectations: [
      "four days, fully populated",
      "outdoor and active choices",
      "sensible pacing rather than three strenuous things in one day",
    ],
  },
  {
    id: "single-day",
    destination: "Rome, Italy",
    days: 1,
    expectations: [
      "exactly one day, not a week trimmed down",
      "the highest-value stops given only one day",
    ],
  },
  {
    id: "obscure-destination",
    destination: "Tbilisi, Georgia",
    days: 3,
    expectations: [
      "three days, fully populated",
      "real Tbilisi places, not invented ones",
      "does not silently substitute a more famous city",
    ],
    mustMention: ["Tbilisi"],
  },
  {
    id: "awkward-input",
    destination: "paris",
    days: 2,
    expectations: [
      "handles lowercase and a bare city name",
      "two days, fully populated",
    ],
  },
];
