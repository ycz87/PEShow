import { reactive, watch } from 'vue'
import type { StyleId, ThemeId } from '../design/tokens'

export type Lang = 'zh' | 'en' | 'both'

/** 每种载流子在屏幕细柱里的个数（连续可调）。粒子越少画得越大（见 PnRenderer.applyScale） */
export const DENSITY = { min: 30, max: 1000, def: 200 }

export interface Settings {
  style: StyleId
  theme: ThemeId
  mascot: boolean
  lang: Lang
  density: number
}

const KEY = 'pdvl.settings.v1'
/** 旧版本把粒子数存成三档 */
const OLD_DENSITY: Record<string, number> = { low: 40, mid: 200, high: 900 }

function load(): Settings {
  const def: Settings = { style: 'sticker', theme: 'dark', mascot: true, lang: 'zh', density: DENSITY.def }
  try {
    const s = { ...def, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
    const d = typeof s.density === 'string' ? OLD_DENSITY[s.density] : s.density
    s.density = Number.isFinite(d) ? Math.min(DENSITY.max, Math.max(DENSITY.min, d)) : DENSITY.def
    return s
  } catch {
    return def
  }
}

export const settings = reactive<Settings>(load())

watch(settings, (s) => localStorage.setItem(KEY, JSON.stringify(s)), { deep: true })

/** 双语文本。英文可暂缺（先完成中文稿），缺失时回退到中文 */
export interface BiText {
  zh: string
  en?: string
}

/** 单语言场景（如 aria-label、Pixi 文字）取文本；中英对照时取中文 */
export function tx(t: BiText): string {
  return settings.lang === 'en' ? (t.en ?? t.zh) : t.zh
}

/** 把文本里的 {key} 占位符换成数值（中英两份都换） */
export function fillBi(t: BiText, map: Record<string, string | number>): BiText {
  const f = (s: string) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in map ? String(map[k]) : m))
  return { zh: f(t.zh), en: t.en === undefined ? undefined : f(t.en) }
}
