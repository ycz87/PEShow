<script setup lang="ts">
// 1.2 的 3D 舞台：Three.js 画布 + 与画布同坐标的编号点 / 层标签 + 零件列表与说明 + 分解滑块、视图开关（热流、压力）、缩放按钮。
// 两个模型（TO-247、平板压接型）由 engine/render/three 里的 buildXxx 生成，舞台与交互是通用的；
// 换步骤时同一个画布换模型，不重建渲染器
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import gsap from 'gsap'
import Bi from './Bi.vue'
import StageTransport from './StageTransport.vue'
import { settings } from '../app/settings'
import { exposeDebug } from '../app/debug'
import { Stage3D, type Model3D, type ProjectedAnchor } from '../engine/render/three/Stage3D'
import { ToonKit } from '../engine/render/three/toon'
import { PRESSFIT_PARTS, buildPressfit } from '../engine/render/three/pressfit'
import { TO247_PARTS, buildTO247 } from '../engine/render/three/to247'
import { UI } from '../devices/power-diode/sections/ui'
import { UI3D, type ModelText, type ViewId } from '../devices/power-diode/sections/ui3d'
import type { Step } from '../devices/power-diode/sections/types'

const props = defineProps<{ step: Step }>()
const T = UI3D.stage

interface ModelDef {
  build: (kit: ToonKit) => Model3D
  parts: readonly string[]
  /** 视图按钮，按显示顺序 */
  views: readonly ViewId[]
  text: ModelText
}
/** 步骤的 mode → 模型 */
const MODELS: Record<string, ModelDef> = {
  to247: { build: buildTO247, parts: TO247_PARTS, views: ['heat'], text: UI3D.to247 },
  pressfit: { build: buildPressfit, parts: PRESSFIT_PARTS, views: ['force', 'heat'], text: UI3D.pressfit },
}
const def = computed(() => MODELS[props.step.mode] ?? MODELS.to247)
const TAGS = ['A', 'K', 'Pp', 'Nm', 'Np'] as const
const TAG_TEXT: Record<(typeof TAGS)[number], string> = { A: 'A', K: 'K', Pp: 'P⁺', Nm: 'N⁻', Np: 'N⁺' }

const host = ref<HTMLDivElement>()
const stage = shallowRef<Stage3D>()
const playing = ref(true)
const speed = ref(1)
const SPEEDS = [0.5, 1, 2]
const explode = ref(0)
const views = reactive<Record<ViewId, boolean>>({ heat: false, force: false })
const selected = ref<string | null>(null)
const hostW = ref(0)
const hostH = computed(() => (hostW.value ? Math.round(Math.min(560, Math.max(380, hostW.value * 0.62))) : 460))

