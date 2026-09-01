import { CanvasTexture, LinearFilter, type Texture } from 'three';
import {
  MAP_H,
  MAP_W,
  METRES_PER_UNIT,
  STORE_KEY,
  isSavedBoat,
  paintStrokes,
  worldToMap,
  type Stroke,
} from '$lib/canales';
import { boat } from './boat';

/**
 * The drawn canal map, turned into something the 3D world can use: one
 * greyscale land mask, read two ways. The GPU samples it as a texture to
 * displace the terrain (banks up, canal bed down); the CPU samples the very
 * same pixels to answer "is there land here?" for the hull. One rasterisation
 * feeding both is the whole point — a boat colliding with a bank that isn't
 * where the bank is drawn would be worse than no collision at all.
 *
 * White = land, black = water. The mask is BLURRED on purpose: a hard edge
 * would give the banks a vertical cliff one texel wide, and the blur turns it
 * into a couple of metres of slope. The CPU threshold sits at the same 0.5 the
 * shader uses, so what blocks you is what you can see.
 */

/** Metres of softening at the shoreline. */
const BANK_SOFTEN_M = 1.5;

export const canalMask = {
  /** Null until the map has loaded. */
  texture: null as Texture | null,
  /** The strokes this mask was built from, kept so the minimap can draw the
   *  very same map the hull is colliding against — rather than fetching its
   *  own copy and risking the two drifting apart. */
  strokes: [] as Stroke[],
  /** False when nothing has been drawn — then the world is open water. */
  hasMap: false,
  /** Bumped whenever the mask is rebuilt, so components can react. */
  version: 0,
};

let pixels: Uint8ClampedArray | null = null;
let maskW = 0;
let maskH = 0;

/**
 * Is this world point land? Outside the drawn map it is always water, so
 * sailing off the edge opens into lake rather than hitting an invisible wall.
 */
export function isLand(worldX: number, worldZ: number): boolean {
  if (!pixels || !canalMask.hasMap) return false;
  const m = worldToMap(worldX, worldZ);
  const px = Math.round((m.x / MAP_W) * maskW);
  const py = Math.round((m.y / MAP_H) * maskH);
  if (px < 0 || py < 0 || px >= maskW || py >= maskH) return false;
  // Red channel is enough: the mask is greyscale.
  return pixels[(py * maskW + px) * 4] > 127;
}

/** Rebuild the mask from a set of strokes. Safe to call again on every edit. */
export function buildCanalMask(strokes: Stroke[]) {
  canalMask.strokes = strokes;
  if (!strokes.length) {
    canalMask.hasMap = false;
    pixels = null;
    canalMask.version += 1;
    return;
  }

  const sharp = document.createElement('canvas');
  sharp.width = MAP_W;
  sharp.height = MAP_H;
  const sctx = sharp.getContext('2d')!;
  paintStrokes(sctx, strokes, { land: '#ffffff', water: '#000000' });

  // Blur into a second canvas — a canvas cannot filter itself in place.
  const soft = document.createElement('canvas');
  soft.width = MAP_W;
  soft.height = MAP_H;
  const ctx = soft.getContext('2d', { willReadFrequently: true })!;
  ctx.filter = `blur(${BANK_SOFTEN_M / METRES_PER_UNIT}px)`;
  ctx.drawImage(sharp, 0, 0);
  ctx.filter = 'none';

  maskW = MAP_W;
  maskH = MAP_H;
  pixels = ctx.getImageData(0, 0, MAP_W, MAP_H).data;

  canalMask.texture?.dispose();
  const texture = new CanvasTexture(soft);
  // flipY defaults to TRUE on a CanvasTexture, and that is a real bug here,
  // not a detail: the shader would sample the mask upside down while `isLand`
  // above reads the same pixels the right way up. The two would disagree about
  // where the banks are — you would collide with land you cannot see. Measured
  // it doing exactly that before this line: the terrain came up solid, with
  // the canal rendered mirrored about the map's middle row.
  texture.flipY = false;
  // Linear, and NO mipmaps: mipmapping a mask averages land and water together
  // at distance, which would float phantom half-banks out in the fog.
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  canalMask.texture = texture;
  canalMask.hasMap = true;
  canalMask.version += 1;
}

/**
 * Fetch the saved map and build the mask from it.
 *
 * The server is authoritative, but if it comes back EMPTY this falls back to
 * the browser's own `localStorage` copy — exactly what the map editor already
 * does, and for the same reason: the two are independent backups of the same
 * drawing, and either one going missing shouldn't blank out the other. This
 * matters more here than it looks: it was the actual bug behind the world and
 * the minimap both going blank after the server's `data/canales.json` was
 * cleared during testing, even though the browser's own drawing was untouched
 * the whole time. Without this fallback, that class of problem has no
 * self-healing path — the world stays blank until someone redraws the canal
 * from scratch on the server, when the drawing was sitting right there in the
 * same browser.
 */
export async function loadCanalMask(fetcher: typeof fetch = fetch) {
  try {
    const res = await fetcher('/api/canales');
    if (res.ok) {
      const data = await res.json();
      if (data?.v === 1 && Array.isArray(data.strokes) && data.strokes.length > 0) {
        buildCanalMask(data.strokes);
        applySavedBoat(data);
        return;
      }
    }
  } catch {
    // No server reachable: fall through to the local backup.
  }
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data?.v === 1 && Array.isArray(data.strokes)) buildCanalMask(data.strokes);
    applySavedBoat(data);
  } catch {
    // No local backup either, or it's corrupt: the scene stays open water,
    // which is a fine fallback -- a lake with nothing drawn on it yet.
  }
}

/**
 * Restores wherever the trajinera was left with the map's Trajinera tool, out
 * of the same document the strokes travel in. Only called once, at load --
 * this is not a live sync, so sailing her around afterwards is never
 * overwritten by a stale save arriving late.
 */
function applySavedBoat(data: unknown) {
  const d = data as { boat?: unknown };
  if (!isSavedBoat(d?.boat)) return;
  boat.x = d.boat.x;
  boat.z = d.boat.z;
  boat.heading = d.boat.heading;
  boat.speed = 0;
}
