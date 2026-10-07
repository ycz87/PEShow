// 粒子 / 离子纹理：按风格用 Canvas 2D 预渲染，再交给 PixiJS 批量绘制（晶格、击穿舞台直接 drawImage 这些画布）。
import { CanvasSource, Texture } from 'pixi.js'
import { STYLES, palette, rgba, type Palette, type StyleDef, type StyleId, type ThemeId } from '../../design/tokens'

const TEX = 64 // 纹理边长
export const CORE = 12 // 纹理中"粒子本体"半径（其余为辉光余量）
const SS = 3 // 超采样倍数：粒子少时会画得很大，纹理需要足够清晰

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = c.height = TEX * SS
  const g = c.getContext('2d')!
  g.scale(SS, SS)
  return [c, g]
}

/** 逻辑尺寸仍为 TEX，缩放计算不受超采样影响；mipmap 保证粒子多、画得小时不闪烁 */
function toTexture(c: HTMLCanvasElement) {
  return new Texture({ source: new CanvasSource({ resource: c, resolution: SS, autoGenerateMipmaps: true }) })
}

/** 简单的确定性随机数，保证每次生成的粉笔纹理一致 */
function rng(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

/**
 * 画布边长 TEX·SS，粒子本体半径 CORE·SS。
 * 空穴画成空心圆环，内径约等于电子半径、外径约为电子的 1.25 倍：刚产生的一对重叠时是"圈里套着一个点"，
 * 也对应 0.1 里"空座位"的样子。大小只为区分，不代表真实尺寸（各舞台的空穴都画在电子上层）
 */
function carrierCanvas(kind: 'e' | 'h', style: StyleDef, p: Palette, dark: boolean): HTMLCanvasElement {
  const [c, g] = canvas()
  const m = TEX / 2
  const col = kind === 'e' ? p.electron : p.hole
  if (style.particle === 'glow') {
    const halo = g.createRadialGradient(m, m, 0, m, m, m)
    halo.addColorStop(0, rgba(col, dark ? 0.55 : 0.28))
    halo.addColorStop(0.35, rgba(col, dark ? 0.22 : 0.1))
    halo.addColorStop(1, rgba(col, 0))
    g.fillStyle = halo
    g.fillRect(0, 0, TEX, TEX)
    if (kind === 'e') {
      const core = g.createRadialGradient(m - 3, m - 3, 0, m, m, CORE)
      core.addColorStop(0, '#FFFFFF')
      core.addColorStop(0.45, col)
      core.addColorStop(1, col)
      g.fillStyle = core
      g.beginPath(); g.arc(m, m, CORE * 0.85, 0, Math.PI * 2); g.fill()
    } else {
      g.strokeStyle = col
      g.lineWidth = 3.2
      g.beginPath(); g.arc(m, m, CORE * 0.98, 0, Math.PI * 2); g.stroke()
      g.strokeStyle = 'rgba(255,255,255,0.75)'
      g.lineWidth = 1.2
      g.beginPath(); g.arc(m, m, CORE * 0.98, Math.PI * 1.1, Math.PI * 1.55); g.stroke()
    }
  } else if (style.particle === 'sticker') {
    g.lineJoin = 'round'
    if (kind === 'e') {
      g.fillStyle = col
      g.strokeStyle = p.line
      g.lineWidth = 3.5
      g.beginPath(); g.arc(m, m, CORE, 0, Math.PI * 2); g.fill(); g.stroke()
      g.fillStyle = 'rgba(255,255,255,0.85)'
      g.beginPath(); g.ellipse(m - 4, m - 4.5, 3.6, 2.4, -0.6, 0, Math.PI * 2); g.fill()
    } else {
      // 描边色的粗环里嵌一道空穴色的环，中间留空
      g.strokeStyle = p.line
      g.lineWidth = 5.5
      g.beginPath(); g.arc(m, m, CORE + 2.5, 0, Math.PI * 2); g.stroke()
      g.strokeStyle = col
      g.lineWidth = 2.8
      g.beginPath(); g.arc(m, m, CORE + 2.5, 0, Math.PI * 2); g.stroke()
    }
  } else {
    // 粉笔：用大量半透明小点堆出颗粒感
    const r = rng(kind === 'e' ? 7 : 13)
    const N = 340
    for (let i = 0; i < N; i++) {
      const a = r() * Math.PI * 2
      const rad = kind === 'e' ? Math.sqrt(r()) * CORE : CORE + 0.5 + r() * 3.5
      const x = m + Math.cos(a) * rad
      const y = m + Math.sin(a) * rad
      g.fillStyle = rgba(col, 0.25 + r() * 0.6)
      g.fillRect(x, y, 1.6, 1.6)
    }
  }
  return c
}

function ionCanvas(sign: '+' | '-', style: StyleDef, p: Palette): HTMLCanvasElement {
  const [c, g] = canvas()
  const m = TEX / 2
  const col = sign === '+' ? p.ionPlus : p.ionMinus
  const R = 15
  g.lineCap = 'round'
  if (style.particle === 'sticker') {
    g.fillStyle = rgba(col, 0.35)
    g.strokeStyle = p.line
    g.lineWidth = 3
    g.beginPath(); g.roundRect(m - R, m - R, 2 * R, 2 * R, 7); g.fill(); g.stroke()
    g.strokeStyle = p.line
  } else if (style.particle === 'chalk') {
    const r = rng(sign === '+' ? 3 : 5)
    g.strokeStyle = rgba(col, 0.85)
    g.lineWidth = 2
    for (let k = 0; k < 2; k++) {
      g.beginPath()
      for (let a = 0; a <= Math.PI * 2 + 0.2; a += 0.35) {
        const rr = R - 1 + (r() - 0.5) * 2.2
        const x = m + Math.cos(a) * rr
        const y = m + Math.sin(a) * rr
        if (a === 0) g.moveTo(x, y); else g.lineTo(x, y)
      }
      g.stroke()
    }
    g.strokeStyle = col
  } else {
    g.strokeStyle = rgba(col, 0.9)
    g.lineWidth = 2.2
    g.beginPath(); g.arc(m, m, R, 0, Math.PI * 2); g.stroke()
    g.fillStyle = rgba(col, 0.18)
    g.fill()
    g.strokeStyle = col
  }
  g.lineWidth = 3.4
  g.beginPath()
  g.moveTo(m - 7, m); g.lineTo(m + 7, m)
  if (sign === '+') { g.moveTo(m, m - 7); g.lineTo(m, m + 7) }
  g.stroke()
  return c
}

export const carrierTexture = (kind: 'e' | 'h', style: StyleDef, p: Palette, dark: boolean): Texture =>
  toTexture(carrierCanvas(kind, style, p, dark))

export const ionTexture = (sign: '+' | '-', style: StyleDef, p: Palette): Texture => toTexture(ionCanvas(sign, style, p))

/** Canvas 2D 舞台用的一套贴图：电子、空穴、施主离子、受主离子 */
export type Sprites = Record<'e' | 'h' | '+' | '-', HTMLCanvasElement>

export function spriteSheet(style: StyleId, theme: ThemeId): Sprites {
  const st = STYLES[style]
  const p = palette(style, theme)
  const dark = theme === 'dark'
  return { e: carrierCanvas('e', st, p, dark), h: carrierCanvas('h', st, p, dark), '+': ionCanvas('+', st, p), '-': ionCanvas('-', st, p) }
}

/** 在 Canvas 2D 上画一个贴图，本体半径 rc（像素） */
export function drawSprite(g: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, rc: number) {
  const d = (rc * TEX) / CORE
  g.drawImage(img, x - d / 2, y - d / 2, d, d)
}
