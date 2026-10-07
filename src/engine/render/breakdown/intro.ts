// 认识击穿：所选器件的结（P | 耗尽层 | N）与电场分布 𝓔(x)。三款器件用同一比例尺，另两款在各自 U_Z 时的 𝓔(x) 画成虚线；
// 隧穿型器件的耗尽层只有几十纳米，在主图上只是一根细刺，另开放大窗看清它的结构
import { ZENERS, ZENER_IDS, type Depletion } from '../../physics/breakdown'
import { rgba } from '../../../design/tokens'
import { conc, lengthText } from '../../../app/format'
import { REGION_A, biasGeom, dash, dimension, sprite, text, type BdCtx, type BdInput, type Scene } from './common'

/** 主图横轴（cm，冶金结为 0）与纵轴上限（V/cm） */
const XS = { lo: -0.4e-4, hi: 3.1e-4 }
const E_TOP = 2e6
/** 放大窗的横轴半宽（cm） */
const ZOOM_HALF = 70e-7
/** 耗尽层在主图上窄于横轴的这一比例时打开放大窗 */
const ZOOM_IF = 0.05
/** 离子间距、半径（像素） */
const ION_GAP = 24
const ION_R = 7

type Map = (x: number) => number

export class IntroScene implements Scene {
  update() {}
  reset() {}

  draw(ctx: BdCtx, inp: BdInput) {
    const { w, h, c, L } = ctx
    const d = ZENERS[inp.device]
    const { g } = biasGeom(d, inp.vr, inp.T)
    const left = 70
    const right = w - 26
    const X: Map = (x) => left + ((x - XS.lo) / (XS.hi - XS.lo)) * (right - left)
    const bar = { y: 46, h: Math.max(70, Math.min(110, h * 0.18)) }
    const plot = { t: bar.y + bar.h + 50, b: h - 46 }
    const Y: Map = (E) => plot.b - (E / E_TOP) * (plot.b - plot.t)

    // 结
    const narrow = X(g.xn) - X(-g.xp) < ZOOM_IF * (right - left)
    junctionBar(ctx, g, X, left, right, bar.y, bar.h, !narrow)
    text(ctx, `P⁺  N_A = ${conc(d.NA)} cm⁻³`, left + 8, bar.y - 14, { size: 12, color: c.inkSoft })
    text(ctx, `${d.ND > 1e18 ? 'N⁺' : 'N'}  N_D = ${conc(d.ND)} cm⁻³`, right - 8, bar.y - 14, { size: 12, color: c.inkSoft, align: 'right' })
    if (!narrow) dimension(ctx, X(-g.xp), X(g.xn), bar.y + bar.h + 18, L.scr.replace('{w}', lengthText(g.W)), c.potential)

    // 坐标
    const { g: G } = ctx
    G.strokeStyle = c.ink
    G.lineWidth = 1.5
    G.beginPath()
    G.moveTo(left, plot.t - 8)
    G.lineTo(left, plot.b)
    G.lineTo(right, plot.b)
    G.stroke()
    G.strokeStyle = rgba(c.ink, 0.08)
    G.lineWidth = 1
    for (let E = 0.5e6; E <= E_TOP; E += 0.5e6) {
      G.beginPath()
      G.moveTo(left, Y(E))
      G.lineTo(right, Y(E))
      G.stroke()
      text(ctx, (E / 1e6).toFixed(1), left - 8, Y(E), { size: 11, color: c.inkSoft, align: 'right', weight: 500 })
    }
    text(ctx, '0', left - 8, plot.b, { size: 11, color: c.inkSoft, align: 'right', weight: 500 })
    text(ctx, L.eAxis, left + 8, plot.t - 12, { size: 12, weight: 700 })
    // 冶金结
    G.strokeStyle = rgba(c.ink, 0.3)
    dash(G, true, [3, 4])
    G.beginPath()
    G.moveTo(X(0), bar.y)
    G.lineTo(X(0), plot.b)
    G.stroke()
    dash(G, false)
    // 1 µm 比例尺
    const rx = right - (X(1e-4) - X(0)) - 4
    G.strokeStyle = c.ink
    G.lineWidth = 2
    G.beginPath()
    G.moveTo(rx, plot.b + 20)
    G.lineTo(right - 4, plot.b + 20)
    G.moveTo(rx, plot.b + 15)
    G.lineTo(rx, plot.b + 25)
    G.moveTo(right - 4, plot.b + 15)
    G.lineTo(right - 4, plot.b + 25)
    G.stroke()
    text(ctx, '1 µm', (rx + right) / 2, plot.b + 33, { size: 11, align: 'center' })
    text(ctx, L.xAxis, left, plot.b + 20, { size: 11, color: c.inkSoft })

    // 另两款器件在各自 U_Z 时的 𝓔(x)
    for (const id of ZENER_IDS) {
      if (id === d.id) continue
      const o = ZENERS[id]
      const go = biasGeom(o, o.VZ, inp.T).g
      triangle(ctx, go, X, Y, false)
      text(ctx, `${id}  ${o.VZ} V ${L.atVZ}`, X(0) + 10, Y(go.Emax) - 6, { size: 11, color: c.inkSoft, base: 'bottom' })
    }
    triangle(ctx, g, X, Y, true)
    text(ctx, `${d.id}  𝓔max = ${(g.Emax / 1e6).toFixed(2)} MV/cm`, X(0) + 10, Y(g.Emax) - 6, { size: 12, weight: 700, color: c.field, base: 'bottom' })

    if (narrow) this.inset(ctx, g, X, Y, plot, right)
  }

