<script setup lang="ts">
// 第 0 章：半导体基础（PN 结）
import { computed, onMounted, reactive, shallowRef, ref } from 'vue'
import gsap from 'gsap'
import Bi from '../../components/Bi.vue'
import ChapterLayout from '../../components/ChapterLayout.vue'
import SymbolCard from '../../components/SymbolCard.vue'
import JunctionStage from '../../components/JunctionStage.vue'
import LatticeStage from '../../components/LatticeStage.vue'
import NiChart from '../../components/NiChart.vue'
import VICurve from '../../components/VICurve.vue'
import CVChart from '../../components/CVChart.vue'
import ScopeChart from '../../components/ScopeChart.vue'
import TestCircuit from '../../components/TestCircuit.vue'
import TrajectoryChart from '../../components/TrajectoryChart.vue'
import BreakdownStage from '../../components/BreakdownStage.vue'
import ZenerChart from '../../components/ZenerChart.vue'
import { exposeDebug } from '../../app/debug'
import { useSteps } from '../../app/useSteps'
import type { AcSignal } from '../../app/acSignal'
import type { SwitchLive } from '../../app/switching'
import type { BreakdownLive } from '../../app/breakdown'
import { CHAPTER } from './sections'
import { UI } from './sections/ui'
import type { Step } from './sections/types'
import { PN } from '../../engine/physics/pn'
import { sampleAt } from '../../engine/physics/recovery'
import { CONC, type Dopant } from '../../engine/physics/doping'

/** V：外加电压（V）；T：温度（°C） */
const state = reactive({ V: 0, T: 25, formation: 1, resetKey: 0 })
/** 晶格场景（0.1–0.2）的杂质与浓度 log₁₀(N / cm⁻³)：进入每一步时按该步设定重置，之后可由舞台工具修改 */
const lat = reactive<{ dopant: Dopant; logN: number }>({ dopant: 'none', logN: CONC.def })
/** 当前舞台（PN 结舞台或晶格舞台）暴露的方法 */
const stage = ref<{ togglePlay(): void; cycleView?(): void }>()

const { secIdx, stepIdx, section, step, go, onExtraKey } = useSteps(CHAPTER.sections, enter)
const vRange = computed<[number, number]>(() => step.value.vRange ?? [PN.Vmin, PN.Vmax])

function enter(s: Step, prev: Step) {
  if (s.lattice) Object.assign(lat, { dopant: s.lattice.dopant, logN: s.lattice.conc ?? CONC.def })
  gsap.killTweensOf(state)
  // 换场景时温度直接到位：晶格场景从 0 K 开始，而 PN 结模型只在 TEMP 范围内有效
  // （0 K 附近 n_i 下溢为 0、U_bi 为无穷大，舞台挂载时布置的粒子坐标会变成 NaN）
  const T = s.T ?? 25
  if (s.scene !== prev.scene) state.T = T
  else gsap.to(state, { T, duration: 1.2, ease: 'power2.inOut' })
  if (s.formation) {
    startFormation()
    return
  }
  gsap.to(state, { formation: 1, duration: 0.6 })
  const [lo, hi] = vRange.value
  const V = s.bias ?? Math.min(hi, Math.max(lo, state.V))
  gsap.to(state, { V, duration: 1.4, ease: 'power2.inOut' })
}

/** "接触瞬间"：回到零偏、无内建电场，粒子重新布置，再让空间电荷区逐渐建立（进入该步与"重新开始"共用） */
function startFormation() {
  gsap.killTweensOf(state, 'V,formation')
  state.V = 0
  state.formation = 0
  state.resetKey++
  gsap.to(state, { formation: 1, duration: 7, delay: 1.2, ease: 'power1.inOut' })
}

/** 舞台上叠加的交流小信号（0.7），由舞台每帧更新；关闭时为 null */
const ac = shallowRef<AcSignal | null>(null)
/** 开关过程（0.8），由舞台每帧更新；不在开关步骤时为 null */
const sw = shallowRef<SwitchLive | null>(null)
/** 反向击穿（0.6）的工作点与结温，由舞台更新 */
const bd = shallowRef<BreakdownLive | null>(null)
/** 二极管符号的导通状态：开关过程中看此刻的端电压 */
const conducting = computed(() => (sw.value ? sampleAt(sw.value.w, sw.value.t).v : state.V) > 0.45)

