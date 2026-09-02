<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { Euler, Group, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
  import {
    BROWS,
    EAR_POSITIONS,
    EYES,
    LASHES,
    HAIR_SIDES,
    HEAD_Y_SEATED,
    MOUTH_POSITION,
    NECK_Y_SEATED,
    NOSE_POSITION,
    SLEEVE_REACH,
    SLEEVE_REST,
    SOMBRERO_BAND_Y,
    armGeometry,
    browGeometry,
    earGeometry,
    eyeGeometry,
    lashGeometry,
    hairLongGeometry,
    hairShortGeometry,
    hairSideGeometry,
    handGeometry,
    headGeometry,
    legGeometry,
    mouthGeometry,
    noseGeometry,
    shoeGeometry,
    sleeveGeometry,
    sombreroBandGeometry,
    sombreroGeometry,
    torsoSeatedGeometry,
    type Sleeves,
  } from './chibi';

  /**
   * A seated passenger in the same miniyo/vinyl kit as the poler: squircle
   * head, brows, button nose, a small real body with legs bent onto the deck.
   *
   * Authored facing -X (inboard for the starboard bench), exactly as before,
   * so `Trajinera.svelte` keeps its placement and its 0/π port-side turn with
   * no edits. Only the face and hair care about the kit's -Z convention, so
   * they live in a headGroup carrying rotation.y = +π/2.
   */
  let {
    shirt = '#e6ecf4',
    skin = '#d09a6e',
    hat = false,
    /** Offsets the idle sway so a benchful of people don't move in lockstep. */
    phase = 0,
  }: { shirt?: string; skin?: string; hat?: boolean; phase?: number } = $props();

  // svelte-ignore state_referenced_locally
  const SHIRT = new MeshStandardMaterial({ color: shirt, roughness: 0.9 });
  // svelte-ignore state_referenced_locally
  const SKIN = new MeshStandardMaterial({ color: skin, roughness: 0.78 });
  // svelte-ignore state_referenced_locally
  const IDLE_PHASE = phase;

  // Hair colour and length rotate off the idle phase, so four passengers
  // differ without another prop to thread through Trajinera.
  const HAIR_TONES = ['#2b1d14', '#4a2f1e', '#6b4a2a', '#1d1712'];
  const pick = <T,>(arr: T[]) => arr[Math.abs(Math.round(IDLE_PHASE * 7)) % arr.length];
  const HAIR_COLOUR = pick(HAIR_TONES);
  const HAIR = new MeshStandardMaterial({ color: HAIR_COLOUR, roughness: 0.95 });
  const longHair = Math.round(IDLE_PHASE * 7) % 2 === 0;
  // Sleeve length rotates off the same phase, so a benchful of passengers is
  // not four people in identical shirts.
  const SLEEVE_CYCLE: Sleeves[] = ['short', 'none', 'long', 'short'];
  const sleeves = SLEEVE_CYCLE[Math.abs(Math.round(IDLE_PHASE * 7)) % SLEEVE_CYCLE.length];

  const EYE = new MeshStandardMaterial({ color: '#141118', roughness: 0.32 });
  const MOUTH = new MeshStandardMaterial({ color: '#7c4634', roughness: 0.6 });
  const PANTS = new MeshStandardMaterial({ color: '#48597a', roughness: 0.9 });
  const SHOE = new MeshStandardMaterial({ color: '#efece4', roughness: 0.85 });
  const STRAW = new MeshStandardMaterial({ color: '#ddc890', roughness: 0.9 });
  const BAND = new MeshStandardMaterial({ color: '#8a6b3f', roughness: 0.9 });

  /** Pose a capsule (built along +Y) to run from one point to another. */
  function poseLimb(from: Vector3, to: Vector3, restLength: number) {
    const dir = new Vector3().subVectors(to, from);
    const mid = new Vector3().addVectors(from, to).multiplyScalar(0.5);
    const e = new Euler().setFromQuaternion(
      new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize())
    );
    return {
      position: [mid.x, mid.y, mid.z] as [number, number, number],
      rotation: [e.x, e.y, e.z] as [number, number, number],
      scale: [1, dir.length() / restLength, 1] as [number, number, number],
    };
  }

  // Hips at exactly the 0.31 m bench top. Thighs run inboard and near level —
  // on a bench this low, sloping them would fold the figure double — then the
  // shins drop to the deck.
  const thighR = poseLimb(new Vector3(0, 0.31, 0.095), new Vector3(-0.3, 0.29, 0.1), 0.332);
  const thighL = poseLimb(new Vector3(0, 0.31, -0.095), new Vector3(-0.3, 0.29, -0.1), 0.332);
  const shinR = poseLimb(new Vector3(-0.3, 0.29, 0.1), new Vector3(-0.33, 0.09, 0.1), 0.332);
  const shinL = poseLimb(new Vector3(-0.3, 0.29, -0.1), new Vector3(-0.33, 0.09, -0.1), 0.332);

  // Arms hang from the shoulders into the lap. Facing -X puts the shoulder
  // line along Z.
  // Arms reach down into the lap. Same length as the standing figure's (see
  // Personaje's note) — just folded, since a seated arm rests on the thigh.
  const shoulderR = new Vector3(0, 0.6, 0.155);
  const shoulderL = new Vector3(0, 0.6, -0.155);
  const handR = new Vector3(-0.17, 0.37, 0.14);
  const handL = new Vector3(-0.17, 0.37, -0.14);
  const armR = poseLimb(shoulderR, handR, 0.253);
  const armL = poseLimb(shoulderL, handL, 0.253);
  const sleeveR =
    sleeves === 'none'
      ? null
      : poseLimb(shoulderR, new Vector3().lerpVectors(shoulderR, handR, SLEEVE_REACH[sleeves]), SLEEVE_REST);
  const sleeveL =
    sleeves === 'none'
      ? null
      : poseLimb(shoulderL, new Vector3().lerpVectors(shoulderL, handL, SLEEVE_REACH[sleeves]), SLEEVE_REST);

  let group = $state.raw<Group | undefined>();
  let headGroup = $state.raw<Group | undefined>();
  let elapsed = 0;

  useTask((delta) => {
    elapsed += delta;
    // A slow look-around, plus a head tilt on a second rhythm. On a head this
    // size a 0.05 rad tilt is a visible, charming few pixels of motion.
    if (group) group.rotation.y = Math.sin(elapsed * 0.5 + IDLE_PHASE) * 0.08;
    if (headGroup) headGroup.rotation.z = Math.sin(elapsed * 0.4 + IDLE_PHASE * 1.3) * 0.05;
  });
