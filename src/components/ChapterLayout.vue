<script setup lang="ts">
// 一章的页面骨架：标题区（名称、一句话、图形符号卡片）→ 小节标签 → 步骤 → 舞台 + 讲解区 → 下方图表 → 模型说明。
// 舞台、图表与符号由各章通过插槽提供
import Bi from './Bi.vue'
import ExplainPanel from './ExplainPanel.vue'
import { COMMON_UI as UI } from '../devices/common/ui'
import type { BiText } from '../app/settings'
import type { ChapterContent, SectionBase } from '../devices/common/content'

defineProps<{ content: ChapterContent<SectionBase<any>>; crumb: BiText; secIdx: number; stepIdx: number; modelNote: BiText; hasCharts: boolean }>()
const emit = defineEmits<{ go: [sec: number, step: number] }>()
</script>

<template>
  <main class="page">
    <section class="hero">
      <div class="hero-text">
        <p class="crumb"><Bi :t="crumb" /></p>
        <h1 class="title"><Bi :t="content.name" /></h1>
        <p class="tagline"><Bi :t="content.tagline" /></p>
      </div>
      <slot name="symbol" />
    </section>

    <nav class="sections" :aria-label="UI.sections.zh">
      <button v-for="(s, i) in content.sections" :key="s.id" class="sec" :aria-current="i === secIdx ? 'true' : undefined" @click="emit('go', i, 0)">
        <span class="sec-no">{{ s.id }}</span>
        <Bi :t="s.title" />
      </button>
    </nav>

    <ol class="steps" :aria-label="UI.steps.zh">
      <li v-for="(s, i) in content.sections[secIdx].steps" :key="`${content.sections[secIdx].id}-${s.id}`">
        <button class="step" :aria-current="i === stepIdx ? 'step' : undefined" @click="emit('go', secIdx, i)">
          <span class="step-no">{{ i + 1 }}</span>
          <Bi :t="s.title" />
        </button>
      </li>
    </ol>

    <div class="main-grid">
      <slot name="stage" />
      <ExplainPanel :section="content.sections[secIdx]" :step="content.sections[secIdx].steps[stepIdx]" :index="stepIdx" />
    </div>

    <div v-if="hasCharts" class="bottom-grid">
      <slot name="charts" />
    </div>

    <p class="model-note"><Bi :t="modelNote" /></p>
  </main>
</template>

<style scoped>
.page {
  padding: 8px clamp(14px, 3vw, 36px) 28px;
  max-width: 1680px;
  margin: 0 auto;
}
.hero {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px 32px;
  margin: 10px 0 18px;
}
.hero-text {
  flex: 1 1 420px;
  max-width: 64ch;
}
.crumb {
  margin: 0;
  color: var(--ink-soft);
  font-size: 0.9rem;
}
.title {
  font-size: clamp(2.6rem, 6vw, 4.6rem);
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.05;
  margin: 2px 0 8px;
}
[data-style='glow'] .title {
  background: linear-gradient(100deg, var(--p-region), var(--potential) 45%, var(--electron));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
[data-style='sticker'] .title {
  font-weight: 700;
  color: var(--ink);
  text-shadow: 3px 3px 0 var(--accent);
}
[data-style='chalk'] .title {
  font-weight: 700;
  text-decoration: underline wavy var(--accent) 2px;
  text-underline-offset: 10px;
}
.title :deep(.bi-en) {
  -webkit-text-fill-color: var(--ink-soft);
  color: var(--ink-soft);
  text-shadow: none;
  letter-spacing: 0;
}
.tagline {
  margin: 0;
  font-size: 1.08rem;
  color: var(--ink-soft);
}

/* ── 小节标签：一条细轨道上的节号，当前节展开显示标题下划线 ── */
.sections {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin: 0 0 10px;
  border-bottom: 1.5px solid color-mix(in srgb, var(--ink) 14%, transparent);
}
.sec {
  flex: none;
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  border: 0;
  background: transparent;
  color: var(--ink-soft);
  font: inherit;
  font-size: 0.92rem;
  padding: 0.5em 0.8em 0.55em;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  margin-bottom: -1.5px;
}
.sec:hover {
  color: var(--ink);
}
.sec-no {
  font-family: var(--font-display);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.sec[aria-current='true'] {
  color: var(--ink);
  font-weight: 700;
  border-bottom-color: var(--accent);
}
.sec[aria-current='true'] .sec-no {
  color: var(--accent);
}
.sec:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.steps {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0;
  margin: 0 0 14px;
}
.step {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: var(--bw) solid var(--line);
  background: var(--surface);
  border-radius: 999px;
  padding: 0.35em 1.05em 0.35em 0.4em;
  cursor: pointer;
  font-weight: 600;
  transition: transform 0.15s, background 0.2s, box-shadow 0.2s;
}
.step-no {
  display: grid;
  place-items: center;
  width: 1.7em;
  height: 1.7em;
  border-radius: 50%;
  font-family: var(--font-display);
  font-weight: 700;
  background: color-mix(in srgb, var(--ink) 10%, transparent);
}
.step[aria-current='step'] {
  background: var(--accent);
  color: var(--bg);
}
.step[aria-current='step'] .step-no {
  background: var(--bg);
  color: var(--accent);
}
[data-style='glow'] .step {
  border-color: color-mix(in srgb, var(--ink) 14%, transparent);
}
[data-style='glow'] .step[aria-current='step'] {
  box-shadow: 0 0 24px -4px var(--accent);
}
[data-style='sticker'] .step {
  box-shadow: 3px 3px 0 var(--line);
}
[data-style='sticker'] .step[aria-current='step'] {
  color: var(--line);
  transform: translate(-1px, -2px);
  box-shadow: 4px 5px 0 var(--line);
}
[data-style='sticker'] .step[aria-current='step'] .step-no {
  background: #fff;
  color: var(--line);
}
[data-style='chalk'] .step {
  background: transparent;
  border-radius: 10px 14px 9px 15px / 14px 9px 15px 10px;
}
[data-style='chalk'] .step[aria-current='step'] {
  background: transparent;
  color: var(--accent);
  border-color: var(--accent);
}
[data-style='chalk'] .step[aria-current='step'] .step-no {
  background: var(--accent);
  color: var(--bg);
}

.main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 400px);
  gap: 18px;
  align-items: start;
  min-height: 360px;
}
/* ExplainPanel 单独撑满左列高度，不影响舞台的初始 clientWidth */
.main-grid > :deep(.explain) {
  align-self: stretch;
}
.bottom-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin-top: 18px;
}
@media (max-width: 1080px) {
  .main-grid,
  .bottom-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.model-note {
  margin: 22px 0 0;
  text-align: center;
  font-size: 0.85rem;
  color: var(--ink-soft);
}
</style>
