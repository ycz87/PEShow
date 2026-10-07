// 两种击穿机理的对比：温度系数随 U_Z 变号。隧穿型（U_Z < 4E_g/q）禁带随温度变窄、隧穿更容易，U_Z 下降；
// 雪崩型（U_Z > 6E_g/q）晶格振动加剧、平均自由程变短，要更强的场才能电离，U_Z 上升；两者之间两种机理并存，温度系数接近零。
// 只画三款器件的手册数据（范围 + 中值），分界取 Sze 的经验规则，不画没有数据支持的连续曲线
import { junctionAt } from '../../physics/pn'
import { ZENERS, ZENER_IDS, tcMid, tcMv, type ZenerId } from '../../physics/breakdown'
import { rgba } from '../../../design/tokens'
import { lengthText, minus } from '../../../app/format'
import { biasGeom, dash, text, type BdColors, type BdCtx, type Scene } from './common'

/** 横轴（V，对数）与纵轴（%/°C） */
const VX = { lo: 2, hi: 100 }
const TC = { lo: -0.12, hi: 0.12 }

/** 每款器件的颜色：负温度系数用冷色，正温度系数用暖色，近零用电势色 */
export function deviceColor(c: BdColors, id: ZenerId) {
  return id === '1N4728A' ? c.cool : id === '1N4733A' ? c.potential : c.warm
}

export class CompareScene implements Scene {
  update() {}
  reset() {}

