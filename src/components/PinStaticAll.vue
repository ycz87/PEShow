<script setup lang="ts">
// 1.3-1 完整的静态特性：示例 PiN 在 25 °C 的 V-A 曲线，正向段（V、A）与反向段（V、µA）各用自己的比例，
// 分成死区、正向导通区、反向阻断区、反向击穿区四个区；点一个区看说明。下方与第 0 章的示例 PN 结对比
import { computed, ref } from 'vue'
import Bi from './Bi.vue'
import Rich from './Rich.vue'
import PinRefNote from './PinRefNote.vue'
import { fillBi, tx } from '../app/settings'
import { BV_PIN, RS, forwardI, reverseI, terminalU } from '../engine/physics/pin'
import { BV_SHOWN, FWD, fwdCurve, revCurve, toPath } from '../devices/power-diode/staticCurves'
import { UI_STATIC } from '../devices/power-diode/sections/uiStatic'
import { UI } from '../devices/power-diode/sections/ui'

type Region = 'dead' | 'fwd' | 'block' | 'bd'
const U = UI_STATIC.all
const REGIONS: Region[] = ['dead', 'fwd', 'block', 'bd']
/** 死区与导通区之间没有明确的分界，这里在 0.8 V 处画一条虚线作约定（0.8 V 时约 0.3 A） */
const U_KNEE = 0.8
const sel = ref<Region | null>(null)

const W = 640
const H = 340
const O = { x: 330, y: 190 }
const m = { l: 20, r: 16, t: 20, b: 22 }
const R_UMAX = 1600
const R_IMAX = 2 // µA
const xF = (u: number) => O.x + (Math.min(u, FWD.uMax) / FWD.uMax) * (W - m.r - O.x)
const yF = (i: number) => O.y - (Math.min(i, FWD.iMax) / FWD.iMax) * (O.y - m.t)
const xR = (u: number) => O.x - (Math.min(u, R_UMAX) / R_UMAX) * (O.x - m.l)
const yR = (iuA: number) => O.y + (Math.min(iuA, R_IMAX) / R_IMAX) * (H - m.b - O.y)

const fwdPath = toPath(fwdCurve(25), xF, yF)
/** 反向曲线画到图的下边（击穿时电流趋于无穷，曲线几乎垂直） */
const revPts = (() => {
  const pts = revCurve(25)
  const k = pts.findIndex(([, i]) => i >= R_IMAX)
  return [[0, 0] as [number, number], ...(k < 0 ? pts : pts.slice(0, k + 1))]
})()
const revPath = toPath(revPts, xR, yR)

const terminalI = (u: number) => forwardI(u, { R: RS.R25 })
const U30 = terminalU(30)
const IR1200 = reverseI(1200) * 1e6
const OPS: Record<Region, { x: number; y: number }> = {
  dead: { x: xF(0.6), y: yF(terminalI(0.6)) },
  fwd: { x: xF(U30), y: yF(30) },
  block: { x: xR(1200), y: yR(IR1200) },
  bd: { x: xR(BV_PIN), y: yR(R_IMAX) },
}
const nums = { u: U30.toFixed(2), i: IR1200.toFixed(3), v: BV_SHOWN }
const info = computed(() => (sel.value ? fillBi(U.info[sel.value], nums) : U.pick))
const rows = U.cmpRows.map((r) => r.map((c) => fillBi(c, nums)))
</script>

