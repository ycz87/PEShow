<script setup lang="ts">
// 吉祥物：小电子（蓝色、带"−"徽章）与小空穴（橙色气泡、带"+"徽章）
import { computed, useId } from 'vue'
import { settings } from '../app/settings'
import { palette } from '../design/tokens'
import type { Mood } from '../devices/common/content'

const props = defineProps<{ kind: 'electron' | 'hole'; mood: Mood; size?: number }>()

const p = computed(() => palette(settings.style, settings.theme))
const col = computed(() => (props.kind === 'electron' ? p.value.electron : p.value.hole))
const uid = `m${useId()}`
const st = computed(() => settings.style)
const ink = computed(() => (st.value === 'chalk' ? p.value.ink : st.value === 'sticker' ? p.value.line : '#14183A'))
const strokeW = computed(() => (st.value === 'sticker' ? 4.5 : st.value === 'chalk' ? 3 : 0))
const faceInk = computed(() => (st.value === 'chalk' && settings.theme === 'dark' ? '#1E3A32' : '#1B1736'))
</script>

<template>
  <svg
    class="mascot"
    :class="[kind, mood, st]"
    :width="size || 112"
    :height="size || 112"
    viewBox="0 0 120 120"
    role="img"
    :aria-label="kind === 'electron' ? '小电子' : '小空穴'"
  >
    <defs>
      <radialGradient :id="`${uid}-body`" cx="38%" cy="32%" r="75%">
        <stop offset="0" stop-color="#FFFFFF" :stop-opacity="st === 'chalk' ? 0.25 : 0.55" />
        <stop offset="0.35" :stop-color="col" />
        <stop offset="1" :stop-color="col" />
      </radialGradient>
      <filter :id="`${uid}-glow`" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="5" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter :id="`${uid}-chalk`" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" />
        <feDisplacementMap in="SourceGraphic" scale="2.6" />
      </filter>
    </defs>

    <g class="bob" :filter="st === 'glow' ? `url(#${uid}-glow)` : st === 'chalk' ? `url(#${uid}-chalk)` : undefined">
      <!-- 贴纸白边 -->
      <circle v-if="st === 'sticker'" cx="60" cy="66" r="44" fill="#FFFFFF" />
      <!-- 小电子头顶的一缕"呆毛"（闪电形） -->
      <path
        v-if="kind === 'electron'"
        d="M60 26 L54 13 L62 15 L58 4"
        fill="none"
        :stroke="st === 'sticker' ? ink : col"
        :stroke-width="st === 'sticker' ? 4.5 : 4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle
        cx="60"
        cy="66"
        r="40"
        :fill="st === 'chalk' ? col : `url(#${uid}-body)`"
        :fill-opacity="st === 'chalk' ? 0.88 : 1"
        :stroke="ink"
        :stroke-width="strokeW"
      />
      <!-- 空穴：内圈光环，表示"这里缺了一个电子" -->
      <circle v-if="kind === 'hole'" cx="60" cy="66" r="29" fill="none" stroke="#FFFFFF" stroke-opacity="0.38" stroke-width="5" stroke-dasharray="6 7" />
      <ellipse cx="44" cy="45" rx="10" ry="6" fill="#FFFFFF" fill-opacity="0.55" transform="rotate(-30 44 45)" />

      <!-- 眼睛 -->
      <g :fill="faceInk" :stroke="faceInk" stroke-linecap="round" stroke-width="4">
        <template v-if="mood === 'happy'">
          <path d="M42 64 q6 -8 12 0" fill="none" />
          <path d="M66 64 q6 -8 12 0" fill="none" />
        </template>
        <template v-else-if="mood === 'calm'">
          <path d="M42 63 h11" fill="none" />
          <path d="M67 63 h11" fill="none" />
        </template>
        <template v-else>
          <circle cx="48" cy="62" :r="mood === 'excited' ? 6.5 : 5.5" stroke="none" />
          <circle cx="72" cy="62" :r="mood === 'excited' ? 6.5 : 5.5" stroke="none" />
          <circle cx="50" cy="59.5" r="2.2" fill="#FFFFFF" stroke="none" />
          <circle cx="74" cy="59.5" r="2.2" fill="#FFFFFF" stroke="none" />
          <template v-if="mood === 'worried'">
            <path d="M41 51 l11 3" fill="none" stroke-width="3.2" />
            <path d="M79 51 l-11 3" fill="none" stroke-width="3.2" />
          </template>
        </template>
      </g>
      <!-- 腮红 -->
      <ellipse cx="38" cy="76" rx="6" ry="3.6" fill="#FF6F9C" fill-opacity="0.55" />
      <ellipse cx="82" cy="76" rx="6" ry="3.6" fill="#FF6F9C" fill-opacity="0.55" />
      <!-- 嘴巴 -->
      <path v-if="mood === 'excited'" d="M50 76 q10 14 20 0 z" :fill="faceInk" />
      <path v-else-if="mood === 'happy'" d="M51 77 q9 9 18 0" fill="none" :stroke="faceInk" stroke-width="3.6" stroke-linecap="round" />
      <path v-else-if="mood === 'worried'" d="M51 81 q4.5 -4 9 0 q4.5 4 9 0" fill="none" :stroke="faceInk" stroke-width="3.2" stroke-linecap="round" />
      <path v-else d="M54 78 q6 4 12 0" fill="none" :stroke="faceInk" stroke-width="3.2" stroke-linecap="round" />

      <!-- 电荷徽章 -->
      <g transform="translate(92 34)">
        <circle r="13" :fill="st === 'chalk' ? 'none' : '#FFFFFF'" :stroke="st === 'glow' ? col : ink" :stroke-width="st === 'glow' ? 2.5 : 3.5" />
        <path :d="kind === 'electron' ? 'M-6 0 h12' : 'M-6 0 h12 M0 -6 v12'" :stroke="st === 'chalk' ? p.ink : col" stroke-width="4" stroke-linecap="round" />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.mascot {
  overflow: visible;
  display: block;
}
.bob {
  transform-origin: 60px 110px;
  animation: bob 2.6s ease-in-out infinite;
}
.hole .bob {
  animation-delay: -1.3s;
}
.excited .bob {
  animation: hop 0.9s ease-in-out infinite;
}
.worried .bob {
  animation: wobble 1.8s ease-in-out infinite;
}
@keyframes bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes hop {
  0%, 100% { transform: translateY(0) scale(1, 1); }
  30% { transform: translateY(-9px) scale(0.97, 1.04); }
  60% { transform: translateY(0) scale(1.05, 0.95); }
}
@keyframes wobble {
  0%, 100% { transform: rotate(0); }
  25% { transform: rotate(-4deg); }
  75% { transform: rotate(4deg); }
}
@media (prefers-reduced-motion: reduce) {
  .bob { animation: none !important; }
}
</style>
