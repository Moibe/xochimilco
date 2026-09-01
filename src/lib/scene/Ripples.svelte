<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    DoubleSide,
    InstancedMesh,
    MeshBasicMaterial,
    Object3D,
  } from 'three';
  import { boat } from './boat';
  import { waveHeight } from './waves';

  /**
   * Wind streaks on the surface. These used to DRIFT past a stationary hull to
   * fake headway; now that the trajinera really travels, they stay anchored to
   * the water and she passes them instead. Each one recycles to the far edge of
   * a ring around her once she leaves it behind, so the lake never runs out.
   */
  let {
    count = 90,
    /** Streaks live within this radius of the boat. */
    radius = 22,
    /** Wind direction the streaks lie along, world radians about Y. */
    windAngle = 0,
  }: { count?: number; radius?: number; windAngle?: number } = $props();

  // svelte-ignore state_referenced_locally
  const RADIUS = radius;
  // svelte-ignore state_referenced_locally
  const WIND = windAngle;

  type Streak = { x: number; z: number; scale: number };
  const streaks: Streak[] = [];
  // svelte-ignore state_referenced_locally
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * RADIUS; // sqrt keeps the disc even
    streaks.push({
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      scale: 0.4 + Math.random() * 0.9,
    });
  }

  const geometry = (() => {
    const geo = new BufferGeometry();
    geo.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([-0.09, 0, 0, 0.09, 0, 0, 0, 0, 0.7]), 3)
    );
    return geo;
  })();

  const material = new MeshBasicMaterial({
    color: '#eef6df',
    transparent: true,
    opacity: 0.1,
    side: DoubleSide,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  let mesh = $state.raw<InstancedMesh | undefined>();
  const dummy = new Object3D();
  let elapsed = 0;

  useTask((delta) => {
    const instanced = mesh;
    if (!instanced) return;
    elapsed += delta;

    for (let i = 0; i < streaks.length; i++) {
      const s = streaks[i];
      const dx = s.x - boat.x;
      const dz = s.z - boat.z;
      if (dx * dx + dz * dz > RADIUS * RADIUS) {
        // Left behind: put it back on the rim at a fresh angle. These are
        // barely-there marks at 0.1 opacity, so a rim respawn never pops.
        const a = Math.random() * Math.PI * 2;
        s.x = boat.x + Math.cos(a) * RADIUS;
        s.z = boat.z + Math.sin(a) * RADIUS;
      }

      dummy.position.set(s.x, waveHeight(s.x, s.z, elapsed) + 0.02, s.z);
      dummy.rotation.set(0, WIND, 0);
      dummy.scale.set(s.scale, 1, s.scale);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
  });
</script>

<T.InstancedMesh bind:ref={mesh} args={[geometry, material, count]} renderOrder={2} />
