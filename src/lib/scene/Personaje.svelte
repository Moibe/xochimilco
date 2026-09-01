<script lang="ts">
  import { T } from '@threlte/core';
  import { DoubleSide, Euler, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
  import {
    BROWS,
    EYES,
    LASHES,
    HAIR_SIDES,
    HEAD_Y_STANDING,
    HIP_CENTRE_Y,
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
    lashGeometry,
    hairCapGeometry,
    hairLongGeometry,
    hairSideGeometry,
    handGeometry,
    hipGeometry,
    headGeometry,
    legGeometry,
    mouthGeometry,
    noseGeometry,
    shoeGeometry,
    sombreroBandGeometry,
    sombreroGeometry,
    torsoGeometry,
  } from './chibi';

  /**
   * The canonical figure, standing at rest with its arms at its sides.
   *
   * This is the reference build of the kit: the poler and the passengers are
   * the same geometry from `chibi.ts` in different poses, so anything changed
   * here in the face or the body shows up on the boat too. It exists mostly so
   * there is somewhere to LOOK at a character — judging a face by orbiting the
   * lake camera at it between two roof posts was guesswork.
   */
  let {
    shirt = '#f2f0ea',
    pants = '#48597a',
    skin = '#d09a6e',
    hair = '#2b1d14',
    shoes = '#efece4',
    hat = false,
    longHair = false,
  }: {
    shirt?: string;
    pants?: string;
    skin?: string;
    hair?: string;
    shoes?: string;
    hat?: boolean;
    longHair?: boolean;
  } = $props();

  // Materials follow the props live: this figure exists to be fiddled with.
  const SHIRT = $derived(new MeshStandardMaterial({ color: shirt, roughness: 0.9 }));
  const PANTS = $derived(new MeshStandardMaterial({ color: pants, roughness: 0.9 }));
  const SKIN = $derived(new MeshStandardMaterial({ color: skin, roughness: 0.78 }));
  const SHOE = $derived(new MeshStandardMaterial({ color: shoes, roughness: 0.85 }));
  const HAIR = $derived(new MeshStandardMaterial({ color: hair, roughness: 0.95 }));
  /** The long-hair shell has an open sweep, so its raw edges need DoubleSide. */
  const HAIR_OPEN = $derived(
    new MeshStandardMaterial({ color: hair, roughness: 0.95, side: DoubleSide })
  );
  const EYE = new MeshStandardMaterial({ color: '#141118', roughness: 0.32 });
  const MOUTH = new MeshStandardMaterial({ color: '#7c4634', roughness: 0.6 });
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

  // Arms hang at the sides with the hands beside the hips.
  //
  // Measured off the reference rather than guessed: there the hands end BELOW
  // the shirt hem, level with the top of the thigh. The shirt hem here is at
  // 0.42, so hands at 0.375 put them just under it, beside the hip mass —
  // which is also simply where hands hang. Two earlier passes had them at 0.50
  // and then 0.545, i.e. above the hem entirely, which is why the arms looked
  // stunted. ARM_OUT keeps the hand clear of the hip's 0.174 radius.
  const HAND_Y = 0.375;
  const ARM_OUT = 0.03;
  const armR = poseLimb(
    new Vector3(SHOULDER_X, SHOULDER_Y, -0.01),
    new Vector3(SHOULDER_X + ARM_OUT, HAND_Y, 0.0),
    0.253
  );
  const armL = poseLimb(
    new Vector3(-SHOULDER_X, SHOULDER_Y, -0.01),
    new Vector3(-SHOULDER_X - ARM_OUT, HAND_Y, 0.0),
    0.253
  );
  const legR = poseLimb(new Vector3(HIP_X, HIP_Y, 0), new Vector3(HIP_X, 0.095, 0), 0.332);
  const legL = poseLimb(new Vector3(-HIP_X, HIP_Y, 0), new Vector3(-HIP_X, 0.095, 0), 0.332);
</script>

<T.Group>
  <T.Mesh geometry={hipGeometry} material={PANTS} position={[0, HIP_CENTRE_Y, 0]} />
  <T.Mesh geometry={legGeometry} material={PANTS} position={legR.position} rotation={legR.rotation} scale={legR.scale} />
  <T.Mesh geometry={legGeometry} material={PANTS} position={legL.position} rotation={legL.rotation} scale={legL.scale} />
  <T.Mesh geometry={shoeGeometry} material={SHOE} position={[HIP_X, 0.042, -0.02]} />
  <T.Mesh geometry={shoeGeometry} material={SHOE} position={[-HIP_X, 0.042, -0.02]} />

  <T.Mesh geometry={torsoGeometry} material={SHIRT} />
  <T.Mesh geometry={armGeometry} material={SKIN} position={armR.position} rotation={armR.rotation} scale={armR.scale} />
  <T.Mesh geometry={armGeometry} material={SKIN} position={armL.position} rotation={armL.rotation} scale={armL.scale} />
  <T.Mesh geometry={handGeometry} material={SKIN} position={[SHOULDER_X + ARM_OUT, HAND_Y, 0]} />
  <T.Mesh geometry={handGeometry} material={SKIN} position={[-SHOULDER_X - ARM_OUT, HAND_Y, 0]} />

  <T.Group position={[0, HEAD_Y_STANDING, 0]}>
    <T.Mesh geometry={headGeometry} material={SKIN} />
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

    <T.Mesh geometry={hairCapGeometry} material={HAIR} />
    {#if longHair}
      <T.Mesh geometry={hairLongGeometry} material={HAIR_OPEN} />
      {#each HAIR_SIDES as pos, i (i)}
        <T.Mesh geometry={hairSideGeometry} material={HAIR} position={pos} />
      {/each}
    {/if}
    {#if hat}
      <T.Mesh geometry={sombreroGeometry} material={STRAW} />
      <T.Mesh
        geometry={sombreroBandGeometry}
        material={BAND}
        position={[0, SOMBRERO_BAND_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
    {/if}
  </T.Group>
</T.Group>
