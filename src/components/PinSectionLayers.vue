<script setup lang="ts">
// 1.2-2 剖面图的两列芯片叠层（SVG）：示例 PiN 与真实产品，t = 0 真实比例，t = 1 压缩成 1.1 舞台的比例。
// 排版、标签摊开、电场示意轮廓都是 sectionLayers.ts 里的纯函数；这里只负责画。
// 点某一层（或它的标签）选中，两列里同名的层一起高亮。
import { computed } from 'vue'
import { tx } from '../app/settings'
import { COLUMNS, fieldShape, place, spreadLabels, type ColumnSpec, type LayerId } from '../devices/power-diode/sectionLayers'
import { UI_SECTION as U } from '../devices/power-diode/sections/uiSection'

const props = defineProps<{ t: number; selected: LayerId | null }>()
const emit = defineEmits<{ select: [id: LayerId] }>()

// 画布坐标（viewBox 700 × 440）
const TOP = 64
const H = 320
const SW = 92
const X: Record<ColumnSpec['id'], number> = { pin: 170, real: 438 }
const EMAX = 56
const GAP = 44

const cols = computed(() =>
  COLUMNS.map((col) => {
    const placed = place(col, props.t, H)
    const left = col.id === 'pin'
    const ys = spreadLabels(placed.map((p) => TOP + p.mid), GAP, TOP + 20, TOP + H - 14)
    const x = X[col.id]
    const edge = left ? x : x + SW
    const dir = left ? -1 : 1
    return {
      col,
      placed,
      x,
      labels: placed.map((p, i) => ({
        id: p.id,
        ly: ys[i],
        // 引线：从层的侧边到标签（先斜再平）
        lead: `M${edge},${TOP + p.mid} L${edge + dir * 9},${ys[i]} H${edge + dir * 15}`,
        tx: edge + dir * 19,
        anchor: left ? 'end' : 'start',
      })),
      shape: fieldShape(col.id === 'pin' ? 'npt' : 'pt', placed, EMAX).map(([dx, y]) => `${left ? x + SW + dx : x - dx},${TOP + y}`).join(' '),
      shapeLabel: col.id === 'pin' ? U.triangle : U.trapezoid,
    }
  }),
)

/** 比例尺只在接近真实比例时有意义 */
const scaleOpacity = computed(() => Math.max(0, 1 - props.t / 0.4))
const k = H / COLUMNS[0].layers.reduce((s, l) => s + l.um, 0)

const dim = (id: LayerId) => props.selected !== null && props.selected !== id
const thin = (h: number) => h < 5
</script>

<template>
  <svg class="sec" viewBox="0 0 700 440" role="img" :aria-label="tx(U.hint)">
    <!-- 列标题 -->
    <g v-for="c in cols" :key="c.col.id" class="title">
      <text :x="c.x + SW / 2" y="20" class="t-main">{{ tx(U.col[c.col.id].title) }}</text>
      <text :x="c.x + SW / 2" y="38" class="t-sub">{{ tx(U.col[c.col.id].sub) }}</text>
    </g>

    <!-- 电流方向：自正面到背面 -->
    <g class="flow">
      <line x1="350" :y1="TOP + 14" x2="350" :y2="TOP + H - 20" />
      <path :d="`M344,${TOP + H - 28} L350,${TOP + H - 16} L356,${TOP + H - 28} Z`" />
      <text x="350" :y="TOP + 4" class="end">{{ tx(U.front) }}</text>
      <text x="350" :y="TOP + H + 8" class="end">{{ tx(U.back) }}</text>
      <text x="358" :y="TOP + H / 2" class="cur">{{ tx(U.current) }}</text>
    </g>

    <g v-for="c in cols" :key="c.col.id">
      <!-- 叠层 -->
      <g class="stack">
        <g
          v-for="p in c.placed"
          :key="p.id"
          class="layer"
          :class="[p.id, { dim: dim(p.id), on: selected === p.id }]"
          role="button"
          tabindex="0"
          :aria-label="tx(U.layers[p.id].name)"
          @click="emit('select', p.id)"
          @keydown.enter="emit('select', p.id)"
        >
          <rect :x="c.x" :y="TOP + p.y" :width="SW" :height="p.h" :class="{ thin: thin(p.h) }" />
        </g>
        <rect :x="c.x" :y="TOP" :width="SW" :height="c.placed.reduce((s, p) => s + p.h, 0)" class="frame" />
      </g>

      <!-- 标签与引线 -->
      <g
        v-for="lb in c.labels"
        :key="lb.id"
        class="label"
        :class="{ dim: dim(lb.id), on: selected === lb.id }"
        @click="emit('select', lb.id)"
      >
        <path :d="lb.lead" />
        <text :x="lb.tx" :y="lb.ly - 12" :text-anchor="lb.anchor" class="l-name">{{ tx(U.layers[lb.id].name) }}</text>
        <text :x="lb.tx" :y="lb.ly + 2" :text-anchor="lb.anchor" class="l-spec">{{ tx(U.layers[lb.id].spec[c.col.id]!.um) }}</text>
        <text :x="lb.tx" :y="lb.ly + 15" :text-anchor="lb.anchor" class="l-spec">{{ tx(U.layers[lb.id].spec[c.col.id]!.dop) }}</text>
      </g>

      <!-- 电场示意轮廓 -->
      <polygon :points="c.shape" class="field" />
      <text :x="c.col.id === 'pin' ? c.x + SW + 4 : c.x - 4" :y="TOP + H + 26" :text-anchor="c.col.id === 'pin' ? 'start' : 'end'" class="fld-name">
        {{ tx(U.field) }}：{{ tx(c.shapeLabel) }}
      </text>
    </g>

    <!-- 比例尺：100 µm 与一根头发丝，与叠层同一把尺 -->
    <g class="scale" :opacity="scaleOpacity">
      <rect x="10" y="408" :width="100 * k" height="5" />
      <text :x="16 + 100 * k" y="414">{{ tx(U.scaleBar) }}</text>
      <rect x="10" y="424" :width="70 * k" height="5" class="hair" />
      <text :x="16 + 70 * k" y="430">{{ tx(U.hair) }}</text>
    </g>
  </svg>
