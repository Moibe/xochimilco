<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import {
    BufferAttribute,
    BoxGeometry,
    CanvasTexture,
    Color,
    CylinderGeometry,
    DoubleSide,
    ExtrudeGeometry,
    Group,
    IcosahedronGeometry,
    InstancedMesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    Object3D,
    PlaneGeometry,
    Shape,
    SRGBColorSpace,
    TorusGeometry,
  } from 'three';
  import Trajinero from './Trajinero.svelte';
  import { waveHeight, waveSlope } from './waves';

  /**
   * A trajinera — the flat-bottomed punt of Xochimilco's canals — built out of
   * primitives the same way `logistica-oceanica`'s `ContainerShip` builds a
   * merchant hull: no glTF, just extrudes and instances. The physics is the
   * same borrowed trick too (see `useTask` below): the hull samples the
   * *actual* lake surface at four points and solves heave/pitch/roll from
   * those samples, so it never drifts out of sync with what the shader draws.
   *
   * What's different from a ship hull, on purpose: a trajinera is a shallow
   * rectangular punt, not a fine-bowed hull, so it barely pitches (a flat
   * wide bottom bridges ripples instead of cutting into them) and rocks a
   * little more readily side-to-side than a hull ten times its beam. Scale:
   * 1 world unit = 1 metre (no metres-to-units conversion needed at this size).
   */
  let {
    length = 8,
    beam = 2.3,
    hullColor = '#d6407e',
    trimColor = '#f5efe0',
    name = 'Estrella',
  }: {
    length?: number;
    beam?: number;
    hullColor?: string;
    trimColor?: string;
    name?: string;
  } = $props();

  // Read once, deliberately — see ContainerShip's identical note. Rebuilding
  // every buffer on each reactive tick would be pure churn for geometry that
  // never changes after mount.
  // svelte-ignore state_referenced_locally
  const LOA = length;
  // svelte-ignore state_referenced_locally
  const BEAM = beam;
  // svelte-ignore state_referenced_locally
  const HULL_COLOR = hullColor;
  // svelte-ignore state_referenced_locally
  const TRIM_COLOR = trimColor;
  // svelte-ignore state_referenced_locally
  const NAME = name;

  const DECK_Y = 0.32;
  const KEEL_Y = -0.2;
  const HULL_BEVEL = 0.04;
  const halfBeam = BEAM / 2;
  const halfLen = LOA / 2;

  // ---- hull: a boxy, shallow-draft punt, not a fine ship's bow -------------
  // Full beam is reached quickly from both ends (a punt is blunt), and the
  // extrude runs along the shape's local Y -> world -Z, so the bow (shape's
  // +Y tip) lands at z = -halfLen, matching ContainerShip's convention.
  const hullGeometry = (() => {
    const shape = new Shape();
    shape.moveTo(0, halfLen);
    shape.quadraticCurveTo(halfBeam * 0.95, halfLen * 0.9, halfBeam, halfLen * 0.62);
    shape.lineTo(halfBeam, -halfLen * 0.88);
    shape.quadraticCurveTo(halfBeam, -halfLen, halfBeam * 0.82, -halfLen);
    shape.lineTo(-halfBeam * 0.82, -halfLen);
    shape.quadraticCurveTo(-halfBeam, -halfLen, -halfBeam, -halfLen * 0.88);
    shape.lineTo(-halfBeam, halfLen * 0.62);
    shape.quadraticCurveTo(-halfBeam * 0.95, halfLen * 0.9, 0, halfLen);

    const geo = new ExtrudeGeometry(shape, {
      depth: DECK_Y - KEEL_Y,
      bevelEnabled: true,
      bevelThickness: HULL_BEVEL,
      bevelSize: HULL_BEVEL,
      bevelSegments: 2,
      curveSegments: 10,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, KEEL_Y, 0);

    // Painted straight into vertex colours, same trick as ContainerShip's
    // boot-top: a cream gunwale trim near the top, the boat's own colour
    // everywhere else, a touch darker right at the keel for grounding.
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const trim = new Color(TRIM_COLOR);
    const hull = new Color(HULL_COLOR);
    const keel = hull.clone().multiplyScalar(0.6);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const c = y > DECK_Y - 0.1 ? trim : y < KEEL_Y + 0.06 ? keel : hull;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  })();

  const hullMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.65 });

  const deckGeometry = new BoxGeometry(BEAM * 0.94, 0.06, LOA * 0.86);
  const deckMaterial = new MeshStandardMaterial({ color: '#a97b4f', roughness: 0.85 });

  // ---- benches along both gunwales, plus a low centre table ----------------
  const benchGeometry = new BoxGeometry(0.32, 0.34, LOA * 0.56);
  const benchMaterial = new MeshStandardMaterial({ color: '#8a5a35', roughness: 0.8 });
  const tableGeometry = new BoxGeometry(halfBeam * 0.7, 0.32, 0.9);
  const tableMaterial = new MeshStandardMaterial({ color: '#7a4d2c', roughness: 0.75 });

  // ---- the arco: a flower-covered arch over the bow ------------------------
  // A half-torus already lies in a vertical plane with both ends touching
  // y = 0 and the apex at y = radius — exactly an arch shape, no bespoke
  // curve needed. Positioned a little back from the very tip, where the hull
  // has nearly reached full beam, so its feet land on real deck.
  const ARCH_Z = -halfLen * 0.62;
  const ARCH_RADIUS = halfBeam * 0.92 + 0.12;
  const ARCH_TUBE = 0.05;

  const archGeometry = (() => {
    const geo = new TorusGeometry(ARCH_RADIUS, ARCH_TUBE, 10, 48, Math.PI);
    // Paint alternating flower-garland bands along the arc instead of a flat
    // colour, so it reads as strung flowers rather than a painted pipe.
    const palette = ['#e63950', '#f2b632', '#8b3fa8', '#2f7fc1', '#f2f2f2', '#e67e22'].map(
      (c) => new Color(c)
    );
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const angle = Math.atan2(y, x); // 0 at +X leg, PI at -X leg, PI/2 at apex
      const band = Math.floor((angle / Math.PI) * palette.length) % palette.length;
      const c = palette[band];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    geo.translate(0, DECK_Y, ARCH_Z);
    return geo;
  })();
  const archMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });

  // Small paper-flower buds scattered along the same curve, deterministically
  // jittered so the arch looks hand-decorated rather than machined — see
  // ContainerShip's `noise` note for why this needs to be stable across reloads.
  const FLOWER_COLORS = ['#e63950', '#f2b632', '#8b3fa8', '#2f7fc1', '#ffffff', '#e67e22'].map(
    (c) => new Color(c)
  );
  const FLOWER_COUNT = 46;
  const flowerGeometry = new IcosahedronGeometry(0.075, 0);
  const flowerMaterial = new MeshStandardMaterial({ roughness: 0.55 });
  const flowerNoise = (a: number) => {
    const s = Math.sin(a * 127.1) * 43758.5453;
    return s - Math.floor(s);
  };
  const flowers = Array.from({ length: FLOWER_COUNT }, (_, i) => {
    const t = i / (FLOWER_COUNT - 1);
    const angle = t * Math.PI;
    const jitterR = ARCH_RADIUS + (flowerNoise(i * 3.1) - 0.5) * 0.14;
    const x = Math.cos(angle) * jitterR;
    const y = DECK_Y + Math.sin(angle) * jitterR;
    const z = ARCH_Z + (flowerNoise(i * 5.7) - 0.5) * 0.16;
    const scale = 0.7 + flowerNoise(i * 9.3) * 0.7;
    const color = FLOWER_COLORS[Math.floor(flowerNoise(i * 13.9) * FLOWER_COLORS.length)];
    return { x, y, z, scale, color };
  });
  let flowerMesh = $state.raw<InstancedMesh | undefined>();
  $effect(() => {
    const mesh = flowerMesh;
    if (!mesh) return;
    const dummy = new Object3D();
    for (let i = 0; i < flowers.length; i++) {
      const f = flowers[i];
      dummy.position.set(f.x, f.y, f.z);
      dummy.scale.setScalar(f.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, f.color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  // Name banner, hung just under the apex — same canvas-texture trick as
  // ContainerShip's hull nameplate, but double-sided since the arch is meant
  // to be read from either the bow or the passenger benches.
  const namePlate = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = NAME.toUpperCase();
    let fontSize = 74;
    ctx.font = `700 ${fontSize}px Georgia, serif`;
    while (ctx.measureText(text).width > canvas.width * 0.88 && fontSize > 18) {
      fontSize -= 2;
      ctx.font = `700 ${fontSize}px Georgia, serif`;
    }
    ctx.fillStyle = '#8b3fa8';
    ctx.fillText(text, canvas.width / 2 + 3, canvas.height / 2 + 5);
    ctx.fillStyle = '#fff6e0';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    const material = new MeshBasicMaterial({ map: texture, transparent: true, side: DoubleSide });
    const width = ARCH_RADIUS * 1.35;
    const height = (width * canvas.height) / canvas.width;
    const geometry = new PlaneGeometry(width, height);
    const position: [number, number, number] = [0, DECK_Y + ARCH_RADIUS * 0.72, ARCH_Z];
    return { geometry, material, position };
  })();

  // ---- toldo: the striped canvas awning over the passenger benches --------
  const ROOF_Y = DECK_Y + 1.65;
  const ROOF_Z = -halfLen * 0.08;
  const roofGeometry = (() => {
    const width = BEAM * 1.08;
    const depth = LOA * 0.6;
    const stripes = 8;
    const geo = new PlaneGeometry(width, depth, stripes, 1);
    geo.rotateX(-Math.PI / 2);
    const palette = ['#f2b632', '#e63950', '#3aa655', '#2f7fc1'].map((c) => new Color(c));
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / width + 0.5; // 0..1 across the width
      const band = Math.min(stripes - 1, Math.floor(x * stripes));
      const c = palette[band % palette.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    return geo;
  })();
  const roofMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: DoubleSide });

  const poleGeometry = new CylinderGeometry(0.03, 0.03, 1.7, 8);
  const poleMaterial = new MeshStandardMaterial({ color: '#5b4630', roughness: 0.9 });
  // Four evenly spaced pole stations under the roof footprint.
  const POLE_STATIONS = Array.from({ length: 4 }, (_, i) => ROOF_Z - LOA * 0.3 + (i * (LOA * 0.6)) / 3);

  // Where the trajinero stands: on the stern deck, outboard on the starboard
  // side so his vara goes down past the gunwale instead of through it, and aft
  // of the toldo's rear edge (z = +2.08) so he's standing in the open the way
  // a poler actually does. The deck plank's top surface is DECK_Y + 0.06.
  const POLER_POSITION: [number, number, number] = [0.7, DECK_Y + 0.06, 3.0];

  // ---- motion: same four-probe technique as ContainerShip, retuned --------
  // A flat wide punt bridges short ripples almost flat (negligible pitch) and
  // rocks a little more readily side-to-side per unit of tilt than a hull ten
  // times its beam — the coefficients below are NOT the ship's, they're tuned
  // down/up from them for that different shape.
  let group = $state.raw<Group | undefined>();
  let elapsed = 0;

  useTask((delta) => {
    elapsed += delta;
    const g = group;
    if (!g) return;

    const bow = waveHeight(0, -halfLen * 0.85, elapsed);
    const stern = waveHeight(0, halfLen * 0.85, elapsed);
    const port = waveHeight(-halfBeam, 0, elapsed);
    const starboard = waveHeight(halfBeam, 0, elapsed);

    g.position.y = (bow + stern + port + starboard) * 0.25 * 0.92;

    const pitch = Math.atan2(stern - bow, halfLen * 1.6) * 0.16;
    const roll = Math.atan2(starboard - port, BEAM) * 0.46;
    g.rotation.x = pitch;
    g.rotation.z = roll;

    const [slopeX] = waveSlope(0, 0, elapsed);
    g.rotation.y = slopeX * 0.03;
  });
</script>

<T.Group bind:ref={group}>
  <T.Mesh geometry={hullGeometry} material={hullMaterial} castShadow />
  <T.Mesh geometry={deckGeometry} material={deckMaterial} position={[0, DECK_Y + 0.03, 0]} />

  <T.Mesh geometry={benchGeometry} material={benchMaterial} position={[halfBeam - 0.24, DECK_Y + 0.2, 0.15]} />
  <T.Mesh geometry={benchGeometry} material={benchMaterial} position={[-(halfBeam - 0.24), DECK_Y + 0.2, 0.15]} />
  <T.Mesh geometry={tableGeometry} material={tableMaterial} position={[0, DECK_Y + 0.19, 0.1]} />

  <T.Mesh geometry={archGeometry} material={archMaterial} castShadow />
  <T.InstancedMesh bind:ref={flowerMesh} args={[flowerGeometry, flowerMaterial, flowers.length]} castShadow />
  <T.Mesh geometry={namePlate.geometry} material={namePlate.material} position={namePlate.position} />

  <T.Mesh geometry={roofGeometry} material={roofMaterial} position={[0, ROOF_Y, ROOF_Z]} />
  {#each POLE_STATIONS as z, i (i)}
    <T.Mesh geometry={poleGeometry} material={poleMaterial} position={[halfBeam * 0.92, DECK_Y + 0.85, z]} />
    <T.Mesh geometry={poleGeometry} material={poleMaterial} position={[-halfBeam * 0.92, DECK_Y + 0.85, z]} />
  {/each}

  <T.Group position={POLER_POSITION}>
    <Trajinero />
  </T.Group>
</T.Group>