  draw(ctx: BdCtx) {
    const { w, h, c, L, g: G } = ctx
    const Eg = junctionAt(25).Eg
    const split = w >= 760
    const plot = { l: 66, r: split ? w * 0.56 : w - 24, t: 40, b: split ? h - 52 : h * 0.58 }
    const X = (v: number) => plot.l + (Math.log(v / VX.lo) / Math.log(VX.hi / VX.lo)) * (plot.r - plot.l)
    const Y = (t: number) => plot.b - ((t - TC.lo) / (TC.hi - TC.lo)) * (plot.b - plot.t)

    // 机理分区：4E_g/q 与 6E_g/q
    const v4 = 4 * Eg
    const v6 = 6 * Eg
    const zones: [number, number, string, string][] = [
      [VX.lo, v4, c.cool, L.tunnelZone],
      [v4, v6, c.potential, L.mixedZone],
      [v6, VX.hi, c.warm, L.avZone],
    ]
    for (const [a, b, col, name] of zones) {
      G.fillStyle = rgba(col, 0.08)
      G.fillRect(X(a), plot.t, X(b) - X(a), plot.b - plot.t)
      text(ctx, name, (X(a) + X(b)) / 2, plot.t + 14, { size: 11.5, weight: 700, color: col, align: 'center', max: X(b) - X(a) - 6 })
    }
    G.strokeStyle = rgba(c.ink, 0.35)
    G.lineWidth = 1
    dash(G, true, [4, 4])
    // 两条分界线靠得近：左边的标签右对齐、右边的左对齐，避免重叠
    for (const [v, s, align, dx] of [[v4, '4E_g/q', 'right', -4], [v6, '6E_g/q', 'left', 4]] as const) {
      G.beginPath()
      G.moveTo(X(v), plot.t)
      G.lineTo(X(v), plot.b)
      G.stroke()
      text(ctx, `${s} ≈ ${v.toFixed(1)} V`, X(v) + dx, plot.b + 30, { size: 10.5, color: c.inkSoft, align })
    }
    dash(G, false)

    // 坐标、网格
    G.strokeStyle = rgba(c.ink, 0.08)
    for (let t = -0.1; t <= 0.1001; t += 0.05) {
      G.beginPath()
      G.moveTo(plot.l, Y(t))
      G.lineTo(plot.r, Y(t))
      G.stroke()
      text(ctx, minus(t.toFixed(2)), plot.l - 8, Y(t), { size: 11, color: c.inkSoft, align: 'right', weight: 500 })
    }
    for (const v of [2, 5, 10, 20, 50, 100]) {
      G.beginPath()
      G.moveTo(X(v), plot.t)
      G.lineTo(X(v), plot.b)
      G.stroke()
      text(ctx, `${v}`, X(v), plot.b + 14, { size: 11, color: c.inkSoft, align: 'center', weight: 500 })
    }
    G.strokeStyle = c.ink
    G.lineWidth = 1.5
    G.beginPath()
    G.moveTo(plot.l, plot.t)
    G.lineTo(plot.l, plot.b)
    G.lineTo(plot.r, plot.b)
    G.stroke()
    G.strokeStyle = rgba(c.ink, 0.55)
    G.beginPath()
    G.moveTo(plot.l, Y(0))
    G.lineTo(plot.r, Y(0))
    G.stroke()
    text(ctx, L.tcAxis, plot.l + 6, plot.t - 14, { size: 12, weight: 700 })
    text(ctx, L.vzAxis, plot.r, plot.b + 44, { size: 11.5, color: c.inkSoft, align: 'right' })

    // 三款器件：手册范围（竖条）与中值（圆点）
    for (const id of ZENER_IDS) {
      const d = ZENERS[id]
      const col = deviceColor(c, id)
      const x = X(d.VZ)
      G.strokeStyle = col
      G.lineWidth = 6
      G.lineCap = 'round'
      G.beginPath()
      G.moveTo(x, Y(d.tc[0]))
      G.lineTo(x, Y(d.tc[1]))
      G.stroke()
      G.lineCap = 'butt'
      G.fillStyle = c.bg
      G.strokeStyle = col
      G.lineWidth = 2.5
      G.beginPath()
      G.arc(x, Y(tcMid(d)), 6, 0, Math.PI * 2)
      G.fill()
      G.stroke()
      const up = tcMid(d) < 0
      text(ctx, id, x, Y(up ? d.tc[1] : d.tc[0]) + (up ? -12 : 12), { size: 11.5, weight: 700, color: col, align: 'center', base: up ? 'bottom' : 'top' })
    }

    // 表格
    const tb = split ? { l: w * 0.6, r: w - 18, t: 52 } : { l: 24, r: w - 18, t: plot.b + 62 }
    const cols = [L.colDev, L.colVZ, L.colMech, 'W', '𝓔max', L.colTC]
    const cw = [0.22, 0.12, 0.17, 0.14, 0.17, 0.18]
    const cx: number[] = []
    cw.reduce((s, f) => (cx.push(tb.l + s * (tb.r - tb.l)), s + f), 0)
    const rowH = split ? Math.min(64, (h - tb.t - 40) / 4) : 30
    cols.forEach((s, i) => text(ctx, s, cx[i], tb.t, { size: 11.5, weight: 700, color: c.inkSoft, max: cw[i] * (tb.r - tb.l) - 4 }))
    G.strokeStyle = rgba(c.ink, 0.3)
    G.lineWidth = 1
    G.beginPath()
    G.moveTo(tb.l, tb.t + 14)
    G.lineTo(tb.r, tb.t + 14)
    G.stroke()
    ZENER_IDS.forEach((id, r) => {
      const d = ZENERS[id]
      const { g } = biasGeom(d, d.VZ, 25)
      const y = tb.t + 14 + rowH * (r + 0.5)
      const col = deviceColor(c, id)
      const mech = d.mech === 'tunnel' ? L.mechT : d.mech === 'mixed' ? L.mechM : L.mechA
      const tcs = d.tc.map((t) => minus(`${t > 0 ? '+' : ''}${t}`)).join(' … ')
      const cells = [id, `${d.VZ} V`, mech, lengthText(g.W), `${(g.Emax / 1e6).toFixed(2)} MV/cm`, tcs]
      cells.forEach((s, i) => text(ctx, s, cx[i], y - (i === 5 ? 8 : 0), { size: 12, weight: i === 0 ? 700 : 600, color: i === 0 || i === 2 ? col : c.ink, max: cw[i] * (tb.r - tb.l) - 4 }))
      text(ctx, `${minus(tcMv(d).toFixed(1))} mV/°C`, cx[5], y + 9, { size: 11, color: c.inkSoft, max: cw[5] * (tb.r - tb.l) - 4 })
      G.strokeStyle = rgba(c.ink, 0.1)
      G.beginPath()
      G.moveTo(tb.l, y + rowH / 2)
      G.lineTo(tb.r, y + rowH / 2)
      G.stroke()
    })
  }
}
