<script setup lang="ts">
// 1.1-2 普通 PN 结的两难：浓而短、淡而长两个普通 PN 结（P⁺N，N 区直接接阴极）并排，都是第 0 章的粒子舞台
// （PinSim plain，见 usePinStage），用同一把尺（每微米像素相同），短的就画得短。两个大标签页切换两种考验：
//  - ① 加反向电压：同一个逐渐升高的电压，浓而短的先击穿
//  - ② 通大电流：同样的电流密度（只算欧姆电阻），淡而长的压降大、发热多
// 电场三角形与"面积就是电压"留到 1.1-4（P⁺N⁻N⁺ 如何耐压）再讲
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import Bi from './Bi.vue'
import HeatLegend from './HeatLegend.vue'
import StageTransport from './StageTransport.vue'
import DensitySlider from './DensitySlider.vue'
import PinMarks from './PinMarks.vue'
import PinBars, { type BarRow } from './PinBars.vue'
import { fillBi, tx, type BiText } from '../app/settings'
import { useSlider } from '../app/useSlider'
import { usePinStage } from '../app/usePinStage'
import { PIN, ohmicDrop, oneSidedJunction } from '../engine/physics/pin'
import { Q } from '../engine/physics/pn'
import type { PinGeometry, PinSimBias } from '../engine/physics/pinSim'
import { sci } from '../engine/render/pin/common'
import { UI as STAGE_UI } from '../devices/pn-junction/sections/ui'
import { UI } from '../devices/power-diode/sections/ui'
import type { Step } from '../devices/power-diode/sections/types'

const props = defineProps<{ step: Step }>()
const C = UI.dilemma

/** 浓而短：10¹⁵，厚度刚好容纳击穿时的耗尽层（约 20 µm，耐压约 300 V）；淡而长：1.3×10¹⁴、120 µm（约 1390 V） */
const DJ = oneSidedJunction(1e15)
const LJ = oneSidedJunction(PIN.ND)
const DENSE: PinGeometry = { ND: DJ.N, W: DJ.W }
const LIGHT: PinGeometry = { ND: PIN.ND, W: PIN.W }
const J = 100
/** 额定电流 30 A（芯片 0.3 cm²，100 A/cm²） */
const CURRENT = J * PIN.A
const U_MAX = 1500
/** 升压速度（V/s）：约 14 s 升到 1500 V */
const RAMP = 110

type Test = 'block' | 'conduct'
const test = ref<Test>('block')
/** 两种考验各看过没有：没看过的标签页会闪动，提醒别漏掉 */
const seen = reactive<Record<Test, boolean>>({ block: true, conduct: false })
const other = computed<Test>(() => (test.value === 'block' ? 'conduct' : 'block'))
const playing = ref(true)
const SPEEDS = [0.25, 0.5, 1, 2]
const speed = ref(1)

// ───────────── 反向电压：自动升压，拖动滑块时停下 ─────────────
const u = ref(0)
const ramping = ref(true)
let raf = 0
let last = 0
function tick(t: number) {
  raf = requestAnimationFrame(tick)
  const dt = last ? Math.min(0.1, (t - last) / 1000) : 0
  last = t
  if (test.value !== 'block' || !ramping.value || !playing.value) return
  u.value = Math.min(U_MAX, u.value + RAMP * dt * speed.value)
  if (u.value >= U_MAX) ramping.value = false
}
raf = requestAnimationFrame(tick)
onBeforeUnmount(() => cancelAnimationFrame(raf))
const uSlider = useSlider(() => u.value, (v) => {
  ramping.value = false
  u.value = v
})

const biasOf = (): PinSimBias => (test.value === 'block' ? { mode: 'reverse', urev: u.value, current: 0 } : { mode: 'ohmic', urev: 0, current: CURRENT })

// ───────────── 两个舞台 ─────────────
const hostD = ref<HTMLDivElement>()
const hostL = ref<HTMLDivElement>()
const d = usePinStage({ host: hostD, geo: DENSE, plain: true, bias: biasOf, playing, speed, debugKey: 'dense' })
const l = usePinStage({ host: hostL, geo: LIGHT, plain: true, bias: biasOf, playing, speed, debugKey: 'light' })
const hostH = computed(() => {
  const w = l.hostW.value || d.hostW.value
  return w ? Math.round(Math.min(300, Math.max(240, w * 0.34))) : 270
})

