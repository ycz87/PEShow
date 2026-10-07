<script setup lang="ts">
// 0.8 舞台控制条：换流按钮、进程提示、此刻的二极管电压；对比一步再加 I_F 与 di_F/dt 两个滑块
import { computed, ref, watch } from 'vue'
import Bi from './Bi.vue'
import { DIDT_RANGE, IF_RANGE, type SwitchLive } from '../app/switching'
import { sampleAt, type SwitchParams } from '../engine/physics/recovery'
import { UI } from '../devices/pn-junction/sections/ui'
import { tx } from '../app/settings'
import { signedV } from '../app/format'

const props = defineProps<{ live: SwitchLive }>()
const emit = defineEmits<{ press: []; params: [Partial<SwitchParams>] }>()

const S = UI.sw
const isOn = computed(() => props.live.w.kind === 'on')
const label = computed(() => {
  const again = props.live.phase === 'done'
  return isOn.value ? (again ? S.onAgain : S.on) : again ? S.offAgain : S.off
})
const status = computed(() => {
  const m = props.live.mode
  if (props.live.still) return m === 'intro' || m === 'compare' ? S.still[m] : S.ready
  return props.live.paused ? S.paused : S[props.live.phase]
})
const v = computed(() => sampleAt(props.live.w, props.live.t).v)

// 滑块拖动时只更新读数，松手才重新计算一次换流
const IF = ref(props.live.w.p.IF)
const didt = ref(props.live.w.p.didt)
watch(() => props.live.w.p, (p) => {
  IF.value = p.IF
  didt.value = p.didt
})
const num = (e: Event) => +(e.target as HTMLInputElement).value
</script>

<template>
  <div class="sw">
    <div class="sw-main">
      <!-- 准备阶段按钮不可按，底色按进度填充，免得以为"按不动"是坏了 -->
      <button
        v-if="!live.still"
        class="btn primary"
        :class="{ prep: live.phase === 'settle' }"
        :style="{ '--prep': `${Math.round(live.prep * 100)}%` }"
        :disabled="live.phase === 'settle' || live.phase === 'run'"
        @click="emit('press')"
      >
        <Bi :t="live.phase === 'settle' ? S.prep : label" />
      </button>
      <p class="sw-status" :class="{ paused: live.paused }" aria-live="polite"><Bi :t="status" /></p>
      <output class="sw-v" :class="v >= 0 ? 'fwd' : 'rev'" :title="tx(S.vD)">
        <small><Bi :t="S.vD" /></small>{{ signedV(v) }}
      </output>
    </div>
    <div v-if="live.mode === 'compare'" class="sw-params">
      <label class="bias">
        <span class="bias-name"><Bi :t="S.IF" /></span>
        <input type="range" :min="IF_RANGE.min" :max="IF_RANGE.max" :step="IF_RANGE.step" :value="IF" @input="IF = num($event)" @change="emit('params', { IF })" />
        <output class="bias-val">{{ Math.round(IF * 1e3) }} mA</output>
      </label>
      <label class="bias">
        <span class="bias-name"><Bi :t="S.didt" /></span>
        <input type="range" :min="DIDT_RANGE.min" :max="DIDT_RANGE.max" :step="DIDT_RANGE.step" :value="didt" @input="didt = num($event)" @change="emit('params', { didt })" />
        <output class="bias-val">{{ Math.round(didt / 1e3) }} mA/µs</output>
      </label>
    </div>
    <small class="sw-circuit"><Bi :t="S.circuit" /></small>
  </div>
</template>

<style scoped>
.sw {
  flex: 1 1 360px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 260px;
}
.sw-main {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sw-main .btn { white-space: nowrap; }
.sw-main .btn.prep {
  min-width: 9em;
  background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 55%, transparent) var(--prep), transparent var(--prep));
}
.sw-status {
  flex: 1;
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.35;
  color: var(--ink-soft);
}
.sw-status.paused {
  color: var(--accent);
  font-weight: 700;
}
.sw-v {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.15rem;
  min-width: 5.2em;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}
.sw-v small {
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 0.68rem;
  color: var(--ink-soft);
}
.sw-v.fwd { color: var(--accent); }
.sw-v.rev { color: var(--potential); }
.sw-params {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
}
.sw-params .bias-val { font-size: 0.95rem; min-width: 5.4em; }
.sw-circuit {
  color: var(--ink-soft);
  font-size: 0.72rem;
}
</style>
