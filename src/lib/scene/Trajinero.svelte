<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import {
    BoxGeometry,
    CylinderGeometry,
    Euler,
    Group,
    MeshStandardMaterial,
    Quaternion,
    SphereGeometry,
    Vector3,
  } from 'three';

  /**
   * The trajinero: the poler who stands on the stern deck and pushes the boat
   * along with a `vara` against the canal bottom. Xochimilco's trajineras are
   * punted, not rowed — there are no oars, no rowlocks and no motor, so the
   * whole figure is built around one long pole worked down the starboard side.
   *
   * Built from the same primitives-only kit as the boat (no glTF), and mounted
   * INSIDE the trajinera's moving group, so it inherits the hull's heave,
   * pitch and roll for free and never drifts off the deck.
   *
   * The stroke below is the real cycle, not a loop of one sine: a long drive
   * (pole planted, swept aft, body folding forward into the push) followed by
   * a shorter recovery (pole lifted clear of the water and swung back forward).
   * That asymmetry is what reads as effort — a symmetric swing looks like the
   * pole is stirring the water rather than pushing off the bottom.
   */
  let { strokeSeconds = 3.6 }: { strokeSeconds?: number } = $props();

  // ---- proportions (metres, feet-relative; 1 world unit = 1 m) -------------
  const HIP_Y = 0.86;
  const SHOULDER_Y = 1.4;
  const HEAD_Y = 1.575;
  const GRIP = new Vector3(0.16, 1.05, -0.42);

  // Stroke extremes, as pole tilt about X. Negative leans the pole's top
  // FORWARD (-Z, the bow) which swings its submerged end aft (+Z) — see the
  // hull's own note on why the bow sits at -Z.
  const CATCH = -0.18; // planted, nearly upright
  const RELEASE = -0.85; // swept back, end of the push
  /**
   * Outward tilt so the vara goes down OUTSIDE the gunwale. Measured, not
   * guessed: at 0.28 the pole crossed the hull's top edge at x = 1.13 against
   * a half-beam of ~1.13 at that station — dead on the gunwale at full sweep.
   * 0.34 clears it by ~6 cm at both ends of the stroke.
   */
  const POLE_OUT = 0.34;

  const POLE_LENGTH = 4.4;
  /** How much pole sticks up above his hands. Kept short deliberately: at the
   *  original 1.1 m the top end punched up through the toldo at full sweep. */
  const POLE_ABOVE_GRIP = 0.55;

  const SKIN = new MeshStandardMaterial({ color: '#8d5a3b', roughness: 0.72 });
  const SHIRT = new MeshStandardMaterial({ color: '#f2ede3', roughness: 0.85 });
  const PANTS = new MeshStandardMaterial({ color: '#3b4a63', roughness: 0.88 });
  const STRAW = new MeshStandardMaterial({ color: '#d9c184', roughness: 0.9 });
  const BAND = new MeshStandardMaterial({ color: '#8a6b3f', roughness: 0.9 });
  const SHOE = new MeshStandardMaterial({ color: '#4a3a2c', roughness: 0.9 });
  const WOOD = new MeshStandardMaterial({ color: '#4a3826', roughness: 0.85 });

  /**
   * A bone: a tapered cylinder baked to run from `from` to `to` in the parent's
   * space. Cheaper than parenting a rotated group per limb, and it keeps the
   * arm angles honest — they're solved from the hand positions rather than
   * eyeballed as Euler triples.
   */
  function limb(from: Vector3, to: Vector3, rTop: number, rBottom: number) {
    const dir = new Vector3().subVectors(to, from);
    const len = dir.length();
    const geo = new CylinderGeometry(rTop, rBottom, len, 8);
    geo.translate(0, -len / 2, 0); // hang from the origin, down -Y
    geo.applyQuaternion(
      new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), dir.clone().normalize())
    );
    geo.translate(from.x, from.y, from.z);
    return geo;
  }

  /** Everything above the hips is baked hip-relative, since it pivots there. */
  const toHip = (v: Vector3) => v.clone().setY(v.y - HIP_Y);

  // ---- legs: a braced punting stance, right foot forward ------------------
  const rightLeg = limb(new Vector3(0.09, HIP_Y, 0), new Vector3(0.1, 0.07, -0.14), 0.075, 0.055);
  const leftLeg = limb(new Vector3(-0.09, HIP_Y, 0), new Vector3(-0.11, 0.07, 0.16), 0.075, 0.055);
  const footGeometry = new BoxGeometry(0.11, 0.06, 0.24);

  // ---- torso, head, sombrero ----------------------------------------------
  const torsoGeometry = new CylinderGeometry(0.185, 0.15, 0.58, 12);
  torsoGeometry.translate(0, 1.15 - HIP_Y, 0);
  const headGeometry = new SphereGeometry(0.115, 16, 12);
  headGeometry.translate(0, HEAD_Y - HIP_Y, 0);
  const hatBrimGeometry = new CylinderGeometry(0.27, 0.27, 0.022, 20);
  hatBrimGeometry.translate(0, 1.655 - HIP_Y, 0);
  const hatCrownGeometry = new CylinderGeometry(0.112, 0.132, 0.14, 16);
  hatCrownGeometry.translate(0, 1.73 - HIP_Y, 0);
  const hatBandGeometry = new CylinderGeometry(0.135, 0.135, 0.035, 16);
  hatBandGeometry.translate(0, 1.672 - HIP_Y, 0);

  // ---- hands on the pole, arms solved to reach them -----------------------
  // The hands sit exactly ON the pole's axis at mid-stroke, so the grip reads
  // as a grip. They stay put while the pole rotates through them: keeping both
  // within ~0.14 m of the pivot means the slide over a full sweep is a couple
  // of centimetres, invisible on a pole this thin — whereas hands parented to
  // the pole would drag the shoulders around with it.
  const poleUpMid = new Vector3(0, 1, 0).applyEuler(new Euler((CATCH + RELEASE) / 2, 0, POLE_OUT));
  const upperHand = GRIP.clone().addScaledVector(poleUpMid, 0.14);
  const lowerHand = GRIP.clone().addScaledVector(poleUpMid, -0.14);

  const rightArm = limb(
    toHip(new Vector3(0.19, SHOULDER_Y, 0)),
    toHip(lowerHand),
    0.052,
    0.042
  );
  const leftArm = limb(toHip(new Vector3(-0.19, SHOULDER_Y, 0)), toHip(upperHand), 0.052, 0.042);
  const handGeometry = new SphereGeometry(0.058, 10, 8);

  // ---- the vara ------------------------------------------------------------
  const poleGeometry = new CylinderGeometry(0.028, 0.034, POLE_LENGTH, 8);
  poleGeometry.translate(0, POLE_ABOVE_GRIP - POLE_LENGTH / 2, 0);

  const GRIP_HIP = toHip(GRIP);

  // ---- the stroke ----------------------------------------------------------
  let figure = $state.raw<Group | undefined>();
  let upperBody = $state.raw<Group | undefined>();
  let pole = $state.raw<Group | undefined>();
  let elapsed = 0;

  /** Fraction of the cycle spent driving; the rest is the quicker recovery. */
  const DRIVE = 0.62;
  const ease = (u: number) => u * u * (3 - 2 * u);

  useTask((delta) => {
    elapsed += delta;
    const p = (elapsed % strokeSeconds) / strokeSeconds;

    let tilt: number;
    let lift: number;
    let drive: number; // 0 at the catch, 1 at the release

    if (p < DRIVE) {
      drive = ease(p / DRIVE);
      tilt = CATCH + (RELEASE - CATCH) * drive;
      lift = 0; // planted on the bottom
    } else {
      const u = (p - DRIVE) / (1 - DRIVE);
      drive = 1 - ease(u);
      tilt = RELEASE + (CATCH - RELEASE) * ease(u);
      // Unweighted and skimmed forward, NOT hoisted clear: with ~1.7 m of a
      // 4.4 m pole under water, actually lifting the tip out would mean
      // raising the hands over his head. Polers in shallow canals feather the
      // vara forward through the water instead, which is what this is.
      lift = Math.sin(u * Math.PI) * 0.07;
    }

    if (pole) {
      pole.rotation.x = tilt;
      pole.rotation.z = POLE_OUT;
      pole.position.y = GRIP_HIP.y + lift;
    }
    // He folds forward into the push and straightens on the recovery.
    if (upperBody) upperBody.rotation.x = -0.04 - drive * 0.22;
    // Knees give a little at the hardest part of the drive.
    if (figure) figure.position.y = -drive * 0.05;
  });
