import { json } from '@sveltejs/kit';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isSavedBoat } from '$lib/canales';

/**
 * Persistencia del mapa de canales: los trazos (vectores, no pixeles) viven en
 * un archivo JSON junto a la app — mismo espíritu que el patrón local.db de
 * los otros proyectos: el dato vive donde corre la app, sin motor de base de
 * datos para un solo dibujo. `data/` está gitignoreado, así que en el droplet
 * sobrevive entre deploys igual que un local.db (el repo se reusa, el archivo
 * no se toca).
 */
const FILE = path.resolve('data', 'canales.json');

export async function GET() {
  try {
    return json(JSON.parse(await readFile(FILE, 'utf8')));
  } catch {
    // Sin archivo todavía (o corrupto): mapa en blanco, nunca un 500.
    return json({ v: 1, strokes: [] });
  }
}

export async function PUT({ request }) {
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, { status: 400 });
  }
  const d = data as { v?: number; strokes?: unknown; boat?: unknown };
  if (d?.v !== 1 || !Array.isArray(d.strokes)) {
    return json({ error: 'formato inválido' }, { status: 400 });
  }
  // La posición guardada es opcional (mapas viejos no la traen) y se descarta
  // en silencio si viene mal formada, en vez de rechazar todo el guardado por
  // un campo que ni siquiera es el dibujo.
  const body = JSON.stringify({
    v: 1,
    strokes: d.strokes,
    ...(isSavedBoat(d.boat) ? { boat: d.boat } : {}),
  });
  // Un dibujo de canales son unos KB; megas es señal de algo roto, no de arte.
  if (body.length > 2_000_000) {
    return json({ error: 'demasiado grande' }, { status: 413 });
  }
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, body, 'utf8');
  return json({ ok: true });
}
