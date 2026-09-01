<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from 'three';
  import { boat } from './boat';
  import { WAVE_COUNT, WAVE_GLSL, WAVE_UNIFORM } from './waves';

  /**
   * The canal. Same trick as the open-ocean version: one plane, displaced in
   * the vertex shader by the shared sum-of-sines, shaded with an analytic
   * normal — no normal map, no texture. Colours and specular are tuned for
   * still, plant-tinted canal water instead of open sea: greener, murkier,
   * far less mirror-like (algae and silt scatter the light instead of
   * reflecting it cleanly).
   *
   * Smaller and denser than the ocean plane: the whole scene is one trajinera
   * at conversational distance, not a 400 m ship — 90 units already reaches
   * past the horizon fog, and the ripples themselves are short (down to 0.75
   * units), so they need close vertex spacing near the boat to read at all.
   */
  let {
    size = 90,
    segments = 260,
    sun = new Vector3(0.35, 0.86, 0.28),
  }: { size?: number; segments?: number; sun?: Vector3 } = $props();

  // svelte-ignore state_referenced_locally
  const SUN_DIRECTION = sun.clone().normalize();

  const geometry = (() => {
    const geo = new PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    // Same outward warp as the ocean plane: spend vertices near the boat,
    // let the rim (which fades into fog anyway) get by on very few.
    const pos = geo.attributes.position;
    const half = size / 2;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / half;
      const z = pos.getZ(i) / half;
      pos.setX(i, Math.sign(x) * Math.abs(x) ** 1.7 * half);
      pos.setZ(i, Math.sign(z) * Math.abs(z) ** 1.7 * half);
    }
    pos.needsUpdate = true;
    geo.computeBoundingSphere();
    return geo;
  })();

  const material = new ShaderMaterial({
    side: DoubleSide,
    uniforms: {
      uWaves: { value: WAVE_UNIFORM },
      uTime: { value: 0 },
      uSun: { value: SUN_DIRECTION },
      uDeep: { value: new Color('#11333a') },
      uShallow: { value: new Color('#3e7d6c') },
      uFoam: { value: new Color('#d9ecdf') },
      uSky: { value: new Color('#bfe6f2') },
      /** The plane rides with the boat, so the horizon fade has to measure
       *  distance from HER, not from the world origin — otherwise she sails
       *  out of the clear water and into her own fog ring. */
      uCenter: { value: new Vector2(0, 0) },
    },
    vertexShader: /* glsl */ `
      ${WAVE_GLSL}

      varying vec3 vWorld;
      varying vec3 vNormal;

      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec3 sea = sampleSea(world.xz);
        world.y += sea.x;
        vNormal = normalize(vec3(-sea.y, 1.0, -sea.z));
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;

      uniform vec3 uSun;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uFoam;
      uniform vec3 uSky;
      uniform vec2 uCenter;

      varying vec3 vWorld;
      varying vec3 vNormal;

      void main() {
        vec3 n = normalize(vNormal);
        vec3 view = normalize(cameraPosition - vWorld);

        // Grazing angles still pick up a little sky, but far less than open
        // sea — canal water is shallow and full of suspended plant matter,
        // so it reads as murky green even near the edges rather than mirroring
        // the sky like clear open water would.
        float fresnel = pow(1.0 - max(dot(n, view), 0.0), 3.2);

        float diffuse = max(dot(n, uSun), 0.0);
        vec3 halfway = normalize(uSun + view);
        // Much lower specular power than open sea: algae-flecked water
        // scatters the highlight into a soft glint instead of a sharp mirror.
        float specular = pow(max(dot(n, halfway), 0.0), 60.0);

        float steep = smoothstep(0.05, 0.2, 1.0 - n.y);

        vec3 water = mix(uDeep, uShallow, diffuse * 0.85);
        vec3 color = mix(water, uSky, fresnel * 0.35);
        color += uFoam * steep * 0.35;
        color += vec3(1.0, 0.98, 0.9) * specular * 0.6;

        // Fade the rim into the sky/fog colour so the plane never shows an edge.
        float dist = length(vWorld.xz - uCenter);
        color = mix(color, uSky, smoothstep(30.0, 65.0, dist));

        gl_FragColor = vec4(color, 1.0);

        // three's Color converts every hex to LINEAR space; a raw ShaderMaterial
        // writes straight to the framebuffer, so without this the lake ships
        // out linear values the display reads as sRGB — several stops too dark
        // and mismatched against the scene background set from the same hex.
        #include <colorspace_fragment>
      }
    `,
  });

  if (WAVE_UNIFORM.length !== WAVE_COUNT) {
    throw new Error('WAVE_UNIFORM y WAVE_COUNT no coinciden');
  }

  let mesh = $state.raw<Mesh | undefined>();

  useTask((delta) => {
    material.uniforms.uTime.value += delta;
    // Slide the plane along under the boat. The vertex shader samples the
    // swell at WORLD xz, so moving the model matrix does NOT drag the wave
    // pattern along — the water stays anchored and she really travels
    // through it, while the finite plane is always centred on her.
    if (mesh) mesh.position.set(boat.x, 0, boat.z);
    material.uniforms.uCenter.value.set(boat.x, boat.z);
  });
</script>

<T.Mesh bind:ref={mesh} {geometry} {material} receiveShadow={false} />
