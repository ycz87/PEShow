<script setup lang="ts">
// 1.3-4 两只同型号二极管并联：一只 25 °C、一只结温 t，两端电压相同，总电流怎样分。
// 低于温度交点时热的那只分得多（可能热失控），高于交点时热的那只分得少（自动均流）
import { computed, ref } from 'vue'
import Bi from './Bi.vue'
import { fillBi, tx } from '../app/settings'
import { T_REF_PIN, crossover, terminalU } from '../engine/physics/pin'
import { UI_STATIC } from '../devices/power-diode/sections/uiStatic'

const props = defineProps<{ t: number }>()
const U = UI_STATIC.temp
const total = ref(30)

/** 两只两端电压相同：解 U(i冷, 25 °C) = U(总 − i冷, t) */
const split = computed(() => {
  const I = total.value
  let lo = 1e-6
  let hi = I - 1e-6
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2
    if (terminalU(mid, T_REF_PIN) < terminalU(I - mid, props.t)) lo = mid
    else hi = mid
  }
  const cold = (lo + hi) / 2
  return { cold, hot: I - cold, u: terminalU(cold, T_REF_PIN) }
})

const verdict = computed(() => {
  const d = split.value.hot - split.value.cold
  if (props.t === T_REF_PIN || Math.abs(d) < 0.05) return { t: U.same, cls: '' }
  return d > 0 ? { t: U.hog, cls: 'danger' } : { t: U.share, cls: 'ok' }
})
const ix = computed(() => crossover(props.t))

// 画布（viewBox 520 × 140）：左右两条母线，中间上下两条支路
const XL = 70
const XR = 450
const YS = [44, 112]
const width = (i: number) => 2 + (i / 80) * 10
</script>

<template>
  <div class="par">
    <svg viewBox="0 0 520 140" role="img" :aria-label="tx(U.s3)">
      <g class="wire">
        <path :d="`M20 78 H${XL} M${XR} 78 H500`" :style="{ strokeWidth: width(total / 2) + 2 }" />
        <path :d="`M${XL} ${YS[0]} V${YS[1]} M${XR} ${YS[0]} V${YS[1]}`" />
      </g>
      <g v-for="(yy, k) in YS" :key="k" :class="['branch', k ? 'hot' : 'cold']">
        <path :d="`M${XL} ${yy} H230 M290 ${yy} H${XR}`" :style="{ strokeWidth: width(k ? split.hot : split.cold) }" class="bw" />
        <path :d="`M240 ${yy - 14} V${yy + 14} L268 ${yy} Z`" class="tri" />
        <path :d="`M270 ${yy - 15} V${yy + 15}`" class="bar" />
        <text x="255" :y="yy - 20" text-anchor="middle" class="lab">{{ k ? tx(fillBi(U.hot, { t })) : tx(U.cold) }}</text>
        <text :x="XR - 10" :y="yy - 8" text-anchor="end" class="val">{{ (k ? split.hot : split.cold).toFixed(1) }} A</text>
      </g>
      <text x="22" y="68" class="val">{{ total }} A</text>
      <text x="505" y="128" text-anchor="end" class="u">U = {{ split.u.toFixed(2) }} V</text>
    </svg>
    <label class="bias fwd">
      <span class="bias-name"><Bi :t="U.total" /></span>
      <input v-model.number="total" type="range" min="4" max="160" step="2" />
      <output class="bias-val">{{ total }}<small> A</small></output>
    </label>
    <p class="pst-state" :class="verdict.cls">
      <Bi :t="verdict.t" />
      <span v-if="ix">（{{ tx(fillBi(U.each, { x: ix.toFixed(0), i: (total / 2).toFixed(0) })) }}）</span>
    </p>
  </div>
</template>

<style scoped>
.par { display: flex; flex-direction: column; gap: 8px; }
.par svg { display: block; width: 100%; height: auto; }
.par .bias { flex: 0 0 auto; min-width: 0; }
.wire path { fill: none; stroke: var(--ink); stroke-width: 2.4; stroke-linecap: round; }
.bw { fill: none; stroke-linecap: round; transition: stroke-width 0.15s; }
.cold .bw { stroke: var(--potential); }
.hot .bw { stroke: var(--danger); }
.tri { fill: color-mix(in srgb, var(--ink) 12%, transparent); stroke: var(--ink); stroke-width: 2.4; stroke-linejoin: round; }
.bar { stroke: var(--ink); stroke-width: 2.6; }
.lab { font-size: 12px; font-weight: 700; fill: var(--ink-soft); }
.cold .val { fill: var(--potential); }
.hot .val { fill: var(--danger); }
.val { font-size: 14px; font-weight: 800; fill: var(--ink); font-variant-numeric: tabular-nums; }
.u { font-size: 12px; fill: var(--ink-soft); }
.pst-state.ok { background: color-mix(in srgb, var(--accent) 16%, transparent); }
</style>
