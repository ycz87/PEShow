<script setup lang="ts">
// 讲解正文：支持行内公式、加粗与列表（标记见 app/rich.ts）。英文缺失时回退到中文
import { computed } from 'vue'
import { richHtml } from '../app/rich'
import { settings, type BiText } from '../app/settings'

const props = defineProps<{ t: BiText }>()

const zh = computed(() => richHtml(props.t.zh))
const en = computed(() => (props.t.en ? richHtml(props.t.en) : ''))
</script>

<template>
  <div v-if="settings.lang === 'en' && en" class="rich" lang="en" v-html="en" />
  <div v-else class="rich">
    <div v-html="zh" />
    <div v-if="settings.lang === 'both' && en" class="rich-en" lang="en" v-html="en" />
  </div>
</template>

<style scoped>
.rich :deep(p) {
  margin: 0 0 0.45em;
}
.rich :deep(p:last-child) {
  margin-bottom: 0;
}
.rich :deep(ul) {
  margin: 0.2em 0 0.45em;
  padding-left: 1.2em;
}
.rich :deep(li) {
  margin: 0.15em 0;
}
.rich :deep(li::marker) {
  color: var(--accent);
}
.rich :deep(strong) {
  font-weight: 700;
}
.rich-en {
  font-size: 0.8em;
  opacity: 0.72;
  margin-top: 0.3em;
}
</style>
