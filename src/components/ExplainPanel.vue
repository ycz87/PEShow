<script setup lang="ts">
// 讲解区：承上 / 本节 / 启下 → 这一步的画面说明 → 一句话 → 打个比方 → 通俗讲解 → 深入一步 → 示意说明。
// 正文按"节"组织，只有步骤标题、画面说明和吉祥物台词随步骤变化
import { computed, ref } from 'vue'
import katex from 'katex'
import Bi from './Bi.vue'
import Rich from './Rich.vue'
import Mascot from './Mascot.vue'
import { settings } from '../app/settings'
import { COMMON_UI as UI } from '../devices/common/ui'
import type { Formula, SectionBase, StepBase } from '../devices/common/content'

const props = defineProps<{ section: SectionBase; step: StepBase; index: number }>()
const deepOpen = ref(true)
const moreOpen = ref(false)

const render = (list: Formula[]) =>
  list.map((f) => ({
    html: katex.renderToString(f.tex, { displayMode: true, throwOnError: false, output: 'html' }),
    note: f.note,
  }))
const core = computed(() => render(props.section.deep.core))
const ext = computed(() => render(props.section.deep.ext))
const hasMore = computed(() => ext.value.length > 0 || (props.section.deep.extText?.length ?? 0) > 0)
const bridge = computed(() =>
  (['prev', 'here', 'next'] as const)
    .map((k) => ({ k, t: props.section.bridge[k] }))
    .filter((b) => b.t),
)
</script>

<template>
  <section class="explain panel">
    <div :key="section.id" class="inner swap-in">
      <dl class="bridge">
        <div v-for="b in bridge" :key="b.k" class="bridge-row" :class="b.k">
          <dt><Bi :t="UI.bridge[b.k]" /></dt>
          <dd><Rich :t="b.t!" /></dd>
        </div>
      </dl>

      <div :key="step.id" class="step swap-in">
        <h3 class="step-title">
          <span class="num">{{ index + 1 }}</span>
          <Bi :t="step.title" />
        </h3>
        <div class="caption"><Rich :t="step.caption" /></div>

        <div v-if="settings.mascot && step.mascot" class="mascots">
          <figure class="m">
            <Mascot kind="electron" :mood="step.mascot.electron.mood" :size="64" />
            <figcaption class="bubble left"><Bi :t="step.mascot.electron.say" /></figcaption>
          </figure>
          <figure class="m right">
            <figcaption class="bubble right"><Bi :t="step.mascot.hole.say" /></figcaption>
            <Mascot kind="hole" :mood="step.mascot.hole.mood" :size="64" />
          </figure>
        </div>
      </div>

      <div class="one-liner"><Rich :t="section.oneLiner" /></div>

      <div v-if="settings.mascot && section.analogy.length" class="block analogy">
        <h4 class="layer-name"><Bi :t="UI.analogy" /></h4>
        <Rich v-for="(a, i) in section.analogy" :key="i" :t="a" class="para" />
      </div>

      <div class="block story">
        <h4 class="layer-name"><Bi :t="UI.layerStory" /></h4>
        <Rich v-for="(p, i) in section.plain" :key="i" :t="p" class="para" />
      </div>

      <div class="deep" :class="{ open: deepOpen }">
        <button class="deep-toggle" :aria-expanded="deepOpen" @click="deepOpen = !deepOpen">
          <span class="caret" aria-hidden="true">▸</span>
          <Bi :t="UI.layerDeep" />
        </button>
        <div v-show="deepOpen" class="deep-body">
          <Rich v-for="(t, i) in section.deep.text" :key="i" :t="t" class="para" />
          <figure v-for="(f, i) in core" :key="i" class="formula">
            <div v-html="f.html" />
            <figcaption><Rich :t="f.note" /></figcaption>
          </figure>
          <template v-if="hasMore">
            <button class="more-toggle" :class="{ open: moreOpen }" :aria-expanded="moreOpen" @click="moreOpen = !moreOpen">
              <Bi :t="UI.more" /> <span class="caret" aria-hidden="true">▸</span>
            </button>
            <div v-show="moreOpen">
              <figure v-for="(f, i) in ext" :key="i" class="formula ext">
                <div v-html="f.html" />
                <figcaption><Rich :t="f.note" /></figcaption>
              </figure>
              <Rich v-for="(t, i) in section.deep.extText ?? []" :key="i" :t="t" class="para" />
            </div>
          </template>
        </div>
      </div>

      <div v-if="section.notes.length" class="block notes">
        <h4 class="layer-name"><Bi :t="UI.notes" /></h4>
        <ul>
          <li v-for="(n, i) in section.notes" :key="i"><Rich :t="n" /></li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.explain {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  box-sizing: border-box;
}

