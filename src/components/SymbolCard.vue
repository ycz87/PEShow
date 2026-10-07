<script setup lang="ts">
// 标题区右侧的图形符号卡片（GB/T 4728.5 / IEC 60617）：二极管符号随导通状态点亮
import Bi from './Bi.vue'
import DiodeSymbol from './DiodeSymbol.vue'
import type { BiText } from '../app/settings'

defineProps<{ conducting: boolean; note: BiText }>()

const TEXT = {
  symbol: { zh: '图形符号', en: 'Symbol' },
  std: 'GB/T 4728.5 / IEC 60617',
}
</script>

<template>
  <figure class="symbol-card panel">
    <figcaption class="sym-head">
      <b><Bi :t="TEXT.symbol" /></b>
      <small>{{ TEXT.std }}</small>
    </figcaption>
    <DiodeSymbol :conducting="conducting" />
    <p class="sym-note"><Bi :t="note" /></p>
  </figure>
</template>

<style scoped>
.symbol-card {
  margin: 0;
  padding: 12px 18px 12px;
  width: min(100%, 320px);
}
.sym-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}
.sym-head small {
  font-size: 0.72rem;
  color: var(--ink-soft);
}
.sym-note {
  margin: 4px 0 0;
  font-size: 0.8rem;
  color: var(--ink-soft);
  line-height: 1.45;
}
</style>
