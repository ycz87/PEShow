<script setup lang="ts">
// 动态特性（0.8）的测试电路（电阻法）：正向电源 U₁、反向电源 U_R 经单刀双掷开关 S、限流电阻 R、回路电感 L 接二极管 D。
// 与波形同步：开关拨向哪边、回路电流的箭头（粗细 ∝ 电流大小，反向电流换色）、R 与二极管上的电压，以及这一刻电路里发生了什么。
// 元件与 recovery.ts 的模型一一对应（图在 CircuitSvg）。0.8-1 不拨开关，电路图占满一行，旁边写清两种接法
import { computed } from 'vue'
import Bi from './Bi.vue'
import Rich from './Rich.vue'
import CircuitSvg from './CircuitSvg.vue'
import type { SwitchLive } from '../app/switching'
import { L_LOOP, R_LIM, sampleAt, sources } from '../engine/physics/recovery'
import { UI } from '../devices/pn-junction/sections/ui'

const props = defineProps<{ live: SwitchLive | null }>()
const U = UI.circ

const w = computed(() => props.live?.w ?? null)
const wide = computed(() => props.live?.mode === 'intro')
const started = computed(() => !!props.live && (props.live.phase === 'run' || props.live.phase === 'done'))
const t = computed(() => (started.value ? props.live!.t : 0))
const s = computed(() => (w.value ? sampleAt(w.value, t.value) : null))
const src = computed(() => (w.value ? sources(w.value.p) : null))

/** 开关拨在 +U₁（true）还是 −U_R：关断前、开通后在 +U₁ */
const toU1 = computed(() => !!w.value && (w.value.kind === 'off') !== started.value)

/** 这一刻在发生什么 */
const phase = computed(() => {
  const x = w.value
  if (!x) return null
  if (x.kind === 'on') {
    if (!started.value) return U.ph.onPre
    return s.value!.v < 0.9 * x.v[x.v.length - 1] ? U.ph.onShift : U.ph.onBuild
  }
  const m = x.m!
  if (!started.value) return U.ph.offPre
  if (t.value < m.tBlock) return U.ph.offStore
  if (t.value < m.tEnd) return U.ph.offRecover
  return U.ph.offBlock
})

</script>

<template>
  <section class="chart panel circ" :class="{ wide }">
    <h3 class="panel-title">
      <Bi :t="U.title" />
      <span class="hint"><Bi :t="U.hint" /></span>
    </h3>
    <div class="body">
      <CircuitSvg
        v-if="w && s && src"
        :to-u1="toU1"
        :i="s.i"
        :u="s.v"
        :i-ref="Math.max(w.p.IF, w.p.IR)"
        unit="mA"
        :U1="src.U1"
        :UR="src.UR"
        :R="`${R_LIM} Ω`"
        :L="`${Math.round(L_LOOP * 1e6)} µH`"
      />
      <ul v-if="wide" class="how">
        <li v-for="(h, k) in U.how" :key="k"><Rich :t="h" /></li>
      </ul>
    </div>
    <p v-if="phase" class="phase"><Bi :t="phase" /></p>
  </section>
</template>

<style scoped>
.circ.panel { border-color: var(--accent); }
.wide { grid-column: 1 / -1; }
.body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px 20px;
  align-items: center;
}
.wide .body { grid-template-columns: minmax(0, 470px) minmax(0, 1fr); }
@media (max-width: 900px) {
  .wide .body { grid-template-columns: minmax(0, 1fr); }
}
.phase {
  margin: 6px 4px 0;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--ink);
}
</style>