// 标注点的 DOM 元素：每帧由舞台直接改位置，不走 Vue 响应式
const els = new Map<string, HTMLElement>()
const setEl = (id: string) => (el: unknown) => {
  if (el instanceof HTMLElement) els.set(id, el)
  else els.delete(id)
}
function place(list: ProjectedAnchor[]) {
  for (const a of list) {
    const el = els.get(a.id)
    if (!el) continue
    el.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px) translate(-50%, -50%)`
    el.style.opacity = a.visible ? '1' : '0'
    el.style.pointerEvents = a.visible ? 'auto' : 'none'
  }
}

let kit: ToonKit | undefined
let ro: ResizeObserver | undefined

/** 装入当前步骤对应的模型：旧模型由舞台拆掉，分解程度、视图、选中都回到初始 */
function loadModel() {
  tween?.kill()
  explode.value = 0
  views.heat = views.force = false
  selected.value = null
  stage.value!.setModel(def.value.build(kit!))
}

onMounted(() => {
  const h = host.value!
  hostW.value = h.clientWidth
  kit = new ToonKit(settings.style, settings.theme)
  const s = new Stage3D(h, kit)
  s.onFrame = place
  s.onPick = select
  stage.value = s
  loadModel()
  ro = new ResizeObserver(() => (hostW.value = h.clientWidth))
  ro.observe(h)
  exposeDebug({ stage3d: s })
})

onBeforeUnmount(() => {
  tween?.kill()
  ro?.disconnect()
  stage.value?.dispose()
})

watch(() => [settings.style, settings.theme] as const, ([st, th]) => {
  kit?.setStyle(st, th)
  stage.value?.refreshStates()
})
watch(explode, (t) => stage.value?.setExplode(t))
watch(playing, (p) => {
  if (stage.value) stage.value.playing = p
})
watch(speed, (v) => {
  if (stage.value) stage.value.speed = v
})
// 从 TO-247 步骤切到压接型步骤（或反过来）：同一个画布换模型
watch(() => props.step.mode, (m) => {
  if (m in MODELS) loadModel()
})

function select(id: string | null) {
  selected.value = id === selected.value ? null : id
  stage.value?.setSelected(selected.value)
}

function toggleView(v: ViewId) {
  views[v] = !views[v]
  stage.value?.setView(v, views[v])
}

// 分解 / 合拢按钮：补间动画（拖滑块时中断）
let tween: gsap.core.Tween | undefined
const anim = { v: 0 }
function toggleExplode() {
  tween?.kill()
  anim.v = explode.value
  const to = explode.value > 0.5 ? 0 : 1
  tween = gsap.to(anim, { v: to, duration: 1.6, ease: 'power2.inOut', onUpdate: () => (explode.value = anim.v) })
}
function onSlide(e: Event) {
  tween?.kill()
  explode.value = +(e.target as HTMLInputElement).value
}

function replay() {
  tween?.kill()
  explode.value = 0
  for (const v of def.value.views) {
    views[v] = false
    stage.value?.setView(v, false)
  }
  select(null)
  stage.value?.reset()
}

const info = computed(() => (selected.value ? def.value.text.parts[selected.value] : null))
/** 当前打开的视图各自带的说明 */
const notes = computed(() =>
  def.value.views.flatMap((v) => {
    const t = def.value.text.notes[v]
    return views[v] && t ? [{ v, t }] : []
  }),
)
defineExpose({ togglePlay: () => (playing.value = !playing.value) })
</script>

<template>
  <section class="stage panel">
    <div ref="host" class="canvas-host" :style="{ height: `${hostH}px` }">
      <div class="overlay">
        <button
          v-for="(id, i) in def.parts"
          :key="id"
          :ref="setEl(id)"
          class="dot3"
          :class="{ on: selected === id }"
          :aria-label="def.text.parts[id].name.zh"
          @click="select(id)"
        >
          {{ i + 1 }}
        </button>
        <span v-for="t in TAGS" :key="t" :ref="setEl(`tag:${t}`)" class="tag3">{{ TAG_TEXT[t] }}</span>
      </div>
    </div>

    <ul class="parts3" role="list">
      <li v-for="(id, i) in def.parts" :key="id">
        <button class="part3" :class="{ on: selected === id }" :aria-pressed="selected === id" @click="select(id)">
          <b>{{ i + 1 }}</b>
          <Bi :t="def.text.parts[id].name" />
        </button>
      </li>
    </ul>

    <div class="info3" :class="{ empty: !info }">
      <template v-if="info">
        <b class="info3-name"><Bi :t="info.name" /></b>
        <p><Bi :t="info.what" /></p>
        <p class="info3-real"><Bi :t="info.real" /></p>
      </template>
      <p v-else class="info3-hint"><Bi :t="def.text.hint" /></p>
      <p v-for="n in notes" :key="n.v" class="info3-note" :class="n.v"><Bi :t="n.t" /></p>
    </div>

    <div class="stage-bottom">
      <StageTransport v-model:playing="playing" v-model:speed="speed" :speeds="SPEEDS" @replay="replay">
        <button class="btn" @click="toggleExplode"><Bi :t="explode > 0.5 ? T.assemble : T.explode" /></button>
        <button v-for="v in def.views" :key="v" class="btn" :aria-pressed="views[v]" @click="toggleView(v)"><Bi :t="T.views[v]" /></button>
        <button class="btn" :aria-label="T.zoomIn.zh" @click="stage?.zoom(0.8)">＋</button>
        <button class="btn" :aria-label="T.zoomOut.zh" @click="stage?.zoom(1.25)">－</button>
      </StageTransport>
      <label class="bias fwd">
        <span class="bias-name"><Bi :t="T.slider" /></span>
        <input type="range" min="0" max="1" step="0.005" :value="explode" @input="onSlide" />
      </label>
    </div>

    <p class="scaled"><Bi :t="UI.scaled[step.mode]" /></p>
  </section>
</template>

<style scoped>
.dot3,
.tag3 {
  position: absolute;
  left: 0;
  top: 0;
  transition: opacity 0.25s;
  will-change: transform;
}
.dot3 {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font: 800 0.82rem var(--font-display);
  color: var(--bg);
  background: var(--accent);
  border: var(--bw, 2px) solid var(--line);
  cursor: pointer;
  pointer-events: auto;
}
.dot3.on {
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 45%, transparent);
  transform-origin: center;
}
.tag3 {
  padding: 0 0.55em;
  border-radius: 999px;
  font: 800 0.8rem/1.6 var(--font-display);
  color: var(--ink);
  background: color-mix(in srgb, var(--surface) 85%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--ink) 40%, transparent);
  white-space: nowrap;
  pointer-events: none;
}
.parts3 {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
}
.part3 {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0.25em 0.8em 0.25em 0.3em;
  border-radius: 999px;
  border: 2px solid color-mix(in srgb, var(--ink) 30%, transparent);
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  color: var(--ink);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}
.part3 b {
  width: 1.5em;
  height: 1.5em;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 0.8rem;
  color: var(--bg);
  background: var(--accent);
}
.part3.on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}
.info3 {
  min-height: 5.6em;
  padding: 8px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  font-size: 0.88rem;
  line-height: 1.55;
}
.info3 p { margin: 2px 0 0; }
.info3-name { font-family: var(--font-display); font-size: 1rem; }
.info3-real { color: var(--ink-soft); font-size: 0.8rem; }
.info3-hint { color: var(--ink-soft); }
.info3-note {
  margin-top: 6px;
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 0.82rem;
}
.info3-note.heat { background: color-mix(in srgb, var(--heat-out) 16%, transparent); }
.info3-note.force { background: color-mix(in srgb, var(--potential) 18%, transparent); }
</style>
