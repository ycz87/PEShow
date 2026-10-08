<script setup lang="ts">
// 1.2-1 电气符号：功率二极管的符号（与普通二极管相同），A、K 两端用引线对应到 1.1 的 P⁺N⁻N⁺ 结构；
// 鼠标移到 A / K 上，对应的那一层（P⁺ / N⁺）亮起。下方把第 0 章的 PN 结并排放：符号相同，内部结构不同。
// 结构条用 1.1 舞台的比例（P⁺ : N⁻ : N⁺ 取自 PIN_SIM），方向也与 1.1 一致（阳极在左）。
import { computed, ref, watch } from 'vue'
import Bi from './Bi.vue'
import DiodeSymbol from './DiodeSymbol.vue'
import { tx } from '../app/settings'
import { PIN_SIM } from '../engine/physics/pinSim'
import { UI } from '../devices/power-diode/sections/ui'
import { UI_SYMBOL as U, type SymEnd } from '../devices/power-diode/sections/uiSymbol'
import type { Step } from '../devices/power-diode/sections/types'

const props = defineProps<{ step: Step }>()

// 画布坐标（viewBox 700 × 270）
const X0 = 60
const X1 = 640
const W = X1 - X0
const XA = X0 + W * PIN_SIM.XA
const XK = X0 + W * PIN_SIM.XK
const AX = (X0 + XA) / 2 // A 引到 P⁺ 的中间
const KX = (XK + X1) / 2
const WIRE_Y = 62
const SY0 = 150
const SH = 60

const hover = ref<SymEnd | null>(null)
const pinned = ref<SymEnd | null>(null)
const active = computed(() => hover.value ?? pinned.value)
const toggle = (e: SymEnd) => (pinned.value = pinned.value === e ? null : e)
watch(() => props.step.id, () => {
  hover.value = pinned.value = null
})
const info = computed(() => (active.value ? U.ends[active.value] : null))
</script>

