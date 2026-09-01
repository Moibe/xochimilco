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
  import { stroke } from './stroke';
  import { waveHeight, waveSlope } from './waves';

  /**
   * Lirio acuático — the water hyacinth that mats up Xochimilco's canals. Pads
   * ride the shared wave surface exactly the way the hull does: height from
   * `waveHeight`, and a tilt solved from `waveSlope` so each one lies flat on
   * the water it's actually sitting on rather than hovering at a fixed angle.
   *
   * They drift at the same `stroke.speed` as the ripples, because they're
   * floating on the same water: if the boat gathers pace on the drive, the
   * whole canal streams past faster, hyacinth included.
   *
   * Laid out in lanes down either side, never in the boat's corridor. Drift is
   * purely along Z, so a clump's X never changes and nothing can wander into
   * the hull — cheaper and more convincing than trying to shove mats aside.
   */
  let {
    clusters = 34,
    /** Nearest a clump may sit to the centreline — just outside the gunwale. */
    laneInner = 1.9,
    laneOuter = 14,
    /** Clumps recycle to the far end once they drift past ±this in Z. */
    reach = 24,
  }: { clusters?: number; laneInner?: number; laneOuter?: number; reach?: number } = $props();

  // svelte-ignore state_referenced_locally
  const REACH = reach;

  type Pad = { x: number; z: number; scale: number; yaw: number };
  type Flower = { x: number; z: number; scale: number };

  const pads: Pad[] = [];
  const flowers: Flower[] = [];

  // svelte-ignore state_referenced_locally
  for (let c = 0; c < clusters; c++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    // svelte-ignore state_referenced_locally
    const cx = side * (laneInner + Math.random() * (laneOuter - laneInner));
    const cz = (Math.random() * 2 - 1) * REACH;
    const petals = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < petals; i++) {
      pads.push({
        x: cx + (Math.random() * 2 - 1) * 0.42,
        z: cz + (Math.random() * 2 - 1) * 0.42,
        scale: 0.7 + Math.random() * 0.7,
        yaw: Math.random() * Math.PI * 2,
      });
    }
    // Roughly one clump in five is in bloom.
    if (Math.random() < 0.2) {
      flowers.push({ x: cx, z: cz, scale: 0.8 + Math.random() * 0.5 });
    }
  }

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
    if (!mesh) return;
    elapsed += delta;
    const step = stroke.speed * delta;

    if (!coloured) {
      for (let i = 0; i < pads.length; i++) {
        mesh.setColorAt(i, PAD_GREENS[i % PAD_GREENS.length]);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      coloured = true;
    }

    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      p.z += step;
      if (p.z > REACH) p.z -= REACH * 2; // same lane, back to the far end

      const [hx, hz] = waveSlope(p.x, p.z, elapsed);
      dummy.position.set(p.x, waveHeight(p.x, p.z, elapsed) + 0.012, p.z);
      // Lay the pad on the surface: the wave normal is (-hx, 1, -hz), which for
      // slopes this gentle is just a small tilt of -hz about X and +hx about Z.
      dummy.rotation.set(-hz, p.yaw, hx);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    const blooms = flowerMesh;
    if (!blooms) return;
    for (let i = 0; i < flowers.length; i++) {
      const f = flowers[i];
      f.z += step;
      if (f.z > REACH) f.z -= REACH * 2;
      const [hx, hz] = waveSlope(f.x, f.z, elapsed);
      dummy.position.set(f.x, waveHeight(f.x, f.z, elapsed) + 0.02, f.z);
      dummy.rotation.set(-hz, 0, hx);
      dummy.scale.setScalar(f.scale);
      dummy.updateMatrix();
      blooms.setMatrixAt(i, dummy.matrix);
    }
    blooms.instanceMatrix.needsUpdate = true;
  });
</script>

<T.InstancedMesh bind:ref={padMesh} args={[padGeometry, padMaterial, pads.length]} />
<T.InstancedMesh bind:ref={flowerMesh} args={[flowerGeometry, flowerMaterial, flowers.length]} />
