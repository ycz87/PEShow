<script setup lang="ts">
// 1.2-5 封装形式：五种封装排成一排（卡通简图 + 电流范围），点一种看实物照片、电流范围、散热方式、用途。
// 下方有一张对数坐标的电流范围图，把五种封装放在同一把尺上比较（量级示意）。
// 数据与文字在 sections/packages.ts；照片的作者与许可在照片下方标注，汇总见 src/assets/photos/ATTRIBUTION.md
import { computed, ref, watch } from 'vue'
import Bi from './Bi.vue'
import PackageIcon from './PackageIcon.vue'
import { tx } from '../app/settings'
import { UI } from '../devices/power-diode/sections/ui'
import { PACKAGES, UI_PACKAGES as U, type PackageId } from '../devices/power-diode/sections/packages'
import type { Step } from '../devices/power-diode/sections/types'

const props = defineProps<{ step: Step }>()

const sel = ref<PackageId>('axial')
const view = ref(0)
const pkg = computed(() => PACKAGES.find((p) => p.id === sel.value)!)
const photo = computed(() => pkg.value.photos[Math.min(view.value, pkg.value.photos.length - 1)])
function pick(id: PackageId) {
  sel.value = id
  view.value = 0
}
watch(() => props.step.id, () => pick('axial'))

// 对数坐标图：0.1 A … 10 kA
const LO = -1
const HI = 4
const AX0 = 150
const AX1 = 680
const px = (a: number) => AX0 + ((Math.log10(a) - LO) / (HI - LO)) * (AX1 - AX0)
const TICKS = [
  { a: 0.1, t: '0.1 A' },
  { a: 1, t: '1 A' },
  { a: 10, t: '10 A' },
  { a: 100, t: '100 A' },
  { a: 1000, t: '1 kA' },
  { a: 10000, t: '10 kA' },
]
const ROW = 22
const rows = computed(() => PACKAGES.map((p, i) => ({ p, y: 14 + i * ROW, x0: px(p.range[0]), x1: px(p.range[1]) })))
</script>

<template>
  <section class="stage panel">
    <ul class="tiles" role="list">
      <li v-for="p in PACKAGES" :key="p.id">
        <button class="tile" :class="{ on: sel === p.id }" :aria-pressed="sel === p.id" @click="pick(p.id)">
          <PackageIcon :kind="p.id" class="tile-icon" />
          <b><Bi :t="p.name" /></b>
        </button>
      </li>
    </ul>

    <div class="detail">
      <figure class="photo">
        <div v-if="pkg.photos.length > 1" class="seg" role="group">
          <button v-for="(ph, i) in pkg.photos" :key="i" :aria-pressed="view === i" @click="view = i"><Bi :t="ph.tab!" /></button>
        </div>
        <img :src="photo.src" :alt="tx(photo.caption)" loading="lazy" />
        <figcaption>
          <Bi :t="photo.caption" />
          <small class="credit">
            <Bi :t="U.photoBy" />：{{ photo.author }} ·
            <a :href="photo.licenseUrl" target="_blank" rel="noopener noreferrer">{{ photo.license }}</a> ·
            <a :href="photo.page" target="_blank" rel="noopener noreferrer"><Bi :t="U.from" /></a>（<Bi :t="U.resized" />）
          </small>
        </figcaption>
      </figure>

      <dl class="facts">
        <div class="name"><b><Bi :t="pkg.name" /></b></div>
        <div><dt><Bi :t="U.rows.current" /></dt><dd><Bi :t="pkg.current" /></dd></div>
        <div><dt><Bi :t="U.rows.cooling" /></dt><dd><Bi :t="pkg.cooling" /></dd></div>
        <div><dt><Bi :t="U.rows.use" /></dt><dd><Bi :t="pkg.use" /></dd></div>
        <div v-if="pkg.note" class="note"><dd><Bi :t="pkg.note" /></dd></div>
      </dl>
    </div>

    <div class="chart">
      <b class="chart-title"><Bi :t="U.chartTitle" /></b>
      <svg viewBox="0 0 700 150" role="img" :aria-label="tx(U.chartTitle)">
        <g class="grid">
          <g v-for="t in TICKS" :key="t.t">
            <path :d="`M${px(t.a)},6 V${14 + PACKAGES.length * ROW - 4}`" />
            <text :x="px(t.a)" :y="14 + PACKAGES.length * ROW + 10" class="mid">{{ t.t }}</text>
          </g>
        </g>
        <g
          v-for="r in rows"
          :key="r.p.id"
          class="row"
          :class="{ on: sel === r.p.id }"
          role="button"
          tabindex="0"
          :aria-label="tx(r.p.name)"
          @click="pick(r.p.id)"
          @keydown.enter="pick(r.p.id)"
        >
          <text x="144" :y="r.y + 11" class="rname">{{ tx(r.p.name) }}</text>
          <rect :x="r.x0" :y="r.y" :width="r.x1 - r.x0" height="14" rx="7" class="bar" />
        </g>
      </svg>
    </div>

    <p class="hint"><Bi :t="U.hint" /></p>
    <p class="scaled"><Bi :t="UI.scaled[step.mode]" /></p>
  </section>
