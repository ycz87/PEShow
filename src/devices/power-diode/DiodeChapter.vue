<script setup lang="ts">
// 第 1 章：功率二极管
import { computed, defineAsyncComponent, onMounted, reactive, ref } from 'vue'
import gsap from 'gsap'
import Bi from '../../components/Bi.vue'
import ChapterLayout from '../../components/ChapterLayout.vue'
import SymbolCard from '../../components/SymbolCard.vue'
import PinAppsStage from '../../components/PinAppsStage.vue'
import PinDeviceStage from '../../components/PinDeviceStage.vue'
import PinDilemmaStage from '../../components/PinDilemmaStage.vue'
import PinResultStage from '../../components/PinResultStage.vue'
import PinSectionStage from '../../components/PinSectionStage.vue'
import PinSymbolStage from '../../components/PinSymbolStage.vue'
import PinPackagesStage from '../../components/PinPackagesStage.vue'
// 3D 舞台带着 Three.js，只在进入 1.2 的 3D 步骤时才加载
const Diode3DStage = defineAsyncComponent(() => import('../../components/Diode3DStage.vue'))
import PinVA from '../../components/PinVA.vue'
import PinDropChart from '../../components/PinDropChart.vue'
import { exposeDebug } from '../../app/debug'
import { useSteps } from '../../app/useSteps'
import { CHAPTER } from './sections'
import { UI } from './sections/ui'
import type { PinState, Step } from './sections/types'

const s = reactive<PinState>({ urev: 600, current: 30 })
const stage = ref<{ togglePlay(): void }>()

const { secIdx, stepIdx, step, go, onExtraKey } = useSteps(CHAPTER.sections, enter)

/** 进入一步：按步骤设定电压与电流（数值用补间过渡） */
function enter(st: Step) {
  gsap.killTweensOf(s)
  const to: Partial<PinState> = {}
  if (st.urev !== undefined) to.urev = st.urev
  if (st.current !== undefined) to.current = st.current
  if (Object.keys(to).length) gsap.to(s, { ...to, duration: 1, ease: 'power2.inOut' })
}

function update(p: Partial<PinState>) {
  gsap.killTweensOf(s, Object.keys(p).join(','))
  Object.assign(s, p)
}

/** 结构、反偏、正偏用第 0 章的粒子舞台；换步时同一个舞台连续运行 */
const onDevice = computed(() => ['structure', 'reverse', 'ohmic', 'forward'].includes(step.value.mode))

/** TO-247 与平板压接型两步共用一个 3D 舞台（换步时换模型） */
const on3d = computed(() => ['to247', 'pressfit'].includes(step.value.mode))

/** 二极管符号的导通状态：正偏画面里点亮 */
const conducting = computed(() => step.value.mode === 'forward' || step.value.mode === 'ohmic' || step.value.mode === 'result')

onExtraKey((e) => {
  if (e.key !== ' ') return false
  stage.value?.togglePlay()
  return true
})

onMounted(() => {
  exposeDebug({ goStep: go })
  go(0, 0)
})

const TEXT = {
  crumb: { zh: '第 1 章　功率二极管', en: 'Chapter 1  Power diode' },
  symNote: { zh: '符号与普通二极管相同；阳极 A 接 P⁺，阴极 K 接 N⁺。', en: 'Same symbol as any diode: anode A is P⁺, cathode K is N⁺.' },
  model: { zh: '示例 PiN 二极管为理想化模型（1200 V 级，N⁻ 区 1.3×10¹⁴ cm⁻³、120 µm），参数只为演示规律，不对应具体型号。', en: 'The example PiN diode is an idealised 1200 V model; its parameters illustrate trends and match no real part.' },
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
      <PinDeviceStage v-if="onDevice" ref="stage" :step="step" :s="s" @update="update" />
      <Diode3DStage v-else-if="on3d" ref="stage" :step="step" />
      <PinSectionStage v-else-if="step.mode === 'section'" :step="step" />
      <PinSymbolStage v-else-if="step.mode === 'symbol'" :step="step" />
      <PinPackagesStage v-else-if="step.mode === 'packages'" :step="step" />
      <PinResultStage v-else-if="step.mode === 'result'" ref="stage" :step="step" :s="s" @update="update" />
      <PinDilemmaStage v-else-if="step.mode === 'dilemma'" :step="step" />
      <PinAppsStage v-else-if="step.mode === 'apps'" ref="stage" :step="step" />
      <section v-else class="wip panel"><Bi :t="UI.wip" /></section>
    </template>

    <template #charts>
      <template v-for="c in step.charts" :key="c">
        <PinVA v-if="c === 'va'" :step="step" :s="s" />
        <PinDropChart v-else-if="c === 'drop'" :step="step" :s="s" />
      </template>
    </template>
  </ChapterLayout>
</template>
