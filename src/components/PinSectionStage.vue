<script setup lang="ts">
// 1.2-2 剖面图：芯片竖着切开的样子。
//  上半：两列芯片叠层（示例 PiN 与真实穿通型产品），滑块在真实比例与 1.1 舞台的压缩比例之间拖动；点一层看说明
//  下半：芯片边缘的终端结构示意（没有终端 / 场限环 / 斜角）
// 排版数据在 devices/power-diode/sectionLayers.ts，文字在 sections/uiSection.ts
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import gsap from 'gsap'
import Bi from './Bi.vue'
import PinCutLocator from './PinCutLocator.vue'
import PinSectionLayers from './PinSectionLayers.vue'
import PinTermination from './PinTermination.vue'
import { UI } from '../devices/power-diode/sections/ui'
import { UI_SECTION as U, type TermId } from '../devices/power-diode/sections/uiSection'
import type { LayerId } from '../devices/power-diode/sectionLayers'
import type { Step } from '../devices/power-diode/sections/types'

const props = defineProps<{ step: Step }>()

const t = ref(0)
const selected = ref<LayerId | null>(null)
const term = ref<TermId>('none')
const TERMS: TermId[] = ['none', 'rings', 'bevel']

let tween: gsap.core.Tween | undefined
function slideTo(to: number) {
  tween?.kill()
  const o = { v: t.value }
  tween = gsap.to(o, { v: to, duration: 1.4, ease: 'power2.inOut', onUpdate: () => (t.value = o.v) })
}
function onSlide(e: Event) {
  tween?.kill()
  t.value = +(e.target as HTMLInputElement).value
}
function select(id: LayerId) {
  selected.value = selected.value === id ? null : id
}
onBeforeUnmount(() => tween?.kill())
// 回到这一步时从头开始
watch(() => props.step.id, () => {
  tween?.kill()
  t.value = 0
  selected.value = null
  term.value = 'none'
})

const info = computed(() => (selected.value ? U.layers[selected.value] : null))
</script>

<template>
  <section class="stage panel">
    <div class="locate">
      <PinCutLocator class="locate-fig" />
      <div class="locate-text">
        <b><Bi :t="U.cut.title" /></b>
        <p><Bi :t="U.cut.text" /></p>
        <p class="note"><Bi :t="U.cut.note" /></p>
      </div>
    </div>

    <PinSectionLayers :t="t" :selected="selected" @select="select" />

    <div class="stage-bottom">
      <label class="bias fwd">
        <span class="bias-name"><Bi :t="U.slider" /></span>
        <input type="range" min="0" max="1" step="0.005" :value="t" @input="onSlide" />
        <span class="bias-name"><Bi :t="U.sliderEnd" /></span>
      </label>
      <button class="btn" @click="slideTo(t < 0.5 ? 1 : 0)"><Bi :t="t < 0.5 ? U.toStage : U.toReal" /></button>
    </div>

    <div class="info">
      <template v-if="info">
        <b class="info-name"><Bi :t="info.name" /></b>
        <p><Bi :t="info.what" /></p>
      </template>
      <p v-else class="hint"><Bi :t="U.hint" /></p>
    </div>

    <div class="eq">
      <b><Bi :t="U.eqTitle" /></b>
      <p><Bi :t="U.eq" /></p>
    </div>

    <div class="term-head">
      <b class="term-title"><Bi :t="U.term.title" /></b>
      <small><Bi :t="U.term.sketch" /></small>
    </div>
    <p class="where"><Bi :t="U.term.where" /></p>
    <div class="seg" role="group">
      <button v-for="k in TERMS" :key="k" :aria-pressed="term === k" @click="term = k"><Bi :t="U.term.tabs[k]" /></button>
    </div>
    <PinTermination :kind="term" />
    <p class="term-text"><Bi :t="U.term.text[term]" /></p>

    <p class="scaled"><Bi :t="UI.scaled[step.mode]" /></p>
  </section>
</template>

<style scoped>
.locate {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 8px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--ink) 5%, transparent);
}
.locate-fig { flex: 1 1 280px; max-width: 360px; }
.locate-text { flex: 1 1 240px; font-size: 0.85rem; line-height: 1.55; }
.locate-text p { margin: 2px 0 0; }
.locate-text .note { font-size: 0.78rem; color: var(--ink-soft); }
.locate-text b { font-family: var(--font-display); font-size: 1rem; color: var(--ink); }
.where { margin: 0; font-size: 0.82rem; color: var(--ink-soft); }
.info,
.eq,
.term-text {
  padding: 8px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  font-size: 0.88rem;
  line-height: 1.55;
}
.info { min-height: 5.6em; }
.info p,
.eq p,
.term-text { margin: 2px 0 0; }
.info-name { font-family: var(--font-display); font-size: 1rem; }
.hint { color: var(--ink-soft); }
.eq { background: color-mix(in srgb, var(--field) 12%, transparent); }
.eq b { font-size: 0.9rem; }
.term-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; margin-top: 6px; }
.term-title { font-family: var(--font-display); font-size: 1.05rem; }
.term-head small { color: var(--ink-soft); font-size: 0.78rem; }
.seg { align-self: flex-start; flex-wrap: wrap; }
.term-text { min-height: 4.8em; }
</style>
