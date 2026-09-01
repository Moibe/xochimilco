<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { OrbitControls } from '@threlte/extras';
  import { Vector3 } from 'three';
  import type { PerspectiveCamera } from 'three';
  import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
  import Lake from './Lake.svelte';
  import Lirios from './Lirios.svelte';
  import Ripples from './Ripples.svelte';
  import Terreno from './Terreno.svelte';
  import Trajinera from './Trajinera.svelte';
  import { advanceStroke } from './stroke';
  import { advanceBoat, boat } from './boat';
  import { autopilot, steerAlongCanal } from './autopilot';

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

  let camera = $state.raw<PerspectiveCamera | undefined>();
  let controls = $state.raw<OrbitControlsImpl | undefined>();
  let lastX = boat.x;
  let lastZ = boat.z;
  /** Where the camera sits relative to the boat before anyone orbits it. */
  const CAM_OFFSET = { x: 9, y: 5, z: 10 };
  let framed = false;

  // The scene root owns both clocks, and is the ONLY caller that advances
  // them — the poler, the hull, the ripples and the hyacinth all just read.
  // Advancing from any of those would step the stroke several times per frame
  // and run the boat at a multiple of the speed it should have. Stroke first,
  // then the boat, so the hull sees this frame's effort.
  useTask((delta) => {
    advanceStroke(delta);
    // The autopilot writes the same two input axes the keyboard does, so it
    // has to run BEFORE the hull reads them.
    if (autopilot.on) steerAlongCanal(delta);
    advanceBoat(delta);

    // Frame her once, on the first frame the refs exist. The camera's declared
    // position is relative to nothing — and she may be anywhere, because the
    // map lets you drop her hundreds of metres away while this scene isn't
    // even mounted. Without this the view opens on empty water with the boat
    // somewhere out in the fog.
    if (camera && controls && !framed) {
      framed = true;
      camera.position.set(boat.x + CAM_OFFSET.x, CAM_OFFSET.y, boat.z + CAM_OFFSET.z);
      controls.target.set(boat.x, 0.6, boat.z);
      lastX = boat.x;
      lastZ = boat.z;
      return;
    }

    // Then follow her by the DELTA rather than snapping to a fixed offset:
    // that keeps whatever angle and zoom the viewer orbited to, and it keeps
    // OrbitControls' own spherical state consistent (it works off
    // camera.position and target, so both have to move together).
    const dx = boat.x - lastX;
    const dz = boat.z - lastZ;
    lastX = boat.x;
    lastZ = boat.z;
    if (camera && controls && (dx !== 0 || dz !== 0)) {
      camera.position.x += dx;
      camera.position.z += dz;
      controls.target.x += dx;
      controls.target.z += dz;
    }
  });
</script>

<T.FogExp2 attach="fog" args={[SKY, 0.014]} />
<T.Color attach="background" args={[SKY]} />

<T.PerspectiveCamera
  bind:ref={camera}
  makeDefault
  position={[9, 5, 10]}
  fov={38}
  near={0.1}
  far={300}
>
  <OrbitControls
    bind:ref={controls}
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
<!-- Ground bounce follows the water's hue — teal now, not leaf-green. -->
<T.HemisphereLight args={['#dff2ff', '#1e4436', 1.15]} />
<T.AmbientLight intensity={0.35} />

<Terreno sun={SUN} />
<Lake sun={SUN} />
<Lirios />
<Ripples />
<Trajinera {name} {hullColor} />
