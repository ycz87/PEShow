// 舞台下方的曲线条带：电场、电势、载流子浓度、能带（含准费米能级）
import type { Graphics } from 'pixi.js'
import { hexToNum } from '../../design/tokens'
import { PN, bands, fieldMag, potential } from '../physics/pn'
import { BINS, type PnSim } from '../physics/pnSim'
import { logLevel, type StageCtx } from './stage'

export function drawStrip(g: Graphics, ctx: StageCtx) {
  g.clear()
  const { sim, bundle, p, L } = ctx
  const X = (x: number) => ctx.X(x)
  const { V, j, w } = sim
  const s = sim.formation
  const ir = ctx.bias.ir
  // 纵轴按 25 °C 定，其他温度的 U_bi 超出时再放宽：换温度时看得出台阶变高变低
  const vbi = Math.max(PN.Vbi, j.Vbi)
  const N = 160
  for (const row of L.rows) {
    const { y0, h } = row
    const yOf = (f: number) => y0 + h - 6 - f * (h - 12)
    g.roundRect(L.devX0, y0, L.devW, h, 6).fill({ color: hexToNum(p.ink), alpha: 0.04 })
    g.moveTo(X(0.5), y0 + 4).lineTo(X(0.5), y0 + h - 4).stroke({ width: 1, color: hexToNum(p.inkSoft), alpha: 0.3 })
    // 在 [x0, x1] 上画曲线（采样点取全局网格，再补上两个端点）
    const curve = (fy: (x: number) => number, color: string, width = 2.6, x0 = 0, x1 = 1) => {
      if (x1 <= x0) return
      g.moveTo(X(x0), yOf(fy(x0)))
      for (let i = Math.ceil(x0 * N); i <= x1 * N; i++) g.lineTo(X(i / N), yOf(fy(i / N)))
      g.lineTo(X(x1), yOf(fy(x1)))
      g.stroke({ width, color: hexToNum(color), cap: 'round', join: 'round' })
    }
    // 虚线：准费米能级
    const dashed = (fy: (x: number) => number, color: string) => {
      const M = 120
      for (let i = 0; i < M; i += 2) {
        g.moveTo(X(i / M), yOf(fy(i / M)))
        g.lineTo(X((i + 1) / M), yOf(fy((i + 1) / M)))
      }
      g.stroke({ width: 2.4, color: hexToNum(color), cap: 'round' })
    }
    if (row.key === 'field') {
      const Eref = fieldMag(0.5, PN.Vmin, 1)
      curve((x) => fieldMag(x, V, s, j) / Eref, p.field)
    } else if (row.key === 'potential') {
      // 纵轴按本步电压范围定：φ 从 A 端的 0 变到 K 端的 U_bi − V
      const [va, vb] = ctx.bias.vRange
      const lo = Math.min(0, Math.min(PN.Vbi, j.Vbi) - vb)
      const hi = Math.max(vbi, vbi - va)
      const fy = (x: number) => (potential(x, V, s, ir, j) - lo) / (hi - lo)
      // 紫色：结上的压降；灰色：两侧体区（有电流时是体电阻上的压降）
      const xa = 0.5 - w / 2
      const xb = 0.5 + w / 2
      curve(fy, p.inkSoft, 2.6, 0, xa)
      curve(fy, p.inkSoft, 2.6, xb, 1)
      curve(fy, p.potential, 2.6, xa, xb)
    } else if (row.key === 'conc') {
      const maj = bundle.majorityPerBin
      const histCurve = (hist: Float32Array, color: string) => {
        for (let b = 0; b < BINS; b++) {
          const yy = yOf(logLevel(hist[b] / maj))
          const x = X((b + 0.5) / BINS)
          if (b === 0) g.moveTo(x, yy); else g.lineTo(x, yy)
        }
        g.stroke({ width: 2.6, color: hexToNum(color), join: 'round' })
      }
      histCurve(bundle.nHist, p.electron)
      histCurve(bundle.pHist, p.hole)
    } else if (row.key === 'band') {
      const top = vbi - PN.Vmin + 0.1
      const bot = -j.Eg - 0.3
      const fy = (E: number) => (E - bot) / (top - bot)
      // 禁带填充
      for (let i = 0; i <= N; i++) {
        const yy = yOf(fy(bands(i / N, V, s, ir, j).Ec))
        if (i === 0) g.moveTo(X(i / N), yy); else g.lineTo(X(i / N), yy)
      }
      for (let i = N; i >= 0; i--) g.lineTo(X(i / N), yOf(fy(bands(i / N, V, s, ir, j).Ev)))
      g.closePath().fill({ color: hexToNum(p.inkSoft), alpha: 0.1 })
      curve((x) => fy(bands(x, V, s, ir, j).Ec), p.ink, 2.4)
      curve((x) => fy(bands(x, V, s, ir, j).Ev), p.ink, 2.4)
      dashed((x) => fy(quasiFermi(sim, x, 'n', ir)), p.electron)
      dashed((x) => fy(quasiFermi(sim, x, 'p', ir)), p.hole)
    }
  }
}

/** 准费米能级：在耗尽层内近似水平，进入对侧中性区后在约一个扩散长度内与对方汇合 */
function quasiFermi(sim: PnSim, x: number, which: 'n' | 'p', ir: number) {
  const { V, j, w } = sim
  const b = bands(x, V, sim.formation, ir, j)
  // 进入 P 区的是电子、进入 N 区的是空穴，各用自己的扩散长度（与粒子仿真一致）
  const Ld = sim.diffusionLength(which === 'n' ? 0 : 1)
  if (which === 'n') {
    const edge = 0.5 - w / 2
    if (x >= edge) return b.EFn
    const t = Math.min(1, (edge - x) / Ld)
    return b.EFn + (b.EFp - b.EFn) * t
  }
  const edge = 0.5 + w / 2
  if (x <= edge) return b.EFp
  const t = Math.min(1, (x - edge) / Ld)
  return b.EFp + (b.EFn - b.EFp) * t
}
