<script setup lang="ts">
// "一个电子走一圈"示意演示旁边的说明：左边是路线（当前路段高亮），右边说明实际情况和演示有哪些不同
import Bi from './Bi.vue'
import { tx } from '../app/settings'
import type { LapInfo } from '../engine/render/lap'
import { UI } from '../devices/pn-junction/sections/ui'

defineProps<{ info: LapInfo | null }>()
const emit = defineEmits<{ again: []; close: [] }>()
const U = UI.lap
</script>

<template>
  <section class="lap">
    <header>
      <b><Bi :t="U.start" /></b>
      <span class="tag"><Bi :t="U.tag" /></span>
      <button class="btn" @click="emit('again')"><Bi :t="U.again" /></button>
      <button class="close" :aria-label="tx(U.close)" :title="tx(U.close)" @click="emit('close')">×</button>
    </header>
    <div class="cols">
      <ol class="route">
        <li
          v-for="(leg, i) in U.legs"
          :key="i"
          :class="{ done: !info || info.done || i < info.leg, now: info && !info.done && i === info.leg }"
        >
          <Bi :t="leg" />
          <em v-if="info && !info.done && i === info.leg && info.fast">（<Bi :t="U.fast" />）</em>
        </li>
      </ol>
      <aside class="real">
        <b><Bi :t="U.realTitle" /></b>
        <ul>
          <li v-for="(t, i) in U.real" :key="i"><Bi :t="t" /></li>
        </ul>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.lap {
  margin: 10px 0 4px;
  padding: 10px 14px 12px;
  border-radius: 12px;
  border: 1.5px dashed color-mix(in srgb, var(--electron) 70%, var(--line));
  background: color-mix(in srgb, var(--electron) 6%, var(--surface));
  font-size: 0.82rem;
  line-height: 1.5;
}
header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-bottom: 8px;
}
header b {
  font-family: var(--font-display);
  font-size: 0.95rem;
}
.tag {
  padding: 0.05em 0.7em;
  border-radius: 999px;
  font-size: 0.75rem;
  color: var(--accent);
  border: 1.5px solid var(--accent);
}
header .btn {
  margin-left: auto;
}
.close {
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ink-soft);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.close:hover,
.close:focus-visible {
  background: color-mix(in srgb, var(--ink) 10%, transparent);
  color: var(--ink);
}
.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
  gap: 14px;
}
@media (max-width: 720px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
.route {
  margin: 0;
  padding-left: 1.6em;
  color: var(--ink-soft);
}
.route li {
  padding: 1px 0;
  transition: color 0.2s;
}
.route li.done {
  color: var(--ink);
}
.route li.now {
  color: var(--ink);
  font-weight: 700;
}
.route li.now::marker {
  color: var(--electron);
}
.route em {
  font-style: normal;
  color: var(--accent);
}
.real {
  padding: 8px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
}
.real ul {
  margin: 4px 0 0;
  padding-left: 1.2em;
}
.real li + li {
  margin-top: 3px;
}
</style>
