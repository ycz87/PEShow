// 设计令牌：三套风格 × 深/浅两套主题。
// 这里是唯一的颜色来源：CSS 变量与 PixiJS 渲染都从这里读取，保证 HTML 与画布颜色一致。

export type StyleId = 'glow' | 'sticker' | 'chalk'
export type ThemeId = 'dark' | 'light'

export interface Palette {
  bg: string
  bg2: string
  surface: string
  line: string // 描边 / 分隔线
  ink: string // 主文字
  inkSoft: string // 次要文字
  accent: string // 界面强调色（按钮选中等）
  electron: string
  hole: string
  field: string // 电场
  potential: string // 电势 / 势垒
  pRegion: string
  nRegion: string
  ionPlus: string // 施主正离子 ⊕
  ionMinus: string // 受主负离子 ⊖
  grid: string // 背景纹理
}

export interface StyleDef {
  id: StyleId
  name: { zh: string; en: string }
  pitch: { zh: string; en: string }
  fontDisplay: string
  fontBody: string
  radius: number
  borderWidth: number
  /** 面板阴影：glow 用柔光、sticker 用硬阴影、chalk 无阴影 */
  shadow: (p: Palette) => string
  particle: 'glow' | 'sticker' | 'chalk'
  themes: Record<ThemeId, Palette>
}

export const STYLES: Record<StyleId, StyleDef> = {
  glow: {
    id: 'glow',
    name: { zh: '夜光晶圆', en: 'Wafer Glow' },
    pitch: {
      zh: '深夜实验室里发光的粒子。辉光和流动感最强，适合视频。',
      en: 'Glowing carriers in a night-time lab. Most cinematic, made for video.',
    },
    fontDisplay: "'Outfit', 'Noto Sans SC', sans-serif",
    fontBody: "'Noto Sans SC', 'Outfit', sans-serif",
    radius: 18,
    borderWidth: 1,
    shadow: (p) => `0 0 0 1px ${p.line}, 0 18px 50px -20px rgba(0,0,0,.55)`,
    particle: 'glow',
    themes: {
      dark: {
        bg: '#0A1433', bg2: '#16306A', surface: 'rgba(22,40,92,0.62)', line: 'rgba(140,170,255,0.20)',
        ink: '#EAF0FF', inkSoft: '#9FB0DA', accent: '#7CF2D0',
        electron: '#3CCBFF', hole: '#FF9A3C', field: '#FFE45C', potential: '#C08CFF',
        pRegion: '#FF5C8A', nRegion: '#3C7BFF', ionPlus: '#FF8A6B', ionMinus: '#6FA8FF', grid: 'rgba(140,170,255,0.07)',
      },
      light: {
        bg: '#EEF3FC', bg2: '#D9E4FA', surface: 'rgba(255,255,255,0.78)', line: 'rgba(30,60,140,0.16)',
        ink: '#13204A', inkSoft: '#56658F', accent: '#00A884',
        electron: '#0B84E6', hole: '#F07400', field: '#D29500', potential: '#8A4DFF',
        pRegion: '#FF4D7E', nRegion: '#2D6BFF', ionPlus: '#E2553A', ionMinus: '#2F6FD6', grid: 'rgba(30,60,140,0.07)',
      },
    },
  },
  sticker: {
    id: 'sticker',
    name: { zh: '贴纸绘本', en: 'Sticker Book' },
    pitch: {
      zh: '粗描边、平涂色和硬阴影，像贴纸一样。卡通感最强，最有 B站味道。',
      en: 'Bold outlines, flat colour, hard shadows. The most cartoon-like option.',
    },
    fontDisplay: "'Fredoka', 'ZCOOL KuaiLe', sans-serif",
    fontBody: "'Noto Sans SC', 'Fredoka', sans-serif",
    radius: 22,
    borderWidth: 3,
    shadow: (p) => `5px 6px 0 0 ${p.line}`,
    particle: 'sticker',
    themes: {
      dark: {
        bg: '#2A2145', bg2: '#3A2D63', surface: '#3B3068', line: '#120C24',
        ink: '#FFF6E9', inkSoft: '#CBBFEA', accent: '#FFD23F',
        electron: '#3FA2FF', hole: '#FF8A26', field: '#FFD23F', potential: '#C39BFF',
        pRegion: '#FF8FB1', nRegion: '#7EC0FF', ionPlus: '#FF7A5C', ionMinus: '#5C9DFF', grid: 'rgba(255,255,255,0.06)',
      },
      light: {
        bg: '#DCEFFF', bg2: '#C4E3FF', surface: '#FFFFFF', line: '#2A2140',
        ink: '#2A2140', inkSoft: '#6B5E8C', accent: '#FF5E8A',
        electron: '#2B86FF', hole: '#FF8A1F', field: '#FFC400', potential: '#8E5CFF',
        pRegion: '#FFB3C6', nRegion: '#9FD0FF', ionPlus: '#F2603E', ionMinus: '#3478E8', grid: 'rgba(42,33,64,0.07)',
      },
    },
  },
  chalk: {
    id: 'chalk',
    name: { zh: '黑板方格', en: 'Chalk & Grid' },
    pitch: {
      zh: '深色是黑板粉笔，浅色是方格纸手写，像老师在课堂上边讲边画。',
      en: 'Chalkboard in dark mode, graph paper in light. Feels like a live lecture.',
    },
    fontDisplay: "'Kalam', 'LXGW WenKai', cursive",
    fontBody: "'LXGW WenKai', 'Kalam', serif",
    radius: 10,
    borderWidth: 2,
    shadow: () => 'none',
    particle: 'chalk',
    themes: {
      dark: {
        bg: '#1E3A32', bg2: '#25483E', surface: 'rgba(255,255,255,0.045)', line: 'rgba(242,240,230,0.38)',
        ink: '#F2F0E6', inkSoft: '#B5C5BB', accent: '#FFE680',
        electron: '#8ED6FF', hole: '#FFB36B', field: '#FFE680', potential: '#FF9FC8',
        pRegion: '#FF9FC8', nRegion: '#8ED6FF', ionPlus: '#FF9F86', ionMinus: '#9CC2FF', grid: 'rgba(242,240,230,0.05)',
      },
      light: {
        bg: '#FBFCF8', bg2: '#F1F6EE', surface: 'rgba(255,255,255,0.72)', line: '#9DB6CC',
        ink: '#1D3557', inkSoft: '#5B7088', accent: '#E63946',
        electron: '#1F6FD1', hole: '#E8650A', field: '#C99700', potential: '#9B3FC6',
        pRegion: '#F28AA8', nRegion: '#6FA8E8', ionPlus: '#D9482B', ionMinus: '#2C65C4', grid: 'rgba(80,140,200,0.16)',
      },
    },
  },
}