<template>
  <section class="stage panel">
    <PinRefNote />
    <figure class="chart sp">
      <h3 class="panel-title"><Bi :t="U.title" /></h3>
      <svg class="plot" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="tx(U.title)">
        <!-- 三个区 -->
        <rect :x="O.x" :y="m.t" :width="xF(U_KNEE) - O.x" :height="O.y - m.t" class="zone dead" :class="{ on: sel === 'dead' }" @click="sel = 'dead'" />
        <line :x1="xF(U_KNEE)" :x2="xF(U_KNEE)" :y1="m.t" :y2="O.y" class="knee" />
        <rect :x="xF(U_KNEE)" :y="m.t" :width="W - m.r - xF(U_KNEE)" :height="O.y - m.t" class="zone fwd" :class="{ on: sel === 'fwd' }" @click="sel = 'fwd'" />
        <rect :x="xR(BV_PIN)" :y="O.y" :width="O.x - xR(BV_PIN)" :height="H - m.b - O.y" class="zone block" :class="{ on: sel === 'block' }" @click="sel = 'block'" />
        <rect :x="m.l" :y="O.y" :width="xR(BV_PIN) - m.l" :height="H - m.b - O.y" class="zone bd" :class="{ on: sel === 'bd' }" @click="sel = 'bd'" />
        <text :x="(O.x + xF(U_KNEE)) / 2" :y="O.y - 12" text-anchor="middle" class="zlab dead">{{ tx(U.regions.dead) }}</text>
        <text :x="(xF(U_KNEE) + W - m.r) / 2 + 30" :y="m.t + 60" text-anchor="middle" class="zlab fwd">{{ tx(U.regions.fwd) }}</text>
        <text :x="(O.x + xR(BV_PIN)) / 2" :y="H - m.b - 36" text-anchor="middle" class="zlab block">{{ tx(U.regions.block) }}</text>
        <text :x="xR(BV_PIN) + 6" :y="H - m.b - 8" class="zlab bd">← {{ tx(U.regions.bd) }}</text>

        <!-- 坐标轴：两半比例不同，过原点处画断口 -->
        <g class="ticks">
          <text v-for="u in [0.5, 1, 1.5, 2]" :key="'f' + u" :x="xF(u)" :y="O.y + 15" text-anchor="middle">{{ u }}</text>
          <text v-for="i in [30, 60, 90]" :key="'i' + i" :x="O.x - 6" :y="yF(i) + 4" text-anchor="end">{{ i }}</text>
          <text v-for="u in [500, 1000, 1500]" :key="'r' + u" :x="xR(u)" :y="O.y - 6" text-anchor="middle">−{{ u }}</text>
          <text :x="O.x - 6" :y="yR(1) + 4" text-anchor="end">−1</text>
          <text :x="O.x - 6" :y="yR(2) + 4" text-anchor="end">−2</text>
          <text :x="W - m.r" :y="O.y - 8" text-anchor="end" class="axis-name">U / V</text>
          <text :x="O.x + 8" :y="m.t + 4" class="axis-name">I / A</text>
          <text :x="O.x + 8" :y="H - m.b + 2" class="axis-name">I / µA</text>
          <text :x="W - m.r" :y="m.t + 4" text-anchor="end" class="quad">{{ tx(U.fwdQuad) }}</text>
          <text :x="m.l" :y="O.y - 22" class="quad">{{ tx(U.revQuad) }}</text>
        </g>
        <g class="axis">
          <line :x1="m.l" :x2="W - m.r" :y1="O.y" :y2="O.y" />
          <line :x1="O.x" :x2="O.x" :y1="m.t - 6" :y2="H - m.b" />
          <path :d="`M${O.x - 18} ${O.y - 6} l5 12 M${O.x - 12} ${O.y - 6} l5 12`" class="brk" />
          <path :d="`M${O.x - 6} ${O.y + 14} l12 -5 M${O.x - 6} ${O.y + 20} l12 -5`" class="brk" />
        </g>
        <line :x1="xR(BV_PIN)" :x2="xR(BV_PIN)" :y1="O.y" :y2="H - m.b" class="bvline" />

        <path :d="fwdPath" class="curve fwd" />
        <path :d="revPath" class="curve rev" />

        <g v-if="sel" class="op" :transform="`translate(${OPS[sel].x} ${OPS[sel].y})`">
          <circle r="11" class="halo" />
          <circle r="6.5" class="dot" />
        </g>
      </svg>
    </figure>

    <div class="regions" role="group">
      <button v-for="r in REGIONS" :key="r" class="btn" :class="r" :aria-pressed="sel === r" @click="sel = sel === r ? null : r">
        <Bi :t="U.regions[r]" />
      </button>
    </div>
    <div class="info"><Rich :t="info" /></div>

    <div class="cmp">
      <h3 class="panel-title"><Bi :t="U.cmpTitle" /></h3>
      <table>
        <thead>
          <tr><th v-for="(h, k) in U.cmpHead" :key="k"><Bi :t="h" /></th></tr>
        </thead>
        <tbody>
          <tr v-for="(r, k) in rows" :key="k">
            <th><Bi :t="r[0]" /></th>
            <td><Bi :t="r[1]" /></td>
            <td class="pin"><Bi :t="r[2]" /></td>
          </tr>
        </tbody>
      </table>
      <p class="cmp-note"><Bi :t="U.cmpNote" /></p>
    </div>

    <p class="scaled"><Bi :t="UI.scaled.staticAll" /></p>
  </section>
