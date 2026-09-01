<script lang="ts">
  import { onMount } from 'svelte';
  import { MAP_H, MAP_W, paintStrokes, worldToMap } from '$lib/canales';
  import { boat, boatForward } from '$lib/scene/boat';
  import { canalMask } from '$lib/scene/canalMask';

  /**
   * El mapa de los canales en chiquito, sobre la vista 3D, con la trajinera
   * moviéndose en él.
   *
   * Dibuja los MISMOS trazos que la máscara con la que choca el casco (los
   * toma de `canalMask.strokes`, no de una segunda petición al servidor), así
   * que el punto blanco nunca puede aparecer en tierra según el minimapa
   * mientras el barco navega según otro mapa.
   *
   * El mapa de fondo se pinta una sola vez a un canvas aparte y de ahí se
   * copia; por cuadro solo se redibuja el punto. Repintar 60 veces por segundo
   * un dibujo de cientos de segmentos sería tirar trabajo a la basura.
   */

  const W = 232;
  const H = Math.round((W * MAP_H) / MAP_W); // conserva la proporción del mapa

  let viewEl: HTMLCanvasElement;
  let base: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let drawnVersion = -1;

  function redrawBase() {
    const bctx = base.getContext('2d')!;
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, W, H);
    // Escala el mapa completo al tamaño del minimapa y lo pinta con la misma
    // función que usa la página de Canales, para que se vean idénticos.
    bctx.save();
    bctx.scale(W / MAP_W, H / MAP_H);
    paintStrokes(bctx, canalMask.strokes);
    bctx.restore();
  }

  function frame() {
    if (drawnVersion !== canalMask.version) {
      drawnVersion = canalMask.version;
      redrawBase();
    }

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0);

    const m = worldToMap(boat.x, boat.z);
    const px = (m.x / MAP_W) * W;
    const py = (m.y / MAP_H) * H;

    // Estela: el mapa cubre 800 m en 232 px, así que a 1 m/s la trajinera
    // avanza ~0.3 px por segundo. Sin dejar rastro el punto parece clavado
    // aunque de verdad se esté moviendo.
    const jump = trail.length ? Math.hypot(px - trail.at(-1)![0], py - trail.at(-1)![1]) : 0;
    // Un salto enorme en un cuadro no es navegar: es que la reubicaste con la
    // herramienta Trajinera del mapa. Sin esto, la estela dibuja una recta que
    // cruza el mapa por encima de la tierra, como si hubiera ido por ahí.
    if (jump > 18) trail.length = 0;
    if (!trail.length || jump > 0.8) {
      trail.push([px, py]);
      if (trail.length > 240) trail.shift();
    }
    if (trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(trail[0][0], trail[0][1]);
      for (const [tx, ty] of trail.slice(1)) ctx.lineTo(tx, ty);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // Fuera del mapa dibujado no hay dónde ponerla: mejor no mentir con un
    // punto pegado al borde.
    if (px >= 0 && px <= W && py >= 0 && py <= H) {
      // `boatForward` ya es unitario en mundo, y el minimapa conserva la
      // orientación (world +x -> +px, world +z -> +py), así que sirve tal cual
      // como dirección en pantalla. Antes lo pasaba por la escala del mapa y la
      // espiga salía de 2.6 px, invisible.
      const fwd = boatForward();
      const TICK_PX = 10;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + fwd.x * TICK_PX, py + fwd.z * TICK_PX);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(px, py, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      // Aro oscuro: sobre el agua clara el punto blanco solo se perdería.
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(20, 30, 25, 0.85)';
      ctx.stroke();
    }

    raf = requestAnimationFrame(frame);
  }

  let raf = 0;
  /** Rastro reciente, en píxeles del minimapa. */
  const trail: [number, number][] = [];

  onMount(() => {
    const dpr = window.devicePixelRatio || 1;
    viewEl.width = Math.round(W * dpr);
    viewEl.height = Math.round(H * dpr);
    ctx = viewEl.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    base = document.createElement('canvas');
    base.width = W;
    base.height = H;

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  });
</script>

<div class="minimapa" style="width: {W}px; height: {H}px" aria-label="Mapa de canales">
  <canvas bind:this={viewEl} style="width: {W}px; height: {H}px"></canvas>
</div>

<style>
  .minimapa {
    position: absolute;
    right: 12px;
    bottom: 12px;
    padding: 0;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.6);
    border-radius: 10px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.15),
      0 4px 16px rgba(0, 0, 0, 0.25);
    background: rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    /* Es un indicador: no debe robarle el arrastre a la cámara. */
    pointer-events: none;
    user-select: none;
  }

  canvas {
    display: block;
  }
</style>