<template>
  <section class="stage panel">
    <svg class="sym" viewBox="0 0 700 270" role="img" aria-label="二极管符号与 P⁺N⁻N⁺ 结构的对应">
      <!-- 引线与符号 -->
      <g class="wires">
        <path :d="`M${AX},${WIRE_Y} H318`" :class="{ on: active === 'A' }" />
        <path :d="`M348,${WIRE_Y} H${KX}`" :class="{ on: active === 'K' }" />
        <path :d="`M318,${WIRE_Y - 24} V${WIRE_Y + 24} L350,${WIRE_Y} Z`" class="tri" :class="{ on: active !== null }" />
        <path :d="`M352,${WIRE_Y - 25} V${WIRE_Y + 25}`" :class="{ on: active === 'K' }" />
      </g>

      <!-- 电流方向 -->
      <g class="flow">
        <path :d="`M250,24 H430`" />
        <path :d="`M424,19 L434,24 L424,29 Z`" class="head" />
        <text x="340" y="16" class="mid">{{ tx(U.current) }}</text>
      </g>

      <!-- 引到结构条的虚线 -->
      <g class="leads">
        <path :d="`M${AX},${WIRE_Y + 8} V${SY0}`" :class="{ on: active === 'A' }" />
        <path :d="`M${KX},${WIRE_Y + 8} V${SY0}`" :class="{ on: active === 'K' }" />
      </g>

      <!-- 结构条：P⁺ / N⁻ / N⁺（1.1 的舞台比例），两端各有一层金属 -->
      <g class="strip">
        <rect :x="X0 - 8" :y="SY0" width="8" :height="SH" class="metal" />
        <rect :x="X1" :y="SY0" width="8" :height="SH" class="metal" />
        <rect :x="X0" :y="SY0" :width="XA - X0" :height="SH" class="p" :class="{ hot: active === 'A', cold: active === 'K' }" />
        <rect :x="XA" :y="SY0" :width="XK - XA" :height="SH" class="nm" :class="{ cold: active !== null }" />
        <rect :x="XK" :y="SY0" :width="X1 - XK" :height="SH" class="np" :class="{ hot: active === 'K', cold: active === 'A' }" />
        <text :x="AX" :y="SY0 + SH / 2 + 6" class="mid reg">{{ tx(U.strip.P) }}</text>
        <text :x="(XA + XK) / 2" :y="SY0 + SH / 2 + 6" class="mid reg">{{ tx(U.strip.N) }}</text>
        <text :x="KX" :y="SY0 + SH / 2 + 6" class="mid reg">{{ tx(U.strip.Np) }}</text>
        <text :x="AX" :y="SY0 + SH + 18" class="mid sub">{{ tx(U.strip.pSub) }}</text>
        <text :x="(XA + XK) / 2" :y="SY0 + SH + 18" class="mid sub">{{ tx(U.strip.nSub) }}</text>
        <text :x="KX" :y="SY0 + SH + 18" class="mid sub">{{ tx(U.strip.npSub) }}</text>
      </g>

      <!-- 符号里画不出的那一层 -->
      <g class="missing">
        <path :d="`M${XA + 6},${SY0 + SH + 32} V${SY0 + SH + 38} H${XK - 6} V${SY0 + SH + 32}`" />
        <text :x="(XA + XK) / 2" :y="SY0 + SH + 56" class="mid">{{ tx(U.missing) }}</text>
      </g>

      <!-- 两个电极端点：可悬停 / 聚焦 / 点击 -->
      <g
        v-for="e in (['A', 'K'] as const)"
        :key="e"
        class="term"
        :class="{ on: active === e }"
        role="button"
        tabindex="0"
        :aria-label="tx(U.ends[e].name)"
        :aria-pressed="pinned === e"
        @mouseenter="hover = e"
        @mouseleave="hover = null"
        @focus="hover = e"
        @blur="hover = null"
        @click="toggle(e)"
        @keydown.enter.prevent="toggle(e)"
        @keydown.space.prevent="toggle(e)"
      >
        <circle :cx="e === 'A' ? AX : KX" :cy="WIRE_Y" r="22" class="hit" />
        <circle :cx="e === 'A' ? AX : KX" :cy="WIRE_Y" r="7" class="dot" />
        <text :x="e === 'A' ? AX : KX" :y="WIRE_Y - 16" class="mid lab">{{ e }}</text>
      </g>
    </svg>

    <div class="info" :class="{ empty: !info }">
      <template v-if="info">
        <b class="info-name"><Bi :t="info.name" /></b>
        <p><Bi :t="info.text" /></p>
      </template>
      <p v-else class="hint"><Bi :t="U.hint" /></p>
    </div>
    <p class="rule"><Bi :t="U.rule" /></p>

    <div class="cmp-head"><b><Bi :t="U.cmp.title" /></b></div>
    <div class="cmp">
      <div v-for="k in (['ch0', 'pin'] as const)" :key="k" class="card" :class="k">
        <b class="card-name"><Bi :t="U.cmp[k].name" /></b>
        <DiodeSymbol :conducting="false" class="card-sym" />
        <svg class="bar" viewBox="0 0 200 30" aria-hidden="true">
          <template v-if="k === 'ch0'">
            <rect x="0" y="0" width="100" height="30" class="p" />
            <rect x="100" y="0" width="100" height="30" class="nplain" />
            <text x="50" y="20" class="mid">P</text>
            <text x="150" y="20" class="mid">N</text>
          </template>
          <template v-else>
            <rect x="0" y="0" :width="200 * PIN_SIM.XA" height="30" class="p" />
            <rect :x="200 * PIN_SIM.XA" y="0" :width="200 * (PIN_SIM.XK - PIN_SIM.XA)" height="30" class="nm" />
            <rect :x="200 * PIN_SIM.XK" y="0" :width="200 * (1 - PIN_SIM.XK)" height="30" class="np" />
            <text :x="100 * PIN_SIM.XA" y="20" class="mid">P⁺</text>
            <text x="100" y="20" class="mid">N⁻</text>
            <text :x="200 - 100 * (1 - PIN_SIM.XK)" y="20" class="mid">N⁺</text>
          </template>
        </svg>
        <ul class="facts">
          <li v-for="f in U.cmp[k].facts" :key="f.zh"><Bi :t="f" /></li>
        </ul>
      </div>
    </div>
    <p class="tail"><Bi :t="U.cmp.tail" /></p>

    <p class="scaled"><Bi :t="UI.scaled[step.mode]" /></p>
  </section>
