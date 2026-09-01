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
  import { waveHeight } from './waves';

  /**
   * Drifting ripple streaks — the same trick as `logistica-oceanica`'s `Foam`,
   * toned way down: the trajinera never actually translates either, so this is
   * what tells the eye the canal is gliding past it. But a punted boat on a
   * sheltered canal makes nothing like an ocean-going wake, so the count,
   * speed, size and opacity here are all a fraction of the original's.
   */
  let {
    count = 90,
    radius = 22,
    speed = 1.1,
    driftX = 0,
    driftZ = 1,
  }: {
    count?: number;
    radius?: number;
    speed?: number;
    driftX?: number;
    driftZ?: number;
  } = $props();

  // svelte-ignore state_referenced_locally
  const len = Math.hypot(driftX, driftZ) || 1;
  // svelte-ignore state_referenced_locally
  const dX = driftX / len;
  // svelte-ignore state_referenced_locally
  const dZ = driftZ / len;
  const pX = -dZ;
  const pZ = dX;
  const driftAngle = Math.atan2(dX, dZ);

  // svelte-ignore state_referenced_locally
  const initialCount = count;
  // svelte-ignore state_referenced_locally
  const initialRadius = radius;

  type Streak = { x: number; z: number; scale: number };
  const streaks: Streak[] = [];
  for (let i = 0; i < initialCount; i++) {
    streaks.push({
      x: (Math.random() * 2 - 1) * initialRadius,
      z: (Math.random() * 2 - 1) * initialRadius,
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
    const step = speed * delta;

    for (let i = 0; i < count; i++) {
      const s = streaks[i];
      s.x += dX * step;
      s.z += dZ * step;

      const fwd = s.x * dX + s.z * dZ;
      const lat = s.x * pX + s.z * pZ;
      if (Math.abs(fwd) > radius || Math.abs(lat) > radius) {
        const newLat = (Math.random() * 2 - 1) * radius;
        s.x = -radius * dX + newLat * pX;
        s.z = -radius * dZ + newLat * pZ;
      }

      dummy.position.set(s.x, waveHeight(s.x, s.z, elapsed) + 0.02, s.z);
      dummy.rotation.set(0, driftAngle, 0);
      dummy.scale.set(s.scale, 1, s.scale);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
  });
</script>

<T.InstancedMesh bind:ref={mesh} args={[geometry, material, count]} renderOrder={2} />
