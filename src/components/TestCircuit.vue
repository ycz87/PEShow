<script setup lang="ts">
// 动态特性（0.8）的测试电路：负载电流 I_F（大电感，近似恒流）、二极管 D 与 RC 缓冲、开关支路（S、换流电感 L、反向电压 U_R）。
// 与波形同步：开关 S 的通断、各支路电流的箭头（粗细 ∝ 电流大小，反向电流换色）、二极管电压，以及这一刻电路里发生了什么。
// 元件与 recovery.ts 的模型一一对应
import { computed } from 'vue'
import Bi from './Bi.vue'
import { tx } from '../app/settings'
import { signedV } from '../app/format'
import type { SwitchLive } from '../app/switching'
import { sampleAt } from '../engine/physics/recovery'
import { UI } from '../devices/pn-junction/sections/ui'

const props = defineProps<{ live: SwitchLive | null }>()
const U = UI.circ

const TOP = 52
const BOT = 252
const XI = 62
const XD = 172
const XC = 252
const XS = 362

const w = computed(() => props.live?.w ?? null)
const started = computed(() => !!props.live && (props.live.phase === 'run' || props.live.phase === 'done'))
const t = computed(() => (started.value ? props.live!.t : 0))
const s = computed(() => (w.value ? sampleAt(w.value, t.value) : null))

/** 开关 S：关断过程中换流开始时闭合；开通过程中换流开始时断开（电流按 di/dt 降到零） */
const closed = computed(() => {
  const x = w.value
  if (!x) return false
  return x.kind === 'off' ? started.value : !started.value || (s.value?.iS ?? 0) > 1e-5
})

/** 这一刻在发生什么 */
const phase = computed(() => {
  const x = w.value
  if (!x) return null
  const tt = t.value
  if (x.kind === 'on') {
    if (!started.value) return U.ph.onPre
    return tt < x.p.IF / x.p.didt ? U.ph.onShift : U.ph.onBuild
  }
  const m = x.m!
  if (!started.value) return U.ph.offPre
  if (tt < m.t0) return U.ph.offFall
  if (tt < m.t1) return U.ph.offStore
  if (tt < m.t2) return U.ph.offRecover
  return U.ph.offBlock
})

interface Arrow {
  x: number
  y: number
  /** 1 = 向下，−1 = 向上 */
  dir: number
  width: number
  rev: boolean
  text: string
}

const mA = (i: number) => `${i < 0 ? '−' : ''}${Math.abs(i * 1e3).toFixed(1)} mA`

const arrows = computed<Arrow[]>(() => {
  const x = w.value
  const q = s.value
  if (!x || !q) return []
  const IF = x.p.IF
  const iC = IF - q.i - q.iS
  const mk = (xx: number, y: number, i: number, down: boolean, rev: boolean): Arrow => ({
    x: xx,
    y,
    dir: (i >= 0) === down ? 1 : -1,
    width: Math.abs(i) < 0.02 * IF ? 0 : 1.6 + 5 * Math.min(1.4, Math.abs(i) / IF),
    rev,
    text: mA(i),
  })
  return [
    mk(XI + 36, 150, IF, false, false),
    mk(XD - 26, 100, q.i, true, q.i < 0),
    mk(XC - 22, 100, iC, true, false),
    mk(XS + 26, 112, q.iS, true, false),
  ]
})

function arrowPath(a: Arrow) {
  const L = 34
  const y0 = a.y - (a.dir * L) / 2
  const y1 = a.y + (a.dir * L) / 2
  const h = 7 + a.width
  return { line: `M${a.x} ${y0} L${a.x} ${y1 - a.dir * h * 0.8}`, head: `M${a.x} ${y1} L${a.x - h * 0.6} ${y1 - a.dir * h} L${a.x + h * 0.6} ${y1 - a.dir * h} Z` }
}

/** 电感的四个半圆 */
const coil = (() => {
  const y0 = 128
  const r = 7
  let d = `M${XS} ${y0 - 6} L${XS} ${y0}`
  for (let k = 0; k < 4; k++) d += ` A${r} ${r} 0 0 1 ${XS} ${y0 + 2 * r * (k + 1)}`
  return d + ` L${XS} ${y0 + 8 * r + 6}`
})()
</script>

