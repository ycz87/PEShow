<script setup lang="ts">
// 1.1-7 小结：回答 1.1-2 的两难。同一个 PiN 上下并排两种状态（都是第 0 章的粒子舞台）：
//  - 截止（反偏）：N⁻ 又淡又厚，是"耐压层"；
//  - 导通（正偏）：N⁻ 被等离子体淹没，是"导电层"。
// 下方的成绩单用 1.1-2 的两个指标比较浓而短、淡而长的普通 PN 结和 PiN，最后点题并预告代价（反向恢复，1.4）
import { computed, ref } from 'vue'
import Bi from './Bi.vue'
import HeatLegend from './HeatLegend.vue'
import StageTransport from './StageTransport.vue'
import DensitySlider from './DensitySlider.vue'
import PinMarks from './PinMarks.vue'
import PinBars, { type BarRow } from './PinBars.vue'
import { fillBi } from '../app/settings'
import { useSlider } from '../app/useSlider'
import { usePinStage } from '../app/usePinStage'
import { BV_PIN, PIN, forward, reverseField, scoreboard } from '../engine/physics/pin'
import type { PinSimBias } from '../engine/physics/pinSim'
import { UI as STAGE_UI } from '../devices/pn-junction/sections/ui'
import { UI } from '../devices/power-diode/sections/ui'
import type { PinState, Step } from '../devices/power-diode/sections/types'

const props = defineProps<{ step: Step; s: PinState }>()
const emit = defineEmits<{ update: [Partial<PinState>] }>()
const C = UI.result
const U_BAR = 1500

const playing = ref(true)
const SPEEDS = [0.25, 0.5, 1, 2]
const speed = ref(1)
const urevSlider = useSlider(() => props.s.urev, (v) => emit('update', { urev: v }))
const curSlider = useSlider(() => props.s.current, (v) => emit('update', { current: v }))

// ───────────── 两个舞台：同一个 PiN 的截止与导通 ─────────────
const biasBlock = (): PinSimBias => ({ mode: 'reverse', urev: props.s.urev, current: props.s.current })
const biasConduct = (): PinSimBias => ({ mode: 'forward', urev: 0, current: props.s.current })
const hostBlock = ref<HTMLDivElement>()
const hostConduct = ref<HTMLDivElement>()
const block = usePinStage({ host: hostBlock, bias: biasBlock, playing, speed, debugKey: 'block' })
const conduct = usePinStage({ host: hostConduct, bias: biasConduct, playing, speed, debugKey: 'conduct' })
const hostH = computed(() => {
  const w = conduct.hostW.value || block.hostW.value
  return w ? Math.round(Math.min(300, Math.max(250, w * 0.4))) : 260
})
function replay() {
  block.replay()
  conduct.replay()
}
defineExpose({ togglePlay: () => (playing.value = !playing.value) })

// ───────────── 读数（模型） ─────────────
const rev = computed(() => reverseField(props.s.urev))
const st = computed(() => forward(props.s.current / PIN.A))
const fmtV = (v: number) => (v < 10 ? v.toFixed(2) : v.toFixed(v < 100 ? 1 : 0))
const fmtW = (p: number) => (p < 100 ? p.toFixed(0) : (Math.round(p / 10) * 10).toString())
const blockLine = computed(() => fillBi(C.blockLine, { w: (rev.value.w * 1e4).toFixed(0), u: props.s.urev.toFixed(0), bv: BV_PIN.toFixed(0) }))
const conductLine = computed(() => fillBi(C.conductLine, { i: props.s.current.toFixed(0), um: fmtV(st.value.UM), u: fmtV(st.value.U) }))
const panels = computed(() => [
  { key: 'block', title: C.block, line: blockLine.value, s: block, host: hostBlock },
  { key: 'conduct', title: C.conduct, line: conductLine.value, s: conduct, host: hostConduct },
])

// ───────────── 成绩单（固定额定 30 A） ─────────────
const board = scoreboard()
const NAMES = { dense: C.dense, light: C.light, pin: C.pin }
const rowsOf = (val: (r: (typeof board)[number]) => number, max: number, text: (v: number) => string, color: (k: string) => string): BarRow[] =>
  board.map((r) => ({ key: r.key, label: NAMES[r.key], text: text(val(r)), f: Math.min(1, val(r) / max), color: color(r.key), strong: r.key === 'pin' }))