function replay() {
  u.value = 0
  ramping.value = true
  d.replay()
  l.replay()
}
watch(() => props.step.id, replay)
watch(test, (t) => {
  seen[t] = true
  replay()
})

// ───────────── 两个结的数值（模型） ─────────────
interface Dev {
  key: 'dense' | 'light'
  geo: PinGeometry
  title: BiText
  bv: number
  /** 只算欧姆电阻：电子平均速度 v = J/(qn)、N 区压降 U、额定电流下的发热功率 */
  v: number
  U: number
  P: number
}
const dev = (key: Dev['key'], geo: PinGeometry, bv: number, U: number): Dev => ({ key, geo, title: key === 'dense' ? C.dense : C.light, bv, v: J / (Q * geo.ND), U, P: U * CURRENT })
const devs: Dev[] = [
  dev('dense', DENSE, DJ.BV, DJ.drop),
  // 淡而长的压降与 1.1-5 的读数一致（低掺杂迁移率 1414）
  dev('light', LIGHT, LJ.BV, ohmicDrop(J)),
]
const spec = (x: Dev) => fillBi(C.spec, { n: sci(x.geo.ND, 1), w: (x.geo.W * 1e4).toFixed(0) })
const stages = computed(() => [
  { x: devs[0], s: d, host: hostD, broken: test.value === 'block' && u.value >= devs[0].bv },
  { x: devs[1], s: l, host: hostL, broken: test.value === 'block' && u.value >= devs[1].bv },
])
const fmtV = (v: number) => (v < 10 ? v.toFixed(2) : v.toFixed(0))
const fmtW = (p: number) => (p < 100 ? p.toFixed(0) : (Math.round(p / 10) * 10).toString())

// ───────────── 结果条 ─────────────
const rowsOf = (val: (x: Dev) => number, max: number, text: (v: number) => string, color: string): BarRow[] =>
  devs.map((x) => ({ key: x.key, label: x.title, text: text(val(x)), f: Math.min(1, val(x) / max), color }))
const bvRows = rowsOf((x) => x.bv, U_MAX, (v) => `${fmtV(v)} V`, '--field')
const dropRows = rowsOf((x) => x.U, 45, (v) => `${fmtV(v)} V`, '--danger')
const heatRows = rowsOf((x) => x.P, devs[1].P * 1.05, (v) => `${fmtW(v)} W`, '--heat-out')
const blockVerdict = fillBi(C.blockVerdict, { k: (devs[1].bv / devs[0].bv).toFixed(1) })
const conductVerdict = fillBi(C.conductVerdict, { n: (devs[1].v / devs[0].v).toFixed(1), l: (LIGHT.W / DENSE.W).toFixed(0), k: (devs[1].U / devs[0].U).toFixed(0) })
const whyLow = fillBi(C.whyLow, { a: fmtW(devs[0].P), b: fmtW(devs[1].P), ud: fmtV(devs[0].U), ul: fmtV(devs[1].U) })
</script>

