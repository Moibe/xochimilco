<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import {
    CylinderGeometry,
    DoubleSide,
    Euler,
    Group,
    MeshBasicMaterial,
    MeshStandardMaterial,
    SphereGeometry,
    Vector3,
  } from 'three';
  import {
    ARM_MAX,
    EYE_POSITIONS,
    EYE_SCALE,
    GLINT_POSITIONS,
    HEAD_Y_STANDING,
    NECK_Y_STANDING,
    SOMBRERO_BAND_Y,
    bellStandingGeometry,
    eyeGeometry,
    glintGeometry,
    hairBackGeometry,
    headGeometry,
    scarfRingGeometry,
    sombreroBandGeometry,
    sombreroGeometry,
  } from './chibi';
  import { limb } from './figures';
  import { stroke } from './stroke';

  /**
   * The trajinero, chibi edition: one closed poncho bell for the whole body,
   * a head a third of his height sunk straight into it, blob feet, and two
   * stubby arms solved to a grip that had to move for them — see the RIG
   * notes below. He still works the same 4.4 m vara on the same shared stroke
   * clock; only the body around it changed.
   *
   * THE RIG IS A MATCHED SET. GRIP dropped from (0.16, 1.05, -0.42) to
   * (0.11, 0.70, -0.20): with shoulders at y 0.80 and 0.28 m arms, a grip
   * ABOVE the shoulders is unreachable — dropping it below lets both arms
   * hang down-forward, which is also the correct punting posture. GRIP.x 0.11
   * is load-bearing for pole-to-belly clearance (at 0.03 the shaft cuts 6 mm
   * into the poncho around y 0.5); GRIP.z -0.20 is load-bearing for
   * head-to-pole clearance at the catch (0.033 m, with POLE_ABOVE_GRIP cut to
   * 0.28 — the old 0.55 stub would spear a 0.42 m skull). POLE_OUT rises to
   * 0.55 because the lower grip gives the shaft less height in which to drift
   * outboard: at the old 0.34 it would cross the deck inside the gunwale;
   * at 0.55 it clears by 0.094 m at the worst point of the stroke
   * (independently re-checked against the hull profile). Touch one of these
   * numbers and re-check all four constraints.
   */

  const GRIP = new Vector3(0.11, 0.7, -0.2);
  const CATCH = -0.18;
  const RELEASE = -0.85;
  const POLE_OUT = 0.55;
  const POLE_LENGTH = 4.4;
  const POLE_ABOVE_GRIP = 0.28;
  const HAND_OFFSET = 0.12;
  /**
   * The lean pivot: the bell's waist, NOT hip height — a chibi has no hips,
   * so the whole soft mass tips as one from down low.
   */
  const WAIST_Y = 0.42;

  const PONCHO = new MeshStandardMaterial({ color: '#f6ede0', roughness: 0.92 });
  const SKIN = new MeshStandardMaterial({ color: '#c98d63', roughness: 0.75 });
  const HAIR = new MeshStandardMaterial({ color: '#241a14', roughness: 1, side: DoubleSide });
  const EYE = new MeshStandardMaterial({ color: '#191720', roughness: 0.35 });
  /** Basic on purpose: a lit glint goes grey when the face turns from the sun. */
  const GLINT = new MeshBasicMaterial({ color: '#ffffff' });
  const SCARF = new MeshStandardMaterial({ color: '#e0503f', roughness: 0.85 });
  const PANTS = new MeshStandardMaterial({ color: '#42506b', roughness: 0.88 });
  const SHOE = new MeshStandardMaterial({ color: '#3f3226', roughness: 0.9 });
  const STRAW = new MeshStandardMaterial({ color: '#ddc890', roughness: 0.9 });
  const BAND = new MeshStandardMaterial({ color: '#8a6b3f', roughness: 0.9 });
  /** Lightened from '#4a3826': that read as a black line against this palette. */
  const WOOD = new MeshStandardMaterial({ color: '#8a6540', roughness: 0.85 });

  /** Everything that leans is baked waist-relative. */
  const toWaist = (v: Vector3) => v.clone().setY(v.y - WAIST_Y);

  // ---- hands on the pole, arms solved to reach them -----------------------
  // Hands sit exactly ON the pole axis at mid-stroke and stay fixed while the
  // pole rotates through them: at 0.12 from the pivot the shaft sweeps 0.040
  // past each hand over the full stroke, well inside the 0.058 mitten.
  const poleUpMid = new Vector3(0, 1, 0).applyEuler(new Euler((CATCH + RELEASE) / 2, 0, POLE_OUT));
  const upperHand = GRIP.clone().addScaledVector(poleUpMid, HAND_OFFSET);
  const lowerHand = GRIP.clone().addScaledVector(poleUpMid, -HAND_OFFSET);

  // Sockets pushed 0.075 forward buy back the reach; they sit 6 mm proud of
  // the bell and the shoulder blobs swallow that, so the arms read as
  // emerging from under the poncho.
  const shoulderL = new Vector3(-0.15, 0.8, -0.075);
  const shoulderR = new Vector3(0.15, 0.8, -0.075);

  // The rig only works if the stubby arms genuinely reach — fail loudly, not
  // as a hand quietly floating off the pole. Slack today: L 0.016, R 0.076.
  if (shoulderL.distanceTo(upperHand) > ARM_MAX || shoulderR.distanceTo(lowerHand) > ARM_MAX) {
    throw new Error('Trajinero: el brazo no alcanza el agarre — GRIP/hombros/POLE_OUT desajustados');
  }

  const armL = limb(toWaist(shoulderL), toWaist(upperHand), 0.055, 0.045);
  const armR = limb(toWaist(shoulderR), toWaist(lowerHand), 0.055, 0.045);
  const handGeometry = new SphereGeometry(0.058, 12, 10);
  const shoulderGeometry = new SphereGeometry(0.058, 10, 8);

  // ---- feet and the stubs that keep a low camera honest -------------------
  const footGeometry = new SphereGeometry(0.075, 12, 10);
  // Entirely inside the hem; exist only so you never see daylight between
  // skirt and feet from a low angle. Outside the leaning group, like the feet.
  const legStubR = limb(new Vector3(0.1, 0.185, -0.06), new Vector3(0.1, 0.07, -0.1), 0.05, 0.042);
  const legStubL = limb(new Vector3(-0.1, 0.185, 0.06), new Vector3(-0.1, 0.07, 0.1), 0.05, 0.042);

  // ---- scarf (body frame, straddles the head/bell interpenetration) -------
  const scarfTail = limb(
    toWaist(new Vector3(0.09, 0.876, 0.06)),
    toWaist(new Vector3(0.196, 0.658, 0.158)),
    0.045,
    0.026
  );
  const scarfTailTipGeometry = new SphereGeometry(0.028, 8, 6);

  // ---- the vara ------------------------------------------------------------
  const poleGeometry = new CylinderGeometry(0.026, 0.032, POLE_LENGTH, 10);
  poleGeometry.translate(0, POLE_ABOVE_GRIP - POLE_LENGTH / 2, 0);

  const GRIP_WAIST = toWaist(GRIP);
  /** headGroup pivot: the bell cap, waist-relative. */
  const NECK_WAIST = NECK_Y_STANDING - WAIST_Y;

  // ---- the stroke ----------------------------------------------------------
  let figure = $state.raw<Group | undefined>();
  let upperBody = $state.raw<Group | undefined>();
  let headGroup = $state.raw<Group | undefined>();
  let pole = $state.raw<Group | undefined>();

  useTask(() => {
    const tilt = CATCH + (RELEASE - CATCH) * stroke.drive;
    const lift = stroke.driving ? 0 : Math.sin(stroke.progress * Math.PI) * 0.07;

    if (pole) {
      pole.rotation.x = tilt;
      pole.rotation.z = POLE_OUT;
      pole.position.y = GRIP_WAIST.y + lift;
    }
    // Dialled back from 0.22: the waist pivot swings the head much further
    // per radian than the old hip pivot did.
    if (upperBody) upperBody.rotation.x = -0.05 - stroke.drive * 0.2;
    // Counter-rotation, mandatory: a head a third of the body amplifies the
    // torso lean enormously — without this he appears to headbutt the water.
    // Do not exceed ~0.12 or it eats the head-to-pole margin at the catch.
    if (headGroup) headGroup.rotation.x = stroke.drive * 0.1;
    if (figure) figure.position.y = -stroke.drive * 0.045;
  });
