<script lang="ts">
  import { Canvas } from '@threlte/core';
  import LakeScene from '$lib/scene/LakeScene.svelte';
</script>

<div class="lake-stage">
  <Canvas>
    <LakeScene />
  </Canvas>
</div>

<style>
  .lake-stage {
    position: absolute;
    inset: 0;
    border-radius: 12px;
    overflow: hidden;
  }
</style>
