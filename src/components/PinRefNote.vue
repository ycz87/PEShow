<script setup lang="ts">
// 1.3 各步顶部的器件说明：曲线来自示例 PiN（理想化模型），手册数值来自哪几份真实数据手册（附官网链接与版本）
import Bi from './Bi.vue'
import Rich from './Rich.vue'
import { UI_STATIC } from '../devices/power-diode/sections/uiStatic'

const U = UI_STATIC.ref
const MAIN = { name: 'STTH3012', doc: 'DS4653 Rev 3（2023-12）', url: 'https://www.st.com/resource/en/datasheet/stth3012.pdf' }
const EXTRA = [
  { name: 'STBR3012', doc: 'DS11909 Rev 2（2018-11）', url: 'https://www.st.com/resource/en/datasheet/stbr3012.pdf' },
  { name: 'onsemi 1N4007', doc: '1N4001/D Rev. 18（2024-06）', url: 'https://www.onsemi.com/pdf/datasheet/1n4001-d.pdf' },
]
</script>

<template>
  <aside class="refnote">
    <b class="rn-title"><Bi :t="U.title" /></b>
    <Rich :t="U.model" />
    <p class="rn-line">
      <Rich :t="U.real" class="rn-inline" />
      <a :href="MAIN.url" target="_blank" rel="noopener">{{ MAIN.name }} {{ MAIN.doc }}</a>
    </p>
    <p class="rn-line">
      <Rich :t="U.extra" class="rn-inline" />
      <template v-for="(d, k) in EXTRA" :key="d.name">
        <a :href="d.url" target="_blank" rel="noopener">{{ d.name }} {{ d.doc }}</a><span v-if="k < EXTRA.length - 1">；</span>
      </template>
    </p>
  </aside>
</template>

<style scoped>
.refnote {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  border-radius: 10px;
  border-left: 4px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  font-size: 0.82rem;
}
.rn-title { font-family: var(--font-display); font-size: 0.9rem; }
.rn-line { margin: 0; }
.rn-inline { display: inline; }
.rn-inline :deep(div),
.rn-inline :deep(p) { display: inline; margin: 0; }
.refnote a { color: var(--accent); font-weight: 700; text-decoration: underline; text-underline-offset: 2px; }
</style>
