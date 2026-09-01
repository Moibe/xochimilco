<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import {
    DoubleSide,
    Group,
    MeshBasicMaterial,
    MeshStandardMaterial,
    SphereGeometry,
    Vector3,
  } from 'three';
  import {
    EYE_POSITIONS,
    EYE_SCALE,
    GLINT_POSITIONS,
    HEAD_Y_SEATED,
    NECK_Y_SEATED,
    SOMBRERO_BAND_Y,
    bellSeatedGeometry,
    eyeGeometry,
    glintGeometry,
    hairBackGeometry,
    hairFringeGeometry,
    headGeometry,
    scarfRingGeometry,
    sombreroBandGeometry,
    sombreroGeometry,
  } from './chibi';
  import { limb } from './figures';

  /**
   * A seated chibi passenger — same kit as the trajinero, posed sitting.
   *
   * The body and limbs are authored facing -X (inboard for the starboard
   * bench), exactly like the old figure, so `Trajinera.svelte` keeps its
   * existing placement and its 0/π port-side turn with ZERO edits. The bell
   * is a lathe and doesn't care about facing; the ONLY parts that do are the
   * face and hair, so those live in a headGroup carrying rotation.y = +π/2
   * (which maps the kit's -Z face onto -X).
   *
   * Clearances, checked against the boat's real numbers: seated hem at
   * BENCH_X 0.91 reaches world x 1.131 vs the 1.15 half-beam (the standing
   * hem would overhang by 6 cm — that's why the seated bell is narrower and
   * carries a 0.94 x-scale); knees/feet/hands all stay clear of the table's
   * 0.4025 half-width; hatted crown 1.340 against 1.59 of roof clearance.
   */
  let {
    shirt = '#e6ecf4',
    skin = '#c98d63',
    hat = false,
    /** Offsets the idle sway so a benchful of people don't move in lockstep. */
    phase = 0,
  }: { shirt?: string; skin?: string; hat?: boolean; phase?: number } = $props();

  // svelte-ignore state_referenced_locally
  const PONCHO = new MeshStandardMaterial({ color: shirt, roughness: 0.92 });
  // svelte-ignore state_referenced_locally
  const SKIN = new MeshStandardMaterial({ color: skin, roughness: 0.75 });
  // svelte-ignore state_referenced_locally
  const IDLE_PHASE = phase;
  // Scarf and hair colours rotate deterministically off the idle phase so the
  // four passengers differ without another prop.
  const SCARF_TONES = ['#f2b632', '#3aa655', '#2f7fc1', '#e0503f'];
  const HAIR_TONES = ['#241a14', '#4a2f1e', '#6b4a2a'];
  const pick = (arr: string[]) => arr[Math.abs(Math.round(IDLE_PHASE * 7)) % arr.length];

  const HAIR = new MeshStandardMaterial({ color: pick(HAIR_TONES), roughness: 1, side: DoubleSide });
  const EYE = new MeshStandardMaterial({ color: '#191720', roughness: 0.35 });
  const GLINT = new MeshBasicMaterial({ color: '#ffffff' });
  const SCARF = new MeshStandardMaterial({ color: pick(SCARF_TONES), roughness: 0.85 });
  const PANTS = new MeshStandardMaterial({ color: '#42506b', roughness: 0.88 });
  const SHOE = new MeshStandardMaterial({ color: '#3f3226', roughness: 0.9 });
  const STRAW = new MeshStandardMaterial({ color: '#ddc890', roughness: 0.9 });
  const BAND = new MeshStandardMaterial({ color: '#8a6b3f', roughness: 0.9 });

  // ---- legs: hips at exactly the 0.31 bench top, thighs level -------------
  // On a 0.31 bench with 0.28 legs, sloping the thighs folds the figure
  // double; level thighs with knees apart is how you sit on a low bench.
  const thighR = limb(new Vector3(0, 0.31, 0.088), new Vector3(-0.235, 0.3, 0.098), 0.072, 0.066);
  const thighL = limb(new Vector3(0, 0.31, -0.088), new Vector3(-0.235, 0.3, -0.098), 0.072, 0.066);
  const shinR = limb(new Vector3(-0.235, 0.3, 0.098), new Vector3(-0.275, 0.075, 0.098), 0.06, 0.05);
  const shinL = limb(new Vector3(-0.235, 0.3, -0.098), new Vector3(-0.275, 0.075, -0.098), 0.06, 0.05);
  const kneeGeometry = new SphereGeometry(0.066, 10, 8);
  const footGeometry = new SphereGeometry(0.072, 12, 10);

  // ---- arms folded in the lap ----------------------------------------------
  const armR = limb(new Vector3(0, 0.795, 0.155), new Vector3(-0.135, 0.585, 0.14), 0.055, 0.045);
  const armL = limb(new Vector3(0, 0.795, -0.155), new Vector3(-0.135, 0.585, -0.14), 0.055, 0.045);
  const handGeometry = new SphereGeometry(0.055, 10, 8);
  const shoulderGeometry = new SphereGeometry(0.058, 10, 8);

  const scarfTail = limb(
    new Vector3(0.09, 0.872, 0.06),
    new Vector3(0.196, 0.654, 0.158),
    0.045,
    0.026
  );
  const scarfTailTipGeometry = new SphereGeometry(0.028, 8, 6);

  let group = $state.raw<Group | undefined>();
  let headGroup = $state.raw<Group | undefined>();
  let elapsed = 0;

  useTask((delta) => {
    elapsed += delta;
    // A slow look-around, plus a little head tilt on a second rhythm. On a
    // head this size a 0.05 rad tilt is a visible, charming few px of motion.
    if (group) group.rotation.y = Math.sin(elapsed * 0.5 + IDLE_PHASE) * 0.08;
    if (headGroup) headGroup.rotation.z = Math.sin(elapsed * 0.4 + IDLE_PHASE * 1.3) * 0.05;
  });
