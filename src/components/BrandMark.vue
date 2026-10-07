<script setup lang="ts">
// 西瓜粥品牌标识：一牙西瓜，瓜子是一颗"电子"和一颗"空穴"
defineProps<{ size?: number }>()
</script>

<template>
  <svg class="brand-mark" :width="size || 40" :height="size || 40" viewBox="0 0 64 64" aria-hidden="true">
    <g transform="rotate(-14 32 32)">
      <path d="M4 26 A28 28 0 0 0 60 26 Z" fill="#2E9E4F" stroke="var(--line, #1B1736)" stroke-width="3" stroke-linejoin="round" />
      <path d="M9 26 A23 23 0 0 0 55 26 Z" fill="#E8F7D6" />
      <path d="M12 26 A20 20 0 0 0 52 26 Z" fill="#FF4F6D" />
      <ellipse cx="22" cy="33" rx="2.3" ry="3.4" fill="#2A1A2E" transform="rotate(-20 22 33)" />
      <ellipse cx="42" cy="33" rx="2.3" ry="3.4" fill="#2A1A2E" transform="rotate(20 42 33)" />
      <circle cx="28" cy="40" r="3.4" fill="#3FA2FF" stroke="#1B1736" stroke-width="1.4" />
      <circle cx="37" cy="40" r="3" fill="#FFF" stroke="#FF8A26" stroke-width="2.2" />
      <path d="M4 26 H60" stroke="var(--line, #1B1736)" stroke-width="3" stroke-linecap="round" />
    </g>
  </svg>
</template>

<style scoped>
.brand-mark {
  display: block;
  flex: none;
}
[data-style='glow'] .brand-mark {
  filter: drop-shadow(0 0 10px rgba(255, 79, 109, 0.45));
}
</style>