</script>

<T.Group bind:ref={group}>
  <T.Mesh geometry={torsoSeatedGeometry} material={SHIRT} castShadow />

  <T.Mesh geometry={legGeometry} material={PANTS} position={thighR.position} rotation={thighR.rotation} scale={thighR.scale} />
  <T.Mesh geometry={legGeometry} material={PANTS} position={thighL.position} rotation={thighL.rotation} scale={thighL.scale} />
  <T.Mesh geometry={legGeometry} material={PANTS} position={shinR.position} rotation={shinR.rotation} scale={shinR.scale} />
  <T.Mesh geometry={legGeometry} material={PANTS} position={shinL.position} rotation={shinL.rotation} scale={shinL.scale} />
  <T.Mesh geometry={shoeGeometry} material={SHOE} position={[-0.37, 0.05, 0.1]} rotation={[0, Math.PI / 2, 0]} />
  <T.Mesh geometry={shoeGeometry} material={SHOE} position={[-0.37, 0.05, -0.1]} rotation={[0, Math.PI / 2, 0]} />

  <T.Mesh geometry={armGeometry} material={SKIN} position={armR.position} rotation={armR.rotation} scale={armR.scale} />
  <T.Mesh geometry={armGeometry} material={SKIN} position={armL.position} rotation={armL.rotation} scale={armL.scale} />
  {#if sleeveR && sleeveL}
    <T.Mesh geometry={sleeveGeometry} material={SHIRT} position={sleeveR.position} rotation={sleeveR.rotation} scale={sleeveR.scale} />
    <T.Mesh geometry={sleeveGeometry} material={SHIRT} position={sleeveL.position} rotation={sleeveL.rotation} scale={sleeveL.scale} />
  {/if}
  <T.Mesh geometry={handGeometry} material={SKIN} position={[-0.17, 0.37, 0.14]} />
  <T.Mesh geometry={handGeometry} material={SKIN} position={[-0.17, 0.37, -0.14]} />

  <!-- Pivots at the neck so the idle reads as a head tilt, not a lean.
       rotation.y turns the kit's -Z face inboard; the idle writes rotation.z. -->
  <T.Group bind:ref={headGroup} position={[0, NECK_Y_SEATED, 0]} rotation={[0, Math.PI / 2, 0]}>
    <T.Group position={[0, HEAD_Y_SEATED - NECK_Y_SEATED, 0]}>
      <T.Mesh geometry={headGeometry} material={SKIN} castShadow />
      {#each EAR_POSITIONS as pos, i (i)}
        <T.Mesh geometry={earGeometry} material={SKIN} position={pos} />
      {/each}
      {#each EYES as eye, i (i)}
        <T.Mesh geometry={eyeGeometry} material={EYE} position={eye.pos} rotation={[0, 0, eye.rotZ]} />
      {/each}
      {#each LASHES as lash, i (i)}
        <T.Mesh geometry={lashGeometry} material={EYE} position={lash.pos} rotation={[0, 0, lash.rotZ]} />
      {/each}
      {#each BROWS as brow, i (i)}
        <T.Mesh geometry={browGeometry} material={HAIR} position={brow.pos} rotation={[0, 0, brow.rotZ]} />
      {/each}
      <T.Mesh geometry={noseGeometry} material={SKIN} position={NOSE_POSITION} />
      <T.Mesh geometry={mouthGeometry} material={MOUTH} position={MOUTH_POSITION} />

      {#if hat}
        <T.Mesh geometry={hairShortGeometry} material={HAIR} />
        <T.Mesh geometry={sombreroGeometry} material={STRAW} castShadow />
        <T.Mesh
          geometry={sombreroBandGeometry}
          material={BAND}
          position={[0, SOMBRERO_BAND_Y, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      {:else if longHair}
        <T.Mesh geometry={hairLongGeometry} material={HAIR} />
        {#each HAIR_SIDES as pos, i (i)}
          <T.Mesh geometry={hairSideGeometry} material={HAIR} position={pos} />
        {/each}
      {:else}
        <T.Mesh geometry={hairShortGeometry} material={HAIR} />
      {/if}
    </T.Group>
  </T.Group>
</T.Group>
