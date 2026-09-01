<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { Color, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from 'three';
  import { MAP_H, MAP_W, METRES_PER_UNIT } from '$lib/canales';
  import { boat } from './boat';
  import { canalMask } from './canalMask';

  /**
   * The chinampas: the land the canals are cut through. This is the drawn map
   * made solid — the same mask the hull collides against, displaced on the GPU
   * so banks rise out of the water and the canal bed drops away under it.
   *
   * The plane rides with the boat exactly like the water does, and samples the
   * mask at WORLD xz, so the terrain stays anchored to the map while only a
   * patch of it around her ever exists. No 800 × 500 m mesh, no rebuilding
   * geometry when the map is redrawn — edit the map, re-upload one texture,
   * done.
   */
  let {
    /** Extent of the patch that follows her. Fog closes in well before its rim. */
    size = 130,
    segments = 260,
    sun = new Vector3(0.35, 0.86, 0.28),
  }: { size?: number; segments?: number; sun?: Vector3 } = $props();

  // svelte-ignore state_referenced_locally
  const SUN_DIRECTION = sun.clone().normalize();

  const geometry = (() => {
    const geo = new PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    return geo;
  })();

  const material = new ShaderMaterial({
    uniforms: {
      uMask: { value: null },
      uHasMap: { value: 0 },
      /** Where the map sits in world metres: half its extent, each way. */
      uMapHalf: {
        value: new Vector2((MAP_W * METRES_PER_UNIT) / 2, (MAP_H * METRES_PER_UNIT) / 2),
      },
      uSun: { value: SUN_DIRECTION },
      uBank: { value: new Color('#6e9350') },
      uBankDry: { value: new Color('#8a9a5b') },
      uShore: { value: new Color('#6b5a3e') },
      uBed: { value: new Color('#1d3630') },
      uSky: { value: new Color('#bfe6f2') },
      uCenter: { value: new Vector2(0, 0) },
    },
    vertexShader: /* glsl */ `
      uniform sampler2D uMask;
      uniform float uHasMap;
      uniform vec2 uMapHalf;

      varying vec3 vWorld;
      varying float vLand;
      varying vec3 vNormal;

      /** Landness 0..1 at a world xz. Off the edge of the map it is open water. */
      float landAt(vec2 p) {
        if (uHasMap < 0.5) return 0.0;
        vec2 uv = (p + uMapHalf) / (uMapHalf * 2.0);
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
        return texture2D(uMask, uv).r;
      }

      /** Bank crest, and the canal floor. */
      float heightAt(vec2 p) {
        return mix(-1.5, 0.55, smoothstep(0.15, 0.85, landAt(p)));
      }

      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        float h = heightAt(world.xz);
        world.y = h;

        // Normal by central difference over one grid step — the mask is the
        // only height source, so there is nothing analytic to differentiate.
        float e = 0.5;
        float hx = heightAt(world.xz + vec2(e, 0.0)) - heightAt(world.xz - vec2(e, 0.0));
        float hz = heightAt(world.xz + vec2(0.0, e)) - heightAt(world.xz - vec2(0.0, e));
        vNormal = normalize(vec3(-hx, 2.0 * e, -hz));

        vLand = landAt(world.xz);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;

      uniform vec3 uSun;
      uniform vec3 uBank;
      uniform vec3 uBankDry;
      uniform vec3 uShore;
      uniform vec3 uBed;
      uniform vec3 uSky;
      uniform vec2 uCenter;

      varying vec3 vWorld;
      varying float vLand;
      varying vec3 vNormal;

      void main() {
        vec3 n = normalize(vNormal);
        float diffuse = max(dot(n, uSun), 0.0);

        // Bed below the waterline, a mud band right at it, grass above — and
        // the flatter the crest the drier and paler it reads.
        vec3 colour = uBed;
        colour = mix(colour, uShore, smoothstep(-0.35, 0.06, vWorld.y));
        vec3 grass = mix(uBank, uBankDry, smoothstep(0.6, 0.98, n.y));
        colour = mix(colour, grass, smoothstep(0.02, 0.3, vWorld.y));

        colour *= 0.55 + 0.45 * diffuse;

        // Same horizon fade as the water, measured from the boat, so land and
        // lake dissolve into the fog together instead of one out-lasting the other.
        float dist = length(vWorld.xz - uCenter);
        colour = mix(colour, uSky, smoothstep(30.0, 65.0, dist));

        gl_FragColor = vec4(colour, 1.0);

        #include <colorspace_fragment>
      }
    `,
  });

  let mesh = $state.raw<Mesh | undefined>();
  let appliedVersion = -1;

  useTask(() => {
    // Pick up a freshly (re)built mask without needing to remount.
    if (appliedVersion !== canalMask.version) {
      appliedVersion = canalMask.version;
      material.uniforms.uMask.value = canalMask.texture;
      material.uniforms.uHasMap.value = canalMask.hasMap ? 1 : 0;
    }
    if (mesh) {
      mesh.position.set(boat.x, 0, boat.z);
      // Set here rather than as a prop: `canalMask` is a plain object, so a
      // `visible={...}` binding would never see the map arrive.
      mesh.visible = canalMask.hasMap;
    }
    material.uniforms.uCenter.value.set(boat.x, boat.z);
  });
</script>

<T.Mesh bind:ref={mesh} {geometry} {material} visible={false} />