  /** 放大窗：横轴 ±70 nm，纵轴与主图同为 0 … 2 MV/cm */
  private inset(ctx: BdCtx, g: Depletion, X: Map, Y: Map, plot: { t: number; b: number }, right: number) {
    const { c, L, g: G } = ctx
    const box = { l: X(1.0e-4), r: right - 6, t: plot.t + 4, b: plot.t + (plot.b - plot.t) * 0.6 }
    const bh = Math.min(64, (box.b - box.t) * 0.34)
    const ix: Map = (x) => box.l + ((x + ZOOM_HALF) / (2 * ZOOM_HALF)) * (box.r - box.l)
    const pb = { t: box.t + bh + 30, b: box.b - 22 }
    const iy: Map = (E) => pb.b - (E / E_TOP) * (pb.b - pb.t)
    // 引线：从主图上的细刺到放大窗
    G.strokeStyle = rgba(c.ink, 0.35)
    G.lineWidth = 1
    dash(G, true, [4, 4])
    G.beginPath()
    G.moveTo(X(0) + 3, Y(g.Emax))
    G.lineTo(box.l, box.t)
    G.moveTo(X(0) + 3, plot.b)
    G.lineTo(box.l, box.b)
    G.stroke()
    dash(G, false)
    G.fillStyle = c.bg
    G.strokeStyle = c.ink
    G.lineWidth = 1.5
    G.beginPath()
    G.rect(box.l, box.t, box.r - box.l, box.b - box.t)
    G.fill()
    G.stroke()
    G.save()
    G.beginPath()
    G.rect(box.l, box.t, box.r - box.l, box.b - box.t)
    G.clip()
    junctionBar(ctx, g, ix, box.l, box.r, box.t, bh, true)
    dimension(ctx, ix(-g.xp), ix(g.xn), box.t + bh + 16, L.scr.replace('{w}', lengthText(g.W)), c.potential)
    G.strokeStyle = rgba(c.ink, 0.5)
    G.lineWidth = 1
    G.beginPath()
    G.moveTo(box.l, pb.b)
    G.lineTo(box.r, pb.b)
    G.stroke()
    triangle(ctx, g, ix, iy, true)
    G.restore()
    // 比例尺 20 nm、放大倍数
    const k = (box.r - box.l) / (2 * ZOOM_HALF) / ((X(1e-4) - X(0)) / 1e-4)
    const sx = box.r - 10 - (ix(20e-7) - ix(0))
    G.strokeStyle = c.ink
    G.lineWidth = 2
    G.beginPath()
    G.moveTo(sx, box.b - 10)
    G.lineTo(box.r - 10, box.b - 10)
    G.stroke()
    text(ctx, '20 nm', (sx + box.r - 10) / 2, box.b - 18, { size: 11, align: 'center', base: 'bottom' })
    text(ctx, L.zoom.replace('{k}', `${Math.round(k)}`), box.l + 8, box.b - 12, { size: 11, weight: 700, color: c.inkSoft })
  }
}

/** 𝓔(x) 三角形：当前器件实线填充，其他器件虚线 */
function triangle(ctx: BdCtx, g: Depletion, X: Map, Y: Map, main: boolean) {
  const { g: G, c } = ctx
  G.beginPath()
  G.moveTo(X(-g.xp), Y(0))
  G.lineTo(X(0), Y(g.Emax))
  G.lineTo(X(g.xn), Y(0))
  if (main) {
    G.closePath()
    G.fillStyle = rgba(c.field, 0.22)
    G.fill()
  }
  G.strokeStyle = main ? c.field : rgba(c.inkSoft, 0.8)
  G.lineWidth = main ? 2.5 : 1.5
  dash(G, !main)
  G.stroke()
  dash(G, false)
}

/** 结的剖面：中性 P 区 | 耗尽层（固定离子）| 中性 N 区 */
function junctionBar(ctx: BdCtx, g: Depletion, X: Map, l: number, r: number, y: number, hh: number, ions: boolean) {
  const { g: G, c, img } = ctx
  const a = Math.max(l, X(-g.xp))
  const b = Math.min(r, X(g.xn))
  G.fillStyle = rgba(c.pRegion, REGION_A)
  G.fillRect(l, y, a - l, hh)
  G.fillStyle = rgba(c.nRegion, REGION_A)
  G.fillRect(b, y, r - b, hh)
  G.strokeStyle = rgba(c.ink, 0.45)
  G.lineWidth = 1.2
  G.strokeRect(l, y, r - l, hh)
  dash(G, true, [4, 3])
  G.beginPath()
  G.moveTo(a, y)
  G.lineTo(a, y + hh)
  G.moveTo(b, y)
  G.lineTo(b, y + hh)
  G.stroke()
  dash(G, false)
  if (!ions) return
  const rows = Math.max(1, Math.floor(hh / ION_GAP))
  const z = X(0)
  const side = (x0: number, x1: number, key: '+' | '-', toward: number) => {
    const span = Math.abs(x1 - x0)
    const cols = Math.max(1, Math.floor(span / ION_GAP))
    for (let i = 0; i < cols; i++) {
      // 只有一列（例如 P⁺ 侧极薄的负电荷层）时贴着冶金结画
      const x = cols === 1 && span < ION_GAP ? z + toward * ION_R * 0.9 : x0 + Math.sign(x1 - x0) * (i + 0.5) * (span / cols)
      for (let j = 0; j < rows; j++) sprite(ctx, img[key], x, y + (j + 0.5) * (hh / rows), ION_R)
    }
  }
  side(z, a, '-', -1)
  side(z, b, '+', 1)
}
