<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { DoubleSide, Euler, Group, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
  import {
    BROWS,
    EYES,
    LASHES,
    HAIR_SIDES,
    HEAD_Y_SEATED,
    MOUTH_POSITION,
    NECK_Y_SEATED,
    NOSE_POSITION,
    SOMBRERO_BAND_Y,
    armGeometry,
    browGeometry,
    eyeGeometry,
    lashGeometry,
    hairLongGeometry,
    hairCapGeometry,
    hairSideGeometry,
    handGeometry,
    headGeometry,
    legGeometry,
    mouthGeometry,
    noseGeometry,
    shoeGeometry,
    sombreroBandGeometry,
    sombreroGeometry,
    torsoSeatedGeometry,
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
  /** The long-hair shell has an open phi sweep, so its two raw edges need
   *  DoubleSide or you can see straight through the head from behind. */
  const HAIR_OPEN = new MeshStandardMaterial({
    color: HAIR_COLOUR,
    roughness: 0.95,
    side: DoubleSide,
  });
  const longHair = Math.round(IDLE_PHASE * 7) % 2 === 0;

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
  // Short arms, hands high in the lap — see Personaje's note on why the long
  // splayed version read as dangling limbs.
  const armR = poseLimb(new Vector3(0, 0.6, 0.155), new Vector3(-0.11, 0.45, 0.145), 0.253);
  const armL = poseLimb(new Vector3(0, 0.6, -0.155), new Vector3(-0.11, 0.45, -0.145), 0.253);

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
  <T.Mesh geometry={handGeometry} material={SKIN} position={[-0.11, 0.45, 0.145]} />
  <T.Mesh geometry={handGeometry} material={SKIN} position={[-0.11, 0.45, -0.145]} />

  <!-- Pivots at the neck so the idle reads as a head tilt, not a lean.
       rotation.y turns the kit's -Z face inboard; the idle writes rotation.z. -->
  <T.Group bind:ref={headGroup} position={[0, NECK_Y_SEATED, 0]} rotation={[0, Math.PI / 2, 0]}>
    <T.Group position={[0, HEAD_Y_SEATED - NECK_Y_SEATED, 0]}>
      <T.Mesh geometry={headGeometry} material={SKIN} castShadow />
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
        <T.Mesh geometry={hairCapGeometry} material={HAIR} />
        <T.Mesh geometry={sombreroGeometry} material={STRAW} castShadow />
        <T.Mesh
          geometry={sombreroBandGeometry}
          material={BAND}
          position={[0, SOMBRERO_BAND_Y, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      {:else if longHair}
        <T.Mesh geometry={hairCapGeometry} material={HAIR} />
        <T.Mesh geometry={hairLongGeometry} material={HAIR_OPEN} />
        {#each HAIR_SIDES as pos, i (i)}
          <T.Mesh geometry={hairSideGeometry} material={HAIR} position={pos} />
        {/each}
      {:else}
        <T.Mesh geometry={hairCapGeometry} material={HAIR} />
      {/if}
    </T.Group>
  </T.Group>
</T.Group>
