<script setup lang="ts">
// 舞台播放控制：播放 / 暂停、重新开始、倍速。默认插槽放各舞台自己的按钮（在倍速前），end 插槽放在最后
import Bi from './Bi.vue'
import { tx } from '../app/settings'
import { COMMON_UI as UI } from '../devices/common/ui'

defineProps<{ speeds: number[] }>()
const emit = defineEmits<{ replay: [] }>()
const playing = defineModel<boolean>('playing', { required: true })
const speed = defineModel<number>('speed', { required: true })
</script>

<template>
  <div class="transport">
    <button class="btn primary" :aria-label="playing ? tx(UI.pause) : tx(UI.play)" @click="playing = !playing">
      <svg v-if="playing" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="1" width="3.6" height="12" rx="1.2" fill="currentColor" /><rect x="8.4" y="1" width="3.6" height="12" rx="1.2" fill="currentColor" /></svg>
      <svg v-else width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5 L12.5 7 L3 12.5 Z" fill="currentColor" /></svg>
      <Bi :t="playing ? UI.pause : UI.play" />
    </button>
    <button class="btn" @click="emit('replay')"><Bi :t="UI.replay" /></button>
    <slot />
    <div class="seg speed" role="group" :aria-label="tx(UI.speed)">
      <button v-for="s in speeds" :key="s" :aria-pressed="speed === s" @click="speed = s">{{ s }}×</button>
    </div>
    <slot name="end" />
  </div>
</template>
