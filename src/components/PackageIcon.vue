<script setup lang="ts">
// 五种封装的卡通简图（SVG，160 × 100）：只表现外形特征，不按比例
import type { PackageId } from '../devices/power-diode/sections/packages'

defineProps<{ kind: PackageId }>()
</script>

<template>
  <svg viewBox="0 0 160 100" class="pk" aria-hidden="true">
    <!-- 轴向引线：圆柱形塑封体，一端有环形标记（阴极），两端引线 -->
    <g v-if="kind === 'axial'">
      <path d="M6,50 H40 M120,50 H154" class="lead" />
      <rect x="40" y="32" width="80" height="36" rx="9" class="plastic" />
      <rect x="50" y="32" width="9" height="36" class="band" />
    </g>

    <!-- TO-247：塑封体 + 带孔的金属背板 + 引脚 -->
    <g v-else-if="kind === 'to247'">
      <rect x="66" y="64" width="7" height="30" class="copper" />
      <rect x="87" y="64" width="7" height="30" class="copper" />
      <rect x="46" y="22" width="68" height="44" rx="4" class="plastic" />
      <path d="M46,24 V12 Q46,6 52,6 H108 Q114,6 114,12 V24 Z" class="copper" />
      <circle cx="80" cy="15" r="5" class="hole" />
    </g>

    <!-- 螺栓型：六角底座 + 螺纹螺栓 + 金属壳 + 陶瓷环 + 柔软的铜带 -->
    <g v-else-if="kind === 'stud'">
      <rect x="70" y="76" width="20" height="20" class="copper" />
      <path d="M70,81 H90 M70,86 H90 M70,91 H90" class="thread" />
      <rect x="48" y="58" width="64" height="18" rx="2" class="steel" />
      <rect x="54" y="36" width="52" height="24" rx="3" class="steel" />
      <rect x="60" y="29" width="40" height="9" rx="3" class="ceramic" />
      <path d="M80,29 C80,10 100,6 122,16" class="strap" />
      <rect x="118" y="10" width="14" height="14" rx="3" class="copper" />
    </g>

    <!-- 模块：长方形塑料外壳 + 绝缘底板（带安装耳）+ 顶部接线端子 -->
    <g v-else-if="kind === 'module'">
      <rect x="6" y="66" width="148" height="12" rx="2" class="steel" />
      <circle cx="15" cy="72" r="3" class="hole" />
      <circle cx="145" cy="72" r="3" class="hole" />
      <rect x="20" y="32" width="120" height="36" rx="4" class="plastic" />
      <g class="terminals">
        <rect v-for="x in [32, 52, 72, 96, 116]" :key="x" :x="x" y="24" width="12" height="10" rx="2" class="copper" />
        <circle v-for="x in [38, 58, 78, 102, 122]" :key="x" :cx="x" cy="29" r="2.2" class="screw" />
      </g>
    </g>

    <!-- 平板压接型：上下铜极面 + 带裙边的陶瓷环 -->
    <g v-else>
      <rect x="40" y="76" width="80" height="12" rx="2" class="copper" />
      <rect x="28" y="38" width="104" height="40" rx="3" class="ceramic" />
      <path d="M28,50 H132 M28,62 H132" class="shed" />
      <rect x="40" y="24" width="80" height="16" rx="2" class="copper" />
    </g>
  </svg>
</template>

<style scoped>
.pk { width: 100%; height: auto; display: block; }
.pk * { stroke: var(--line); stroke-width: 2.2px; stroke-linejoin: round; stroke-linecap: round; }
.lead { fill: none; stroke: var(--ink-soft); stroke-width: 4px; }
.plastic { fill: color-mix(in srgb, var(--ink) 25%, var(--surface)); }
.band { fill: color-mix(in srgb, var(--ink) 85%, var(--surface)); stroke-width: 1.6px; }
.copper { fill: #e9a06a; }
.steel { fill: #b9c1d4; }
.ceramic { fill: #f1e9d8; }
.hole { fill: var(--surface); }
.thread, .shed { fill: none; stroke-width: 1.4px; }
.strap { fill: none; stroke: #e9a06a; stroke-width: 7px; }
.screw { fill: #f3d36b; stroke-width: 1.2px; }
</style>
