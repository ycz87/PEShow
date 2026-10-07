// 外电路：A 端 → 导线 → 电池 → 导线 → K 端；导线里的电子珠子与接触处电子进出的小提示
import { Graphics, Text } from 'pixi.js'
import { hexToNum } from '../../design/tokens'
import type { ContactEvent } from '../physics/pnSim'
import type { StageCtx } from './stage'

const POP_LIFE = 0.45
const BEAD_GAP = 24

export class Circuit {
  readonly g = new Graphics()
  /** 电池的 + / − 号 */
  readonly texts: Text[] = ['+', '−'].map((s) => {
    const t = new Text({ text: s, style: { fontSize: 15, fontWeight: '800', fill: 0xffffff } })
    t.anchor.set(0.5)
    return t
  })
  private pops: { side: 'A' | 'K'; y: number; out: boolean; age: number }[] = []
  /** 导线里电子珠子的位移（单位：珠距）；target 由接触事件推进，pos 平滑跟随 */
  private beadPos = 0
  private beadTarget = 0
  /**
   * 交流小信号（0.7）时电容充放电造成的额外位移（单位：珠距），由舞台按交流相位给出：
   * 结电荷随电压增减时，导线里的电子跟着来回挪，这就是电容电流。粒子仿真里每种载流子总数固定，没有这部分，所以单独加上
   */
  capShift = 0

  constructor(private ctx: StageCtx) {}

  setFont(family: string, fill: number) {
    for (const t of this.texts) {
      t.style.fontFamily = family
      t.style.fill = fill
    }
  }

  clear() {
    this.pops.length = 0
  }

  onContact(e: ContactEvent) {
    // 导线是"不可压缩"的电子链：A 端流出或 K 端流入一个电子，整条链前进半格（两端合起来一格）
    const slot = Math.min(1, 40 / this.ctx.sim.target) * 0.5
    this.beadTarget += e.out === (e.side === 'A') ? slot : -slot
    this.pops.push({ side: e.side, y: e.y, out: e.out, age: 0 })
  }

  /** dt：真实帧间隔；fdt：特效用的时间（暂停时为 0） */
  update(dt: number, fdt: number) {
    for (const p of this.pops) p.age += fdt
    this.pops = this.pops.filter((p) => p.age < POP_LIFE)
    if (this.pops.length > 120) this.pops.splice(0, this.pops.length - 120)
    this.beadPos += (this.beadTarget - this.beadPos) * Math.min(1, dt * 6)
  }

  /** 珠子速度只表示方向和多少，不代表真实漂移速度（铜线中真实漂移只有约 μm/s） */
  draw() {
    const { ctx, g } = this
    g.clear()
    const { devX0, devW, devY0, wireY } = ctx.L
    const c = ctx.c
    const wire = hexToNum(ctx.p.inkSoft)
    const ax = devX0 - 7.5
    const kx = devX0 + devW + 7.5
    const y1 = devY0 - 4
    const cx = (ax + kx) / 2
    const gap = 9
    g.moveTo(ax, y1).lineTo(ax, wireY).lineTo(cx - gap, wireY)
    g.moveTo(cx + gap, wireY).lineTo(kx, wireY).lineTo(kx, y1)
    g.stroke({ width: 2.6, color: wire, alpha: 0.9, join: 'round', cap: 'round' })
    // 电池：长线为正极。正偏时正极接 A，反偏时翻转；零偏时相当于短路
    const sgn = ctx.sim.biasSign
    const on = sgn !== 0
    const plusLeft = sgn >= 0
    const xl = cx - gap
    const xr = cx + gap
    const longX = plusLeft ? xl : xr
    const shortX = plusLeft ? xr : xl
    const a = on ? 1 : 0.35
    g.moveTo(longX, wireY - 13).lineTo(longX, wireY + 13).stroke({ width: 2.6, color: c.ink, alpha: a })
    g.moveTo(shortX, wireY - 7).lineTo(shortX, wireY + 7).stroke({ width: 5, color: c.ink, alpha: a })
    if (!on) g.moveTo(xl, wireY).lineTo(xr, wireY).stroke({ width: 2, color: wire, alpha: 0.6 })
    const [tp, tm] = this.texts
    tp.x = longX + (plusLeft ? -9 : 9)
    tm.x = shortX + (plusLeft ? 9 : -9)
    tp.y = tm.y = wireY - 14
    tp.alpha = tm.alpha = a
    // 导线里的电子珠子
    const lenA = y1 - wireY
    const lenTop = kx - ax
    const total = lenA * 2 + lenTop
    const at = (s: number): [number, number] => {
      if (s < lenA) return [ax, y1 - s]
      if (s < lenA + lenTop) return [ax + (s - lenA), wireY]
      return [kx, wireY + (s - lenA - lenTop)]
    }
    const n = Math.floor(total / BEAD_GAP)
    const off = ((((this.beadPos + this.capShift) * BEAD_GAP) % total) + total) % total
    for (let k = 0; k < n; k++) {
      const s = (k * BEAD_GAP + off) % total
      const [x, y] = at(s)
      if (Math.abs(x - cx) < gap + 3 && y === wireY) continue
      g.circle(x, y, 3.4).fill({ color: c.e, alpha: 0.9 })
    }
    // 接触处的小提示：电子在导线与器件之间进出
    for (const p of this.pops) {
      const t = p.age / POP_LIFE
      const edge = p.side === 'A' ? devX0 : devX0 + devW
      const outward = p.side === 'A' ? -1 : 1
      const dir = p.out ? outward : -outward
      const x = edge + dir * (t - 0.5) * 16
      g.circle(x, ctx.Y(p.y), 2.6).fill({ color: c.e, alpha: (1 - t) * 0.9 })
    }
  }
}
