<script setup lang="ts">
// 1.2-2 的"芯片边缘"示意图（SVG）：反向电压下，结在边缘弯曲处电场挤在一起，三种做法对比：
// 没有终端、场限环（平面芯片）、斜角（整片晶圆）。纯示意：画的是电场线的疏密和位置，不做电场计算。
// 坐标：上是芯片正面（阳极），左边是芯片中间（省略），右边是芯片边缘。
import { tx } from '../app/settings'
import { UI_SECTION as U, type TermId } from '../devices/power-diode/sections/uiSection'

defineProps<{ kind: TermId }>()

const SURF = 70 // 芯片表面
const PD = 24 // 主结的深度，也是它拐角的曲率半径
const CX = 396 // 主结拐角的圆心 x
const RINGS = [452, 504, 556]
const RING_R = 14

const pt = (cx: number, r: number, deg: number): [number, number] => [cx + r * Math.cos((deg * Math.PI) / 180), SURF + r * Math.sin((deg * Math.PI) / 180)]
const seg = (a: [number, number], b: [number, number]) => `M${a[0].toFixed(1)},${a[1].toFixed(1)} L${b[0].toFixed(1)},${b[1].toFixed(1)}`
/** 以 (cx, 表面) 为圆心的一束辐射状电场线，从半径 r0 指向 r1（箭头在 r1 一端，指向 P⁺） */
const fan = (cx: number, degs: number[], r0: number, r1: number) => degs.map((d) => seg(pt(cx, r0, d), pt(cx, r1, d)))

const FLAT = [80, 140, 200, 260, 320].map((x) => `M${x},162 L${x},${SURF + PD + 6}`)
const FAN_NONE = fan(CX, [12, 32, 52, 72, 90], 92, PD + 6)
const FAN_RINGS = fan(CX, [45, 70, 90], 92, PD + 6)
const FAN_RING_EACH = RINGS.map((x) => fan(x, [60, 90, 120], 56, RING_R + 6))

// 斜角：P⁺ 一侧（上）宽，向 N⁺ 一侧（下）收窄；真实只有几度，这里画成约 35°
const BV_TOP = 640
const BV_BOT_Y = 210
const BV_RUN = 200
const bevelX = (y: number) => BV_TOP - ((y - SURF) * BV_RUN) / (BV_BOT_Y - SURF)
const BEVEL = `40,${SURF} ${BV_TOP},${SURF} ${bevelX(BV_BOT_Y)},${BV_BOT_Y} 40,${BV_BOT_Y}`
const BV_P = SURF + PD
const BV_DEPL_Y = 166
const BV_DEPL = `40,${BV_P} ${bevelX(BV_P)},${BV_P} ${bevelX(BV_DEPL_Y)},${BV_DEPL_Y} 40,${BV_DEPL_Y}`
const BV_LINES = [80, 140, 200, 260, 320, 380, 440, 500, 560].map((x) => `M${x},${BV_DEPL_Y - 6} L${x},${BV_P + 6}`)
const COAT = `M${BV_TOP + 3},${SURF + 4} L${bevelX(BV_BOT_Y) + 3},${BV_BOT_Y + 4}`
</script>

