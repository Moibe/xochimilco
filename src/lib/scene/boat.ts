import { isLand } from './canalMask';
import { stroke } from './stroke';

/**
 * Where the trajinera actually IS. Until now she never moved: she sat at the
 * origin bobbing while the water slid past to fake headway. With arrow-key
 * control she needs a real position and heading in the world — which is also
 * what the canal map will need the day those drawn channels become water.
 *
 * The scenery is what moves to keep up: `Lake` re-centres its plane on the
 * boat every frame (the wave shader samples WORLD xz, so the swell stays
 * anchored and the boat genuinely travels through it), and the ripples and
 * hyacinth recycle around her instead of drifting past a stationary hull.
 *
 * Plain mutable fields for the same reason as `stroke.ts`: written and read
 * every frame inside `useTask`, where a reactive proxy would just be 60
 * invalidations a second for nobody.
 */

/** Peak push per unit of stroke effort, m/s². The poler's baseline cruise. */
const THRUST = 1.5;
/**
 * Extra push while the player holds forward — he leans into it. Sized against
 * the equilibrium `mean(thrust)/DRAG`: mean stroke effort is 0.395, so this
 * settles her near 1.8 m/s pushing hard against a 1.0 m/s idle cruise. It was
 * 2.6 first, which worked out to 2.7 m/s — about 10 km/h, a speedboat, not a
 * punt.
 */
const BOOST = 1.3;
/** Linear drag, 1/s. Thrust and drag settle the idle cruise near 1 m/s. */
const DRAG = 0.6;
/** Back-poling: real polers do reverse, but slowly. */
const BACK_THRUST = 2.2;
const MAX_REVERSE = -0.5;
/** Yaw rate at full steering input, rad/s — ~38°/s, a boat and not a car. */
const TURN_RATE = 0.6;
/**
 * A boat steers by moving, so turning scales with speed — but a punt can also
 * pivot on the pole while stopped, so the floor is well above zero rather than
 * leaving the player stuck when they come to rest.
 */
const TURN_AT_REST = 0.35;
const TURN_FULL_SPEED = 1.1;

export const boat = {
  x: 0,
  z: 0,
  /** Radians about Y. At 0 the bow points down -Z, matching the hull's own
   *  convention (see the note in `Trajinera.svelte` on why the bow is -Z). */
  heading: 0,
  /** Along-heading speed, m/s. Negative while backing up. */
  speed: 0.95,
  /** Instantaneous acceleration, m/s² — the hull reads this for surge pitch. */
  accel: 0,
};

/** Held-key state, -1..1 on each axis. Written by the page's key handler. */
export const boatInput = { forward: 0, turn: 0 };

/** Unit vector the bow points along, given the current heading. */
export function boatForward(): { x: number; z: number } {
  return { x: -Math.sin(boat.heading), z: -Math.cos(boat.heading) };
}

/**
 * World position of a point given in the boat's own frame — the hull's wave
 * probes need this, because once she can turn, sampling the swell at fixed
 * local offsets would have her riding waves from wherever she was pointing
 * when the scene loaded.
 */
export function boatToWorld(localX: number, localZ: number): { x: number; z: number } {
  const c = Math.cos(boat.heading);
  const s = Math.sin(boat.heading);
  return {
    x: boat.x + localX * c + localZ * s,
    z: boat.z - localX * s + localZ * c,
  };
}

/** Inverse of `boatToWorld`: a world point expressed in the boat's frame. */
export function worldToBoat(worldX: number, worldZ: number): { x: number; z: number } {
  const c = Math.cos(boat.heading);
  const s = Math.sin(boat.heading);
  const dx = worldX - boat.x;
  const dz = worldZ - boat.z;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

/**
 * Advance the hull. ONE caller per frame — `LakeScene` owns the tick and calls
 * this straight after `advanceStroke`, so the boat sees this frame's effort.
 */
export function advanceBoat(delta: number) {
  // Holding forward doesn't bypass the stroke, it makes each push harder — so
  // the surge keeps its rhythm and the poler stays the thing moving the boat.
  // Holding back doesn't add a brake that fights the motion (which would stall
  // out the moment she started backing up, each pushing against the other);
  // it simply points his push the other way, which is what back-poling IS.
  const throttle = boatInput.forward;
  const push =
    throttle >= 0
      ? (THRUST + BOOST * throttle) * stroke.effort
      : BACK_THRUST * throttle * stroke.effort;

  boat.accel = push - DRAG * boat.speed;
  boat.speed += boat.accel * delta;
  // Reverse is capped well below the forward cruise: nobody back-poles fast.
  if (boat.speed < MAX_REVERSE) boat.speed = MAX_REVERSE;

  const steerAuthority =
    TURN_AT_REST + (TURN_FULL_SPEED - TURN_AT_REST) * Math.min(1, Math.abs(boat.speed) / 1.2);
  boat.heading += boatInput.turn * TURN_RATE * steerAuthority * delta;

  const fwd = boatForward();
  const stepX = fwd.x * boat.speed * delta;
  const stepZ = fwd.z * boat.speed * delta;

  // Try the whole move; if the bank is in the way, try each axis on its own so
  // she SLIDES along the shore instead of sticking to it. Sticking is what a
  // naive "blocked? then don't move" check gives you, and it makes a narrow
  // canal nearly impossible to steer down.
  if (canGo(boat.x + stepX, boat.z + stepZ)) {
    boat.x += stepX;
    boat.z += stepZ;
  } else if (canGo(boat.x + stepX, boat.z)) {
    boat.x += stepX;
    boat.speed *= 0.6; // grounding scrubs off way
  } else if (canGo(boat.x, boat.z + stepZ)) {
    boat.z += stepZ;
    boat.speed *= 0.6;
  } else {
    boat.speed = 0;
  }
}

/**
 * Can the hull sit here? Checked at the leading end rather than the centre —
 * an 8 m boat tested only at her middle buries half her length in a bank
 * before anything stops her. Which end leads depends on whether she is going
 * ahead or backing up.
 */
function canGo(x: number, z: number): boolean {
  if (isLand(x, z)) return false;
  const fwd = boatForward();
  const lead = boat.speed >= 0 ? HALF_LENGTH : -HALF_LENGTH;
  return !isLand(x + fwd.x * lead, z + fwd.z * lead);
}

/** Half the hull's length, the probe distance to her bow (or stern astern). */
const HALF_LENGTH = 3.4;
