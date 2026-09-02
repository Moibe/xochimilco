<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { Group, Matrix4, MeshStandardMaterial } from 'three';
  import { boat } from './boat';
  import { isLand, nearestWater } from './canalMask';
  import { waveHeight } from './waves';
  import { mergeGeometries, superellipsoid } from './chibi';

  /**
   * A very occasional axolotl. The lake's water is fully opaque (see
   * `Lake.svelte`'s shader), so "well below the surface" already means
   * invisible — no fading or hide/show state needed, just a Y position. It
   * spends almost all its time parked there and only rises for one short
   * swim near the boat every couple of minutes. The rarity is the point:
   * this is meant to feel like spotting something, not like ambient
   * wildlife going about routine business.
   */

  const BODY_SCALE = 0.8;
  /** How far below the (invisible-anyway) surface it sits between sightings. */
  const PARKED_Y = -50;
  /** How deep it starts/ends a sighting, before rising to/from the surface. */
  const SUBMERGE_DEPTH = 0.55;
  const SURFACE_RIDE = 0.012;
  /** A sighting happens somewhere in this ring around the boat — close
   *  enough to plausibly notice, far enough that it isn't right on the deck. */
  const SPAWN_MIN_R = 9;
  const SPAWN_MAX_R = 24;
  /** How far it swims during one sighting. */
  const SWIM_MIN = 6;
  const SWIM_MAX = 14;
  /** Fraction of the swim spent rising into view / sinking back out of it. */
  const RISE_FRAC = 0.15;

  const BODY = new MeshStandardMaterial({ color: '#f4cddc', roughness: 0.5 });
  const GILL = new MeshStandardMaterial({ color: '#e8879f', roughness: 0.45 });
  const EYE = new MeshStandardMaterial({ color: '#141118', roughness: 0.3 });

  /**
   * One merged blob — a wide flat head fused into a slimmer tapering body —
   * rather than two pieces held together by overlap. Same reasoning as the
   * pants/hair fixes on the human kit: `mergeGeometries` bakes each part's
   * placement in and concatenates them into a single real mesh.
   */
  const bodyGeometry = mergeGeometries([
    { geometry: superellipsoid({ x: 0.06, y: 0.048, z: 0.07 }, 3.4, 16, 12), matrix: new Matrix4().makeTranslation(0, 0, -0.05) },
    { geometry: superellipsoid({ x: 0.038, y: 0.036, z: 0.085 }, 2.6, 14, 10), matrix: new Matrix4().makeTranslation(0, -0.004, 0.09) },
  ]);
  const eyeGeometry = superellipsoid({ x: 0.012, y: 0.012, z: 0.012 }, 2.2, 8, 6);
  const legGeometry = superellipsoid({ x: 0.014, y: 0.022, z: 0.014 }, 2.4, 8, 6);
  /** A small feathery frond — three per side, fanned at the back of the head,
   *  the external gills that are THE axolotl silhouette. */
  const gillGeometry = superellipsoid({ x: 0.011, y: 0.021, z: 0.011 }, 2.0, 8, 6);
  const tailGeometry = superellipsoid({ x: 0.014, y: 0.05, z: 0.07 }, 2.6, 10, 8);

  const EYES: [number, number, number][] = [
    [0.032, 0.02, -0.1],
    [-0.032, 0.02, -0.1],
  ];
  const LEGS: [number, number, number][] = [
    [0.048, -0.032, 0.0],
    [-0.048, -0.032, 0.0],
    [0.04, -0.03, 0.14],
    [-0.04, -0.03, 0.14],
  ];
  const GILLS: { pos: [number, number, number]; rot: [number, number, number] }[] = [
    { pos: [0.055, 0.03, 0.0], rot: [0.35, 0, -0.5] },
    { pos: [0.06, 0.008, 0.018], rot: [0.05, 0, -0.75] },
    { pos: [0.054, -0.014, 0.032], rot: [-0.3, 0, -0.6] },
    { pos: [-0.055, 0.03, 0.0], rot: [0.35, 0, 0.5] },
    { pos: [-0.06, 0.008, 0.018], rot: [0.05, 0, 0.75] },
    { pos: [-0.054, -0.014, 0.032], rot: [-0.3, 0, 0.6] },
  ];

  let group = $state.raw<Group | undefined>();
  let tailPivot = $state.raw<Group | undefined>();

  let phase: 'waiting' | 'swimming' = 'waiting';
  /** First sighting comes soon-ish after load, so the feature is discoverable
   *  without an early visitor having to wait through a full cooldown. */
  let timer = 8 + Math.random() * 15;
  let elapsed = 0;
  let swimT = 0;
  let swimDuration = 0;
  let sx = 0;
  let sz = 0;
  let ex = 0;
  let ez = 0;
  let dirX = 0;
  let dirZ = 0;
  let heading = 0;

  /** Picks a short, all-water path near the boat. Returns false if it can't
   *  find one in a few tries (e.g. the boat is out past the drawn canal, in
   *  a slim tongue of water) — the caller just retries shortly after. */
  function tryStartSwim(): boolean {
    for (let attempt = 0; attempt < 6; attempt++) {
      const a = Math.random() * Math.PI * 2;
      const d = SPAWN_MIN_R + Math.random() * (SPAWN_MAX_R - SPAWN_MIN_R);
      const start = nearestWater(boat.x + Math.cos(a) * d, boat.z + Math.sin(a) * d, 14);
      if (!start) continue;
      const sa = Math.random() * Math.PI * 2;
      const sd = SWIM_MIN + Math.random() * (SWIM_MAX - SWIM_MIN);
      const endX = start.x + Math.cos(sa) * sd;
      const endZ = start.z + Math.sin(sa) * sd;
      const midX = (start.x + endX) / 2;
      const midZ = (start.z + endZ) / 2;
      if (isLand(endX, endZ) || isLand(midX, midZ)) continue;

      sx = start.x;
      sz = start.z;
      ex = endX;
      ez = endZ;
      dirX = (endX - start.x) / sd;
      dirZ = (endZ - start.z) / sd;
      // Same forward convention as `boat.ts`: heading 0 points -Z.
      heading = Math.atan2(-dirX, -dirZ);
      swimDuration = 15 + Math.random() * 10;
      swimT = 0;
      return true;
    }
    return false;
  }

  useTask((delta) => {
    elapsed += delta;

    if (phase === 'waiting') {
      timer -= delta;
      if (timer <= 0) {
        if (tryStartSwim()) {
          phase = 'swimming';
        } else {
          timer = 4; // no nearby water found this try; have another go soon
        }
      }
      if (group) group.position.y = PARKED_Y;
      return;
    }

    swimT += delta;
    const t = Math.min(1, swimT / swimDuration);
    const rise =
      t < RISE_FRAC ? t / RISE_FRAC : t > 1 - RISE_FRAC ? (1 - t) / RISE_FRAC : 1;
    const eased = t * t * (3 - 2 * t);
    const x = sx + (ex - sx) * eased;
    const z = sz + (ez - sz) * eased;

    // A gentle S-wiggle across the swim, perpendicular to the direction of
    // travel, plus a matching sway in heading so the nose leads the curve.
    const perpX = -dirZ;
    const perpZ = dirX;
    const wiggle = Math.sin(swimT * 3.2) * 0.15 * rise;
    const wx = x + perpX * wiggle;
    const wz = z + perpZ * wiggle;

    if (group) {
      const y = waveHeight(wx, wz, elapsed) + SURFACE_RIDE * rise - SUBMERGE_DEPTH * (1 - rise);
      group.position.set(wx, y, wz);
      group.rotation.y = heading + Math.cos(swimT * 3.2) * 0.18 * rise;
    }
    if (tailPivot) tailPivot.rotation.y = Math.sin(swimT * 5.5) * 0.5 * rise;

    if (t >= 1) {
      phase = 'waiting';
      // Long and randomised on purpose — minutes apart, not seconds.
      timer = 90 + Math.random() * 120;
    }
  });
</script>

<T.Group bind:ref={group} scale={BODY_SCALE}>
  <T.Mesh geometry={bodyGeometry} material={BODY} />
  {#each EYES as pos, i (i)}
    <T.Mesh geometry={eyeGeometry} material={EYE} position={pos} />
  {/each}
  {#each LEGS as pos, i (i)}
    <T.Mesh geometry={legGeometry} material={BODY} position={pos} />
  {/each}
  {#each GILLS as g, i (i)}
    <T.Mesh geometry={gillGeometry} material={GILL} position={g.pos} rotation={g.rot} />
  {/each}
  <T.Group bind:ref={tailPivot} position={[0, 0, 0.16]}>
    <T.Mesh geometry={tailGeometry} material={BODY} position={[0, 0, 0.06]} />
  </T.Group>
</T.Group>