</script>

<T.Group bind:ref={group}>
  <T.Mesh geometry={bellSeatedGeometry} material={PONCHO} scale={[0.94, 1, 1.02]} castShadow />

  <T.Mesh geometry={thighR} material={PANTS} />
  <T.Mesh geometry={thighL} material={PANTS} />
  <T.Mesh geometry={kneeGeometry} material={PANTS} position={[-0.235, 0.3, 0.098]} />
  <T.Mesh geometry={kneeGeometry} material={PANTS} position={[-0.235, 0.3, -0.098]} />
  <T.Mesh geometry={shinR} material={PANTS} />
  <T.Mesh geometry={shinL} material={PANTS} />
  <T.Mesh
    geometry={footGeometry}
    material={SHOE}
    position={[-0.32, 0.045, 0.098]}
    scale={[1.5, 0.62, 1]}
  />
  <T.Mesh
    geometry={footGeometry}
    material={SHOE}
    position={[-0.32, 0.045, -0.098]}
    scale={[1.5, 0.62, 1]}
  />

  <T.Mesh geometry={shoulderGeometry} material={PONCHO} position={[0, 0.795, 0.155]} />
  <T.Mesh geometry={shoulderGeometry} material={PONCHO} position={[0, 0.795, -0.155]} />
  <T.Mesh geometry={armR} material={SKIN} />
  <T.Mesh geometry={armL} material={SKIN} />
  <T.Mesh geometry={handGeometry} material={SKIN} position={[-0.135, 0.585, 0.14]} />
  <T.Mesh geometry={handGeometry} material={SKIN} position={[-0.135, 0.585, -0.14]} />

  <T.Mesh
    geometry={scarfRingGeometry}
    material={SCARF}
    position={[0, 0.851, 0]}
    rotation={[Math.PI / 2, 0, 0]}
  />
  <T.Mesh geometry={scarfTail} material={SCARF} />
  <T.Mesh geometry={scarfTailTipGeometry} material={SCARF} position={[0.196, 0.654, 0.158]} />

  <!-- Pivots at the neck so the idle tilt reads as a head tilt, not a lean.
       rotation.y maps the kit's -Z face inboard; the idle writes rotation.z. -->
  <T.Group bind:ref={headGroup} position={[0, NECK_Y_SEATED, 0]} rotation={[0, Math.PI / 2, 0]}>
    <T.Group position={[0, HEAD_Y_SEATED - NECK_Y_SEATED, 0]}>
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
      <T.Mesh geometry={hairBackGeometry} material={HAIR} />
      {#if hat}
        <T.Mesh geometry={sombreroGeometry} material={STRAW} scale={[0.78, 1, 0.78]} castShadow />
        <T.Mesh
          geometry={sombreroBandGeometry}
          material={BAND}
          position={[0, SOMBRERO_BAND_Y, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[0.78, 0.78, 1]}
        />
      {:else}
        <T.Mesh geometry={hairFringeGeometry} material={HAIR} />
      {/if}
    </T.Group>
  </T.Group>
</T.Group>