</template>

<style scoped>
.sec {
  width: 100%;
  height: auto;
  display: block;
  font-family: var(--font-body);
  user-select: none;
}
text {
  fill: var(--ink);
  paint-order: stroke;
  stroke: var(--bg);
  stroke-width: 3px;
  stroke-linejoin: round;
}
.t-main { font: 800 15px var(--font-display); text-anchor: middle; }
.t-sub { font-size: 11px; text-anchor: middle; fill: var(--ink-soft); }
.flow line { stroke: var(--ink-soft); stroke-width: 2; stroke-dasharray: 5 4; }
.flow path { fill: var(--ink-soft); }
.flow text { font-size: 11px; fill: var(--ink-soft); }
.flow .end { text-anchor: middle; }

.layer { cursor: pointer; transition: opacity 0.25s; outline: none; }
.layer rect { stroke: var(--line); stroke-width: 1.6px; }
.layer rect.thin { stroke-width: 0.7px; }
.layer.on rect { stroke: var(--accent); stroke-width: 3px; }
.layer:focus-visible rect { stroke: var(--accent); stroke-width: 3px; }
.layer.dim { opacity: 0.35; }
.layer:hover rect { filter: brightness(1.12); }
.metalF rect { fill: color-mix(in srgb, var(--ink) 38%, var(--surface)); }
.metalB rect { fill: color-mix(in srgb, var(--ink) 55%, var(--surface)); }
.p rect { fill: var(--p-region); }
.nm rect { fill: color-mix(in srgb, var(--n-region) 38%, #fff); }
.fs rect { fill: color-mix(in srgb, var(--n-region) 70%, #fff); }
.np rect { fill: var(--n-region); }
.frame { fill: none; stroke: var(--line); stroke-width: var(--bw, 2px); pointer-events: none; }

.label { cursor: pointer; transition: opacity 0.25s; }
.label path { fill: none; stroke: var(--ink-soft); stroke-width: 1.2px; }
.label.dim { opacity: 0.35; }
.label.on path { stroke: var(--accent); stroke-width: 2px; }
.l-name { font-size: 13px; font-weight: 800; }
.l-spec { font-size: 11px; fill: var(--ink-soft); }
.label.on .l-name { fill: var(--accent); }

.field {
  fill: color-mix(in srgb, var(--field) 40%, transparent);
  stroke: var(--field);
  stroke-width: 2px;
  stroke-linejoin: round;
  pointer-events: none;
}
.fld-name { font-size: 11px; fill: var(--field); font-weight: 700; }

.scale rect { fill: var(--ink-soft); }
.scale rect.hair { fill: var(--accent); }
.scale text { font-size: 11px; fill: var(--ink-soft); }
</style>
