/**
 * One punting stroke, defined once and read by everyone who cares: the
 * trajinero poses himself from it, the hull takes a surge from it, and the
 * ripples and the water hyacinth drift at the speed it produces. Same
 * single-source-of-truth idea as `waves.ts` — a poler pushing on one clock
 * while the water streams past on another looks like two unrelated animations
 * playing in the same shot.
 *
 * The boat's speed is NOT a hand-drawn curve: thrust is applied only while he
 * is actually pushing, drag is always eating it, and the surge falls out of
 * integrating the two. That's why the water visibly gathers pace through the
 * drive and coasts back down during the recovery.
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
/** Push, in m/s², at the peak of the drive. */
const THRUST = 1.5;
/** Linear drag, 1/s. With the thrust above this settles near 1 m/s — about
 *  walking pace, which is what a loaded trajinera actually does. */
const DRAG = 0.6;

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
  /** Boat speed through the water, m/s. */
  speed: 0.95,
  /** Instantaneous acceleration, m/s². Positive while he gains on the drag. */
  accel: 0,
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

  // Effort is zero at the catch, peaks mid-push and tapers off as the pole
  // goes flat and stops biting — a square-wave push would make the boat lurch.
  let effort: number;
  if (p < DRIVE_FRACTION) {
    const u = p / DRIVE_FRACTION;
    stroke.driving = true;
    stroke.progress = u;
    stroke.drive = ease(u);
    effort = Math.sin(u * Math.PI);
  } else {
    const u = (p - DRIVE_FRACTION) / (1 - DRIVE_FRACTION);
    stroke.driving = false;
    stroke.progress = u;
    stroke.drive = 1 - ease(u);
    effort = 0;
  }

  stroke.accel = THRUST * effort - DRAG * stroke.speed;
  stroke.speed = Math.max(0, stroke.speed + stroke.accel * delta);
}
