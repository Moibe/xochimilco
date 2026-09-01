<script lang="ts">
  import { T } from '@threlte/core';
  import { OrbitControls } from '@threlte/extras';
  import { CircleGeometry, CylinderGeometry, MeshBasicMaterial, MeshStandardMaterial } from 'three';
  import Personaje from './Personaje.svelte';

  /**
   * The character studio: one figure on a turntable, lit like the product
   * photos the style comes from. Deliberately nothing else — no water, no
   * boat, no fog — so what you are judging is the figure.
   *
   * Rotation is OrbitControls' own: drag to spin it, wheel to zoom, and
   * `autoRotate` for a hands-off turntable. Orbiting the camera rather than
   * spinning the model means the lighting stays put as it turns, which is what
   * you want when you are checking how a face reads from each angle.
   */
  let {
    /** Still by default: this is a viewer, and you usually want to LOOK. */
    autoRotate = false,
    hat = false,
    longHair = false,
    shirt = '#f2f0ea',
  }: { autoRotate?: boolean; hat?: boolean; longHair?: boolean; shirt?: string } = $props();

  const BACKDROP = '#efe7db';

  const podiumGeometry = new CylinderGeometry(0.62, 0.66, 0.05, 48);
  const podiumMaterial = new MeshStandardMaterial({ color: '#e2d7c6', roughness: 0.95 });
  /** A painted contact shadow: cheaper and more reliable than a shadow map,
   *  and it keeps the figure from looking like it is hovering. */
  const shadowGeometry = (() => {
    const geo = new CircleGeometry(0.26, 32);
    geo.rotateX(-Math.PI / 2);
    return geo;
  })();
  const shadowMaterial = new MeshBasicMaterial({
    color: '#8a7c6a',
    transparent: true,
    opacity: 0.32,
  });
</script>

<T.Color attach="background" args={[BACKDROP]} />

<!-- The camera sits at NEGATIVE z: the kit faces -Z, so the +z side is the
     back of its head. Distance 3.0 against a 1.32 m figure — at 2.4 with this
     fov the visible height was 1.38 m and it clipped at both ends. -->
<T.PerspectiveCamera makeDefault position={[0, 0.82, -3]} fov={32} near={0.05} far={50}>
  <OrbitControls
    {autoRotate}
    enableDamping
    dampingFactor={0.08}
    enablePan={false}
    autoRotateSpeed={1.6}
    target={[0, 0.68, 0]}
    minDistance={1}
    maxDistance={5}
    minPolarAngle={0.25}
    maxPolarAngle={Math.PI / 2 + 0.05}
  />
</T.PerspectiveCamera>

<!-- Three-point-ish product lighting: a warm key, a cool fill from the
     opposite side so the shaded half never goes muddy, and a rim from behind
     to lift the silhouette off the backdrop. -->
<T.DirectionalLight position={[2.2, 3.2, 2.6]} intensity={2.4} color="#fff4e2" />
<T.DirectionalLight position={[-2.6, 1.6, 1.4]} intensity={0.75} color="#dce9ff" />
<T.DirectionalLight position={[-0.6, 2.2, -3]} intensity={1.1} color="#ffffff" />
<T.HemisphereLight args={['#ffffff', '#b9a892', 0.85]} />
<T.AmbientLight intensity={0.42} />

<T.Mesh geometry={podiumGeometry} material={podiumMaterial} position={[0, -0.025, 0]} />
<T.Mesh geometry={shadowGeometry} material={shadowMaterial} position={[0, 0.003, 0]} />

<Personaje {hat} {longHair} {shirt} />
