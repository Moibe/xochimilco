<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Canvas } from '@threlte/core';
  import LakeScene from '$lib/scene/LakeScene.svelte';
  import Minimapa from '$lib/Minimapa.svelte';
  import { boatInput } from '$lib/scene/boat';
  import { loadCanalMask } from '$lib/scene/canalMask';
  import { autopilot, releaseAutopilot } from '$lib/scene/autopilot';

  // Pick up whatever is currently drawn on the map (and wherever the
  // Trajinera tool left her) every time we come back to the lake. Gated
  // behind `ready` rather than fired-and-forgotten: LakeScene frames the
  // camera on boat.x/z on its very first frame, and that fetch can resolve
  // a restored position a beat after mount. Mounting the Canvas only once
  // it's done means the very first frame already has the right numbers,
  // instead of framing the old spot and then cutting to the new one.
  let ready = $state(false);
  onMount(async () => {
    await loadCanalMask();
    ready = true;
  });

  /**
   * Keyboard helm. Tracks which arrows are HELD rather than reacting to
   * keydown events: key repeat fires at the OS's rate, not the frame rate, so
   * steering off the repeat would judder and would also stop dead the moment
   * a second key went down. The physics reads these two axes every frame.
   */
  const held = new Set<string>();
  const KEYS: Record<string, [axis: 'forward' | 'turn', value: number]> = {
    ArrowUp: ['forward', 1],
    ArrowDown: ['forward', -1],
    ArrowLeft: ['turn', 1],
    ArrowRight: ['turn', -1],
  };

  function apply() {
    let forward = 0;
    let turn = 0;
    for (const key of held) {
      const [axis, value] = KEYS[key];
      if (axis === 'forward') forward += value;
      else turn += value;
    }
    // Holding both of an opposing pair cancels out, as it should.
    boatInput.forward = Math.max(-1, Math.min(1, forward));
    boatInput.turn = Math.max(-1, Math.min(1, turn));
  }

  function onKeydown(e: KeyboardEvent) {
    if (!(e.key in KEYS) || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault(); // arrows would otherwise scroll the panel
    // Touching the tiller takes her off autopilot — otherwise the two of you
    // write the same input axes every frame and fight over the helm.
    if (autopilot.on) releaseAutopilot();
    held.add(e.key);
    apply();
  }

  function onKeyup(e: KeyboardEvent) {
    if (!(e.key in KEYS)) return;
    held.delete(e.key);
    apply();
  }

  /** Losing focus mid-press never delivers the keyup — she'd steer forever. */
  function releaseAll() {
    held.clear();
    apply();
  }

  // Same hazard on navigation, and it really bites: leave for /canales with a
  // key down and the keyup lands on a page that is no longer listening, so the
  // input axis stays pinned. Measured before this line existed — she came back
  // still turning, heading winding on forever with no way to stop her. The
  // input lives in a module, so it outlives this component and must be cleared.
  onDestroy(() => {
    releaseAll();
    releaseAutopilot();
  });

  let piloting = $state(false);
  function togglePilot() {
    if (autopilot.on) {
      releaseAutopilot();
    } else {
      releaseAll(); // drop any held key so it cannot fight the autopilot
      autopilot.on = true;
    }
    piloting = autopilot.on;
  }
</script>

<svelte:window onkeydown={onKeydown} onkeyup={onKeyup} onblur={releaseAll} />

<div class="lake-stage">
  {#if ready}
    <Canvas>
      <LakeScene />
    </Canvas>

    <Minimapa />
  {/if}

  <div class="helm">
    <span><kbd>↑</kbd> impulsar · <kbd>↓</kbd> frenar · <kbd>←</kbd><kbd>→</kbd> timonear</span>
    <button class="pilot" class:is-active={piloting} onclick={togglePilot}>
      {piloting ? 'Piloto: sigue el canal' : 'Piloto'}
    </button>
  </div>
</div>

<style>
  .lake-stage {
    position: absolute;
    inset: 0;
    border-radius: 12px;
    overflow: hidden;
  }

  .helm {
    position: absolute;
    left: 50%;
    bottom: 12px;
    transform: translateX(-50%);
    margin: 0;
    padding: 0.4rem 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.85);
    white-space: nowrap;
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(8px) saturate(110%);
    -webkit-backdrop-filter: blur(8px) saturate(110%);
    border: 1px solid rgba(255, 255, 255, 0.55);
    border-radius: 10px;
    user-select: none;
  }

  .helm span {
    pointer-events: none;
  }

  .pilot {
    padding: 0.2rem 0.6rem;
    font: inherit;
    font-size: 0.76rem;
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .pilot:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  .pilot.is-active {
    color: #fff;
    background: rgba(37, 99, 235, 0.65);
    border-color: rgba(120, 170, 255, 0.8);
  }

  kbd {
    display: inline-block;
    min-width: 1.15rem;
    padding: 0.05rem 0.2rem;
    font: inherit;
    text-align: center;
    color: #fff;
    background: rgba(255, 255, 255, 0.14);
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 5px;
  }
</style>
