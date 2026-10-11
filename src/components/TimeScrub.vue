<script setup lang="ts">
// 1.4 的播放条：播放 / 暂停、从头播放、时间滑块（ns）
import Bi from './Bi.vue'
import type { TimeCursor } from '../app/useTimeCursor'
import { UI_DYN as U } from '../devices/power-diode/sections/uiDyn'

const props = defineProps<{ c: TimeCursor }>()
const ns = (s: number) => Math.round(s * 1e9)
const onInput = (e: Event) => props.c.seek(+(e.target as HTMLInputElement).value * 1e-9)
</script>

<template>
  <div class="scrub">
    <button class="btn primary" @click="c.toggle()"><Bi :t="c.playing.value ? U.pause : U.play" /></button>
    <button class="btn" @click="c.replay()"><Bi :t="U.replay" /></button>
    <label class="bias">
      <span class="bias-name"><Bi :t="U.time" /></span>
      <input type="range" min="0" :max="ns(c.tMax)" step="1" :value="ns(c.t.value)" @input="onInput" />
      <output class="bias-val">{{ ns(c.t.value) }}<small> ns</small></output>
    </label>
    <small class="slow"><Bi :t="U.slow" /></small>
  </div>
</template>

<style scoped>
.scrub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.scrub .bias { flex: 1 1 280px; }
.slow { color: var(--ink-soft); font-size: 0.75rem; }
</style>
