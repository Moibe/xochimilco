<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import {
    CylinderGeometry,
    Euler,
    Group,
    MeshStandardMaterial,
    Quaternion,
    Vector3,
  } from 'three';
  import {
    ARM_MAX,
    BROWS,
    EYE_POSITIONS,
    HEAD_Y_STANDING,
    HIP_X,
    HIP_Y,
    MOUTH_POSITION,
    NECK_Y_STANDING,
    NOSE_POSITION,
    SHOULDER_X,
    SHOULDER_Y,
    SOMBRERO_BAND_Y,
    armGeometry,
    browGeometry,
    eyeGeometry,
    handGeometry,
    hairCapGeometry,
    headGeometry,
    legGeometry,
    mouthGeometry,
    noseGeometry,
    shoeGeometry,
    sombreroBandGeometry,
    sombreroGeometry,
    sashGeometry,
    torsoGeometry,
  } from './chibi';
  import { stroke } from './stroke';

  /**
   * The trajinero in the miniyo/vinyl style: squircle head, real little body,
   * and two arms posed onto a 4.4 m vara he is still working on the shared
   * stroke clock.
   *
   * THE RIG IS A MATCHED SET. GRIP sits below the shoulders (0.62 against
   * shoulders at 0.73) because that is both reachable for short arms and the
   * correct punting posture. GRIP.x 0.11 keeps the shaft off his belly;
   * GRIP.z -0.20 keeps it clear of the skull at the catch. POLE_OUT is 0.60,
   * not less: the grip is low, so the shaft has little height in which to
   * drift outboard before it reaches the water, and it must still pass
   * OUTSIDE the gunwale — measured at 0.093 m clear at the worst point of the
   * stroke against the real hull profile. Touch one of these and re-check all
   * of it.
   */

  const GRIP = new Vector3(0.11, 0.62, -0.2);
  const CATCH = -0.18;
  const RELEASE = -0.85;
  const POLE_OUT = 0.6;
  const POLE_LENGTH = 4.4;
  /** Short on purpose: a longer stub reaches into a 0.54 m tall head. */
  const POLE_ABOVE_GRIP = 0.22;
  const HAND_OFFSET = 0.12;
  /** The lean pivot: low in the torso, so the whole soft mass tips as one. */
  const WAIST_Y = 0.46;

  const SHIRT = new MeshStandardMaterial({ color: '#f6f1e6', roughness: 0.9 });
  const SKIN = new MeshStandardMaterial({ color: '#d09a6e', roughness: 0.78 });
  const HAIR = new MeshStandardMaterial({ color: '#2b1d14', roughness: 0.95 });
  /**
   * Solid black, and slightly glossy on purpose: the reference figures have no
   * painted white dot in the eye — the highlight you see is the varnish
   * catching the light, so it comes from the material, not from a mesh.
   */
  const EYE = new MeshStandardMaterial({ color: '#141118', roughness: 0.32 });
  const MOUTH = new MeshStandardMaterial({ color: '#7c4634', roughness: 0.6 });
  const SASH = new MeshStandardMaterial({ color: '#c8452f', roughness: 0.85 });
  const PANTS = new MeshStandardMaterial({ color: '#3f4d63', roughness: 0.9 });
  const SHOE = new MeshStandardMaterial({ color: '#e9e6de', roughness: 0.85 });
  const STRAW = new MeshStandardMaterial({ color: '#ddc890', roughness: 0.9 });
  const BAND = new MeshStandardMaterial({ color: '#8a6b3f', roughness: 0.9 });
  /** Light enough not to read as a black line against this palette. */
  const WOOD = new MeshStandardMaterial({ color: '#8a6540', roughness: 0.85 });

  /** Pose a capsule (built along +Y) to run from one point to another. */
  function poseLimb(from: Vector3, to: Vector3) {
    const dir = new Vector3().subVectors(to, from);
    const mid = new Vector3().addVectors(from, to).multiplyScalar(0.5);
    const quat = new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      dir.clone().normalize()
    );
    const e = new Euler().setFromQuaternion(quat);
    return {
      position: [mid.x, mid.y - WAIST_Y, mid.z] as [number, number, number],
      rotation: [e.x, e.y, e.z] as [number, number, number],
      scale: [1, dir.length() / 0.253, 1] as [number, number, number],
    };
  }

  // ---- hands on the pole, arms solved to reach them -----------------------
  // The hands sit exactly ON the pole's axis at mid-stroke and stay put while
  // it rotates through them: at 0.12 from the pivot the shaft sweeps 0.04 past
  // each hand over the full stroke, well inside the mitten.
  const poleUpMid = new Vector3(0, 1, 0).applyEuler(new Euler((CATCH + RELEASE) / 2, 0, POLE_OUT));
  const upperHand = GRIP.clone().addScaledVector(poleUpMid, HAND_OFFSET);
  const lowerHand = GRIP.clone().addScaledVector(poleUpMid, -HAND_OFFSET);

  const shoulderL = new Vector3(-SHOULDER_X, SHOULDER_Y, -0.06);
  const shoulderR = new Vector3(SHOULDER_X, SHOULDER_Y, -0.06);

  // Fail loudly rather than letting a hand float quietly off the shaft.
  if (shoulderL.distanceTo(upperHand) > ARM_MAX || shoulderR.distanceTo(lowerHand) > ARM_MAX) {
    throw new Error('Trajinero: el brazo no alcanza el agarre — GRIP/hombros/POLE_OUT desajustados');
  }

  const armL = poseLimb(shoulderL, upperHand);
  const armR = poseLimb(shoulderR, lowerHand);

  // ---- legs: a braced punting stance, right foot forward -------------------
  const legR = poseLimb(new Vector3(HIP_X, HIP_Y, -0.01), new Vector3(HIP_X + 0.01, 0.1, -0.06));
  const legL = poseLimb(new Vector3(-HIP_X, HIP_Y, 0.01), new Vector3(-HIP_X - 0.01, 0.1, 0.06));

  // ---- the vara ------------------------------------------------------------
  const poleGeometry = new CylinderGeometry(0.026, 0.032, POLE_LENGTH, 10);
  poleGeometry.translate(0, POLE_ABOVE_GRIP - POLE_LENGTH / 2, 0);

  const w = (y: number) => y - WAIST_Y;

  // ---- the stroke ----------------------------------------------------------
  let figure = $state.raw<Group | undefined>();
  let upperBody = $state.raw<Group | undefined>();
  let headGroup = $state.raw<Group | undefined>();
  let pole = $state.raw<Group | undefined>();

  useTask(() => {
    const tilt = CATCH + (RELEASE - CATCH) * stroke.drive;
    // Unweighted and skimmed forward on the recovery, NOT hoisted clear: with
    // ~1.7 m of a 4.4 m pole under water, lifting the tip out would mean
    // raising his hands over his head. Polers in shallow canals feather the
    // vara forward through the water instead, which is what this is.
    const lift = stroke.driving ? 0 : Math.sin(stroke.progress * Math.PI) * 0.07;

    if (pole) {
      pole.rotation.x = tilt;
      pole.rotation.z = POLE_OUT;
      pole.position.y = w(GRIP.y) + lift;
    }
    if (upperBody) upperBody.rotation.x = -0.05 - stroke.drive * 0.2;
    // Counter-rotation, mandatory: a head this size amplifies the torso lean
    // enormously, and without it he appears to headbutt the water.
    if (headGroup) headGroup.rotation.x = stroke.drive * 0.1;
    if (figure) figure.position.y = -stroke.drive * 0.045;
  });
