<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { BoxGeometry, Group, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
  import { limb } from './figures';

  /**
   * A seated passenger. Trajinera benches run down both gunwales facing each
   * other across the table, so this figure is built facing INBOARD (-X) and
   * the parent rotates it 180° for the port bench — a rotation rather than a
   * negative scale, which would flip the face winding and light them inside out.
   *
   * Local origin is the deck under the seat, matching the poler's convention,
   * so the parent places both the same way.
   */
  let {
    shirt = '#e6ecf4',
    skin = '#8d5a3b',
    hat = false,
    /** Offsets the idle sway so a benchful of people don't move in lockstep. */
    phase = 0,
  }: { shirt?: string; skin?: string; hat?: boolean; phase?: number } = $props();

  // svelte-ignore state_referenced_locally
  const SHIRT = new MeshStandardMaterial({ color: shirt, roughness: 0.85 });
  // svelte-ignore state_referenced_locally
  const SKIN = new MeshStandardMaterial({ color: skin, roughness: 0.72 });
  // svelte-ignore state_referenced_locally
  const IDLE_PHASE = phase;
  const PANTS = new MeshStandardMaterial({ color: '#42506b', roughness: 0.88 });
  const SHOE = new MeshStandardMaterial({ color: '#3f3226', roughness: 0.9 });
  const STRAW = new MeshStandardMaterial({ color: '#ddc890', roughness: 0.9 });
  const HAIR = new MeshStandardMaterial({ color: '#241a14', roughness: 0.95 });

  /** Bench top, measured off the boat: seat y (DECK_Y + 0.2) + half its 0.34
   *  height, minus the deck plank top (DECK_Y + 0.06). */
  const HIP_Y = 0.31;
  const SHOULDER_Y = HIP_Y + 0.52;

  // Thighs run inboard from the hips, shins drop to the deck. Knees end up a
  // little high — the bench is low, which is exactly how these boats seat you.
  const rightThigh = limb(new Vector3(0, HIP_Y, 0.09), new Vector3(-0.36, HIP_Y - 0.02, 0.1), 0.075, 0.07);
  const leftThigh = limb(new Vector3(0, HIP_Y, -0.09), new Vector3(-0.36, HIP_Y - 0.02, -0.1), 0.075, 0.07);
  const rightShin = limb(new Vector3(-0.36, HIP_Y - 0.02, 0.1), new Vector3(-0.4, 0.05, 0.1), 0.062, 0.05);
  const leftShin = limb(new Vector3(-0.36, HIP_Y - 0.02, -0.1), new Vector3(-0.4, 0.05, -0.1), 0.062, 0.05);
  const footGeometry = new BoxGeometry(0.2, 0.055, 0.1);

  // Facing -X, so the shoulder line runs along Z.
  const torso = limb(new Vector3(0.02, SHOULDER_Y, 0), new Vector3(0, HIP_Y, 0), 0.17, 0.145);
  const rightArm = limb(
    new Vector3(0.02, SHOULDER_Y - 0.03, 0.16),
    new Vector3(-0.2, HIP_Y + 0.06, 0.14),
    0.048,
    0.04
  );
  const leftArm = limb(
    new Vector3(0.02, SHOULDER_Y - 0.03, -0.16),
    new Vector3(-0.2, HIP_Y + 0.06, -0.14),
    0.048,
    0.04
  );

  const headGeometry = new SphereGeometry(0.105, 14, 12);
  headGeometry.translate(0.01, SHOULDER_Y + 0.17, 0);
  const hairGeometry = new SphereGeometry(0.109, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  hairGeometry.translate(0.01, SHOULDER_Y + 0.17, 0);
  const hatGeometry = new SphereGeometry(0.13, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42);
  hatGeometry.translate(0.01, SHOULDER_Y + 0.19, 0);

  let group = $state.raw<Group | undefined>();
  let elapsed = 0;

  useTask((delta) => {
    elapsed += delta;
    // A slow look-around. The hull already rocks them; this is just enough to
    // keep them from reading as mannequins.
    if (group) group.rotation.y = Math.sin(elapsed * 0.5 + IDLE_PHASE) * 0.08;
  });
</script>

<T.Group bind:ref={group}>
  <T.Mesh geometry={rightThigh} material={PANTS} castShadow />
  <T.Mesh geometry={leftThigh} material={PANTS} castShadow />
  <T.Mesh geometry={rightShin} material={PANTS} />
  <T.Mesh geometry={leftShin} material={PANTS} />
  <T.Mesh geometry={footGeometry} material={SHOE} position={[-0.44, 0.03, 0.1]} />
  <T.Mesh geometry={footGeometry} material={SHOE} position={[-0.44, 0.03, -0.1]} />

  <T.Mesh geometry={torso} material={SHIRT} castShadow />
  <T.Mesh geometry={rightArm} material={SKIN} />
  <T.Mesh geometry={leftArm} material={SKIN} />
  <T.Mesh geometry={headGeometry} material={SKIN} castShadow />
  {#if hat}
    <T.Mesh geometry={hatGeometry} material={STRAW} castShadow />
  {:else}
    <T.Mesh geometry={hairGeometry} material={HAIR} />
  {/if}
</T.Group>
