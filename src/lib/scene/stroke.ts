/**
 * One punting stroke, defined once and read by everyone who cares: the
 * trajinero poses himself from it, and `boat.ts` turns its effort into thrust.
 * Same single-source-of-truth idea as `waves.ts` — a poler pushing on one
 * clock while the hull moves on another looks like two unrelated animations
 * playing in the same shot.
 *
 * This module owns the CADENCE only. Where the boat actually ends up is
 * `boat.ts`'s job: it integrates this effort against drag and steering, so the
 * player's arrow keys and the poler's rhythm meet in exactly one place.
 *
 * Deliberately plain mutable fields, not runes: this is written and read every
 * frame from inside `useTask`, and a reactive proxy would treat 60 writes a
 * second as 60 rounds of invalidation for no one's benefit (same reasoning as
 * the `$state.raw` notes on the instanced meshes).
 */

/** Seconds per full stroke. Unhurried — a poler is not in a hurry. */
const CYCLE = 3.6;
/** Fraction of the cycle spent driving; the rest is the quicker recovery. */
const DRIVE_FRACTION = 0.62;

const ease = (u: number) => u * u * (3 - 2 * u);

export const stroke = {
  /** 0..1 through the whole cycle. */
  phase: 0,
  /** True while the vara is planted and he is pushing. */
  driving: true,
  /** 0..1 through the current segment (drive or recovery). */
  progress: 0,
  /** 0 at the catch, 1 at the release — drives both pole tilt and body lean. */
  drive: 0,
  /**
   * How hard the vara is biting right now, 0..1. Zero at the catch, peaking
   * mid-push, back to zero through the recovery — a square-wave push would
   * make the boat lurch.
   */
  effort: 0,
};

let elapsed = 0;

/**
 * Advance the clock. Exactly ONE caller per frame — `LakeScene` owns the tick
 * (see its note); everyone else only reads.
 */
export function advanceStroke(delta: number) {
  elapsed += delta;
  const p = (elapsed % CYCLE) / CYCLE;
  stroke.phase = p;

  if (p < DRIVE_FRACTION) {
    const u = p / DRIVE_FRACTION;
    stroke.driving = true;
    stroke.progress = u;
    stroke.drive = ease(u);
    stroke.effort = Math.sin(u * Math.PI);
  } else {
    const u = (p - DRIVE_FRACTION) / (1 - DRIVE_FRACTION);
    stroke.driving = false;
    stroke.progress = u;
    stroke.drive = 1 - ease(u);
    stroke.effort = 0;
  }
}
