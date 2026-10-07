<script setup lang="ts">
// 粒子数滑块（各章粒子舞台共用一个设置）：重建粒子是重操作，拖动时只显示数值，松手才提交
import { ref } from 'vue'
import Bi from './Bi.vue'
import { DENSITY, settings, tx, type BiText } from '../app/settings'
import { UI } from '../devices/pn-junction/sections/ui'

defineProps<{ hint: BiText }>()

const drag = ref<number | null>(null)
function commit() {
  if (drag.value !== null) settings.density = drag.value
  drag.value = null
}
</script>

<template>
  <label class="density" :title="tx(hint)">
    <span><Bi :t="UI.density" /></span>
    <input type="range" :min="DENSITY.min" :max="DENSITY.max" step="10" :value="drag ?? settings.density" @input="drag = +($event.target as HTMLInputElement).value" @change="commit" />
    <output>{{ drag ?? settings.density }}</output>
  </label>
</template>

<style scoped>
.density {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--ink-soft);
}
.density input { width: 96px; }
.density output {
  min-width: 2.4em;
  font-variant-numeric: tabular-nums;
}
</style>
