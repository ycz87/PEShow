<script setup lang="ts">
// 右侧悬浮的"配色"按钮：点开后选择风格（A/B/C）与深浅主题
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Bi from './Bi.vue'
import { settings } from '../app/settings'
import { STYLES, STYLE_IDS, type StyleId } from '../design/tokens'

const open = ref(false)
const root = ref<HTMLElement>()
const letters: Record<StyleId, string> = { glow: 'A', sticker: 'B', chalk: 'C' }

const T = {
  button: { zh: '配色', en: 'Look' },
  title: { zh: '配色与风格', en: 'Look & style' },
  style: { zh: '风格', en: 'Style' },
  theme: { zh: '明暗', en: 'Theme' },
  dark: { zh: '深色', en: 'Dark' },
  light: { zh: '浅色', en: 'Light' },
  keys: { zh: '快捷键：1 / 2 / 3 切换风格，T 切换深浅', en: 'Keys: 1/2/3 style, T theme' },
}

function onDoc(e: PointerEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}
onMounted(() => {
  document.addEventListener('pointerdown', onDoc)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDoc)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="dock">
    <Transition name="pop">
      <div v-if="open" id="style-menu" class="menu panel" role="dialog" :aria-label="T.title.zh">
        <h3 class="panel-title"><Bi :t="T.title" /></h3>
        <p class="group-name"><Bi :t="T.style" /></p>
        <div class="cards" role="radiogroup" :aria-label="T.style.zh">
          <button
            v-for="id in STYLE_IDS"
            :key="id"
            class="card"
            :class="`sc-${id}`"
            role="radio"
            :aria-checked="settings.style === id"
            @click="settings.style = id"
          >
            <span class="sc-letter">{{ letters[id] }}</span>
            <span class="sc-text">
              <b><Bi :t="STYLES[id].name" /></b>
              <small><Bi :t="STYLES[id].pitch" /></small>
            </span>
          </button>
        </div>
        <p class="group-name"><Bi :t="T.theme" /></p>
        <div class="seg" role="group" :aria-label="T.theme.zh">
          <button :aria-pressed="settings.theme === 'dark'" @click="settings.theme = 'dark'">☾ <Bi :t="T.dark" /></button>
          <button :aria-pressed="settings.theme === 'light'" @click="settings.theme = 'light'">☀ <Bi :t="T.light" /></button>
        </div>
        <p class="keys"><Bi :t="T.keys" /></p>
      </div>
    </Transition>
    <button class="fab" :aria-expanded="open" aria-controls="style-menu" @click="open = !open">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5C21 6.4 17 3 12 3Z"
          fill="currentColor"
        />
        <circle cx="7.5" cy="11" r="1.6" fill="var(--hole)" />
        <circle cx="10" cy="7" r="1.6" fill="var(--accent)" />
        <circle cx="14.5" cy="7" r="1.6" fill="var(--electron)" />
        <circle cx="17" cy="11" r="1.6" fill="var(--potential)" />
      </svg>
      <span class="fab-label"><Bi :t="T.button" /></span>
    </button>
  </div>
</template>

<style scoped>
.dock {
  position: fixed;
  right: clamp(12px, 2vw, 24px);
  bottom: clamp(12px, 3vh, 28px);
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}
.fab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px 10px 12px;
  border-radius: 999px;
  border: var(--bw) solid var(--line);
  background: var(--surface);
  color: var(--ink);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 20px -6px rgba(0, 0, 0, 0.35);
}
.fab[aria-expanded='true'] {
  background: var(--accent);
  color: var(--bg);
}
[data-style='sticker'] .fab {
  box-shadow: 3px 3px 0 var(--line);
}
[data-style='sticker'] .fab[aria-expanded='true'] {
  color: var(--line);
}
.menu {
  width: min(340px, calc(100vw - 24px));
  max-height: calc(100vh - 110px);
  overflow-y: auto;
  padding: 14px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.menu .panel-title {
  margin: 0;
}
.group-name {
  margin: 4px 0 0;
  font-size: 0.8rem;
  color: var(--ink-soft);
}
.cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.card {
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  padding: 7px 10px;
  border-radius: 12px;
  border: 2px solid transparent;
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  color: var(--ink);
  cursor: pointer;
  line-height: 1.3;
}
.card[aria-checked='true'] {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}
.sc-letter {
  flex: none;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  font-weight: 800;
  font-size: 1.05rem;
}
/* 每张卡片用自己风格的字体与颜色做预览 */
.sc-glow .sc-letter { font-family: 'Outfit', sans-serif; background: #0a1433; color: #7cf2d0; box-shadow: 0 0 12px rgba(124, 242, 208, 0.6) inset; }
.sc-sticker .sc-letter { font-family: 'Fredoka', sans-serif; background: #ffd23f; color: #2a2140; border: 2.5px solid #2a2140; box-shadow: 2px 2px 0 #2a2140; }
.sc-chalk .sc-letter { font-family: 'Kalam', sans-serif; background: #1e3a32; color: #f2f0e6; }
.sc-glow b { font-family: 'Outfit', 'Noto Sans SC', sans-serif; }
.sc-sticker b { font-family: 'Fredoka', 'ZCOOL KuaiLe', sans-serif; font-weight: 400; }
.sc-chalk b { font-family: 'Kalam', 'LXGW WenKai', sans-serif; }
.sc-text small {
  display: block;
  font-size: 0.72rem;
  color: var(--ink-soft);
}
.keys {
  margin: 4px 0 0;
  font-size: 0.72rem;
  color: var(--ink-soft);
}
.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
  transform-origin: bottom right;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.97);
}
@media print {
  .dock { display: none; }
}
</style>