<template>
  <div class="term">
    <svg class="art" viewBox="0 0 700 250" role="img" :aria-label="tx(U.term.text[kind])">
      <defs>
        <marker id="term-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,1 L9,5 L0,9 Z" class="arrowhead" />
        </marker>
        <radialGradient id="term-hot">
          <stop offset="0" style="stop-color: var(--danger); stop-opacity: 0.95" />
          <stop offset="1" style="stop-color: var(--danger); stop-opacity: 0" />
        </radialGradient>
        <clipPath id="term-bevel"><polygon :points="BEVEL" /></clipPath>
      </defs>

      <!-- ───── 平面芯片（没有终端 / 场限环） ───── -->
      <g class="fade" :class="{ off: kind === 'bevel' }">
        <rect x="40" :y="SURF" width="600" height="110" class="nm" />
        <rect x="40" y="180" width="600" height="30" class="np" />
        <rect x="40" y="210" width="600" height="5" class="metalB" />
        <rect x="40" y="63" width="364" height="7" class="metalF" />

        <!-- 耗尽层：没有终端时包着主结的拐角铺开；有场限环时一直铺到最外一环 -->
        <path :d="`M40 ${SURF + PD} H${CX} A${PD} ${PD} 0 0 0 ${CX + PD} ${SURF} H${CX + 100} A100 100 0 0 1 ${CX} 170 H40 Z`" class="depl fade" :class="{ off: kind !== 'none' }" />
        <path :d="`M40 ${SURF + PD} H${CX} A${PD} ${PD} 0 0 0 ${CX + PD} ${SURF} H580 C580 130 480 170 ${CX} 170 H40 Z`" class="depl fade" :class="{ off: kind !== 'rings' }" />

        <path :d="`M40 ${SURF} H${CX + PD} A${PD} ${PD} 0 0 1 ${CX} ${SURF + PD} H40 Z`" class="pp" />
        <g class="fade" :class="{ off: kind !== 'rings' }">
          <path v-for="x in RINGS" :key="x" :d="`M${x - RING_R} ${SURF} A${RING_R} ${RING_R} 0 0 0 ${x + RING_R} ${SURF} Z`" class="pp" />
          <text :x="RINGS[1]" y="40" class="mark mid">{{ tx(U.term.marks.ring) }}</text>
          <path :d="seg([RINGS[1], 46], [RINGS[1], SURF - 4])" class="leader" />
        </g>

        <!-- 电场线 -->
        <g class="lines">
          <path v-for="d in FLAT" :key="d" :d="d" marker-end="url(#term-arr)" />
        </g>
        <g class="lines fade" :class="{ off: kind !== 'none' }">
          <path v-for="d in FAN_NONE" :key="d" :d="d" marker-end="url(#term-arr)" />
        </g>
        <g class="lines fade" :class="{ off: kind !== 'rings' }">
          <path v-for="d in FAN_RINGS" :key="d" :d="d" marker-end="url(#term-arr)" />
          <template v-for="(f, i) in FAN_RING_EACH" :key="i">
            <path v-for="d in f" :key="d" :d="d" marker-end="url(#term-arr)" />
          </template>
        </g>

        <!-- 电场最强处：没有终端时集中在拐角；有场限环时分散成几个小的 -->
        <g class="fade" :class="{ off: kind !== 'none' }">
          <circle cx="412" cy="86" r="30" fill="url(#term-hot)" />
          <path :d="seg([446, 46], [418, 80])" class="leader" />
          <text x="448" y="40" class="mark hot">{{ tx(U.term.legend.hot) }} · {{ tx(U.term.marks.hotHere) }}</text>
        </g>
        <g class="fade" :class="{ off: kind !== 'rings' }">
          <circle cx="410" cy="84" r="17" fill="url(#term-hot)" opacity="0.4" />
          <circle v-for="x in RINGS" :key="x" :cx="x + 10" cy="80" r="13" fill="url(#term-hot)" opacity="0.3" />
        </g>
      </g>

      <!-- ───── 整片晶圆（斜角） ───── -->
      <g class="fade" :class="{ off: kind !== 'bevel' }">
        <g clip-path="url(#term-bevel)">
          <rect x="40" :y="SURF" width="620" :height="PD" class="pp" />
          <rect x="40" :y="BV_P" width="620" :height="180 - BV_P" class="nm" />
          <rect x="40" y="180" width="620" height="30" class="np" />
          <polygon :points="BV_DEPL" class="depl" />
          <g class="lines">
            <path v-for="d in BV_LINES" :key="d" :d="d" marker-end="url(#term-arr)" />
          </g>
        </g>
        <polygon :points="BEVEL" class="outline" />
        <rect x="40" y="63" width="590" height="7" class="metalF" />
        <rect x="40" y="210" :width="bevelX(BV_BOT_Y) - 40" height="5" class="metalB" />
        <path :d="COAT" class="coat" />
        <text :x="BV_TOP - 150" y="236" class="mark mid">{{ tx(U.term.legend.coat) }}</text>
        <path :d="seg([BV_TOP - 150, 224], [bevelX(196) + 6, 200])" class="leader" />
        <text x="528" y="172" class="mark soft">{{ tx(U.term.marks.surface) }}</text>
        <path :d="seg([526, 168], [bevelX(150) - 2, 150])" class="leader" />
      </g>

      <!-- 层名与"芯片中间"提示 -->
      <g class="names">
        <text x="48" y="87">{{ tx(U.term.marks.pplus) }}</text>
        <text x="48" y="132">{{ tx(U.term.marks.nminus) }}</text>
        <text x="48" y="200">{{ tx(U.term.marks.nplus) }}</text>
        <text x="46" y="240" class="soft">← {{ tx(U.term.marks.cut) }}</text>
        <text x="46" y="52" class="soft">{{ tx(U.term.marks.front) }}</text>
      </g>
    </svg>

    <ul class="lg">
      <li><i class="sw depl" />{{ tx(U.term.legend.depl) }}</li>
      <li><svg viewBox="0 0 24 10" class="ln"><path d="M1,5 L21,5" marker-end="url(#term-arr)" /></svg>{{ tx(U.term.legend.line) }}</li>
      <li v-if="kind !== 'bevel'"><i class="sw hot" />{{ tx(U.term.legend.hot) }}</li>
      <li v-if="kind === 'bevel'"><i class="sw coat" />{{ tx(U.term.legend.coat) }}</li>
    </ul>
  </div>
