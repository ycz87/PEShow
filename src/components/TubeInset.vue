<script setup lang="ts">
// 舞台角落的小插图：整块 PN 结（斜二测）的截面分成很多根细柱，舞台画的是其中黄色的一根
import { computed } from 'vue'
import Bi from './Bi.vue'
import { tx } from '../app/settings'
import { UI } from '../devices/pn-junction/sections/ui'

/** w：耗尽层宽度（归一化），与舞台一致 */
const props = defineProps<{ w: number }>()
const emit = defineEmits<{ close: [] }>()

type Pt = [number, number]
/** 器件块：x 沿 A→K，y 向上，z 向纸内；斜二测投影 */
const B = { x: 22, y: 84, L: 150, Hh: 50, Dx: 44, Dy: 28 }
const NG = 6
/** 被选中的细柱所在的行（自下而上）与列（自前向后） */
const CELL = { r: 3, d: 2 }
/** 舞台缩略条 */
const S = { y: 112, h: 22 }

const pr = (x: number, y: number, z: number): Pt => [B.x + x * B.L + z * B.Dx, B.y - y * B.Hh - z * B.Dy]
const pts = (...p: Pt[]) => p.map((q) => q.join(',')).join(' ')

const y0 = CELL.r / NG
const y1 = (CELL.r + 1) / NG
const z0 = CELL.d / NG
const z1 = (CELL.d + 1) / NG

const FILLS = ['var(--tube-p)', 'var(--tube-scr)', 'var(--tube-n)']
const shape = computed(() => {
  const xs = [0, 0.5 - props.w / 2, 0.5 + props.w / 2, 1]
  const top = [0, 1, 2].map((k) => ({ fill: FILLS[k], p: pts(pr(xs[k], 1, 0), pr(xs[k + 1], 1, 0), pr(xs[k + 1], 1, 1), pr(xs[k], 1, 1)) }))
  const front = [0, 1, 2].map((k) => ({ fill: FILLS[k], p: pts(pr(xs[k], 0, 0), pr(xs[k + 1], 0, 0), pr(xs[k + 1], 1, 0), pr(xs[k], 1, 0)) }))
  const strip = [0, 1, 2].map((k) => ({ fill: FILLS[k], x: B.x + xs[k] * B.L, w: (xs[k + 1] - xs[k]) * B.L }))
  return { top, front, strip }
})

const col = {
  front: pts(pr(0, y0, z0), pr(1, y0, z0), pr(1, y1, z0), pr(0, y1, z0)),
  top: pts(pr(0, y1, z0), pr(1, y1, z0), pr(1, y1, z1), pr(0, y1, z1)),
  end: pts(pr(1, y0, z0), pr(1, y0, z1), pr(1, y1, z1), pr(1, y1, z0)),
}
const kFace = pts(pr(1, 0, 0), pr(1, 0, 1), pr(1, 1, 1), pr(1, 1, 0))
const outline = [
  pts(pr(0, 0, 0), pr(1, 0, 0), pr(1, 1, 0), pr(0, 1, 0)),
  pts(pr(0, 1, 0), pr(1, 1, 0), pr(1, 1, 1), pr(0, 1, 1)),
  kFace,
]
/** K 端截面的网格，以及顶面沿长度方向贯穿的分隔线 */
const grid = Array.from({ length: NG - 1 }, (_, i) => (i + 1) / NG).flatMap((t) => [
  [pr(1, t, 0), pr(1, t, 1)],
  [pr(1, 0, t), pr(1, 1, t)],
])
const lanes = Array.from({ length: NG - 1 }, (_, i) => [pr(0, 1, (i + 1) / NG), pr(1, 1, (i + 1) / NG)])
/** 引出线：细柱两端 → 舞台缩略条 */
const leaders = [
  [pr(0, y0, z0), [B.x, S.y] as Pt],
  [pr(1, y0, z0), [B.x + B.L, S.y] as Pt],
]
const aBar = [pr(0, 0, 0), pr(0, 1, 0)]
/** 缩略条里的几个载流子（固定位置，只示意） */
const dots = [
  { k: 'h', x: 0.08, y: 0.35 }, { k: 'h', x: 0.2, y: 0.7 }, { k: 'h', x: 0.31, y: 0.3 }, { k: 'h', x: 0.4, y: 0.62 },
  { k: 'e', x: 0.6, y: 0.4 }, { k: 'e', x: 0.7, y: 0.72 }, { k: 'e', x: 0.81, y: 0.3 }, { k: 'e', x: 0.93, y: 0.6 },
]
</script>