.inner {
  padding: 18px 20px 16px;
  overflow-y: auto;
  flex: 1 1 0;
  min-height: 0;
  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--ink) 22%, transparent) transparent;
}
/* Chromium / Safari */
.inner::-webkit-scrollbar {
  width: 5px;
}
.inner::-webkit-scrollbar-track {
  background: transparent;
}
.inner::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink) 22%, transparent);
}
.inner::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--ink) 38%, transparent);
}

/* 单列布局（≤1080px）时右侧面板自然展开，不强制滚动 */
@media (max-width: 1080px) {
  .explain {
    height: auto;
    overflow: visible;
  }
  .inner {
    overflow-y: visible;
    flex: none;
  }
}

.bridge {
  margin: 0 0 14px;
  display: grid;
  gap: 6px;
  font-size: 0.86rem;
}
.bridge-row {
  display: grid;
  grid-template-columns: 3.2em 1fr;
  gap: 8px;
  align-items: baseline;
}
.bridge-row dt {
  font-weight: 700;
  color: var(--ink-soft);
}
.bridge-row dd {
  margin: 0;
  color: var(--ink-soft);
}
.bridge-row.here dt,
.bridge-row.here dd {
  color: var(--ink);
}
.bridge-row.here dd {
  font-size: 0.97rem;
}

.step {
  padding: 10px 12px;
  margin: 0 -4px 12px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
.caption {
  font-size: 0.92rem;
  margin-top: 6px;
}

.mascots {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 8px -4px 0;
}
.m {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.m.right {
  justify-content: flex-end;
}
.bubble {
  position: relative;
  font-size: 0.86rem;
  line-height: 1.45;
  padding: 0.5em 0.85em;
  border-radius: 16px;
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  max-width: 230px;
}
.bubble.left {
  border-bottom-left-radius: 4px;
}
.bubble.right {
  border-bottom-right-radius: 4px;
}
[data-style='sticker'] .bubble {
  background: #fff;
  color: #2a2140;
  border: 2.5px solid var(--line);
  box-shadow: 2px 2px 0 var(--line);
}
[data-style='chalk'] .bubble {
  background: transparent;
  border: 1.6px dashed var(--line);
}
[data-style='glow'] .bubble {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
}

.step-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.25rem;
  font-weight: 700;
}
.num {
  flex: none;
  display: grid;
  place-items: center;
  width: 1.55em;
  height: 1.55em;
  border-radius: 50%;
  font-size: 0.85em;
  background: var(--accent);
  color: var(--bg);
}
[data-style='sticker'] .num {
  color: var(--line);
  border: 3px solid var(--line);
}
[data-style='chalk'] .num {
  background: transparent;
  color: var(--accent);
  border: 2px solid var(--accent);
}

.one-liner {
  font-family: var(--font-display);
  font-size: 1.08rem;
  line-height: 1.55;
  font-weight: 600;
  margin: 0 0 14px;
  padding-left: 12px;
  border-left: 4px solid var(--accent);
}
[data-style='chalk'] .one-liner {
  font-family: var(--font-body);
  font-weight: 700;
}

.layer-name {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--ink-soft);
  margin: 0 0 4px;
  font-family: var(--font-body);
}
.block {
  margin-bottom: 10px;
}
.para {
  margin: 0 0 0.7em;
  font-size: 0.95rem;
}
.analogy .para {
  font-size: 0.93rem;
}
.deep {
  margin-top: 6px;
  border-top: 1.5px dashed color-mix(in srgb, var(--ink) 22%, transparent);
  padding-top: 8px;
}
.deep-toggle,
.more-toggle {
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 4px 0;
  font-weight: 700;
  color: var(--potential);
  display: flex;
  align-items: center;
  gap: 6px;
}
.more-toggle {
  font-size: 0.86rem;
}
.caret {
  display: inline-block;
  transition: transform 0.2s;
}
.deep.open > .deep-toggle .caret,
.more-toggle.open .caret {
  transform: rotate(90deg);
}
.deep-body .para {
  font-size: 0.9rem;
  margin: 6px 0;
}
.formula {
  margin: 8px 0;
  padding: 2px 10px 8px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--potential) 9%, transparent);
  overflow-x: auto;
}
.formula.ext {
  background: color-mix(in srgb, var(--potential) 5%, transparent);
}
.formula figcaption {
  font-size: 0.8rem;
  color: var(--ink-soft);
  text-align: center;
}
.notes {
  margin-top: 12px;
  border-top: 1.5px dashed color-mix(in srgb, var(--ink) 22%, transparent);
  padding-top: 8px;
}
.notes ul {
  margin: 0;
  padding-left: 1.1em;
  font-size: 0.84rem;
  color: var(--ink-soft);
}
.notes li {
  margin: 0.25em 0;
}

.swap-in {
  /* 换步时新内容直接替换并淡入；不等旧内容离场，避免页面短暂空白 */
  animation: swap-in 0.25s ease;
}
@keyframes swap-in {
  from { opacity: 0; transform: translateY(8px); }
}
</style>
