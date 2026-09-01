import { LatheGeometry, SphereGeometry, TorusGeometry, Vector2 } from 'three';

/**
 * The chibi character kit — shared geometry for the trajinero and the
 * passengers, in the "Spooky Express" register the user asked for: a head one
 * third of total height, no neck, one closed bell for the whole body, stubby
 * blob limbs, two big dark eyes with a white glint, hair as a single helmet
 * mass. All numbers come from a synthesized construction spec whose reach and
 * clearance arithmetic was re-verified against the boat's real dimensions
 * (bench 0.31, table half-width 0.4025, roof clearance 1.59, half-beam 1.15).
 *
 * Frames: BODY parts are feet-relative (origin = deck plank top). Everything
 * on the HEAD (eyes, glints, hair, sombrero) is HEAD-CENTRED — those offsets
 * are identical for the standing and seated variants, so one set of constants
 * serves both; each component mounts them inside a group placed at its own
 * head centre (y 1.045 standing, 1.040 seated).
 *
 * Geometries are module-level singletons on purpose: five characters share
 * one set of buffers, and materials (the only thing that varies) stay in the
 * components.
 */

export const HEAD_R = 0.21;
/** Head centre, feet-relative. */
export const HEAD_Y_STANDING = 1.045;
export const HEAD_Y_SEATED = 1.04;
/** Top of the bell (the "neck" the head sinks into), feet-relative. */
export const NECK_Y_STANDING = 0.862;
export const NECK_Y_SEATED = 0.858;

const profile = (pts: [number, number][]) => pts.map(([x, y]) => new Vector2(x, y));

/**
 * The standing poncho bell: torso, garment and hips as ONE closed watertight
 * lathe — a stacked-primitives union shows a seam and can't give the
 * reference's continuous flare. 28 segments because the hem shoulder facets
 * visibly under the scene's directional light at 20.
 */
export const bellStandingGeometry = new LatheGeometry(
  profile([
    [0.0, 0.055], [0.155, 0.055], [0.225, 0.075], [0.255, 0.13], [0.26, 0.18],
    [0.252, 0.26], [0.236, 0.36], [0.216, 0.47], [0.198, 0.57], [0.183, 0.66],
    [0.171, 0.74], [0.162, 0.8], [0.152, 0.84], [0.115, 0.856], [0.06, 0.86],
    [0.0, 0.862],
  ]),
  28
);

/**
 * The seated bell: hem raised to drape 0.085 over the bench edge, domed
 * underside so it isn't a flat floating disc from a low camera, and narrower
 * (0.235 max, times the component's 0.94 x-scale) so at BENCH_X 0.91 the
 * outboard hem stays inside the 1.15 half-beam — the wide standing hem would
 * overhang the gunwale by 6 cm.
 */
export const bellSeatedGeometry = new LatheGeometry(
  profile([
    [0.0, 0.225], [0.09, 0.228], [0.15, 0.24], [0.205, 0.258], [0.23, 0.3],
    [0.235, 0.35], [0.228, 0.43], [0.214, 0.52], [0.198, 0.61], [0.184, 0.69],
    [0.172, 0.755], [0.162, 0.805], [0.15, 0.84], [0.112, 0.852], [0.058, 0.856],
    [0.0, 0.858],
  ]),
  28
);

/** The single largest curved silhouette on screen — 16 facets would show. */
export const headGeometry = new SphereGeometry(HEAD_R, 24, 18);

// ---- the face, head-centred. The kit faces -Z. -------------------------
/** Scaled per-mesh to (1, 1.32, 0.45): a 0.10 × 0.13 ovoid, 45 mm deep. */
export const eyeGeometry = new SphereGeometry(0.05, 12, 10);
export const EYE_SCALE: [number, number, number] = [1, 1.32, 0.45];
/**
 * Standing 17 mm proud of the skull; the per-side yaw (∓0.38) aligns each
 * ovoid's flattened axis with the head's outward normal at that point.
 */
export const EYE_POSITIONS: { pos: [number, number, number]; rotY: number }[] = [
  { pos: [0.076, -0.007, -0.19], rotY: -0.38 },
  { pos: [-0.076, -0.007, -0.19], rotY: 0.38 },
];

export const glintGeometry = new SphereGeometry(0.016, 8, 6);
/** Upper-inner of each eye, clear of both skull and eye front face. */
export const GLINT_POSITIONS: [number, number, number][] = [
  [0.058, 0.03, -0.212],
  [-0.058, 0.03, -0.212],
];

// ---- hair: one solid helmet, never strands ------------------------------
/**
 * Fringe cap. Its rim (centre + 0.222·cos 1.30 = +0.059) lands exactly on the
 * top edge of the eye ovals — the fringe kisses the eyes, the classic chibi
 * read. OMIT when the figure wears the sombrero.
 */
export const hairFringeGeometry = new SphereGeometry(0.222, 20, 12, 0, Math.PI * 2, 0, 1.3);
/**
 * Jaw-length bob mass around the back and sides, leaving a 151° face opening.
 * KEEP under a hat. Its material must be DoubleSide: the partial phi sweep
 * leaves two raw edges and you'd otherwise see through the head from
 * three-quarter-rear.
 */
export const hairBackGeometry = new SphereGeometry(
  0.224, 20, 14, -Math.PI * 0.58, Math.PI * 1.16, 0, 2.0
);

// ---- scarf ----------------------------------------------------------------
/**
 * Collar torus. Its outer radius (0.165 + 0.045 = 0.21) exactly matches the
 * head's, so in profile the collar lines up with the skull — this part is
 * what makes "no neck" invisible from every angle. BODY-frame part: sits at
 * the bell cap, not inside the head group.
 */
export const scarfRingGeometry = new TorusGeometry(0.165, 0.045, 8, 20);

// ---- sombrero, head-centred ------------------------------------------------
/**
 * Crown AND brim in one revolved profile with real thickness, including the
 * upturned brim edge — a cylinder brim plus dome crown reads as a lampshade
 * on a ball. Passengers wear it at 0.78 x/z scale.
 */
export const sombreroGeometry = new LatheGeometry(
  profile([
    [0.0, 0.3], [0.07, 0.296], [0.11, 0.281], [0.128, 0.252], [0.134, 0.221],
    [0.176, 0.209], [0.246, 0.205], [0.306, 0.209], [0.332, 0.219], [0.316, 0.227],
    [0.258, 0.221], [0.192, 0.221], [0.146, 0.229], [0.142, 0.262], [0.116, 0.287],
    [0.058, 0.296], [0.0, 0.298],
  ]),
  28
);
export const sombreroBandGeometry = new TorusGeometry(0.138, 0.014, 8, 22);
/** Band height above the head centre (wraps the crown just over the brim). */
export const SOMBRERO_BAND_Y = 0.239;

/** Stubby limbs must stay within this reach or a hand detaches from the pole. */
export const ARM_MAX = 0.28;
