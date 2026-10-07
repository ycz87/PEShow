<script setup lang="ts">
// 图例里的两项：一次复合（向外扩散的暖色波纹，放热）、一次产生（向内收缩的冷色波纹，吸热）
import Bi from './Bi.vue'
import { UI } from '../devices/pn-junction/sections/ui'
</script>

<template>
  <li><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="3.5" fill="none" stroke="var(--heat-out)" stroke-width="1.8" /><circle cx="9" cy="9" r="7.5" fill="none" stroke="var(--heat-out)" stroke-width="1.5" opacity="0.5" /></svg><Bi :t="UI.legend.heatOut" /></li>
  <li><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="3.5" fill="none" stroke="var(--heat-in)" stroke-width="1.5" opacity="0.5" /><circle cx="9" cy="9" r="7.5" fill="none" stroke="var(--heat-in)" stroke-width="1.8" /></svg><Bi :t="UI.legend.heatIn" /></li>
</template>