<template>
  <section class="chart panel">
    <h3 class="panel-title">
      <Bi :t="U.title" />
      <span class="hint"><Bi :t="U.hint" /></span>
    </h3>
    <svg v-if="w && s" viewBox="0 0 440 290" class="plot" role="img" :aria-label="tx(U.title)">
      <!-- 母线 -->
      <path :d="`M${XI} ${TOP} H${XS} M${XI} ${BOT} H${XS}`" class="wire" />
      <!-- 负载电流源 -->
      <path :d="`M${XI} ${TOP} V${150 - 22} M${XI} ${150 + 22} V${BOT}`" class="wire" />
      <circle :cx="XI" cy="150" r="22" class="part" />
      <path :d="`M${XI} 162 V136 M${XI - 6} 143 L${XI} 135 L${XI + 6} 143`" class="part-line" />
      <text :x="XI - 28" y="155" class="lbl" text-anchor="end">I_F</text>
      <text :x="XI" y="272" class="sub" text-anchor="middle">{{ tx(U.load) }}</text>

      <!-- 二极管 D（阳极在上） -->
      <path :d="`M${XD} ${TOP} V138 M${XD} 164 V${BOT}`" class="wire" />
      <path :d="`M${XD - 15} 138 H${XD + 15} L${XD} 164 Z`" class="diode" :class="{ rev: s.i < 0 }" />
      <path :d="`M${XD - 15} 164 H${XD + 15}`" class="part-line" />
      <text :x="XD + 20" y="146" class="lbl">D</text>
      <text :x="XD + 20" y="166" class="val" :class="s.v >= 0 ? 'fwd' : 'rev'">{{ signedV(s.v) }}</text>

      <!-- RC 缓冲 -->
      <path :d="`M${XC} ${TOP} V96 M${XC} 132 V170 M${XC} 178 V${BOT}`" class="wire thin" />
      <path :d="`M${XC} 96 l6 4.5 l-12 4.5 l12 4.5 l-12 4.5 l12 4.5 l-12 4.5 l6 4.5`" class="part-line thin" />
      <path :d="`M${XC - 11} 170 H${XC + 11} M${XC - 11} 178 H${XC + 11}`" class="part-line" />
      <text :x="XC + 14" y="118" class="sub">R_s</text>
      <text :x="XC + 14" y="178" class="sub">C_s</text>

      <!-- 开关支路：S、L、U_R（长线为正极，在下） -->
      <path :d="`M${XS} ${TOP} V70 M${XS} 96 V122 M${XS} 190 V202 M${XS} 214 V${BOT}`" class="wire" />
      <circle :cx="XS" cy="70" r="2.8" class="node" />
      <circle :cx="XS" cy="96" r="2.8" class="node" />
      <path :d="closed ? `M${XS} 70 L${XS} 96` : `M${XS} 96 L${XS - 16} 74`" class="switch" :class="{ closed }" />
      <text :x="XS + 12" y="86" class="lbl">S</text>
      <path :d="coil" class="part-line" fill="none" />
      <text :x="XS + 16" y="160" class="lbl">L</text>
      <path :d="`M${XS - 9} 202 H${XS + 9} M${XS - 16} 214 H${XS + 16}`" class="battery" />
      <text :x="XS + 22" y="212" class="lbl">U_R</text>
      <text :x="XS - 26" y="222" class="sub">+</text>

      <!-- 电流箭头：粗细 ∝ 电流大小，二极管反向电流换色 -->
      <g v-for="(a, k) in arrows" :key="k" class="arrow" :class="{ rev: a.rev }">
        <template v-if="a.width">
          <path :d="arrowPath(a).line" :stroke-width="a.width" />
          <path :d="arrowPath(a).head" />
        </template>
        <text :x="a.x" :y="a.y + 32" text-anchor="middle" class="amp">{{ a.text }}</text>
      </g>
      <text :x="XS" y="276" class="sub" text-anchor="middle">{{ tx(closed ? U.closed : U.open) }}</text>
    </svg>
    <p v-if="phase" class="phase"><Bi :t="phase" /></p>
  </section>
</template>

<style scoped>
.plot {
  width: 100%;
  height: auto;
  display: block;
}
.wire {
  fill: none;
  stroke: var(--ink-soft);
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.wire.thin { stroke-width: 1.6; }
.part {
  fill: var(--surface);
  stroke: var(--ink);
  stroke-width: 2;
}
.part-line {
  fill: none;
  stroke: var(--ink);
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.part-line.thin { stroke-width: 1.6; }
.diode {
  fill: color-mix(in srgb, var(--accent) 35%, var(--surface));
  stroke: var(--ink);
  stroke-width: 2;
  stroke-linejoin: round;
  transition: fill 0.2s;
}
.diode.rev { fill: color-mix(in srgb, var(--hole) 45%, var(--surface)); }
.node { fill: var(--ink); }
.switch {
  stroke: var(--ink);
  stroke-width: 3;
  stroke-linecap: round;
}
.switch.closed { stroke: var(--accent); }
.battery {
  stroke: var(--ink);
  stroke-width: 2.6;
  stroke-linecap: round;
}
.lbl {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  fill: var(--ink);
}
.sub {
  font-size: 11px;
  fill: var(--ink-soft);
}
.val {
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.val.fwd { fill: var(--accent); }
.val.rev { fill: var(--hole); }
.arrow path {
  fill: var(--accent);
  stroke: var(--accent);
  stroke-linecap: round;
}
.arrow.rev path {
  fill: var(--hole);
  stroke: var(--hole);
}
.arrow path:first-child { fill: none; }
.amp {
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  fill: var(--ink-soft);
}
.phase {
  margin: 6px 4px 0;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--ink);
}
</style>