</script>

<T.Group bind:ref={figure}>
  <T.Mesh geometry={rightLeg} material={PANTS} castShadow />
  <T.Mesh geometry={leftLeg} material={PANTS} castShadow />
  <T.Mesh geometry={footGeometry} material={SHOE} position={[0.1, 0.03, -0.17]} />
  <T.Mesh geometry={footGeometry} material={SHOE} position={[-0.11, 0.03, 0.13]} />

  <T.Group bind:ref={upperBody} position={[0, HIP_Y, 0]}>
    <T.Mesh geometry={torsoGeometry} material={SHIRT} castShadow />
    <T.Mesh geometry={headGeometry} material={SKIN} castShadow />
    <T.Mesh geometry={hatBrimGeometry} material={STRAW} castShadow />
    <T.Mesh geometry={hatCrownGeometry} material={STRAW} />
    <T.Mesh geometry={hatBandGeometry} material={BAND} />

    <T.Mesh geometry={rightArm} material={SKIN} castShadow />
    <T.Mesh geometry={leftArm} material={SKIN} castShadow />
    <T.Mesh
      geometry={handGeometry}
      material={SKIN}
      position={[upperHand.x, upperHand.y - HIP_Y, upperHand.z]}
    />
    <T.Mesh
      geometry={handGeometry}
      material={SKIN}
      position={[lowerHand.x, lowerHand.y - HIP_Y, lowerHand.z]}
    />

    <T.Group bind:ref={pole} position={[GRIP_HIP.x, GRIP_HIP.y, GRIP_HIP.z]}>
      <T.Mesh geometry={poleGeometry} material={WOOD} castShadow />
    </T.Group>
  </T.Group>
</T.Group>
