<script lang="ts">
  import { onMount } from 'svelte';

  /**
   * El mapa de los canales: una herramienta de dibujo sencilla. Un solo pincel
   * del ancho de un canal que se arrastra sobre la "tierra" para abrir agua, y
   * un modo Tierra que la repone (la goma ES pintar tierra encima — no hay
   * canal alpha ni composite raro).
   *
   * El dibujo vive como VECTORES (lista de trazos con sus puntos), no como
   * pixeles: el canvas es solo la vista. De ahí salen gratis el deshacer
   * (pop del último trazo + repintado) y la persistencia (JSON chico en
   * localStorage, no un dataURL gordo). Todo ocurre sobre un lienzo-mundo de
   * tamaño fijo, así que el ancho del canal es constante sin importar el
   * tamaño de la ventana, y un resize solo re-encuadra.
   *
   * Por ahora es independiente del mundo 3D; el formato de trazos queda listo
   * para algún día extruir estos canales en la escena.
   */

  const WORLD_W = 1600;
  const WORLD_H = 1000;
  /** Ancho del pincel = ancho de un canal, en unidades del mundo. */
  const CANAL_WIDTH = 26;
  /** Mismo tono que el agua de la escena 3D, para que se sientan un mundo. */
  const WATER = '#3e7d6c';
  const LAND = '#66854f';
  const STORE_KEY = 'xochimilco:canales:v1';
  /** Distancia mínima entre puntos guardados — evita trazos de mil puntos. */
  const MIN_SEGMENT = 2.5;

  type Mode = 'canal' | 'tierra';
  type Stroke = { mode: Mode; points: number[] }; // plano [x0,y0,x1,y1,...]

  let mode = $state<Mode>('canal');
  let strokeCount = $state(0);
  let confirmClear = $state(false);

  let hostEl: HTMLDivElement;
  let viewEl: HTMLCanvasElement;

  // Estado imperativo del dibujo — nada de esto necesita reactividad de Svelte.
  let strokes: Stroke[] = [];
  let world!: HTMLCanvasElement;
  let wctx!: CanvasRenderingContext2D;
  let vctx!: CanvasRenderingContext2D;
  let scale = 1;
  let ox = 0;
  let oy = 0;
  let cursor: { x: number; y: number } | null = null; // en px CSS de la vista
  let drawing = false;

  function strokeStyleFor(m: Mode) {
    return m === 'canal' ? WATER : LAND;
  }

  /** Pinta un tramo (o un punto suelto) de un trazo sobre el lienzo-mundo. */
  function paintSegment(m: Mode, x0: number, y0: number, x1: number, y1: number) {
    wctx.strokeStyle = strokeStyleFor(m);
    wctx.lineWidth = CANAL_WIDTH;
    wctx.lineCap = 'round';
    wctx.lineJoin = 'round';
    wctx.beginPath();
    wctx.moveTo(x0, y0);
    // Un "punto" también pasa por aquí: el cap redondo estampa el círculo.
    wctx.lineTo(x1 === x0 && y1 === y0 ? x1 + 0.01 : x1, y1);
    wctx.stroke();
  }

  function redrawWorld() {
    wctx.fillStyle = LAND;
    wctx.fillRect(0, 0, WORLD_W, WORLD_H);
    for (const s of strokes) {
      for (let i = 0; i + 3 < s.points.length; i += 2) {
        paintSegment(s.mode, s.points[i], s.points[i + 1], s.points[i + 2], s.points[i + 3]);
      }
      if (s.points.length === 2) {
        paintSegment(s.mode, s.points[0], s.points[1], s.points[0], s.points[1]);
      }
    }
  }

  function drawView() {
    const w = viewEl.clientWidth;
    const h = viewEl.clientHeight;
    vctx.clearRect(0, 0, w, h);

    const mw = WORLD_W * scale;
    const mh = WORLD_H * scale;
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

    // Anillo del pincel: se ve el ancho del canal ANTES de soltarlo.
    if (cursor) {
      const r = (CANAL_WIDTH / 2) * scale;
      vctx.beginPath();
      vctx.arc(cursor.x, cursor.y, r, 0, Math.PI * 2);
      vctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      vctx.lineWidth = 1.6;
      if (mode === 'tierra') vctx.setLineDash([5, 4]);
      vctx.stroke();
      vctx.setLineDash([]);
      vctx.beginPath();
      vctx.arc(cursor.x, cursor.y, r + 1.4, 0, Math.PI * 2);
      vctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      vctx.lineWidth = 1;
      vctx.stroke();
    }
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
    scale = Math.min((w - PAD * 2) / WORLD_W, (h - TOP - PAD) / WORLD_H);
    ox = (w - WORLD_W * scale) / 2;
    oy = TOP + (h - TOP - PAD - WORLD_H * scale) / 2;
    drawView();
  }

  function toWorld(e: PointerEvent) {
    const r = viewEl.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    return {
      cx,
      cy,
      wx: Math.min(WORLD_W, Math.max(0, (cx - ox) / scale)),
      wy: Math.min(WORLD_H, Math.max(0, (cy - oy) / scale)),
      inside:
        cx >= ox && cx <= ox + WORLD_W * scale && cy >= oy && cy <= oy + WORLD_H * scale,
    };
  }

  function save() {
    const payload = JSON.stringify({ v: 1, strokes });
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
    } catch {
      // Datos corruptos: se empieza con el mapa en blanco.
    }
  }

  function onPointerDown(e: PointerEvent) {
    const p = toWorld(e);
    if (!p.inside || e.button !== 0) return;
    drawing = true;
    viewEl.setPointerCapture(e.pointerId);
    strokes.push({ mode, points: [p.wx, p.wy] });
    paintSegment(mode, p.wx, p.wy, p.wx, p.wy);
    strokeCount = strokes.length;
    cursor = { x: p.cx, y: p.cy };
    drawView();
  }

  function onPointerMove(e: PointerEvent) {
    const p = toWorld(e);
    cursor = p.inside || drawing ? { x: p.cx, y: p.cy } : null;
    if (drawing) {
      const s = strokes[strokes.length - 1];
      const n = s.points.length;
      const lx = s.points[n - 2];
      const ly = s.points[n - 1];
      if (Math.hypot(p.wx - lx, p.wy - ly) >= MIN_SEGMENT) {
        s.points.push(p.wx, p.wy);
        paintSegment(s.mode, lx, ly, p.wx, p.wy);
      }
    }
    drawView();
  }

  function onPointerUp() {
    if (!drawing) return;
    drawing = false;
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
    world.width = WORLD_W;
    world.height = WORLD_H;
    wctx = world.getContext('2d')!;
    vctx = viewEl.getContext('2d')!;

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
    <span class="hint">Mapa de canales — arrastra para dibujar</span>
    <div class="group" role="radiogroup" aria-label="Modo de pincel">
      <button class="ctl" class:is-active={mode === 'canal'} onclick={() => (mode = 'canal')}>
        Canal
      </button>
      <button class="ctl" class:is-active={mode === 'tierra'} onclick={() => (mode = 'tierra')}>
        Tierra
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