</script>

<T.Group bind:ref={figure}>
  <T.Mesh geometry={legGeometry} material={PANTS} position={legR.position} rotation={legR.rotation} scale={legR.scale} castShadow />
  <T.Mesh geometry={legGeometry} material={PANTS} position={legL.position} rotation={legL.rotation} scale={legL.scale} castShadow />
  <T.Mesh geometry={shoeGeometry} material={SHOE} position={[HIP_X + 0.01, 0.045, -0.09]} />
  <T.Mesh geometry={shoeGeometry} material={SHOE} position={[-HIP_X - 0.01, 0.045, 0.03]} />

  <T.Group bind:ref={upperBody} position={[0, WAIST_Y, 0]}>
    <T.Mesh geometry={torsoGeometry} material={SHIRT} position={[0, -WAIST_Y, 0]} castShadow />
    <!-- Faja: the red sash a poler wears at the waist. Its own ring geometry —
         scaling the torso lathe down in Y also drags its heights down, which
         left the sash floating off the figure as a loose disc. -->
    <T.Mesh geometry={sashGeometry} material={SASH} position={[0, w(0.52), 0]} />

    <T.Mesh geometry={armGeometry} material={SKIN} position={armL.position} rotation={armL.rotation} scale={armL.scale} castShadow />
    <T.Mesh geometry={armGeometry} material={SKIN} position={armR.position} rotation={armR.rotation} scale={armR.scale} castShadow />
    <T.Mesh geometry={handGeometry} material={SKIN} position={[upperHand.x, w(upperHand.y), upperHand.z]} />
    <T.Mesh geometry={handGeometry} material={SKIN} position={[lowerHand.x, w(lowerHand.y), lowerHand.z]} />

    <T.Group bind:ref={headGroup} position={[0, w(NECK_Y_STANDING), 0]}>
      <!-- Inner frame at the head centre: every face offset in chibi.ts is
           head-centred, so it serves the seated build unchanged. -->
      <T.Group position={[0, HEAD_Y_STANDING - NECK_Y_STANDING, 0]}>
        <T.Mesh geometry={headGeometry} material={SKIN} castShadow />
        {#each EYE_POSITIONS as pos, i (i)}
          <T.Mesh geometry={eyeGeometry} material={EYE} position={pos} />
        {/each}
        {#each BROWS as brow, i (i)}
          <T.Mesh geometry={browGeometry} material={HAIR} position={brow.pos} rotation={[0, 0, brow.rotZ]} />
        {/each}
        <T.Mesh geometry={noseGeometry} material={SKIN} position={NOSE_POSITION} />
        <T.Mesh geometry={mouthGeometry} material={MOUTH} position={MOUTH_POSITION} />
        <!-- Sombrero over cropped hair. -->
        <T.Mesh geometry={hairCapGeometry} material={HAIR} />
        <T.Mesh geometry={sombreroGeometry} material={STRAW} castShadow />
        <T.Mesh
          geometry={sombreroBandGeometry}
          material={BAND}
          position={[0, SOMBRERO_BAND_Y, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      </T.Group>
    </T.Group>

    <T.Group bind:ref={pole} position={[GRIP.x, w(GRIP.y), GRIP.z]}>
      <T.Mesh geometry={poleGeometry} material={WOOD} castShadow />
    </T.Group>
  </T.Group>
</T.Group>
