<script lang="ts">
  import { onMount } from 'svelte';
  import {
    CANAL_WIDTH,
    LAND,
    MAP_H,
    MAP_W,
    METRES_PER_UNIT,
    STORE_KEY,
    isSavedBoat,
    mapToWorld,
    paintLatest,
    paintStrokes,
    worldToMap,
    type Mode,
    type Stroke,
  } from '$lib/canales';
  import { boat, boatForward } from '$lib/scene/boat';

  /**
   * El mapa de los canales, y el timón de la trajinera.
   *
   * Dibujas con un pincel del ancho de un canal; el modo Tierra la repone (la
   * goma ES pintar tierra encima). El punto blanco es la trajinera: muestra
   * dónde está en el mundo 3D, y con la herramienta Trajinera la mueves a
   * donde quieras. Lo que dibujes aquí es literalmente el terreno de la vista
   * 3D — las mismas medidas y los mismos trazos, vía `$lib/canales`.
   *
   * Los trazos viven como VECTORES, no como pixeles: el canvas es solo la
   * vista. De ahí salen gratis el deshacer y una persistencia de unos KB.
   */

  /** Distancia mínima entre puntos guardados — evita trazos de mil puntos. */
  const MIN_SEGMENT = 2.5;

  type Tool = Mode | 'trajinera';

  let tool = $state<Tool>('canal');
  let strokeCount = $state(0);
  let confirmClear = $state(false);
  /** Posición de la lancha en unidades de mapa, para dibujar el punto. */
  let boatMap = $state(worldToMap(boat.x, boat.z));

  let hostEl: HTMLDivElement;
  let viewEl: HTMLCanvasElement;

  // Estado imperativo del dibujo — nada de esto necesita reactividad.
  let strokes: Stroke[] = [];
  let world!: HTMLCanvasElement;
  let wctx!: CanvasRenderingContext2D;
  let vctx!: CanvasRenderingContext2D;
  let scale = 1;
  let ox = 0;
  let oy = 0;
  let cursor: { x: number; y: number } | null = null; // px CSS de la vista
  let drawing = false;

  function redrawWorld() {
    paintStrokes(wctx, strokes);
  }

  function drawView() {
    const w = viewEl.clientWidth;
    const h = viewEl.clientHeight;
    vctx.clearRect(0, 0, w, h);

    const mw = MAP_W * scale;
    const mh = MAP_H * scale;
    vctx.save();
    vctx.beginPath();
    vctx.roundRect(ox, oy, mw, mh, 14);
    vctx.clip();
    vctx.drawImage(world, ox, oy, mw, mh);
    vctx.restore();

    vctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    vctx.lineWidth = 1.5;
    vctx.beginPath();
    vctx.roundRect(ox, oy, mw, mh, 14);
    vctx.stroke();

    drawBoat();

    // Anillo del pincel: se ve el ancho del canal ANTES de soltarlo.
    if (cursor && tool !== 'trajinera') {
      const r = (CANAL_WIDTH / 2) * scale;
      vctx.beginPath();
      vctx.arc(cursor.x, cursor.y, r, 0, Math.PI * 2);
      vctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      vctx.lineWidth = 1.6;
      if (tool === 'tierra') vctx.setLineDash([5, 4]);
      vctx.stroke();
      vctx.setLineDash([]);
      vctx.beginPath();
      vctx.arc(cursor.x, cursor.y, r + 1.4, 0, Math.PI * 2);
      vctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      vctx.lineWidth = 1;
      vctx.stroke();
    }
  }

  /** La trajinera: punto blanco con una espiga que apunta a su proa. */
  function drawBoat() {
    const px = ox + boatMap.x * scale;
    const py = oy + boatMap.y * scale;

    // La proa: el rumbo 0 mira a -Z, que en el mapa es hacia arriba.
    const fwd = boatForward();
    const len = 13 * scale;
    vctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    vctx.lineWidth = 2;
    vctx.lineCap = 'round';
    vctx.beginPath();
    vctx.moveTo(px, py);
    vctx.lineTo(px + (fwd.x / METRES_PER_UNIT) * len, py + (fwd.z / METRES_PER_UNIT) * len);
    vctx.stroke();

    vctx.beginPath();
    vctx.arc(px, py, 5.5, 0, Math.PI * 2);
    vctx.fillStyle = '#ffffff';
    vctx.fill();
    // Aro oscuro: sobre agua clara el punto blanco solo se perdería.
    vctx.lineWidth = 1.6;
    vctx.strokeStyle = 'rgba(20, 30, 25, 0.85)';
    vctx.stroke();
  }

  function layout() {
    const w = hostEl.clientWidth;
    const h = hostEl.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    viewEl.width = Math.round(w * dpr);
    viewEl.height = Math.round(h * dpr);
    vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Encuadre contain, centrado, con un respiro para la toolbar.
    const PAD = 14;
    const TOP = 64;
    scale = Math.min((w - PAD * 2) / MAP_W, (h - TOP - PAD) / MAP_H);
    ox = (w - MAP_W * scale) / 2;
    oy = TOP + (h - TOP - PAD - MAP_H * scale) / 2;
    drawView();
  }

  function toMap(e: PointerEvent) {
    const r = viewEl.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    return {
      cx,
      cy,
      mx: Math.min(MAP_W, Math.max(0, (cx - ox) / scale)),
      my: Math.min(MAP_H, Math.max(0, (cy - oy) / scale)),
      inside: cx >= ox && cx <= ox + MAP_W * scale && cy >= oy && cy <= oy + MAP_H * scale,
    };
  }

  /** Mueve la trajinera del mundo 3D a este punto del mapa. */
  function placeBoat(mx: number, my: number) {
    const w = mapToWorld(mx, my);
    boat.x = w.x;
    boat.z = w.z;
    // Sin esto llegaría al lugar nuevo todavía navegando a la velocidad que
    // llevaba, y se saldría sola del canal donde la acabas de poner.
    boat.speed = 0;
    boatMap = { x: mx, y: my };
    drawView();
  }

  function save() {
    // La posición de la trajinera viaja en el MISMO documento que los trazos:
    // es un solo dibujo, y guardarlos por separado abriría la puerta a que
    // uno se actualice y el otro no.
    const payload = JSON.stringify({
      v: 1,
      strokes,
      boat: { x: boat.x, z: boat.z, heading: boat.heading },
    });
    // localStorage primero: instantáneo y funciona sin red. El servidor es la
    // copia fuerte (sobrevive a limpiar el navegador y se comparte entre
    // navegadores); si el PUT falla, el respaldo local ya quedó.
    try {
      localStorage.setItem(STORE_KEY, payload);
    } catch {
      // Sin almacenamiento (modo privado, etc.): el servidor sigue guardando.
    }
    fetch('/api/canales', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: payload,
    }).catch(() => {
      // Sin servidor (offline): localStorage ya tiene el dibujo.
    });
  }

  /** Aplica una posición guardada al singleton del barco, si es válida. */
  function applyBoat(data: unknown) {
    const d = data as { boat?: unknown };
    if (!isSavedBoat(d?.boat)) return;
    boat.x = d.boat.x;
    boat.z = d.boat.z;
    boat.heading = d.boat.heading;
    // Sin esto aparecería en el punto guardado pero todavía "navegando" a la
    // velocidad que llevaba cuando se guardó — mismo motivo que en placeBoat.
    boat.speed = 0;
    boatMap = worldToMap(boat.x, boat.z);
  }

  async function load() {
    // El servidor es la fuente autoritativa. Si viene VACÍO, se cae a
    // localStorage a propósito: así el dibujo hecho antes de que existiera el
    // endpoint migra solo — se carga del respaldo local y el siguiente
    // guardado lo sube.
    try {
      const res = await fetch('/api/canales');
      if (res.ok) {
        const data = await res.json();
        if (data?.v === 1 && Array.isArray(data.strokes) && data.strokes.length > 0) {
          strokes = data.strokes;
          applyBoat(data);
          return;
        }
      }
    } catch {
      // Sin red: probamos el respaldo local.
    }
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data?.v === 1 && Array.isArray(data.strokes)) strokes = data.strokes;
      applyBoat(data);
    } catch {
      // Datos corruptos: se empieza con el mapa en blanco.
    }
  }

  function onPointerDown(e: PointerEvent) {
    const p = toMap(e);
    if (!p.inside || e.button !== 0) return;
    viewEl.setPointerCapture(e.pointerId);
    cursor = { x: p.cx, y: p.cy };

    if (tool === 'trajinera') {
      drawing = true; // arrastrar la reubica de forma continua
      placeBoat(p.mx, p.my);
      return;
    }

    drawing = true;
    strokes.push({ mode: tool, points: [p.mx, p.my] });
    paintLatest(wctx, tool, p.mx, p.my, p.mx, p.my);
    strokeCount = strokes.length;
    drawView();
  }

  function onPointerMove(e: PointerEvent) {
    const p = toMap(e);
    cursor = p.inside || drawing ? { x: p.cx, y: p.cy } : null;

    if (drawing && tool === 'trajinera') {
      placeBoat(p.mx, p.my);
      return;
    }

    if (drawing) {
      const s = strokes[strokes.length - 1];
      const n = s.points.length;
      const lx = s.points[n - 2];
      const ly = s.points[n - 1];
      if (Math.hypot(p.mx - lx, p.my - ly) >= MIN_SEGMENT) {
        s.points.push(p.mx, p.my);
        paintLatest(wctx, s.mode, lx, ly, p.mx, p.my);
      }
    }
    drawView();
  }

  function onPointerUp() {
    if (!drawing) return;
    drawing = false;
    // Antes esto solo guardaba trazos nuevos — mover la trajinera nunca se
    // persistía, así que sobrevivía a un cambio de página (el estado sigue en
    // memoria) pero no a una recarga de verdad.
    save();
  }

  function onPointerLeave() {
    cursor = null;
    drawView();
  }

  function undo() {
    if (!strokes.length) return;
    strokes.pop();
    strokeCount = strokes.length;
    redrawWorld();
    drawView();
    save();
  }

  function clearAll() {
    strokes = [];
    strokeCount = 0;
    confirmClear = false;
    redrawWorld();
    drawView();
    save();
  }

  function onKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    }
  }

  onMount(() => {
    world = document.createElement('canvas');
    world.width = MAP_W;
    world.height = MAP_H;
    wctx = world.getContext('2d')!;
    vctx = viewEl.getContext('2d')!;

    // La lancha pudo haber navegado desde la última visita.
    boatMap = worldToMap(boat.x, boat.z);

    // Lienzo en blanco de inmediato; el dibujo guardado llega en cuanto
    // responde el servidor (o el respaldo local) y se repinta.
    redrawWorld();
    const ro = new ResizeObserver(layout);
    ro.observe(hostEl);
    layout();
    load().then(() => {
      strokeCount = strokes.length;
      redrawWorld();
      drawView();
    });
    return () => ro.disconnect();
  });