const colorOf = (good: string, bad: string) => (k: string) => (k === 'pin' ? '--accent' : k === 'dense' ? good : bad)
const bvRows = rowsOf((r) => r.bv, U_BAR, (v) => `${v.toFixed(0)} V`, (k) => (k === 'dense' ? '--danger' : k === 'pin' ? '--accent' : '--field'))
const uRows = rowsOf((r) => r.u, 45, (v) => `${fmtV(v)} V`, colorOf('--field', '--danger'))
const heatRows = rowsOf((r) => r.p, board[1].p * 1.05, (v) => `${fmtW(v)} W`, colorOf('--heat-out', '--heat-out'))
const dense = board[0]
const light = board[1]
const boardNote = fillBi(C.boardNote, { bd: dense.bv.toFixed(0), ud: fmtV(dense.u), ul: fmtV(light.u) })
</script>

<template>
  <section class="stage panel">
    <div v-for="p in panels" :key="p.key" class="dev">
      <div class="dev-head">
        <b class="dev-title"><Bi :t="p.title" /></b>
        <span class="dev-live"><Bi :t="p.line" /></span>
      </div>
      <div :ref="(el) => (p.host.value = el as HTMLDivElement)" class="canvas-host" :style="{ height: `${hostH}px` }">
        <div v-if="p.s.L.value" class="overlay" aria-hidden="true">
          <PinMarks :L="p.s.L.value" :depl="p.s.depl.value" :counts="p.s.counts.value" />
        </div>
      </div>
      <div class="stage-bottom">
        <label v-if="p.key === 'block'" class="bias rev">
          <span class="bias-name"><Bi :t="UI.urev" /></span>
          <input type="range" min="0" :max="Math.floor(BV_PIN)" step="10" :value="urevSlider.shown" @input="urevSlider.input" @change="urevSlider.release" />
          <output class="bias-val">{{ s.urev.toFixed(0) }}<small> V</small></output>
        </label>
        <label v-else class="bias fwd">
          <span class="bias-name"><Bi :t="UI.current" /></span>
          <input type="range" min="1" max="90" step="1" :value="curSlider.shown" @input="curSlider.input" @change="curSlider.release" />
          <output class="bias-val">{{ s.current.toFixed(0) }}<small> A</small></output>
        </label>
      </div>
    </div>

    <div class="result">
      <b class="board-title"><Bi :t="C.boardTitle" /></b>
      <div class="board">
        <PinBars :title="C.bvName" :rows="bvRows" :marker="s.urev / U_BAR" />
        <PinBars :title="C.uName" :rows="uRows" />
        <PinBars :title="C.heatName" :rows="heatRows" />
      </div>
      <p class="note"><Bi :t="boardNote" /></p>
      <div class="both">
        <p class="both-end"><Bi :t="C.insight" /></p>
        <p class="cost"><Bi :t="C.cost" /></p>
      </div>
    </div>

    <ul class="legend">
      <li><i class="lg-dot e" /><Bi :t="STAGE_UI.legend.electron" /></li>
      <li><i class="lg-dot h" /><Bi :t="STAGE_UI.legend.hole" /></li>
      <HeatLegend />
      <li v-if="conduct.ratio.value" class="weight"><Bi :t="fillBi(UI.ratio, { s: (conduct.ratio.value.stage * 100).toFixed(0), r: (conduct.ratio.value.real * 100).toFixed(1), k: Math.round(conduct.ratio.value.stage / conduct.ratio.value.real) })" /></li>
    </ul>

    <div class="stage-bottom">
      <StageTransport v-model:playing="playing" v-model:speed="speed" :speeds="SPEEDS" @replay="replay">
        <template #end><DensitySlider :hint="UI.densityHint" /></template>
      </StageTransport>
      <span class="rated"><Bi :t="C.rated" /> 30 A（100 A/cm²）</span>
    </div>

    <p class="scaled"><Bi :t="UI.scaled[step.mode]" /></p>
  </section>
</template>

<style scoped>
.result {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--ink) 5%, transparent);
}
.board-title { font-size: 0.95rem; }
.board {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 12px 24px;
}
.note {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.55;
  color: var(--ink-soft);
}
.both {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--accent) 55%, transparent);
}
.both p { margin: 0; font-size: 0.9rem; line-height: 1.5; }
.both .both-end { font-weight: 800; color: var(--accent); }
.both .cost { font-size: 0.82rem; color: var(--ink-soft); }
.legend .weight { font-style: italic; }
.rated {
  font-size: 0.8rem;
  color: var(--ink-soft);
}
</style>
