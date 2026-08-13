/**
 * A trip's lifecycle, written down once.
 *
 * Before this, "can I share it" was a boolean somebody remembered to check,
 * and the answers disagreed depending on which screen you asked from. The
 * table below is the only answer, and every route asks it.
 *
 * The rule that catches people: a background job finishing may only move a
 * trip from generating to ready. If the owner archived the trip while the AI
 * was still writing, a job that blindly sets "ready" resurrects it. Which
 * transitions are legal depends on where you are now, not on what just
 * happened somewhere else.
 */

export const TRIP_STATES = [
  "draft",
  "generating",
  "ready",
  "shared",
  "archived",
] as const;

export type TripState = (typeof TRIP_STATES)[number];

/** From -> the states it is allowed to move to. Everything else is refused. */
const TRANSITIONS: Record<TripState, readonly TripState[]> = {
  draft: ["generating"],
  // Back to draft when a first generation fails; on to ready when it works.
  generating: ["ready", "draft"],
  ready: ["generating", "shared", "archived"],
  shared: ["ready"],
  archived: ["ready"],
};

export function canTransition(from: TripState, to: TripState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTripState(value: string): value is TripState {
  return (TRIP_STATES as readonly string[]).includes(value);
}

/** Editing means changing the inputs, which only makes sense before or after. */
export function canEdit(state: TripState): boolean {
  return state === "draft" || state === "ready";
}

/** Only a finished trip can be shared. A half-written one is not worth sending. */
export function canShare(state: TripState): boolean {
  return state === "ready";
}

/** Regenerating is allowed from ready, and refused while one is already running. */
export function canGenerate(state: TripState): boolean {
  return state === "draft" || state === "ready";
}

export function canArchive(state: TripState): boolean {
  return state === "ready";
}

/**
 * Why an action was refused, in words worth showing someone.
 *
 * A refusal that only says "invalid state" is a dead end. This says what is
 * happening and what to do about it.
 */
export function refusalReason(state: TripState, action: string): string {
  const reasons: Record<TripState, string> = {
    draft: "This trip has no itinerary yet.",
    generating: "This trip is still generating. You can do that once it is ready.",
    ready: `You cannot ${action} a trip in this state.`,
    shared: "This trip is shared and read-only. Unshare it first.",
    archived: "This trip is archived. Unarchive it first.",
  };
  return reasons[state];
}