</template>

<style scoped>
.term .art { width: 100%; height: auto; display: block; font-family: var(--font-body); }
.fade { transition: opacity 0.4s; }
.fade.off { opacity: 0; pointer-events: none; }
.nm { fill: color-mix(in srgb, var(--n-region) 38%, #fff); stroke: none; }
.np { fill: var(--n-region); }
.pp { fill: var(--p-region); stroke: var(--line); stroke-width: 1.6px; }
.metalF { fill: color-mix(in srgb, var(--ink) 38%, var(--surface)); }
.metalB { fill: color-mix(in srgb, var(--ink) 55%, var(--surface)); }
.depl { fill: color-mix(in srgb, var(--field) 24%, transparent); stroke: color-mix(in srgb, var(--field) 70%, transparent); stroke-width: 1.5px; stroke-dasharray: 5 4; }
.outline { fill: none; stroke: var(--line); stroke-width: var(--bw, 2px); stroke-linejoin: round; }
.coat { fill: none; stroke: var(--accent); stroke-width: 9px; stroke-linecap: round; opacity: 0.85; }
.lines path { fill: none; stroke: var(--ink); stroke-width: 1.6px; opacity: 0.8; }
.arrowhead { fill: var(--ink); }
.leader { fill: none; stroke: var(--ink-soft); stroke-width: 1.2px; }
text { fill: var(--ink); paint-order: stroke; stroke: var(--bg); stroke-width: 3px; stroke-linejoin: round; font-size: 12px; }
.names text { font-weight: 800; font-size: 13px; }
.names text.soft, .mark.soft { fill: var(--ink-soft); font-weight: 400; font-size: 11px; }
.mark { font-weight: 800; }
.mark.mid { text-anchor: middle; }
.mark.hot { fill: var(--danger); }

.lg { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 0.78rem; color: var(--ink-soft); }
.lg li { display: inline-flex; align-items: center; gap: 6px; }
.sw { width: 14px; height: 14px; border-radius: 3px; display: inline-block; }
.sw.depl { background: color-mix(in srgb, var(--field) 24%, transparent); border: 1.5px dashed color-mix(in srgb, var(--field) 70%, transparent); }
.sw.hot { border-radius: 50%; background: radial-gradient(var(--danger), transparent 75%); }
.sw.coat { background: var(--accent); opacity: 0.85; }
.ln { width: 24px; height: 10px; }
.ln path { fill: none; stroke: var(--ink); stroke-width: 1.6px; }
</style>