</template>

<style scoped>
.zone { cursor: pointer; transition: fill 0.2s; }
.zone.dead { fill: color-mix(in srgb, var(--ink) 6%, transparent); }
.zone.dead.on { fill: color-mix(in srgb, var(--ink) 16%, transparent); }
.knee { stroke: var(--ink-soft); stroke-width: 1.2; stroke-dasharray: 3 4; pointer-events: none; }
.zlab.dead { fill: var(--ink-soft); }
.regions .btn[aria-pressed='true'].dead { border-color: var(--ink); }
.zone.fwd { fill: color-mix(in srgb, var(--accent) 6%, transparent); }
.zone.block { fill: color-mix(in srgb, var(--potential) 6%, transparent); }
.zone.bd { fill: color-mix(in srgb, var(--danger) 8%, transparent); }
.zone.fwd.on { fill: color-mix(in srgb, var(--accent) 18%, transparent); }
.zone.block.on { fill: color-mix(in srgb, var(--potential) 18%, transparent); }
.zone.bd.on { fill: color-mix(in srgb, var(--danger) 22%, transparent); }
.zlab { font-size: 13px; font-weight: 800; pointer-events: none; }
.zlab.fwd { fill: var(--accent); }
.zlab.block { fill: var(--potential); }
.zlab.bd { fill: var(--danger); }
.axis line, .brk { stroke: var(--ink); stroke-width: 1.6; fill: none; }
.quad { font-size: 12px; font-weight: 700; fill: var(--ink-soft); }
.curve { fill: none; stroke-width: 3; stroke-linejoin: round; pointer-events: none; }
.curve.fwd { stroke: var(--accent); }
.curve.rev { stroke: var(--potential); }
.bvline { stroke: var(--danger); stroke-width: 1.4; stroke-dasharray: 4 4; }
.regions { display: flex; flex-wrap: wrap; gap: 8px; }
.regions .btn[aria-pressed='true'].fwd { border-color: var(--accent); color: var(--accent); }
.regions .btn[aria-pressed='true'].block { border-color: var(--potential); color: var(--potential); }
.regions .btn[aria-pressed='true'].bd { border-color: var(--danger); color: var(--danger); }
.info {
  min-height: 4.8em;
  padding: 8px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  font-size: 0.9rem;
}
.cmp table { border-collapse: collapse; width: 100%; font-size: 0.86rem; }
.cmp th, .cmp td { padding: 4px 8px; border-bottom: 1px solid color-mix(in srgb, var(--ink) 12%, transparent); text-align: left; }
.cmp thead th { color: var(--ink-soft); }
.cmp td.pin { color: var(--accent); font-weight: 700; }
.cmp-note { margin: 6px 0 0; font-size: 0.82rem; color: var(--ink-soft); }
</style>
