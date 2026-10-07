// Canvas 2D 舞台共用的配色与绘图小工具：文字、箭头、尺寸线、虚线、圆角矩形
import { STYLES, palette, signalColors, type StyleId, type ThemeId } from '../../design/tokens'

export interface CanvasColors {
  bg: string
  ink: string
  inkSoft: string
  line: string
  accent: string
  electron: string
  hole: string
  field: string
  potential: string
  pRegion: string
  nRegion: string
  ionPlus: string
  ionMinus: string
  /** 放热（复合、声子散射）、吸热、损坏警示 */
  warm: string
  cool: string
  danger: string
  font: string
  fontDisplay: string
}

export function canvasColors(style: StyleId, theme: ThemeId): CanvasColors {
  const p = palette(style, theme)
  const st = STYLES[style]
  const sig = signalColors(theme)
  return {
    bg: p.bg, ink: p.ink, inkSoft: p.inkSoft, line: p.line, accent: p.accent, electron: p.electron, hole: p.hole,
    field: p.field, potential: p.potential, pRegion: p.pRegion, nRegion: p.nRegion, ionPlus: p.ionPlus, ionMinus: p.ionMinus,
    warm: sig.heatOut, cool: sig.heatIn, danger: sig.danger,
    font: st.fontBody, fontDisplay: st.fontDisplay,
  }
}

/** 画文字所需的最小上下文 */
export interface DrawCtx {
  g: CanvasRenderingContext2D
  c: CanvasColors
}

export interface TextOpt {
  size?: number
  weight?: number
  color?: string
  align?: CanvasTextAlign
  base?: CanvasTextBaseline
  display?: boolean
  max?: number
}

export function text(ctx: DrawCtx, s: string, x: number, y: number, o: TextOpt = {}) {
  const { g, c } = ctx
  g.font = `${o.weight ?? 600} ${o.size ?? 12}px ${o.display ? c.fontDisplay : c.font}`
  g.fillStyle = o.color ?? c.ink
  g.textAlign = o.align ?? 'left'
  g.textBaseline = o.base ?? 'middle'
  g.fillText(s, x, y, o.max)
}

export function arrow(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 2, head = 8) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  g.strokeStyle = color
  g.fillStyle = color
  g.lineWidth = width
  g.beginPath()
  g.moveTo(x1, y1)
  g.lineTo(x2 - Math.cos(a) * head * 0.8, y2 - Math.sin(a) * head * 0.8)
  g.stroke()
  g.beginPath()
  g.moveTo(x2, y2)
  g.lineTo(x2 - Math.cos(a - 0.4) * head, y2 - Math.sin(a - 0.4) * head)
  g.lineTo(x2 - Math.cos(a + 0.4) * head, y2 - Math.sin(a + 0.4) * head)
  g.closePath()
  g.fill()
}

/** 两端带箭头的尺寸线，文字写在中间上方 */
export function dimension(ctx: DrawCtx, x1: number, x2: number, y: number, label: string, color: string) {
  const { g } = ctx
  const head = Math.min(7, Math.abs(x2 - x1) / 3)
  g.strokeStyle = color
  g.lineWidth = 1.4
  g.beginPath()
  g.moveTo(x1, y - 5)
  g.lineTo(x1, y + 5)
  g.moveTo(x2, y - 5)
  g.lineTo(x2, y + 5)
  g.stroke()
  if (head >= 2) {
    arrow(g, (x1 + x2) / 2, y, x1, y, color, 1.4, head)
    arrow(g, (x1 + x2) / 2, y, x2, y, color, 1.4, head)
  }
  text(ctx, label, (x1 + x2) / 2, y - 6, { color, base: 'bottom', align: 'center', weight: 700 })
}

/** 虚线开关 */
export function dash(g: CanvasRenderingContext2D, on: boolean, pattern = [5, 4]) {
  g.setLineDash(on ? pattern : [])
}

/** 带圆角的矩形路径 */
export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}
