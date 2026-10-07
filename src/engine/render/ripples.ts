// 电子-空穴对的波纹：复合向外扩散（放热，暖色），产生向内收缩（吸热，冷色）。
// 波纹的形状（rippleRings）各舞台共用：PN 结、晶格、雪崩的碰撞电离
import type { Graphics } from 'pixi.js'
import type { PairEvent } from '../physics/pnSim'
import type { StageCtx } from './stage'

/** 一次复合 / 产生的波纹持续时间（秒，按真实时间） */
export const RIPPLE_LIFE = 1.1
/** 同时最多画几个，免得满屏闪烁 */
export const RIPPLE_MAX = 5

/**
 * 年龄 age 时的两道圆环：半径与不透明度。外扩（复合、电离）从 4 px 长到 4 + R，越来越淡；
 * 内收（产生）从 R + 3 缩到 3，越来越浓
 */
export function rippleRings(age: number, inward: boolean, R: number, life = RIPPLE_LIFE) {
  const t = age / life
  const rings: { r: number; alpha: number }[] = []
  for (let k = 0; k < 2; k++) {
    const tk = Math.min(1, Math.max(0, t * 1.25 - k * 0.25))
    if (tk <= 0 || tk >= 1) continue
    rings.push(inward ? { r: R * (1 - tk) + 3, alpha: tk * 0.9 } : { r: 4 + R * tk, alpha: (1 - tk) * 0.9 })
  }
  return rings
}

export class Ripples {
  private list: { x: number; y: number; age: number; gen: boolean }[] = []
  /**
   * 本帧到达、还没决定画不画的事件。空位不够时从中随机抽取，画出来的波纹位置才代表真实的复合 / 产生分布
   * （仿真按列从 x = 0 往右生成事件，先到先得会让 P 区左端占满名额）
   */
  private pending: PairEvent[] = []

  /** force：被追踪载流子的结局一定画出来 */
  add(e: PairEvent, force: boolean) {
    if (force) this.list.push({ x: e.x, y: e.y, age: 0, gen: e.gen })
    else this.pending.push(e)
  }

  clear() {
    this.list.length = 0
    this.pending.length = 0
  }

  update(dt: number) {
    for (const r of this.list) r.age += dt
    this.list = this.list.filter((r) => r.age < RIPPLE_LIFE)
    const q = this.pending
    while (this.list.length < RIPPLE_MAX && q.length) {
      const k = Math.floor(Math.random() * q.length)
      const e = q[k]
      q[k] = q[q.length - 1]
      q.pop()
      this.list.push({ x: e.x, y: e.y, age: 0, gen: e.gen })
    }
    q.length = 0
  }

  draw(g: Graphics, ctx: StageCtx) {
    const { c } = ctx
    const R = Math.max(14, Math.min(30, ctx.L.devW * 0.028))
    for (const r of this.list) {
      for (const ring of rippleRings(r.age, r.gen, R)) {
        g.circle(ctx.X(r.x), ctx.Y(r.y), ring.r).stroke({ width: 2.4, color: r.gen ? c.cool : c.warm, alpha: ring.alpha })
      }
    }
  }
}
