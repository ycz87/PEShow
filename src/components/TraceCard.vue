<script setup lang="ts">
// 追踪模式的"它的一生"卡片：被追踪载流子的来历、所在区域（少子 / 多子）、越过结的次数、存活时间与结局。
// 卡片放在载流子的另一侧，不挡住它（位置由舞台给出）
import { computed } from 'vue'
import Bi from './Bi.vue'
import type { TraceInfo } from '../engine/render/tracer'
import { UI } from '../devices/pn-junction/sections/ui'

const props = defineProps<{ trace: TraceInfo }>()
const U = UI.trace

/** 当前是少子还是多子（在耗尽层里不区分） */
const role = computed(() => {
  const t = props.trace
  if (t.region === 'SCR') return null
  return (t.kind === 0) === (t.region === 'P') ? U.minority : U.majority
})
const origin = computed(() => {
  const t = props.trace
  return t.origin === 'wireA' || t.origin === 'wireK' ? U.origins[t.origin][t.kind] : U.origins[t.origin]
})
const status = computed(() => {
  const t = props.trace
  if (t.status === 'exited') return t.kind === 0 ? U.status.exitedE : U.status.exitedH
  return U.status[t.status]
})
</script>

<template>
  <div class="life" :class="{ right: trace.x < 0.5 }">
    <div class="life-head">
      <i class="kind-dot" :class="trace.kind === 0 ? 'e' : 'h'" />
      <b><Bi :t="U.kind[trace.kind]" /></b>
      <span class="life-title"><Bi :t="U.title" /></span>
    </div>
    <dl>
      <dt><Bi :t="U.origin" /></dt>
      <dd><Bi :t="origin" /></dd>
      <dt><Bi :t="U.now" /></dt>
      <dd><Bi :t="U.regions[trace.region]" /><template v-if="role">（<Bi :t="role" />）</template></dd>
      <dt><Bi :t="U.crossings" /></dt>
      <dd>{{ trace.crossings }} <Bi :t="U.times" /></dd>
      <dt><Bi :t="U.age" /></dt>
      <dd>{{ trace.age.toFixed(1) }} s <small><Bi :t="trace.ageFromBirth ? U.ageNoteBirth : U.ageNote" /></small></dd>
    </dl>
    <p class="life-status" :class="trace.status"><Bi :t="status" /></p>
    <p v-if="trace.status !== 'free'" class="life-next"><Bi :t="U.next4s" /></p>
  </div>
</template>

<style scoped>
.life {
  position: absolute;
  width: min(270px, 42%);
  padding: 10px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  border: 1.5px solid var(--line);
  backdrop-filter: blur(8px);
  font-size: 0.78rem;
  line-height: 1.4;
}
.life.right { transform: translateX(-100%); }
.life-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 0.88rem;
}
.life-title { color: var(--ink-soft); margin-left: auto; font-size: 0.78rem; }
.kind-dot { width: 10px; height: 10px; border-radius: 50%; }
.kind-dot.e { background: var(--electron); }
.kind-dot.h { background: var(--hole); }
.life dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 10px;
  margin: 0;
}
.life dt { color: var(--ink-soft); }
.life dd { margin: 0; }
.life dd small { color: var(--ink-soft); font-size: 0.7rem; }
.life-status {
  margin: 8px 0 0;
  font-weight: 700;
}
.life-status.recombined { color: var(--heat-out); }
.life-status.exited { color: var(--electron); }
.life-next { margin: 2px 0 0; color: var(--ink-soft); font-size: 0.72rem; }
</style>
