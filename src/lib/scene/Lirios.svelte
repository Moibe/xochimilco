<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import {
    CircleGeometry,
    Color,
    ConeGeometry,
    InstancedMesh,
    MeshStandardMaterial,
    Object3D,
  } from 'three';
  import { boat, boatToWorld, worldToBoat } from './boat';
  import { waveHeight, waveSlope } from './waves';

  /**
   * Lirio acuático — the water hyacinth that mats up Xochimilco's canals. Pads
   * ride the shared wave surface exactly the way the hull does: height from
   * `waveHeight`, and a tilt solved from `waveSlope` so each one lies flat on
   * the water it's actually sitting on rather than hovering at a fixed angle.
   *
   * They are anchored to the WATER, not to the boat: she sails past them. Any
   * clump she leaves behind recycles to the rim of a wide ring around her,
   * far enough out that the fog swallows the respawn.
   *
   * The old version kept them in fixed lanes down either side so they could
   * never reach the hull — a trick that only worked while the boat couldn't
   * steer. Now that she can, clumps get SHOVED ASIDE instead when she runs
   * over them, which is both what really happens and better looking: she
   * parts the mat as she goes.
   */
  let {
    clusters = 90,
    /** Clumps live within this radius; respawns land on its rim, deep in fog. */
    reach = 45,
  }: { clusters?: number; reach?: number } = $props();

  // svelte-ignore state_referenced_locally
  const REACH = reach;
  /** Hull footprint the mats get pushed out of, with a little margin. */
  const CLEAR_HALF_BEAM = 1.45;
  const CLEAR_HALF_LEN = 4.3;

  type Pad = { dx: number; dz: number; scale: number; yaw: number };
  type Clump = { x: number; z: number; pads: Pad[]; bloom: number };

  function scatter(clump: Clump, x: number, z: number) {
    clump.x = x;
    clump.z = z;
  }

  // svelte-ignore state_referenced_locally
  const clumps: Clump[] = Array.from({ length: clusters }, () => {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * REACH; // sqrt keeps the disc even
    const petals = 3 + Math.floor(Math.random() * 4);
    const pads: Pad[] = Array.from({ length: petals }, () => ({
      dx: (Math.random() * 2 - 1) * 0.42,
      dz: (Math.random() * 2 - 1) * 0.42,
      scale: 0.7 + Math.random() * 0.7,
      yaw: Math.random() * Math.PI * 2,
    }));
    // Roughly one clump in five is in bloom.
    const bloom = Math.random() < 0.2 ? 0.8 + Math.random() * 0.5 : 0;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, pads, bloom };
  });

  // Instance counts are fixed for the life of the mesh — a clump never gains
  // or loses pads, it only ever moves.
  const padTotal = clumps.reduce((n, c) => n + c.pads.length, 0);
  const bloomTotal = clumps.filter((c) => c.bloom > 0).length;

  const padGeometry = (() => {
    const geo = new CircleGeometry(0.17, 9);
    geo.rotateX(-Math.PI / 2);
    return geo;
  })();
  const padMaterial = new MeshStandardMaterial({ roughness: 0.62, metalness: 0.02 });

  const flowerGeometry = new ConeGeometry(0.045, 0.17, 6);
  flowerGeometry.translate(0, 0.085, 0);
  const flowerMaterial = new MeshStandardMaterial({ color: '#9c7bc8', roughness: 0.7 });

  // Greens vary a little per pad so a mat doesn't read as one flat sheet.
  const PAD_GREENS = ['#3f7d33', '#4c8c3a', '#356b2c', '#59993f'].map((c) => new Color(c));

  let padMesh = $state.raw<InstancedMesh | undefined>();
  let flowerMesh = $state.raw<InstancedMesh | undefined>();
  const dummy = new Object3D();
  let elapsed = 0;
  let coloured = false;

  useTask((delta) => {
    const mesh = padMesh;
    const blooms = flowerMesh;
    if (!mesh) return;
    elapsed += delta;

    if (!coloured) {
      for (let i = 0; i < padTotal; i++) mesh.setColorAt(i, PAD_GREENS[i % PAD_GREENS.length]);
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      coloured = true;
    }

    let p = 0;
    let b = 0;
    for (const clump of clumps) {
      const dx = clump.x - boat.x;
      const dz = clump.z - boat.z;
      if (dx * dx + dz * dz > REACH * REACH) {
        // Left astern: back to the rim at a fresh angle, out where the fog is.
        const a = Math.random() * Math.PI * 2;
        scatter(clump, boat.x + Math.cos(a) * REACH, boat.z + Math.sin(a) * REACH);
      } else {
        // Under the hull: shove the mat out to the side she is passing on.
        // EASED, not snapped — jumping it straight to the clear line teleported
        // a whole clump 1.4 m sideways in one frame while it was still ahead of
        // the bow, which reads as the mat flinching away before she touches it.
        // Lerping parts it over a few frames, so she looks like she is pushing.
        const local = worldToBoat(clump.x, clump.z);
        if (Math.abs(local.x) < CLEAR_HALF_BEAM && Math.abs(local.z) < CLEAR_HALF_LEN) {
          const side = local.x >= 0 ? 1 : -1;
          const targetX = side * CLEAR_HALF_BEAM;
          const eased = local.x + (targetX - local.x) * Math.min(1, delta * 5);
          const pushed = boatToWorld(eased, local.z);
          scatter(clump, pushed.x, pushed.z);
        }
      }

      for (const pad of clump.pads) {
        const x = clump.x + pad.dx;
        const z = clump.z + pad.dz;
        const [hx, hz] = waveSlope(x, z, elapsed);
        dummy.position.set(x, waveHeight(x, z, elapsed) + 0.012, z);
        // Lay the pad on the surface: the wave normal is (-hx, 1, -hz), which
        // for slopes this gentle is just a small tilt of -hz about X and +hx
        // about Z.
        dummy.rotation.set(-hz, pad.yaw, hx);
        dummy.scale.setScalar(pad.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(p++, dummy.matrix);
      }

      if (clump.bloom && blooms) {
        const [hx, hz] = waveSlope(clump.x, clump.z, elapsed);
        dummy.position.set(clump.x, waveHeight(clump.x, clump.z, elapsed) + 0.02, clump.z);
        dummy.rotation.set(-hz, 0, hx);
        dummy.scale.setScalar(clump.bloom);
        dummy.updateMatrix();
        blooms.setMatrixAt(b++, dummy.matrix);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (blooms) blooms.instanceMatrix.needsUpdate = true;
  });
</script>

<!-- frustumCulled=false is load-bearing here (same reason as Ripples): three
     computes an InstancedMesh's bounding sphere once and never invalidates it
     when instances move, so the stale sphere left at the world origin would
     cull every pad and bloom once she had sailed ~85 m from it. -->
<T.InstancedMesh
  bind:ref={padMesh}
  args={[padGeometry, padMaterial, padTotal]}
  frustumCulled={false}
/>
<T.InstancedMesh
  bind:ref={flowerMesh}
  args={[flowerGeometry, flowerMaterial, bloomTotal]}
  frustumCulled={false}
/>