</script>

<T.Group bind:ref={figure}>
  <!-- Squashed blobs, never boxes — a box catches highlights on its corners
       and reads as a brick. Right foot forward: the braced punting stance. -->
  <T.Mesh
    geometry={footGeometry}
    material={SHOE}
    position={[0.1, 0.046, -0.1]}
    scale={[1, 0.62, 1.5]}
  />
  <T.Mesh
    geometry={footGeometry}
    material={SHOE}
    position={[-0.1, 0.046, 0.1]}
    scale={[1, 0.62, 1.5]}
  />
  <T.Mesh geometry={legStubR} material={PANTS} />
  <T.Mesh geometry={legStubL} material={PANTS} />

  <T.Group bind:ref={upperBody} position={[0, WAIST_Y, 0]}>
    <T.Mesh geometry={bellStandingGeometry} material={PONCHO} position={[0, -WAIST_Y, 0]} castShadow />

    <T.Mesh geometry={shoulderGeometry} material={PONCHO} position={[0.15, 0.8 - WAIST_Y, -0.075]} />
    <T.Mesh geometry={shoulderGeometry} material={PONCHO} position={[-0.15, 0.8 - WAIST_Y, -0.075]} />
    <T.Mesh geometry={armL} material={SKIN} castShadow />
    <T.Mesh geometry={armR} material={SKIN} castShadow />
    <T.Mesh
      geometry={handGeometry}
      material={SKIN}
      position={[upperHand.x, upperHand.y - WAIST_Y, upperHand.z]}
    />
    <T.Mesh
      geometry={handGeometry}
      material={SKIN}
      position={[lowerHand.x, lowerHand.y - WAIST_Y, lowerHand.z]}
    />

    <T.Mesh
      geometry={scarfRingGeometry}
      material={SCARF}
      position={[0, 0.855 - WAIST_Y, 0]}
      rotation={[Math.PI / 2, 0, 0]}
    />
    <T.Mesh geometry={scarfTail} material={SCARF} />
    <T.Mesh
      geometry={scarfTailTipGeometry}
      material={SCARF}
      position={[0.196, 0.658 - WAIST_Y, 0.158]}
    />

    <T.Group bind:ref={headGroup} position={[0, NECK_WAIST, 0]}>
      <!-- Inner frame at the head centre: every face/hair/hat offset in
           chibi.ts is head-centred and identical for both variants. -->
      <T.Group position={[0, HEAD_Y_STANDING - NECK_Y_STANDING, 0]}>
        <T.Mesh geometry={headGeometry} material={SKIN} castShadow />
        {#each EYE_POSITIONS as eye (eye.rotY)}
          <T.Mesh
            geometry={eyeGeometry}
            material={EYE}
            position={eye.pos}
            rotation={[0, eye.rotY, 0]}
            scale={EYE_SCALE}
          />
        {/each}
        {#each GLINT_POSITIONS as pos, i (i)}
          <T.Mesh geometry={glintGeometry} material={GLINT} position={pos} />
        {/each}
        <!-- Sombrero wearer: fringe suppressed, bob kept underneath. -->
        <T.Mesh geometry={hairBackGeometry} material={HAIR} />
        <T.Mesh geometry={sombreroGeometry} material={STRAW} castShadow />
        <T.Mesh
          geometry={sombreroBandGeometry}
          material={BAND}
          position={[0, SOMBRERO_BAND_Y, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      </T.Group>
    </T.Group>

    <T.Group bind:ref={pole} position={[GRIP_WAIST.x, GRIP_WAIST.y, GRIP_WAIST.z]}>
      <T.Mesh geometry={poleGeometry} material={WOOD} castShadow />
    </T.Group>
  </T.Group>
</T.Group>