<template>
  <section class="stage panel">
    <div class="tests" role="tablist" :aria-label="tx(C.test)">
      <button
        v-for="t in (['block', 'conduct'] as const)"
        :key="t"
        role="tab"
        class="test"
        :class="{ on: test === t, fresh: !seen[t] }"
        :aria-selected="test === t"
        @click="test = t"
      >
        <span class="test-tag"><Bi :t="C[t].tag" /></span>
        <b class="test-title"><Bi :t="C[t].title" /></b>
        <small><Bi :t="C[t].sub" /></small>
        <i v-if="!seen[t]" class="new"><Bi :t="C.new" /></i>
      </button>
    </div>

    <p class="ro">
      <span v-if="test === 'block'"><Bi :t="C.sameU" /> <b class="fld">{{ u.toFixed(0) }}</b> V</span>
      <span v-else><Bi :t="C.sameJ" /> <b class="acc">{{ J }}</b> A/cm²（{{ CURRENT }} A）</span>
    </p>

    <div v-for="st in stages" :key="st.x.key" class="dev">
      <div class="dev-head">
        <b class="dev-title"><Bi :t="st.x.title" /></b>
        <span><Bi :t="spec(st.x)" /></span>
        <span v-if="test === 'conduct'" class="dev-live">
          <Bi :t="C.speed" /> <b>{{ sci(st.x.v, 1) }}</b> cm/s · <Bi :t="C.drop" /> <b class="danger">{{ fmtV(st.x.U) }}</b> V · <Bi :t="C.heat" /> <b class="danger">{{ fmtW(st.x.P) }}</b> W
        </span>
      </div>
      <div :ref="(el) => (st.host.value = el as HTMLDivElement)" class="canvas-host" :style="{ height: `${hostH}px` }">
        <div v-if="st.s.L.value" class="overlay" aria-hidden="true">
          <PinMarks :L="st.s.L.value" :xa="st.s.xa.value" :xk="st.s.xk.value" :depl="st.s.depl.value" :counts="st.s.counts.value" :n-name="UI.regions.n" />
          <span v-if="st.broken" class="broke" :style="{ left: `${st.s.L.value.devX0 + st.s.L.value.devW / 2}px`, top: `${st.s.L.value.devY0 + st.s.L.value.devH / 2}px` }">
            <Bi :t="C.broke" />
          </span>
        </div>
      </div>
    </div>

    <div class="result">
      <template v-if="test === 'block'">
        <PinBars :title="C.bvName" :rows="bvRows" :marker="u / U_MAX">
          <p class="verdict"><Bi :t="blockVerdict" /></p>
        </PinBars>
      </template>
      <template v-else>
        <PinBars :title="C.dropName" :rows="dropRows">
          <p class="verdict"><Bi :t="conductVerdict" /></p>
        </PinBars>
        <PinBars :title="C.heatName" :rows="heatRows" />
        <p class="why"><b><Bi :t="C.whyLowTitle" /></b> <Bi :t="whyLow" /></p>
      </template>
      <button v-if="!seen[other]" class="next" @click="test = other"><Bi :t="C[other].next" /></button>
      <p v-else class="dilemma"><Bi :t="C.dilemma" /></p>
    </div>

    <ul class="legend">
      <li><i class="lg-dot e" /><Bi :t="STAGE_UI.legend.electron" /></li>
      <li><i class="lg-dot h" /><Bi :t="STAGE_UI.legend.hole" /></li>
      <HeatLegend />
    </ul>

    <div class="stage-bottom">
      <StageTransport v-model:playing="playing" v-model:speed="speed" :speeds="SPEEDS" @replay="replay">
        <template #end><DensitySlider :hint="UI.densityHint" /></template>
      </StageTransport>
      <label v-if="test === 'block'" class="bias rev">
        <span class="bias-name"><Bi :t="UI.urev" /></span>
        <input type="range" min="0" :max="U_MAX" step="10" :value="uSlider.shown" @input="uSlider.input" @change="uSlider.release" />
        <output class="bias-val">{{ u.toFixed(0) }}<small> V</small></output>
      </label>
    </div>

    <p class="scaled"><Bi :t="UI.scaled[step.mode]" /></p>
  </section>
</template>

<style scoped>
.tests {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.test {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 14px;
  border-radius: 14px;
  border: 2.5px solid color-mix(in srgb, var(--ink) 25%, transparent);
  background: color-mix(in srgb, var(--ink) 4%, transparent);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  font: inherit;
}
.test-tag {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--ink-soft);
}
.test-title {
  font-family: var(--font-display);
  font-size: 1.2rem;
  line-height: 1.2;
}
.test small { font-size: 0.78rem; color: var(--ink-soft); }
.test.on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}
.test.on .test-tag { color: var(--accent); }
.test.fresh { animation: fresh 1.2s ease-in-out infinite; }
@keyframes fresh { 50% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent) 45%, transparent); } }
.test .new {
  position: absolute;
  top: -9px;
  right: 10px;
  padding: 0 0.6em;
  border-radius: 999px;
  font-style: normal;
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1.6;
  color: #fff;
  background: var(--danger);
}
@media (max-width: 560px) {
  .tests { grid-template-columns: 1fr; }
}

.result {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--ink) 5%, transparent);
}
.verdict,
.dilemma,
.why {
  margin: 2px 0 0;
  font-size: 0.9rem;
}
.verdict { font-weight: 700; }
.dilemma { font-weight: 700; color: var(--accent); }
.why {
  padding: 8px 10px;
  border-radius: 10px;
  line-height: 1.55;
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  border: 1.5px dashed color-mix(in srgb, var(--danger) 55%, transparent);
}
.next {
  align-self: flex-start;
  padding: 0.5em 1.2em;
  border-radius: 999px;
  border: 2.5px solid var(--accent);
  background: var(--accent);
  color: #fff;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  animation: fresh 1.2s ease-in-out infinite;
}
</style>