function setV(v: number) {
  gsap.killTweensOf(state, 'V')
  const [lo, hi] = vRange.value
  state.V = Math.min(hi, Math.max(lo, v))
  if (state.formation < 1) {
    gsap.killTweensOf(state, 'formation')
    state.formation = 1
  }
}

function setT(t: number) {
  gsap.killTweensOf(state, 'T')
  state.T = t
}

onExtraKey((e) => {
  if (e.key === ' ') stage.value?.togglePlay()
  else if (e.key === 'v' || e.key === 'V') stage.value?.cycleView?.()
  else return false
  return true
})

onMounted(() => {
  // 调试：在后台标签页（requestAnimationFrame 暂停）中手动推进补间动画与舞台
  let simT = 0
  exposeDebug({
    advance(sec: number) {
      const fps = 30
      for (let i = 0; i < Math.round(sec * fps); i++) {
        simT += 1 / fps
        gsap.updateRoot(gsap.ticker.time + simT)
      }
      const r = window.__pdvl?.renderer as { advance(s: number, fps: number): void; bundle?: { current: number } } | undefined
      r?.advance(sec, fps)
      return { V: state.V, T: state.T, formation: state.formation, I: r?.bundle?.current }
    },
    goStep: go,
  })
  go(0, 0)
})

const TEXT = {
  crumb: { zh: '第 0 章　半导体基础', en: 'Chapter 0  Semiconductor basics' },
  symNote: { zh: '电流从阳极 A 流向阴极 K；P 区接 A，N 区接 K。', en: 'Current flows from anode A to cathode K. P side is A, N side is K.' },
  model: { zh: '示例 PN 结为理想化模型，参数只为演示规律，不对应具体型号。', en: 'The example PN junction is an idealised model; its parameters illustrate trends and match no real part.' },
}
</script>

<template>
  <ChapterLayout
    :content="CHAPTER"
    :crumb="TEXT.crumb"
    :sec-idx="secIdx"
    :step-idx="stepIdx"
    :model-note="TEXT.model"
    :has-charts="step.charts.length > 0"
    @go="go"
  >
    <template #symbol>
      <SymbolCard :conducting="conducting" :note="TEXT.symNote" />
    </template>

    <template #stage>
      <JunctionStage
        v-if="step.scene === 'junction'"
        ref="stage"
        :step="step"
        :V="state.V"
        :T="state.T"
        :v-range="vRange"
        :formation="state.formation"
        :reset-key="state.resetKey"
        @update:V="setV"
        @update:T="setT"
        @update:ac="ac = $event"
        @update:sw="sw = $event"
        @replay="startFormation"
      />
      <LatticeStage
        v-else-if="step.scene === 'lattice'"
        ref="stage"
        :step="step"
        :T="state.T"
        :dopant="lat.dopant"
        :log-n="lat.logN"
        @update:T="setT"
        @update:dopant="lat.dopant = $event"
        @update:logN="lat.logN = $event"
      />
      <BreakdownStage
        v-else-if="step.scene === 'breakdown'"
        ref="stage"
        :step="step"
        :T="state.T"
        @update:T="setT"
        @update:bd="bd = $event"
      />
      <section v-else class="wip panel"><Bi :t="UI.wip" /></section>
    </template>

    <template #charts>
      <template v-for="c in step.charts" :key="c">
        <VICurve v-if="c === 'vi'" :V="state.V" :T="state.T" :unlock="section.vi ?? 'full'" :step="step" :ac="ac" @update:V="setV" />
        <CVChart v-else-if="c === 'cv'" :V="state.V" :T="state.T" :step="step" :v-range="vRange" :ac="ac" @update:V="setV" />
        <ScopeChart v-else-if="c === 'scope'" :live="sw" />
        <ScopeChart v-else-if="c === 'scopeOn' || c === 'scopeOff'" :live="sw" :fixed="c === 'scopeOn' ? 'on' : 'off'" />
        <TestCircuit v-else-if="c === 'circuit'" :live="sw" />
        <TrajectoryChart v-else-if="c === 'trajectory'" :live="sw" />
        <ZenerChart v-else-if="c === 'zener'" :live="bd" />
        <NiChart v-else-if="c === 'ni'" :T="state.T" :dopant="lat.dopant" :log-n="lat.logN" @update:T="setT" />
        <section v-else class="wip panel"><Bi :t="UI.wip" /></section>
      </template>
    </template>
  </ChapterLayout>
</template>
