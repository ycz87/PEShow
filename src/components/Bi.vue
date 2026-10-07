<script setup lang="ts">
// 双语文本：中文 / English / 中英对照。英文缺失时回退到中文
import { settings, type BiText } from '../app/settings'

defineProps<{ t: BiText; tag?: string }>()
</script>

<template>
  <component :is="tag || 'span'" class="bi" :class="settings.lang">
    <template v-if="settings.lang === 'en'">{{ t.en ?? t.zh }}</template>
    <template v-else-if="settings.lang === 'zh' || !t.en">{{ t.zh }}</template>
    <template v-else>
      <span class="bi-zh">{{ t.zh }}</span>
      <span class="bi-en" lang="en">{{ t.en }}</span>
    </template>
  </component>
</template>

<style scoped>
.bi.both > .bi-en {
  display: block;
  font-size: 0.72em;
  opacity: 0.72;
  font-weight: 400;
  margin-top: 0.15em;
  letter-spacing: 0;
}
</style>
