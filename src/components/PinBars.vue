<script setup lang="ts">
// 对比横条（第 1 章）：几个器件在同一个量上的比较（耐压、压降、发热……），长度同一刻度。
// 默认插槽放结论文字；marker 是一条竖线（如当前的反向电压）
import Bi from './Bi.vue'
import type { BiText } from '../app/settings'

export interface BarRow {
  key: string
  label: BiText
  /** 显示的数值文字 */
  text: string
  /** 条的长度，0…1 */
  f: number
  /** 条的颜色（CSS 变量名，如 --field） */
  color: string
  /** 突出这一行（如 PiN） */
  strong?: boolean
}

defineProps<{ title: BiText; rows: BarRow[]; marker?: number }>()
</script>

<template>
  <div class="bars">
    <b class="bars-name"><Bi :t="title" /></b>
    <div v-for="b in rows" :key="b.key" class="bar-row" :class="{ strong: b.strong }">
      <span class="bar-label"><Bi :t="b.label" /></span>
      <span class="bar">
        <i :style="{ width: `${b.f * 100}%`, background: `var(${b.color})` }" />
        <i v-if="marker !== undefined" class="now" :style="{ left: `${Math.min(1, marker) * 100}%` }" />
      </span>
      <output>{{ b.text }}</output>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bars-name { font-size: 0.88rem; }
.bar-row {
  display: grid;
  grid-template-columns: 8.5em 1fr 5.5em;
  align-items: center;
  gap: 10px;
  font-size: 0.85rem;
}
.bar {
  position: relative;
  height: 14px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--ink) 10%, transparent);
}
.bar i {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 7px;
  transition: width 0.4s ease;
}
.bar i.now {
  width: 2px;
  inset: -4px auto -4px auto;
  background: var(--ink);
  border-radius: 0;
  transition: none;
}
.bar-row.strong {
  font-weight: 800;
  padding: 2px 6px;
  margin: 0 -6px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}
.bar-row output {
  font-family: var(--font-display);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
