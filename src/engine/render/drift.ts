// 各区平均定向速度：P 区、耗尽层、N 区底部各一对小箭头（电子 / 空穴），长度 ∝ 该区该类载流子的平均 x 速度。
// 统计取全体并联细柱，与屏幕上画多少粒子无关
import type { Graphics } from 'pixi.js'
import type { Kind, Zone } from '../physics/pnSim'
import type { StageCtx } from './stage'

/** 平均个数少于这个值时，平均速度的统计涨落比信号还大，不画箭头 */
const MIN_COUNT = 10
/** 示意放大：箭头长度 = 平均速度（宽度/秒）× 器件宽度 × GAIN */
const GAIN = 1.1

export function drawDrift(g: Graphics, ctx: StageCtx) {
  const { sim, bundle, L, c } = ctx
  const w = sim.w
  const cap = L.devW * 0.08
  const panelW = 2 * cap + 22
  const y0 = L.devY0 + L.devH - 46
  const centers: [Zone, number][] = [
    [0, (0.5 - w / 2) / 2],
    [1, 0.5],
    [2, (1.5 + w / 2) / 2],
  ]
  for (const [zone, xc] of centers) {
    const cx = ctx.X(xc)
    g.roundRect(cx - panelW / 2, y0, panelW, 40, 8).fill({ color: c.panel, alpha: 0.78 }).stroke({ width: 1, color: c.ink, alpha: 0.18 })
    for (const kind of [0, 1] as Kind[]) {
      const y = y0 + (kind === 0 ? 13 : 27)
      const col = kind === 0 ? c.e : c.h
      if (bundle.meanCount(kind, zone) < MIN_COUNT) {
        // 这一区这种载流子太少，算不出有意义的平均
        g.circle(cx, y, 4).stroke({ width: 1.6, color: col, alpha: 0.7 })
        continue
      }
      const len = Math.max(-cap, Math.min(cap, bundle.meanVx(kind, zone) * L.devW * GAIN))
      if (Math.abs(len) < 4) {
        // 平均速度约为 0：画一个实心小点
        g.circle(cx, y, 3).fill({ color: col })
        continue
      }
      const dir = Math.sign(len)
      const x0 = cx - len / 2
      const x1 = cx + len / 2
      const head = Math.min(8, Math.abs(len) * 0.6)
      g.moveTo(x0, y).lineTo(x1 - dir * head, y).stroke({ width: 3, color: col, cap: 'round' })
      g.poly([x1, y, x1 - dir * head, y - 5, x1 - dir * head, y + 5]).fill({ color: col })
    }
  }
}
