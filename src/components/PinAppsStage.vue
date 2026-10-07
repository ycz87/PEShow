<script setup lang="ts">
// 1.1-1 的舞台：Canvas 2D 画布（应用卡片 + 耐压–电流双对数图）+ 播放控制
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import Bi from './Bi.vue'
import StageTransport from './StageTransport.vue'
import { settings, tx } from '../app/settings'
import { exposeDebug } from '../app/debug'
import { PinRenderer } from '../engine/render/pin/PinRenderer'
import { PIN_LABEL_KEYS, type PinLabels } from '../engine/render/pin/common'
import { PIN_LABELS, UI } from '../devices/power-diode/sections/ui'
import type { Step } from '../devices/power-diode/sections/types'

defineProps<{ step: Step }>()

const host = ref<HTMLDivElement>()
const r = shallowRef<PinRenderer>()
const playing = ref(true)
const SPEEDS = [0.25, 0.5, 1, 2]
const speed = ref(1)
const hostW = ref(0)
/** 画布高度随宽度变化 */
const hostH = computed(() => (hostW.value ? Math.round(Math.min(580, Math.max(430, hostW.value * 0.62))) : 480))

const labels = (): PinLabels => Object.fromEntries(PIN_LABEL_KEYS.map((k) => [k, tx(PIN_LABELS[k])])) as PinLabels

onMounted(async () => {
  hostW.value = host.value!.clientWidth
  const pr = new PinRenderer(host.value!, labels())
  // 等按宽度算出的高度生效后再建画布
  await nextTick()
  if (!host.value) return
  pr.init(settings.style, settings.theme)
  pr.playing = playing.value
  r.value = pr
  ro = new ResizeObserver(() => {
    hostW.value = host.value!.clientWidth
    pr.resize(host.value!.clientWidth, host.value!.clientHeight)
  })
  ro.observe(host.value)
  exposeDebug({ renderer: pr })
})
let ro: ResizeObserver | undefined
onBeforeUnmount(() => {
  ro?.disconnect()
  r.value?.destroy()
})

watch(() => [settings.style, settings.theme] as const, ([s, t]) => r.value?.setStyle(s, t))
watch(() => settings.lang, () => {
  if (r.value) r.value.labels = labels()
})
watch(playing, (p) => { if (r.value) r.value.playing = p })
watch(speed, (s) => { if (r.value) r.value.speed = s })

defineExpose({ togglePlay: () => (playing.value = !playing.value) })
</script>

<template>
  <section class="stage panel">
    <div ref="host" class="canvas-host" :style="{ height: `${hostH}px` }" />

    <div class="stage-bottom">
      <StageTransport v-model:playing="playing" v-model:speed="speed" :speeds="SPEEDS" @replay="r?.reset()" />
    </div>

    <p class="scaled"><Bi :t="UI.scaled[step.mode]" /></p>
  </section>
</template>