</template>

<style scoped>
.tiles { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.tile {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 6px;
  border-radius: 14px;
  border: 2.5px solid color-mix(in srgb, var(--ink) 25%, transparent);
  background: color-mix(in srgb, var(--ink) 4%, transparent);
  color: var(--ink);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  text-align: center;
}
.tile b { font-family: var(--font-display); line-height: 1.25; }
.tile.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 18%, transparent); }
.tile-icon { max-width: 96px; }

.detail { display: grid; grid-template-columns: minmax(180px, 0.9fr) 1.4fr; gap: 14px; align-items: start; }
.photo { margin: 0; display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
.photo .seg { align-self: center; }
.photo img {
  width: 100%;
  max-height: 340px;
  object-fit: contain;
  border-radius: 12px;
  border: 2.5px solid var(--line);
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}
.photo figcaption { font-size: 0.78rem; line-height: 1.5; color: var(--ink-soft); }
.credit { display: block; margin-top: 2px; font-size: 0.7rem; opacity: 0.85; }
.credit a { color: var(--accent); }

.facts { margin: 0; display: flex; flex-direction: column; gap: 8px; font-size: 0.88rem; line-height: 1.55; }
.facts > div { display: grid; grid-template-columns: 3.2em 1fr; gap: 4px 8px; }
.facts .name { display: block; font-size: 1.1rem; font-family: var(--font-display); }
.facts dt { font-weight: 800; color: var(--accent); }
.facts dd { margin: 0; }
.facts .note { display: block; padding: 6px 10px; border-radius: 10px; font-size: 0.82rem; background: color-mix(in srgb, var(--ink) 6%, transparent); color: var(--ink-soft); }

.chart { padding: 8px 12px; border-radius: 12px; background: color-mix(in srgb, var(--ink) 5%, transparent); }
.chart-title { font-size: 0.85rem; }
.chart svg { width: 100%; height: auto; display: block; font-family: var(--font-body); }
.chart text { font-size: 11px; fill: var(--ink-soft); }
.chart .mid { text-anchor: middle; }
.chart .rname { text-anchor: end; fill: var(--ink); font-size: 12px; }
.grid path { stroke: color-mix(in srgb, var(--ink) 22%, transparent); stroke-width: 1px; stroke-dasharray: 3 3; }
.row { cursor: pointer; outline: none; }
.row .bar { fill: color-mix(in srgb, var(--ink) 38%, transparent); stroke: var(--line); stroke-width: 1.4px; transition: fill 0.25s; }
.row.on .bar { fill: var(--accent); }
.row.on .rname { font-weight: 800; fill: var(--accent); }
.hint { margin: 0; font-size: 0.82rem; color: var(--ink-soft); }

@media (max-width: 640px) {
  .detail { grid-template-columns: 1fr; }
  .tiles { grid-template-columns: repeat(3, 1fr); }
}
</style>
