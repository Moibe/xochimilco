import {
  BufferGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  LatheGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three';

/**
 * The chibi character kit, in the "miniyo by cactus" register the user asked
 * for — the collectible-vinyl look: a big rounded-CUBE head with a flat face,
 * a small real body with arms and legs, and a face carrying brows, a button
 * nose and a hint of a smile.
 *
 * What changed from the first pass, straight off the reference photos:
 *   · head: sphere → superellipsoid. A vinyl head is a squircle, and the flat
 *     front is what gives you somewhere to actually put a face.
 *   · face: gained a nose, thick brows and a smile. The brows do most of the
 *     characterisation — they are the boldest thing on those faces.
 *   · eyes: solid black now. The reference eyes have no painted white glint;
 *     what you see is a specular sheen, so it comes from the material instead.
 *   · body: bell/poncho → torso + arms + legs + shoes. These figures have real
 *     little bodies; the old bell hid everything below the chin.
 *
 * Frames: BODY parts are feet-relative (origin = the deck plank top).
 * Everything on the HEAD is HEAD-CENTRED, so one set of face constants serves
 * the standing and seated builds alike; each component mounts them in a group
 * placed at its own head centre.
 */

// ---- head ------------------------------------------------------------------
export const HEAD_HALF = { x: 0.26, y: 0.27, z: 0.245 };
/** Head centre, feet-relative. */
export const HEAD_Y_STANDING = 1.05;
export const HEAD_Y_SEATED = 0.9;
/** Top of the torso the head sinks into — there is no neck, by design. */
export const NECK_Y_STANDING = 0.8;
export const NECK_Y_SEATED = 0.66;

/**
 * A sphere pushed out onto a superellipsoid: |x|^e + |y|^e + |z|^e = 1.
 * At e = 2 this is the sphere it started as; by e ≈ 4 it is the rounded cube a
 * vinyl head actually is, with faces flat enough to carry features and corners
 * still soft. Doing it by deformation rather than a rounded-box primitive keeps
 * the sphere's UV-style topology, so partial sweeps (the hair caps below) come
 * out of the same helper.
 */
export function superellipsoid(
  half: { x: number; y: number; z: number },
  exponent = 4.2,
  widthSegments = 32,
  heightSegments = 24,
  thetaStart = 0,
  thetaLength = Math.PI,
  phiStart = 0,
  phiLength = Math.PI * 2
): BufferGeometry {
  const geo = new SphereGeometry(1, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const len = Math.hypot(x, y, z) || 1;
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;
    // Radius that lands this direction on the superellipsoid's surface.
    const denom =
      Math.abs(nx) ** exponent + Math.abs(ny) ** exponent + Math.abs(nz) ** exponent;
    const r = 1 / denom ** (1 / exponent);
    pos.setXYZ(i, nx * r * half.x, ny * r * half.y, nz * r * half.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export const headGeometry = superellipsoid(HEAD_HALF);

// ---- the face, head-centred. The kit faces -Z. ------------------------------
// The face is nearly flat out to ~40% of the half-width (that is the point of
// the squircle), so everything below sits just proud of z = -0.244 and can
// never z-fight.

/**
 * A slim soft-cornered oval. Narrowed from 0.13 x 0.16 to 0.09 x 0.14 — the
 * first pass read as goggles: wide enough that the two eyes nearly met the
 * sides of the head, which flattened the whole face. Slimmer ovals set a
 * little closer in leave the cheeks room to read as cheeks.
 */
export const eyeGeometry = superellipsoid({ x: 0.04, y: 0.066, z: 0.024 }, 3.0, 20, 16);
export const EYE_POSITIONS: [number, number, number][] = [
  [0.098, -0.035, -0.234],
  [-0.098, -0.035, -0.234],
];

/**
 * Brows. Thick, dark and slightly tilted — on the reference faces these carry
 * more of the character than the eyes do, and leaving them off is most of why
 * the first pass read as blank.
 */
// Narrowed alongside the eyes: a brow much wider than the eye under it stops
// reading as a brow and starts reading as a painted stripe.
export const browGeometry = superellipsoid({ x: 0.055, y: 0.015, z: 0.019 }, 3.0, 16, 10);
export const BROWS: { pos: [number, number, number]; rotZ: number }[] = [
  // Sits clear of the eye tops. Closer and the brow merges into the eye as one
  // dark band; the reference faces keep a visible gap between them.
  { pos: [0.098, 0.098, -0.237], rotZ: -0.1 },
  { pos: [-0.098, 0.098, -0.237], rotZ: 0.1 },
];

/** The button nose — small, central, and the thing that says "vinyl toy". */
export const noseGeometry = superellipsoid({ x: 0.036, y: 0.032, z: 0.03 }, 2.6, 16, 12);
export const NOSE_POSITION: [number, number, number] = [0, -0.078, -0.243];

/**
 * A hint of a smile: a shallow arc of a torus. Barely a few pixels at scene
 * distance, but the camera can be orbited right up to the boat, and a mouthless
 * face reads as eerie the moment you do.
 */
export const mouthGeometry = (() => {
  const arc = Math.PI * 0.62;
  const geo = new TorusGeometry(0.052, 0.0075, 6, 20, arc);
  // A torus arc always starts at +X and sweeps anticlockwise, so its midpoint
  // sits at arc/2. To read as a smile the arc has to be the BOTTOM of the
  // circle, i.e. its midpoint at 270°: rotate by 1.5π - arc/2. An earlier
  // 0.69π put the midpoint at 180° — the left-hand SIDE of the circle, which
  // renders as a crooked vertical squiggle rather than a mouth.
  geo.rotateZ(Math.PI * 1.5 - arc / 2);
  return geo;
})();
export const MOUTH_POSITION: [number, number, number] = [0, -0.138, -0.238];

// ---- hair ------------------------------------------------------------------
/**
 * A shell over the crown, cut just ABOVE the brows. Its rim lands at head-y
 * +0.129 against brow tops at +0.122 — that gap is the whole margin, and closing it
 * hides the face. Full 360°, which is safe precisely because it stops above
 * every feature.
 */
export const hairCapGeometry = superellipsoid(
  { x: HEAD_HALF.x + 0.014, y: HEAD_HALF.y + 0.012, z: HEAD_HALF.z + 0.014 },
  4.2,
  32,
  20,
  0,
  1.14
);
/**
 * Length down the back and sides for long hair, with a gap left for the face.
 *
 * Getting the gap in the right place needs three's actual phi convention, not
 * the obvious guess. SphereGeometry lays out
 *   x = -r·cos(phi)·sin(theta),  z = r·sin(phi)·sin(theta)
 * so phi = 0 is -X and the BACK of the head (+Z) is at phi = +π/2 — centring
 * the sweep on 0 (as a first version did) wraps hair over one cheek and leaves
 * the opening out to the side, burying half the face. Centred on π/2 and
 * spanning 1.24π, the 137° gap lands squarely on the face at -Z.
 *
 * Its material must be DoubleSide: the open sweep leaves two raw edges.
 */
export const hairLongGeometry = superellipsoid(
  { x: HEAD_HALF.x + 0.016, y: HEAD_HALF.y + 0.014, z: HEAD_HALF.z + 0.016 },
  4.2,
  32,
  22,
  0,
  2.15,
  Math.PI * 0.5 - Math.PI * 0.62,
  Math.PI * 1.24
);
/**
 * Masses that fall beside the jaw — the reference's centre-parted look. Kept
 * modest and set BEHIND the face plane (+z): at 0.075 x 0.2 and level with the
 * head's middle they swung round in front of the chest like a pair of dark
 * paddles rather than reading as hair.
 */
export const hairSideGeometry = superellipsoid({ x: 0.055, y: 0.155, z: 0.08 }, 3.0, 16, 14);
export const HAIR_SIDES: [number, number, number][] = [
  [0.235, -0.175, 0.035],
  [-0.235, -0.175, 0.035],
];

// ---- body ------------------------------------------------------------------
const profile = (pts: [number, number][]) => pts.map(([x, y]) => new Vector2(x, y));

/**
 * A small real torso: near-cylindrical with a rounded top, the head sinking
 * into its cap. Nothing like the old bell, which swallowed the whole figure.
 */
// Shoulder radius 0.19 makes the head about 1.35x the shoulder width, which
// is what the reference figures actually are. At 0.157 the ratio was 1.68 and
// they read as bobbleheads on sticks — the head was not too big, the body was
// too narrow.
export const torsoGeometry = new LatheGeometry(
  profile([
    [0.0, 0.42], [0.12, 0.42], [0.168, 0.452], [0.182, 0.51], [0.19, 0.6],
    [0.188, 0.68], [0.176, 0.735], [0.148, 0.775], [0.086, 0.795], [0.0, 0.802],
  ]),
  28
);
/** Seated: the same torso, shifted so its hips land on a 0.31 m bench. */
export const torsoSeatedGeometry = new LatheGeometry(
  profile([
    [0.0, 0.28], [0.12, 0.28], [0.168, 0.312], [0.182, 0.37], [0.19, 0.46],
    [0.188, 0.54], [0.176, 0.595], [0.148, 0.635], [0.086, 0.655], [0.0, 0.662],
  ]),
  28
);
/** The poler's faja, worn at the waist. A ring, NOT the torso rescaled: the
 *  lathe's profile carries its own heights, so scaling it in Y drags the whole
 *  band down to the origin and it floats off as a loose disc. */
export const sashGeometry = new CylinderGeometry(0.193, 0.186, 0.075, 28, 1, true);

/** Limbs are capsules — rounded ends mean no joint ever shows a hard rim. */
export const armGeometry = new CapsuleGeometry(0.049, 0.155, 4, 12);
export const legGeometry = new CapsuleGeometry(0.066, 0.2, 4, 12);
export const handGeometry = superellipsoid({ x: 0.05, y: 0.052, z: 0.05 }, 2.6, 14, 12);
/** Shoes: a rounded wedge, longer than wide, like the reference sneakers. */
export const shoeGeometry = superellipsoid({ x: 0.072, y: 0.045, z: 0.115 }, 3.2, 18, 14);

export const SHOULDER_Y = 0.73;
/** On the torso's surface at shoulder height, so arms emerge rather than
 *  sprouting from inside the chest. */
export const SHOULDER_X = 0.17;
export const HIP_Y = 0.46;
export const HIP_X = 0.09;

// ---- sombrero, head-centred ------------------------------------------------
/**
 * Crown and brim in one revolved profile with real thickness, including the
 * upturned edge — a cylinder brim plus a dome crown reads as a lampshade on a
 * ball. Sized up for the bigger squircle head.
 */
/**
 * The crown has to be WIDER than the skull or the hat cannot be worn — it can
 * only be balanced on top. At a crown radius of 0.16 against a head half-width
 * of 0.24–0.26 it floated over the head like a halo with the hair poking out
 * beneath. The crown now clears the head at 0.265, and its brim line sits at
 * y 0.17, below the head's crown at 0.27, so it is genuinely pulled down over
 * the skull. Outer surface first, then back along the underside, which is what
 * gives the brim real thickness and its upturned edge.
 */
export const sombreroGeometry = new LatheGeometry(
  profile([
    [0.0, 0.335], [0.1, 0.332], [0.175, 0.322], [0.225, 0.295], [0.253, 0.245],
    [0.265, 0.19], [0.268, 0.168],
    [0.33, 0.158], [0.4, 0.152], [0.44, 0.158], [0.428, 0.169], [0.36, 0.164],
    [0.29, 0.172],
    [0.262, 0.2], [0.248, 0.26], [0.205, 0.305], [0.12, 0.33], [0.0, 0.333],
  ]),
  28
);
export const sombreroBandGeometry = new TorusGeometry(0.268, 0.017, 8, 24);
/** Band height above the head centre (wraps the crown just over the brim). */
export const SOMBRERO_BAND_Y = 0.205;

/** Stubby limbs must stay within this reach or a hand detaches from the pole. */
export const ARM_MAX = 0.34;
