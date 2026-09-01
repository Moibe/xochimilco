<script lang="ts">
  import { Canvas } from '@threlte/core';
  import EstudioScene from '$lib/scene/EstudioScene.svelte';

  /**
   * El estudio del personaje: un muñequito solo, sobre un tornamesa, para
   * poder verlo bien desde cualquier ángulo. Es el punto de partida para las
   * próximas ediciones — la geometría es exactamente la misma (`chibi.ts`) que
   * usan el trajinero y los pasajeros, así que lo que se ajuste aquí se ve
   * igual en la lancha.
   */

  let autoRotate = $state(true);
  let hat = $state(false);
  let longHair = $state(false);
  let shirt = $state('#f2f0ea');

  const SHIRTS = ['#f2f0ea', '#f3c4c9', '#d6e7c8', '#f7e2ae', '#a9c6de', '#e0a3a0'];
</script>

<div class="studio">
  <Canvas>
    <EstudioScene {autoRotate} {hat} {longHair} {shirt} />
  </Canvas>

  <div class="toolbar">
    <span class="hint">Arrastra para girarlo · rueda para acercar</span>
    <div class="group">
      <button class="ctl" class:is-active={autoRotate} onclick={() => (autoRotate = !autoRotate)}>
        Girar
      </button>
      <button class="ctl" class:is-active={hat} onclick={() => (hat = !hat)}>Sombrero</button>
      <button class="ctl" class:is-active={longHair} onclick={() => (longHair = !longHair)}>
        Pelo largo
      </button>
    </div>
    <div class="group swatches">
      {#each SHIRTS as colour (colour)}
        <button
          class="swatch"
          class:is-active={shirt === colour}
          style="background: {colour}"
          aria-label="Camisa {colour}"
          onclick={() => (shirt = colour)}
        ></button>
      {/each}
    </div>
  </div>
</div>

<style>
  .studio {
    position: absolute;
    inset: 0;
    border-radius: 12px;
    overflow: hidden;
  }

  /* Mismo lenguaje glass que la TopNav y el mapa. */
  .toolbar {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding: 0.45rem 0.85rem;
    background: rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(8px) saturate(110%);
    -webkit-backdrop-filter: blur(8px) saturate(110%);
    border: 1px solid rgba(255, 255, 255, 0.85);
    border-radius: 12px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      0 4px 16px rgba(0, 0, 0, 0.12);
    user-select: none;
    white-space: nowrap;
  }

  .hint {
    font-size: 0.82rem;
    color: #5a5045;
  }

  .group {
    display: flex;
    gap: 0.3rem;
    padding-left: 0.9rem;
    border-left: 1px solid rgba(0, 0, 0, 0.12);
  }

  .ctl {
    padding: 0.32rem 0.7rem;
    font-size: 0.8rem;
    color: #4a4139;
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
  .ctl:hover {
    background: rgba(255, 255, 255, 0.85);
  }
  .ctl.is-active {
    color: #fff;
    background: rgba(37, 99, 235, 0.85);
    border-color: rgba(37, 99, 235, 0.5);
  }

  .swatches {
    gap: 0.25rem;
  }

  .swatch {
    width: 1.15rem;
    height: 1.15rem;
    padding: 0;
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.12s ease, box-shadow 0.12s ease;
  }
  .swatch:hover {
    transform: scale(1.12);
  }
  .swatch.is-active {
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.9);
  }
</style>
