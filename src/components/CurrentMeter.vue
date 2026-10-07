<script setup lang="ts">
// 舞台控制条上的电流计：对数刻度，便于同时看清大电流和小电流。读数是舞台上的粒子流（个/秒），样式见 styles/stage.css
import { computed } from 'vue'
import Bi from './Bi.vue'
import { tx, type BiText } from '../app/settings'

const props = defineProps<{ value: number; name: BiText; hint?: BiText }>()

const text = computed(() => `${props.value >= 0 ? '+' : '−'}${Math.abs(props.value).toFixed(1)}`)
const fill = computed(() => {
  const m = Math.min(1, Math.log10(1 + Math.abs(props.value)) / Math.log10(60))
  return props.value >= 0 ? m : -m
})
const pct = (v: number) => `${v * 100}%`
</script>

<template>
  <div class="meter" :title="tx(hint ?? name)">
    <span class="meter-name"><Bi :t="name" /></span>
    <div class="meter-bar">
      <i class="zero" />
      <i
        class="fill"
        :class="fill >= 0 ? 'pos' : 'neg'"
        :style="fill >= 0 ? { left: '50%', width: pct(fill / 2) } : { right: '50%', width: pct(-fill / 2) }"
      />
    </div>
    <output class="meter-val">{{ text }} /s</output>
  </div>
</template>
