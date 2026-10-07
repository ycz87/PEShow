<script setup lang="ts">
// 第 1 章粒子舞台画布上方的标注（与画布同坐标）：各区名称、耗尽层、A / K 电极与外电路计数器。
// 放在舞台的 .overlay 里，样式见 styles/stage.css
import { computed } from 'vue'
import Bi from './Bi.vue'
import { tx, type BiText } from '../app/settings'
import { PIN_SIM } from '../engine/physics/pinSim'
import type { StageLayout } from '../engine/render/layout'
import { UI as STAGE_UI } from '../devices/pn-junction/sections/ui'
import { UI } from '../devices/power-diode/sections/ui'

const props = withDefaults(
  defineProps<{
    L: StageLayout
    /** P⁺N 结与 N 区右端（仿真坐标）；N 区一直到阴极时不画 N⁺ */
    xa?: number
    xk?: number
    /** 耗尽层两端（舞台坐标） */
    depl: [number, number]
    counts: { outA: number; inK: number }
    /** N 区的名称（默认 N⁻） */
    nName?: BiText
    /** 1.1-3：给三个区加掺杂说明，高亮中间的 N⁻ */
    structure?: boolean
  }>(),
  { xa: PIN_SIM.XA, xk: PIN_SIM.XK, nName: () => UI.regions.nMinus },
)

const m = computed(() => {
  const l = props.L
  const X = (x: number) => l.devX0 + x * l.devW
  const xa = props.xa
  const dr = Math.max(xa, props.depl[1])
  return {
    pX: X(xa / 2),
    nX: X((dr + props.xk) / 2),
    kX: X((props.xk + 1) / 2),
    showK: props.xk < 0.999,
    scrX: X((xa + dr) / 2),
    showScr: (dr - xa) * l.devW > 70,
    showN: (props.xk - dr) * l.devW > 40,
    labelY: l.devY0 - 10,
    aX: l.devX0 - 7.5,
    kTermX: l.devX0 + l.devW + 7.5,
    wireY: l.wireY,
    // 器件画得很短时两个计数器挤不下：K 端的放到电极外侧
    kOut: l.devW < 320,
    devX0: l.devX0,
    devY0: l.devY0,
    devH: l.devH,
    aW: xa * l.devW,
    nX0: X(xa),
    nW: (props.xk - xa) * l.devW,
    kX0: X(props.xk),
    kW: (1 - props.xk) * l.devW,
  }
})
</script>

<template>
  <span class="region p" :style="{ left: `${m.pX}px`, top: `${m.labelY}px` }"><Bi :t="UI.regions.pPlus" /></span>
  <Transition name="fade">
    <span v-if="m.showN" class="region n light" :style="{ left: `${m.nX}px`, top: `${m.labelY}px` }"><Bi :t="nName" /></span>
  </Transition>
  <span v-if="m.showK" class="region n" :style="{ left: `${m.kX}px`, top: `${m.labelY}px` }"><Bi :t="UI.regions.nPlus" /></span>
  <Transition name="fade">
    <span v-if="m.showScr" class="region scr" :style="{ left: `${m.scrX}px`, top: `${m.labelY}px` }"><Bi :t="UI.regions.depl" /></span>
  </Transition>
  <template v-if="structure">
    <i class="nm-focus" :style="{ left: `${m.nX0}px`, top: `${m.devY0}px`, width: `${m.nW}px`, height: `${m.devH}px` }" />
    <span class="dop heavy" :style="{ left: `${m.devX0 + 4}px`, top: `${m.devY0 + 8}px`, width: `${m.aW - 8}px` }">
      <b><Bi :t="UI.structure.heavy" /></b><span>≈10¹⁹ cm⁻³</span><span><Bi :t="UI.structure.holeSea" /></span>
    </span>
    <span class="dop light" :style="{ left: `${m.nX0 + m.nW / 2}px`, top: `${m.devY0 + 8}px`, maxWidth: `${Math.min(m.nW - 16, 330)}px` }">
      <b><Bi :t="UI.structure.light" /></b><span>1.3×10¹⁴ cm⁻³</span><span><Bi :t="UI.structure.lightWhy" /></span>
    </span>
    <span class="dop heavy" :style="{ left: `${m.kX0 + 4}px`, top: `${m.devY0 + 8}px`, width: `${m.kW - 8}px` }">
      <b><Bi :t="UI.structure.heavy" /></b><span>≈10¹⁹ cm⁻³</span><span><Bi :t="UI.structure.electronSea" /></span>
    </span>
    <span class="dop-note" :style="{ left: `${m.nX0 + m.nW / 2}px`, top: `${m.devY0 + m.devH - 10}px`, maxWidth: `${Math.max(240, m.nW + 60)}px` }">
      <Bi :t="UI.structure.note" />
    </span>
  </template>
  <span class="term" :style="{ left: `${m.aX}px`, top: `${m.wireY - 5}px` }">A</span>
  <span class="term" :style="{ left: `${m.kTermX}px`, top: `${m.wireY - 5}px` }">K</span>
  <span class="counter a" :title="tx(STAGE_UI.counters.hint)" :style="{ left: `${m.aX + 12}px`, top: `${m.wireY + 6}px` }">
    <Bi :t="counts.outA < 0 ? STAGE_UI.counters.inA : STAGE_UI.counters.outA" /> <b>{{ Math.abs(counts.outA) }}</b>
  </span>
  <span class="counter" :class="m.kOut ? 'k-out' : 'k'" :title="tx(STAGE_UI.counters.hint)" :style="{ left: `${m.kOut ? m.kTermX + 14 : m.kTermX - 12}px`, top: `${m.wireY + 6}px` }">
    <Bi :t="counts.inK < 0 ? STAGE_UI.counters.outK : STAGE_UI.counters.inK" /> <b>{{ Math.abs(counts.inK) }}</b>
  </span>
</template>

<style>
/* 1.1-3 的掺杂说明：画在舞台 .overlay 里，不加 scoped（与 stage.css 的区域标签同级） */
.stage .overlay > .nm-focus {
  position: absolute;
  box-sizing: border-box;
  border: 3px dashed var(--accent);
  border-radius: 10px;
  animation: nm-pulse 1.6s ease-in-out infinite;
}
@keyframes nm-pulse { 50% { opacity: 0.35; } }
.stage .overlay > .dop {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px 6px;
  border-radius: 8px;
  font-size: 0.7rem;
  line-height: 1.3;
  text-align: center;
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--ink) 35%, transparent);
  box-sizing: border-box;
}
.stage .overlay > .dop b { font-size: 0.8rem; }
.stage .overlay > .dop.light {
  transform: translateX(-50%);
  font-size: 0.78rem;
  border: 2px solid var(--accent);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
}
.stage .overlay > .dop.light b { font-size: 0.95rem; color: var(--accent); }
.stage .overlay > .dop-note {
  position: absolute;
  transform: translate(-50%, -100%);
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 0.74rem;
  line-height: 1.4;
  text-align: center;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  border: 1.5px dashed var(--ink-soft);
}
</style>
