<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Canvas } from '@threlte/core';
  import LakeScene from '$lib/scene/LakeScene.svelte';
  import { boatInput } from '$lib/scene/boat';
  import { loadCanalMask } from '$lib/scene/canalMask';

  // Pick up whatever is currently drawn on the map, every time we come back to
  // the lake — you can go and re-cut a canal and sail it on your return.
  onMount(loadCanalMask);

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
  onDestroy(releaseAll);
</script>

<svelte:window onkeydown={onKeydown} onkeyup={onKeyup} onblur={releaseAll} />

<div class="lake-stage">
  <Canvas>
    <LakeScene />
  </Canvas>

  <p class="helm">
    <kbd>↑</kbd> impulsar · <kbd>↓</kbd> frenar · <kbd>←</kbd><kbd>→</kbd> timonear
  </p>
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
    pointer-events: none;
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
