<script setup lang="ts">
// 1.3 的参数表：每行一个手册参数，标明额定值 / 特性值 / 测试条件，给出含义、示例 PiN 与 STTH3012 的数值。
// 点一行选中它（同一步里的图跟着高亮对应位置），再点一次取消
import Bi from './Bi.vue'
import Rich from './Rich.vue'
import { fillBi } from '../app/settings'
import { UI_STATIC as U, type ParamRow } from '../devices/power-diode/sections/uiStatic'

const props = defineProps<{ rows: ParamRow[]; values: Record<string, Record<string, string | number>>; active: string | null }>()
const emit = defineEmits<{ select: [key: string | null] }>()

const toggle = (k: string) => emit('select', props.active === k ? null : k)
const sym = (r: ParamRow) => ({ zh: `$${r.sym}$` })
</script>

<template>
  <div class="ptable">
    <p class="pt-hint"><Bi :t="U.kindHint" /></p>
    <div class="pt-scroll">
      <table>
        <thead>
          <tr><th v-for="(h, k) in U.head" :key="k"><Bi :t="h" /></th></tr>
        </thead>
        <tbody>
          <tr
            v-for="r in rows"
            :key="r.key"
            :class="{ on: active === r.key }"
            tabindex="0"
            :aria-pressed="active === r.key"
            @click="toggle(r.key)"
            @keydown.enter.space.prevent="toggle(r.key)"
          >
            <th>
              <Rich :t="sym(r)" class="pt-sym" />
              <Bi :t="r.name" class="pt-name" />
            </th>
            <td><span class="pt-kind" :class="r.kind"><Bi :t="U.kind[r.kind]" /></span></td>
            <td class="pt-means"><Rich :t="r.means" /></td>
            <td class="pt-val"><Rich :t="fillBi(r.ex, values[r.key] ?? {})" /></td>
            <td class="pt-val"><Rich :t="r.ds" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.ptable { display: flex; flex-direction: column; gap: 6px; }
.pt-hint { margin: 0; font-size: 0.8rem; color: var(--ink-soft); }
.pt-scroll { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; min-width: 720px; font-size: 0.84rem; }
thead th { text-align: left; color: var(--ink-soft); font-weight: 700; padding: 4px 8px; white-space: nowrap; }
tbody tr { cursor: pointer; transition: background 0.2s; }
tbody tr:hover { background: color-mix(in srgb, var(--ink) 5%, transparent); }
tbody tr.on { background: color-mix(in srgb, var(--accent) 16%, transparent); }
tbody th, tbody td { padding: 6px 8px; border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent); text-align: left; vertical-align: top; }
tbody th { min-width: 9em; }
.pt-sym { font-size: 1.1rem; }
.pt-name { display: block; font-weight: 700; font-size: 0.8rem; }
.pt-means { min-width: 18em; }
.pt-val { min-width: 9em; font-variant-numeric: tabular-nums; }
.pt-kind { font-size: 0.72rem; font-weight: 700; padding: 1px 7px; border-radius: 99px; white-space: nowrap; }
.pt-kind.rating { background: color-mix(in srgb, var(--danger) 18%, transparent); color: var(--danger); }
.pt-kind.char { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); }
.pt-kind.cond { background: color-mix(in srgb, var(--ink) 12%, transparent); color: var(--ink-soft); }
</style>
