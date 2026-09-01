import { boat, boatInput } from './boat';
import { isLand } from './canalMask';

/**
 * Autopilot: lets the trajinera find her own way down a canal.
 *
 * She senses rather than follows a route. Every frame she casts a fan of
 * "whiskers" from her position and measures how far each one runs before it
 * hits land, then steers toward the open water and throttles back when the
 * way ahead closes in. Nothing here knows about strokes or paths.
 *
 * That is deliberate. The drawn strokes ARE polylines, so following them
 * directly was the obvious alternative — but a canal is often several
 * overlapping strokes, or a wide one carved narrower with the Tierra brush,
 * and then the stroke's centreline is not the channel's. Sensing the mask
 * asks the only question that actually matters: where is there water?
 *
 * It writes the SAME two input axes the keyboard does, so the hull physics,
 * the collision and the punting stroke are all unchanged — the autopilot is
 * just another hand on the tiller.
 */

/** How far a whisker looks, in metres. */
const LOOK = 22;
/** Sampling step along a whisker. Finer than the boat is wide. */
const STEP = 0.7;
/** Sideways whiskers look less far — a canal is not that wide. */
const SIDE_LOOK = 13;

/** Fan of whisker angles, in radians off the bow. Positive is to port. */
const FAN = [-1.15, -0.75, -0.42, -0.18, 0, 0.18, 0.42, 0.75, 1.15];
const WIDEST = 1.15;

/** How hard she leans on the open direction, and on staying mid-channel. */
const STEER_GAIN = 1.7;
const CENTRE_GAIN = 0.1;
/** Smoothing on the tiller, per second. Raw whisker output judders. */
const TILLER_EASE = 4.5;

export const autopilot = { on: false };

let tiller = 0;

/** Distance until land along `angle` off the bow, capped at `maxDist`. */
function clearance(angle: number, maxDist: number): number {
  const h = boat.heading + angle;
  const dx = -Math.sin(h);
  const dz = -Math.cos(h);
  for (let d = STEP; d <= maxDist; d += STEP) {
    if (isLand(boat.x + dx * d, boat.z + dz * d)) return d;
  }
  return maxDist;
}

/**
 * Drive the tiller for one frame. Called by `LakeScene` before `advanceBoat`,
 * only while `autopilot.on`.
 */
export function steerAlongCanal(delta: number) {
  // Weighted average of the fan: each direction pulls in proportion to how
  // open it is, squared so a clear lane dominates a merely-passable one, and
  // damped by how far off the bow it is so she does not wheel around for a
  // slightly wider option to the side.
  let weighted = 0;
  let total = 0;
  for (const angle of FAN) {
    const open = clearance(angle, LOOK) / LOOK;
    const weight = open * open * (1 - 0.55 * (Math.abs(angle) / WIDEST));
    weighted += angle * weight;
    total += weight;
  }
  const desired = total > 0 ? weighted / total : 0;

  // Centring: more room to port means she is hugging the starboard bank, so
  // she eases to port. Without this she happily scrapes along one side.
  const port = clearance(Math.PI / 2, SIDE_LOOK);
  const starboard = clearance(-Math.PI / 2, SIDE_LOOK);
  const centring = (port - starboard) * CENTRE_GAIN;

  const target = Math.max(-1, Math.min(1, desired * STEER_GAIN + centring));
  // Ease rather than snap: the whiskers change in jumps as they cross the
  // mask's pixels, and steering straight off them makes her twitch.
  tiller += (target - tiller) * Math.min(1, delta * TILLER_EASE);
  boatInput.turn = tiller;

  // Throttle on what is ahead: full ahead in open water, easing off as the
  // channel closes, backing off entirely when she is about to run aground.
  const ahead = clearance(0, LOOK);
  boatInput.forward = Math.max(-0.6, Math.min(1, (ahead - 5) / 8));
}

/** Hand the tiller back, leaving the inputs neutral. */
export function releaseAutopilot() {
  autopilot.on = false;
  tiller = 0;
  boatInput.turn = 0;
  boatInput.forward = 0;
}