export const STYLE_IDS = Object.keys(STYLES) as StyleId[]

export function palette(style: StyleId, theme: ThemeId): Palette {
  return STYLES[style].themes[theme]
}

/** 与风格无关、只随深浅变化的信号色：放热（复合、声子散射、升温）、吸热（产生、低温）、损坏警示 */
export interface SignalColors {
  heatOut: string
  heatIn: string
  danger: string
}

const SIGNAL: Record<ThemeId, SignalColors> = {
  dark: { heatOut: '#FFA24C', heatIn: '#5CC8FF', danger: '#FF5C5C' },
  light: { heatOut: '#E06A00', heatIn: '#1A7FD4', danger: '#D62D2D' },
}

export function signalColors(theme: ThemeId): SignalColors {
  return SIGNAL[theme]
}

/** 把令牌写入根元素的 CSS 变量 */
export function applyTokens(style: StyleId, theme: ThemeId, el: HTMLElement = document.documentElement) {
  const s = STYLES[style]
  const p = s.themes[theme]
  const vars: Record<string, string> = {
    '--font-display': s.fontDisplay,
    '--font-body': s.fontBody,
    '--radius': `${s.radius}px`,
    '--bw': `${s.borderWidth}px`,
    '--shadow': s.shadow(p),
  }
  for (const [k, v] of Object.entries({ ...p, ...SIGNAL[theme] })) {
    vars[`--${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}`] = v
  }
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v)
  el.dataset.style = style
  el.dataset.theme = theme
}

/** '#RRGGBB' 或 'rgba(r,g,b,a)' → 0xRRGGBB（透明度另由 colorAlpha 读取） */
export function hexToNum(c: string): number {
  const m = c.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const [r, g, b] = m[1].split(',').map((v) => parseFloat(v))
    return (r << 16) | (g << 8) | b
  }
  return parseInt(c.replace('#', '').slice(0, 6), 16)
}

/** '#RRGGBB' → 'rgba(r,g,b,a)'（Canvas 2D 用） */
export function rgba(hex: string, a: number): string {
  const n = hexToNum(hex)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

export function colorAlpha(c: string): number {
  const m = c.match(/rgba\(([^)]+)\)/)
  return m ? parseFloat(m[1].split(',')[3]) : 1
}
