<script setup lang="ts">
// 二极管图形符号（GB/T 4728.5 / IEC 60617-05）：三角形指向竖线，电流由阳极 A 流向阴极 K
defineProps<{ conducting: boolean }>()
</script>

<template>
  <svg class="diode-symbol" viewBox="0 0 200 84" role="img" aria-label="二极管符号 A → K">
    <g fill="none" stroke="var(--ink)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 42 H78" />
      <path d="M122 42 H184" />
      <path d="M80 22 L80 62 L118 42 Z" :fill="conducting ? 'var(--accent)' : 'color-mix(in srgb, var(--ink) 10%, transparent)'" class="tri" />
      <path d="M120 21 V63" />
    </g>
    <circle cx="16" cy="42" r="4.5" fill="var(--ink)" />
    <circle cx="184" cy="42" r="4.5" fill="var(--ink)" />
    <text x="16" y="24" text-anchor="middle" class="term">A</text>
    <text x="184" y="24" text-anchor="middle" class="term">K</text>
    <!-- 导通时沿导线流动的电流点 -->
    <g v-if="conducting" class="flow">
      <circle v-for="i in 4" :key="i" r="3.4" cy="42" :style="{ animationDelay: `${-i * 0.35}s` }" />
    </g>
  </svg>
</template>

<style scoped>
.diode-symbol {
  width: 100%;
  max-width: 220px;
  display: block;
  overflow: visible;
}
.term {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 17px;
  fill: var(--ink);
}
.tri {
  transition: fill 0.3s;
}
.flow circle {
  fill: var(--field);
  animation: run 1.4s linear infinite;
}
@keyframes run {
  0% { transform: translateX(16px); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateX(184px); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .flow { display: none; }
}
</style>