</script>

<svelte:window onkeydown={onKeydown} />

<div class="map-stage" bind:this={hostEl}>
  <canvas
    bind:this={viewEl}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    onpointerleave={onPointerLeave}
  ></canvas>

  <div class="toolbar">
    <span class="hint">
      {tool === 'trajinera' ? 'Arrastra el punto para mover la trajinera' : 'Arrastra para dibujar'}
    </span>
    <div class="group" role="radiogroup" aria-label="Herramienta">
      <button class="ctl" class:is-active={tool === 'canal'} onclick={() => (tool = 'canal')}>
        Canal
      </button>
      <button class="ctl" class:is-active={tool === 'tierra'} onclick={() => (tool = 'tierra')}>
        Tierra
      </button>
      <button
        class="ctl"
        class:is-active={tool === 'trajinera'}
        onclick={() => (tool = 'trajinera')}
      >
        Trajinera
      </button>
    </div>
    <div class="group">
      <button class="ctl" disabled={strokeCount === 0} onclick={undo}>Deshacer</button>
      <button class="ctl" disabled={strokeCount === 0} onclick={() => (confirmClear = true)}>
        Limpiar
      </button>
    </div>
  </div>

  {#if confirmClear}
    <div class="overlay" role="dialog" aria-modal="true" aria-label="Confirmar limpiar mapa">
      <div class="modal">
        <p class="modal-title">¿Borrar todo el mapa?</p>
        <p class="modal-body">Se pierden los {strokeCount} trazos dibujados. No hay vuelta atrás.</p>
        <div class="modal-actions">
          <button class="ctl" onclick={() => (confirmClear = false)}>Cancelar</button>
          <button class="ctl danger" onclick={clearAll}>Borrar todo</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .map-stage {
    position: absolute;
    inset: 0;
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    cursor: crosshair;
    touch-action: none;
  }

  /* Toolbar glass, mismo lenguaje que la TopNav. */
  .toolbar {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding: 0.45rem 0.85rem;
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(8px) saturate(110%);
    -webkit-backdrop-filter: blur(8px) saturate(110%);
    border: 1px solid rgba(255, 255, 255, 0.85);
    border-radius: 12px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 4px 16px rgba(0, 0, 0, 0.12);
    user-select: none;
    white-space: nowrap;
  }

  .hint {
    font-size: 0.82rem;
    color: rgba(255, 255, 255, 0.85);
  }

  .group {
    display: flex;
    gap: 0.3rem;
    padding-left: 0.9rem;
    border-left: 1px solid rgba(255, 255, 255, 0.18);
  }

  .ctl {
    padding: 0.32rem 0.7rem;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.88);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
  .ctl:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }
  .ctl:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .ctl.is-active {
    color: #fff;
    background: rgba(37, 99, 235, 0.22);
    border-color: rgba(37, 99, 235, 0.5);
    box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.18) inset;
  }
  .ctl.danger:hover:not(:disabled) {
    background: rgba(220, 60, 60, 0.28);
    border-color: rgba(255, 120, 120, 0.6);
  }

  /* Modal de confirmación — nunca el confirm() nativo. */
  .overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.32);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    border-radius: 12px;
  }

  .modal {
    min-width: 300px;
    padding: 1.1rem 1.25rem;
    background: rgba(30, 40, 48, 0.72);
    backdrop-filter: blur(10px) saturate(110%);
    -webkit-backdrop-filter: blur(10px) saturate(110%);
    border: 1px solid rgba(255, 255, 255, 0.85);
    border-radius: 16px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 8px 32px rgba(0, 0, 0, 0.35);
  }

  .modal-title {
    margin: 0 0 0.35rem;
    font-size: 1rem;
    font-weight: 600;
    color: #fff;
  }

  .modal-body {
    margin: 0 0 0.9rem;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.4rem;
  }
</style>
