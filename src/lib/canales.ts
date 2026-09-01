/**
 * The canal map, shared by the 2D drawing tool and the 3D world so both agree
 * on exactly one set of dimensions and one way of painting a stroke. The map
 * page draws it for you to look at; the scene rasterises the same strokes into
 * a land mask and builds terrain from it. If these two ever drew differently,
 * the boat would be sailing a canal that isn't the one on screen.
 */

/** The drawing surface, in map units. */
export const MAP_W = 1600;
export const MAP_H = 1000;
/** Brush width = the width of a canal, in map units. */
export const CANAL_WIDTH = 26;

/**
 * The scale that ties the two worlds together. At 0.5 the brush paints a 13 m
 * channel — a real Xochimilco canal — and the whole map covers 800 × 500 m,
 * which is a believable stretch of the network for an 8 m boat.
 */
export const METRES_PER_UNIT = 0.5;

export const WATER = '#3e7d6c';
export const LAND = '#66854f';

export type Mode = 'canal' | 'tierra';
/** A brush stroke: a flat [x0,y0,x1,y1,…] path in map units. */
export type Stroke = { mode: Mode; points: number[] };

/** Map units → world metres. The map's centre is the world origin. */
export function mapToWorld(mx: number, my: number): { x: number; z: number } {
  return { x: (mx - MAP_W / 2) * METRES_PER_UNIT, z: (my - MAP_H / 2) * METRES_PER_UNIT };
}

/** World metres → map units. */
export function worldToMap(wx: number, wz: number): { x: number; y: number } {
  return { x: wx / METRES_PER_UNIT + MAP_W / 2, y: wz / METRES_PER_UNIT + MAP_H / 2 };
}

/** Paint one segment of a stroke. A zero-length one still stamps a round dot. */
function paintSegment(
  ctx: CanvasRenderingContext2D,
  colour: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number
) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = CANAL_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 === x0 && y1 === y0 ? x1 + 0.01 : x1, y1);
  ctx.stroke();
}

/**
 * Repaint the whole map from its strokes. Land first, then every stroke in
 * order — "tierra" is not an eraser with an alpha channel, it simply paints
 * land back over water, which is exactly what building up a chinampa is.
 *
 * `colours` lets the 3D side reuse this to rasterise a black-and-white land
 * mask instead of the pretty version.
 */
export function paintStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  colours: { land: string; water: string } = { land: LAND, water: WATER }
) {
  ctx.fillStyle = colours.land;
  ctx.fillRect(0, 0, MAP_W, MAP_H);
  for (const s of strokes) {
    const colour = s.mode === 'canal' ? colours.water : colours.land;
    for (let i = 0; i + 3 < s.points.length; i += 2) {
      paintSegment(ctx, colour, s.points[i], s.points[i + 1], s.points[i + 2], s.points[i + 3]);
    }
    if (s.points.length === 2) {
      paintSegment(ctx, colour, s.points[0], s.points[1], s.points[0], s.points[1]);
    }
  }
}

/** Paint just the newest segment, so dragging doesn't repaint the whole map. */
export function paintLatest(
  ctx: CanvasRenderingContext2D,
  mode: Mode,
  x0: number,
  y0: number,
  x1: number,
  y1: number
) {
  paintSegment(ctx, mode === 'canal' ? WATER : LAND, x0, y0, x1, y1);
}
