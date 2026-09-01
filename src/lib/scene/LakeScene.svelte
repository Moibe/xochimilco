<script lang="ts">
  import { T } from '@threlte/core';
  import { OrbitControls } from '@threlte/extras';
  import { Vector3 } from 'three';
  import Lake from './Lake.svelte';
  import Ripples from './Ripples.svelte';
  import Trajinera from './Trajinera.svelte';

  /**
   * The whole vignette: one trajinera, one canal, one midday sun — the
   * close-up equivalent of `logistica-oceanica`'s `ShipScene`, but daylight
   * and small-scale instead of open-sea and vast. Fog and camera distances
   * are tuned for an 8 m boat on a ~90-unit canal plane, not a 400 m ship on
   * a 700-unit sea.
   */
  let { name = 'Estrella', hullColor = '#d6407e' }: { name?: string; hullColor?: string } =
    $props();

  const SUN = new Vector3(0.35, 0.86, 0.28).normalize();
  const SKY = '#bfe6f2';
</script>

<T.FogExp2 attach="fog" args={[SKY, 0.014]} />
<T.Color attach="background" args={[SKY]} />

<T.PerspectiveCamera makeDefault position={[9, 5, 10]} fov={38} near={0.1} far={300}>
  <OrbitControls
    enableDamping
    dampingFactor={0.08}
    target={[0, 0.6, 0]}
    minDistance={4}
    maxDistance={40}
    maxPolarAngle={Math.PI / 2 - 0.04}
  />
</T.PerspectiveCamera>

<!-- Key light matches the lake shader's sun direction so the boat and water agree. -->
<T.DirectionalLight position={[SUN.x * 30, SUN.y * 30, SUN.z * 30]} intensity={2.6} color="#fff6e0" />
<T.HemisphereLight args={['#dff2ff', '#274a1e', 1.15]} />
<T.AmbientLight intensity={0.35} />

<Lake sun={SUN} />
<Ripples driftX={0} driftZ={1} />
<Trajinera {name} {hullColor} />
