<script setup lang="ts">
// 页面外壳：顶栏（品牌、吉祥物、语言）、章节条、当前章节、页脚；风格与深浅主题由右下角悬浮按钮切换。
// 章节由地址里的 #ch0、#ch1 决定，第 1 章按需加载（含 3D 部分），不拖慢第 0 章
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import Bi from './components/Bi.vue'
import BrandMark from './components/BrandMark.vue'
import StyleDock from './components/StyleDock.vue'
import PnChapter from './devices/pn-junction/PnChapter.vue'
import { settings, type Lang } from './app/settings'
import { STYLE_IDS, applyTokens } from './design/tokens'

const DiodeChapter = defineAsyncComponent(() => import('./devices/power-diode/DiodeChapter.vue'))

watchEffect(() => applyTokens(settings.style, settings.theme))

const chapters = [
  { zh: '半导体基础', en: 'Semiconductor basics', ready: true },
  { zh: '功率二极管', en: 'Power diode', ready: true },
  { zh: '功率 BJT', en: 'Power BJT' },
  { zh: '晶闸管家族', en: 'Thyristors' },
  { zh: '功率 MOSFET', en: 'Power MOSFET' },
  { zh: 'IGBT', en: 'IGBT' },
  { zh: 'IGCT', en: 'IGCT' },
  { zh: 'SiC 器件', en: 'SiC devices' },
  { zh: 'GaN 器件', en: 'GaN devices' },
]

const fromHash = () => {
  const n = Number(location.hash.match(/^#ch(\d+)/)?.[1] ?? 0)
  return chapters[n]?.ready ? n : 0
}
const chapter = ref(fromHash())
const onHash = () => (chapter.value = fromHash())
function openChapter(i: number) {
  if (!chapters[i].ready) return
  location.hash = `#ch${i}`
  window.scrollTo({ top: 0 })
}

/** 与章节无关的快捷键：1/2/3 换风格、T 深浅、M 吉祥物（翻步、播放由各章处理） */
function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement
  if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable)) return
  if (e.key === '1' || e.key === '2' || e.key === '3') settings.style = STYLE_IDS[+e.key - 1]
  else if (e.key === 't' || e.key === 'T') settings.theme = settings.theme === 'dark' ? 'light' : 'dark'
  else if (e.key === 'm' || e.key === 'M') settings.mascot = !settings.mascot
  else return
  e.preventDefault()
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('hashchange', onHash)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('hashchange', onHash)
})

const langs: { id: Lang; label: string }[] = [
  { id: 'zh', label: '中' },
  { id: 'en', label: 'EN' },
  { id: 'both', label: '中/EN' },
]

const TEXT = {
  lab: { zh: '功率器件可视化实验室', en: 'Power Device Visual Lab' },
  mascot: { zh: '吉祥物', en: 'Mascots' },
  soon: { zh: '制作中', en: 'Coming soon' },
  footer: { zh: '由 B站 UP 主「西瓜粥」制作，面向电力电子技术课堂与自学。', en: 'Made by Bilibili creator 西瓜粥 for power electronics teaching and self-study.' },
}
</script>

<template>
  <div class="backdrop" aria-hidden="true" />

  <header class="topbar">
    <a class="brand" href="#ch0" @click.prevent="openChapter(0)">
      <BrandMark :size="44" />
      <span class="brand-text">
        <span class="brand-name"><Bi :t="TEXT.lab" /></span>
        <span class="brand-by">B站 UP 主 西瓜粥 出品</span>
      </span>
    </a>
    <div class="prefs">
      <button class="chip" :aria-pressed="settings.mascot" @click="settings.mascot = !settings.mascot"><Bi :t="TEXT.mascot" /></button>
      <div class="seg" role="group" aria-label="语言 Language">
        <button v-for="l in langs" :key="l.id" :aria-pressed="settings.lang === l.id" @click="settings.lang = l.id">{{ l.label }}</button>
      </div>
    </div>
  </header>

  <nav class="chapters" aria-label="章节">
    <button
      v-for="(c, i) in chapters"
      :key="i"
      class="ch"
      :class="{ on: i === chapter }"
      :disabled="!c.ready"
      :title="c.ready ? undefined : TEXT.soon.zh"
      :aria-current="i === chapter ? 'page' : undefined"
      @click="openChapter(i)"
    >
      <span class="ch-no">{{ i }}</span>
      <Bi :t="c" />
    </button>
  </nav>

  <PnChapter v-if="chapter === 0" />
  <DiodeChapter v-else-if="chapter === 1" />

  <footer class="footer">
    <p class="credit">
      <BrandMark :size="28" />
      <span><Bi :t="TEXT.footer" /></span>
    </p>
  </footer>

  <StyleDock />
</template>

<style scoped>
/* ── 顶栏 ── */
.topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  padding: 14px clamp(14px, 3vw, 36px) 8px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: inherit;
  text-decoration: none;
}
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.brand-name {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.12rem;
}
.brand-by {
  font-size: 0.78rem;
  color: var(--ink-soft);
}
.prefs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* ── 章节条 ── */
.chapters {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 6px clamp(14px, 3vw, 36px) 10px;
  scrollbar-width: thin;
}
.ch {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-size: 0.85rem;
  padding: 0.3em 0.85em 0.3em 0.35em;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--ink-soft);
  opacity: 0.75;
  cursor: pointer;
}
.ch:disabled {
  cursor: default;
  opacity: 0.45;
}
.ch:not(:disabled):hover {
  opacity: 1;
  color: var(--ink);
}
.ch:focus-visible {
  outline: 2px solid var(--accent);
}
.ch.on {
  opacity: 1;
  color: var(--ink);
  font-weight: 700;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}
.ch-no {
  display: grid;
  place-items: center;
  width: 1.6em;
  height: 1.6em;
  border-radius: 50%;
  font-size: 0.78rem;
  font-weight: 700;
  background: color-mix(in srgb, var(--ink) 10%, transparent);
}
.ch.on .ch-no {
  background: var(--accent);
  color: var(--bg);
}
[data-style='sticker'] .ch.on {
  border: 2.5px solid var(--line);
  background: var(--accent);
  color: var(--line);
  box-shadow: 2px 2px 0 var(--line);
}
[data-style='sticker'] .ch.on .ch-no {
  background: #fff;
  color: var(--line);
}

.footer {
  padding: 18px 16px 30px;
  font-size: 0.85rem;
  color: var(--ink-soft);
  text-align: center;
}
.footer p {
  margin: 0;
}
.credit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
</style>