<template>
  <figure class="tube">
    <button class="close" :aria-label="tx(UI.tube.close)" :title="tx(UI.tube.close)" @click="emit('close')">×</button>
    <svg viewBox="0 0 240 142" role="img" :aria-label="tx(UI.tube.caption)">
      <!-- 被选中的细柱先画，器件各面半透明地盖在上面，看上去在器件内部 -->
      <polygon :points="col.front" class="col" />
      <polygon :points="col.top" class="col light" />
      <g class="faces">
        <polygon v-for="(f, i) in shape.top" :key="`t${i}`" :points="f.p" :fill="f.fill" />
        <polygon v-for="(f, i) in shape.front" :key="`f${i}`" :points="f.p" :fill="f.fill" />
        <polygon :points="kFace" fill="var(--tube-n)" />
      </g>
      <line v-for="(l, i) in lanes" :key="`l${i}`" :x1="l[0][0]" :y1="l[0][1]" :x2="l[1][0]" :y2="l[1][1]" class="lane" />
      <line v-for="(l, i) in grid" :key="`g${i}`" :x1="l[0][0]" :y1="l[0][1]" :x2="l[1][0]" :y2="l[1][1]" class="grid" />
      <polygon :points="col.end" class="col" />
      <polygon v-for="(p, i) in outline" :key="`o${i}`" :points="p" class="outline" />
      <line :x1="aBar[0][0] - 3" :y1="aBar[0][1]" :x2="aBar[1][0] - 3" :y2="aBar[1][1]" class="electrode" />
      <text :x="B.x - 13" :y="B.y - B.Hh / 2" class="term">A</text>
      <text :x="pr(1, 0.5, 1)[0] + 11" :y="pr(1, 0.5, 1)[1]" class="term">K</text>
      <text :x="pr(0.2, 0.22, 0)[0]" :y="pr(0.2, 0.22, 0)[1]" class="region p">P</text>
      <text :x="pr(0.8, 0.22, 0)[0]" :y="pr(0.8, 0.22, 0)[1]" class="region n">N</text>

      <line v-for="(l, i) in leaders" :key="`d${i}`" :x1="l[0][0]" :y1="l[0][1]" :x2="l[1][0]" :y2="l[1][1]" class="leader" />
      <rect v-for="(s, i) in shape.strip" :key="`s${i}`" :x="s.x" :y="S.y" :width="s.w" :height="S.h" :fill="s.fill" />
      <circle
        v-for="(d, i) in dots"
        :key="`c${i}`"
        :cx="B.x + d.x * B.L"
        :cy="S.y + d.y * S.h"
        r="2.6"
        :class="d.k"
      />
      <rect :x="B.x" :y="S.y" :width="B.L" :height="S.h" class="strip-frame" />
      <text :x="B.x + B.L + 8" :y="S.y + S.h / 2" class="stage-tag">= {{ tx(UI.tube.stage) }}</text>
    </svg>
    <figcaption><Bi :t="UI.tube.caption" /></figcaption>
  </figure>
</template>

<style scoped>
.tube {
  --tube-p: color-mix(in srgb, var(--p-region) 38%, var(--surface));
  --tube-n: color-mix(in srgb, var(--n-region) 38%, var(--surface));
  --tube-scr: color-mix(in srgb, var(--ink) 6%, var(--surface));
  position: relative;
  margin: 0;
  width: min(230px, 38%);
  padding: 8px 10px 8px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--ink) 25%, transparent);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--ink) 14%, transparent);
  pointer-events: auto;
}
svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
.faces {
  opacity: 0.62;
}
.col {
  fill: #ffc928;
  stroke: #8a6400;
  stroke-width: 1.2;
}
.col.light {
  fill: #ffe27a;
}
.grid,
.lane {
  stroke: var(--ink);
  stroke-width: 0.7;
  opacity: 0.28;
}
.lane {
  opacity: 0.14;
}
.outline {
  fill: none;
  stroke: var(--ink);
  stroke-width: 1.1;
  stroke-linejoin: round;
}
.electrode {
  stroke: var(--ink-soft);
  stroke-width: 4;
  stroke-linecap: round;
}
.leader {
  stroke: #b8860b;
  stroke-width: 1;
  stroke-dasharray: 4 3;
}
.strip-frame {
  fill: none;
  stroke: #b8860b;
  stroke-width: 1.8;
}
.e {
  fill: var(--electron);
}
.h {
  fill: var(--surface);
  stroke: var(--hole);
  stroke-width: 1.3;
}
text {
  font-family: var(--font-display);
  font-weight: 700;
  dominant-baseline: central;
  text-anchor: middle;
}
.term {
  font-size: 12px;
  fill: var(--ink);
}
.region {
  font-size: 11px;
}
.region.p {
  fill: color-mix(in srgb, var(--p-region) 75%, var(--ink));
}
.region.n {
  fill: color-mix(in srgb, var(--n-region) 75%, var(--ink));
}
.stage-tag {
  font-size: 11px;
  text-anchor: start;
  fill: #b8860b;
}
figcaption {
  font-size: 0.74rem;
  line-height: 1.4;
  color: var(--ink-soft);
  margin-top: 4px;
}
.close {
  position: absolute;
  top: 2px;
  right: 4px;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ink-soft);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.close:hover,
.close:focus-visible {
  background: color-mix(in srgb, var(--ink) 10%, transparent);
  color: var(--ink);
}
</style>