</template>

<style scoped>
.sym { width: 100%; height: auto; display: block; font-family: var(--font-body); overflow: visible; }
text { fill: var(--ink); paint-order: stroke; stroke: var(--bg); stroke-width: 3px; stroke-linejoin: round; font-size: 12px; }
.mid { text-anchor: middle; }

.wires path { fill: none; stroke: var(--ink); stroke-width: 3.2px; stroke-linecap: round; stroke-linejoin: round; transition: stroke 0.25s; }
.wires path.tri { fill: color-mix(in srgb, var(--ink) 10%, transparent); transition: fill 0.25s, stroke 0.25s; }
.wires path.on { stroke: var(--accent); }
.wires path.tri.on { fill: color-mix(in srgb, var(--accent) 35%, transparent); }
.flow path { fill: none; stroke: var(--ink-soft); stroke-width: 2px; stroke-dasharray: 5 4; }
.flow .head { fill: var(--ink-soft); stroke: none; }
.flow text { fill: var(--ink-soft); }
.leads path { fill: none; stroke: var(--ink-soft); stroke-width: 1.6px; stroke-dasharray: 5 4; transition: stroke 0.25s; }
.leads path.on { stroke: var(--accent); stroke-width: 2.6px; }

.strip rect { stroke: var(--line); stroke-width: var(--bw, 2px); transition: opacity 0.25s, filter 0.25s; }
.strip .metal { fill: color-mix(in srgb, var(--ink) 45%, var(--surface)); }
.p { fill: var(--p-region); }
.nm { fill: color-mix(in srgb, var(--n-region) 38%, #fff); }
.np { fill: var(--n-region); }
.nplain { fill: var(--n-region); }
.strip .cold { opacity: 0.35; }
.strip .hot { stroke: var(--accent); stroke-width: 4px; filter: drop-shadow(0 0 6px var(--accent)); }
.reg { font: 800 16px var(--font-display); fill: var(--ink); }
.sub { font-size: 11px; fill: var(--ink-soft); }
.missing path { fill: none; stroke: var(--accent); stroke-width: 1.6px; stroke-linejoin: round; }
.missing text { fill: var(--accent); font-weight: 700; }

.term { cursor: pointer; outline: none; }
.term .hit { fill: transparent; }
.term .dot { fill: var(--ink); stroke: var(--bg); stroke-width: 2px; transition: fill 0.25s; }
.term .lab { font: 800 18px var(--font-display); }
.term.on .dot, .term:focus-visible .dot { fill: var(--accent); }
.term.on .lab { fill: var(--accent); }

.info,
.rule,
.tail {
  margin: 0;
  padding: 8px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  font-size: 0.88rem;
  line-height: 1.55;
}
.info { min-height: 4.6em; }
.info p { margin: 2px 0 0; }
.info-name { font-family: var(--font-display); font-size: 1rem; color: var(--accent); }
.hint { color: var(--ink-soft); }
.rule { font-size: 0.82rem; color: var(--ink-soft); }
.tail { font-weight: 700; background: color-mix(in srgb, var(--accent) 12%, transparent); }

.cmp-head b { font-family: var(--font-display); font-size: 1.05rem; }
.cmp { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 2px solid color-mix(in srgb, var(--ink) 25%, transparent);
  background: color-mix(in srgb, var(--ink) 4%, transparent);
}
.card.pin { border-color: var(--accent); }
.card-name { font-family: var(--font-display); font-size: 0.95rem; }
.card-sym { max-width: 150px; }
.bar { width: 100%; max-width: 240px; height: auto; }
.bar rect { stroke: var(--line); stroke-width: 1.6px; }
.bar text { font: 800 12px var(--font-display); }
.facts { list-style: none; margin: 0; padding: 0; align-self: stretch; font-size: 0.8rem; line-height: 1.5; color: var(--ink-soft); }
.facts li { padding-left: 1em; position: relative; }
.facts li::before { content: '·'; position: absolute; left: 0.3em; }
@media (max-width: 560px) {
  .cmp { grid-template-columns: 1fr; }
}
</style>
