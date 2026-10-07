<script setup lang="ts">
// PiN 器件舞台（1.1 结构、反偏、正偏）：第 0 章的粒子舞台跑 PinSim（见 usePinStage），
// 画布上方是各区名称与外电路计数器，下方是与器件对齐的电场图 / 浓度图、播放控制与滑块
import { computed, ref } from 'vue'
import Bi from './Bi.vue'
import TraceCard from './TraceCard.vue'
import HeatLegend from './HeatLegend.vue'
import StageTransport from './StageTransport.vue'
import DensitySlider from './DensitySlider.vue'
import CurrentMeter from './CurrentMeter.vue'
import PinMarks from './PinMarks.vue'
import PinProfile from './PinProfile.vue'
import { fillBi, tx } from '../app/settings'
import { useSlider } from '../app/useSlider'
import { usePinStage } from '../app/usePinStage'
import type { PinSimBias } from '../engine/physics/pinSim'
import { stageHeight } from '../engine/render/layout'
import { BV_PIN, I_SAT_OHMIC, PIN, forward, ohmicDrop, reverseField } from '../engine/physics/pin'
import { Q } from '../engine/physics/pn'
import { sci } from '../engine/render/pin/common'
import { UI as STAGE_UI } from '../devices/pn-junction/sections/ui'
import { UI } from '../devices/power-diode/sections/ui'
import type { PinState, Step } from '../devices/power-diode/sections/types'

const props = defineProps<{ step: Step; s: PinState }>()
const emit = defineEmits<{ update: [Partial<PinState>] }>()
const has = (t: Step['tools'][number]) => props.step.tools.includes(t)

const host = ref<HTMLDivElement>()
const playing = ref(true)
const SPEEDS = [0.25, 0.5, 1, 2]
const speed = ref(1)
const tracing = ref(false)

/** 舞台上的偏置：结构这一步零偏；反偏、正偏（假想没有空穴注入 / 真实的空穴注入）各一种 */
const bias = computed<PinSimBias>(() => {
  const m = props.step.mode
  const mode = m === 'reverse' || m === 'ohmic' || m === 'forward' ? m : 'eq'
  return { mode, urev: props.s.urev, current: props.s.current }
})

/** N⁻ 区空穴分布的粒子统计（p/N_D），约 1.5 s 平滑；换电流或偏置方式时从当前分布重新开始 */
const DOT_BINS = 16
const dots = ref<number[]>([])
let dotAcc: Float64Array | null = null
let dotKey = ''

const { r, L, hostW, counts, trace, weight, ratio, current, depl, replay } = usePinStage({
  host,
  bias: () => bias.value,
  playing,
  speed,
  tracing,
  onReset() {
    // 重新开始：等离子体从空的 N⁻ 区重新建立，浓度图的圆点也从零开始
    dotAcc = null
    dots.value = []
  },
  onPoll(s) {
    if (s.bias.mode !== 'forward') return
    const h = s.holeProfile(DOT_BINS)
    const key = String(s.bias.current)
    if (!dotAcc || key !== dotKey) {
      dotAcc = h
      dotKey = key
    }
    for (let k = 0; k < DOT_BINS; k++) dotAcc[k] += (h[k] - dotAcc[k]) * 0.2
    dots.value = Array.from(dotAcc)
  },
})
const NO_LAYERS = { field: false, potential: false, conc: false, band: false }
const hostH = computed(() => (hostW.value ? stageHeight(hostW.value, NO_LAYERS) : 480))

// ───────────── 滑块 ─────────────
const urevSlider = useSlider(() => props.s.urev, (v) => emit('update', { urev: v }))
const curSlider = useSlider(() => props.s.current, (v) => emit('update', { current: v }))

// ───────────── 读数（模型） ─────────────
const rev = computed(() => (props.step.mode === 'reverse' ? reverseField(props.s.urev) : null))
const fwd = computed(() => {
  const m = props.step.mode
  if (m !== 'forward' && m !== 'ohmic') return null
  const J = props.s.current / PIN.A
  const st = forward(J)
  // 没有空穴注入时电子的平均速度 v = J/(qN_D)（真实比例），与饱和速度之比
  const v = J / (Q * PIN.ND)
  return { J, U: st.U, Uj: st.Uj, UM: st.UM, ohm: ohmicDrop(J), v, vFrac: v / PIN.vsat }
})

defineExpose({ togglePlay: () => (playing.value = !playing.value) })

const weightText = computed(() => fillBi(UI.weight, { k: weight.value.toFixed(1) }))
/** 舞台上等离子体与 P⁺ 的浓度比被放大了多少倍（示意要写明） */
const ratioText = computed(() => {
  const r0 = ratio.value
  if (!r0) return null
  const pct = (x: number) => (x * 100 < 10 ? (x * 100).toFixed(1) : (x * 100).toFixed(0))
  return fillBi(UI.ratio, { s: pct(r0.stage), r: pct(r0.real), k: Math.round(r0.stage / r0.real) })
})
const hypoText = computed(() => (fwd.value ? fillBi(UI.hypo.body, { v: sci(fwd.value.v, 1), p: (fwd.value.vFrac * 100).toFixed(0), i: I_SAT_OHMIC.toFixed(0) }) : null))
</script>

<template>
  <section class="stage panel">
    <div class="stage-top">
      <p v-if="rev" class="ro">
        <span><Bi :t="UI.ro.w" /> <b>{{ (rev.w * 1e4).toFixed(0) }}</b> µm</span>
        <span><Bi :t="UI.ro.emax" /> <b class="fld">{{ sci(rev.E1, 2) }}</b> V/cm</span>
        <span><Bi :t="UI.ro.bv" /> <b>{{ BV_PIN.toFixed(0) }}</b> V</span>
      </p>
      <p v-else-if="fwd" class="ro">
        <span><Bi :t="UI.ro.j" /> <b>{{ fwd.J.toFixed(0) }}</b> A/cm²</span>
        <template v-if="step.mode === 'forward'">
          <span><Bi :t="UI.ro.uf" /> <b class="acc">{{ fwd.U.toFixed(2) }}</b> V</span>
          <span>= <Bi :t="UI.ro.uj" /> <b>{{ fwd.Uj.toFixed(2) }}</b> V</span>
          <span>+ <Bi :t="UI.ro.um" /> <b>{{ fwd.UM.toFixed(2) }}</b> V</span>
        </template>
        <template v-else>
          <span><Bi :t="UI.ro.ohm" /> <b class="danger">{{ fwd.ohm.toFixed(1) }}</b> V</span>
          <span><Bi :t="UI.ro.vel" /> <b>{{ sci(fwd.v, 1) }}</b> cm/s（<Bi :t="UI.ro.satFrac" /> {{ (fwd.vFrac * 100).toFixed(0) }} %）</span>
        </template>
      </p>
      <span v-else />
    </div>

    <div ref="host" class="canvas-host" :style="{ height: `${hostH}px` }">
      <div v-if="L" class="overlay" aria-hidden="true">
        <PinMarks :L="L" :depl="depl" :counts="counts" :structure="step.mode === 'structure'" />
        <span v-if="step.mode === 'ohmic' && hypoText" class="dop-note hypo" :style="{ left: `${L.devX0 + L.devW * 0.5}px`, top: `${L.devY0 + L.devH - 10}px`, maxWidth: `${Math.max(260, L.devW * 0.8)}px` }">
          <b><Bi :t="UI.hypo.title" /></b> <Bi :t="hypoText" />
        </span>
        <TraceCard
          v-if="tracing && trace"
          :trace="trace"
          :style="{ left: `${trace.x < 0.5 ? L.width - L.devX0 - 10 : L.devX0 + 10}px`, top: `${L.devY0 + 10}px` }"
        />
      </div>
    </div>

    <PinProfile
      v-if="L && step.mode !== 'structure'"
      :view="bias.mode === 'forward' || bias.mode === 'ohmic' ? 'conc' : 'field'"
      :mode="bias.mode"
      :urev="s.urev"
      :current="s.current"
      :x0="L.devX0"
      :w="L.devW"
      :width="L.width"
      :dots="dots"
    />

    <ul class="legend">
      <li><i class="lg-dot e" /><Bi :t="STAGE_UI.legend.electron" /></li>
      <li><i class="lg-dot h" /><Bi :t="STAGE_UI.legend.hole" /></li>
      <HeatLegend />
      <li><span class="beads" aria-hidden="true"><i class="lg-dot e small" /><i class="lg-dot e small" /><i class="lg-dot e small" /></span><Bi :t="STAGE_UI.legend.bead" /></li>
      <li v-if="bias.mode === 'forward' && weight > 1.05" class="weight" :title="tx(UI.weightHint)"><Bi :t="weightText" /></li>
      <li v-if="ratioText" class="weight"><Bi :t="ratioText" /></li>
    </ul>

    <div class="stage-bottom">
      <StageTransport v-model:playing="playing" v-model:speed="speed" :speeds="SPEEDS" @replay="replay">
        <template v-if="has('trace')">
          <button class="btn" :aria-pressed="tracing" @click="tracing = !tracing"><Bi :t="tracing ? STAGE_UI.trace.stop : UI.trace" /></button>
          <button v-if="tracing" class="btn" @click="r?.nextTrace()"><Bi :t="STAGE_UI.trace.next" /></button>
        </template>
        <template #end><DensitySlider :hint="UI.densityHint" /></template>
      </StageTransport>

      <label v-if="has('urev')" class="bias rev">
        <span class="bias-name"><Bi :t="UI.urev" /></span>
        <input type="range" min="0" :max="Math.floor(BV_PIN)" step="10" :value="urevSlider.shown" @input="urevSlider.input" @change="urevSlider.release" />
        <output class="bias-val">{{ s.urev.toFixed(0) }}<small> V</small></output>
      </label>

      <label v-if="has('current')" class="bias fwd">
        <span class="bias-name"><Bi :t="UI.current" /></span>
        <input type="range" min="1" max="90" step="1" :value="curSlider.shown" @input="curSlider.input" @change="curSlider.release" />
        <output class="bias-val">{{ s.current.toFixed(0) }}<small> A</small></output>
      </label>

      <CurrentMeter v-if="has('current')" :value="current" :name="UI.flow" :hint="UI.flowHint" />
    </div>

    <p class="scaled"><Bi :t="UI.scaled[step.mode]" /></p>
  </section>
</template>

<style scoped>
.stage-top { min-height: 1.6em; }
.legend .weight { font-style: italic; }
.beads { display: inline-flex; gap: 2px; }
</style>
