// 晶格舞台（0.1–0.2 节）的微观模型：平面方格晶格上的共价键、自由电子、空穴（键上的空位）和杂质原子。
// 长度单位：晶格常数（相邻原子间距 = 1），原子 (i, j) 位于 (i, j)；时间单位：舞台秒。
//  - 自由电子：速度为 Ornstein–Uhlenbeck 过程（热速度 VTH、阻尼 GAMMA），扩散系数 D_e = VTH²/GAMMA；
//    电场给它向左的加速度 FIELD，平均漂移速度 FIELD/GAMMA。
//  - 空穴：键上的空位。相邻键（与它共用一个原子的 6 个键之一）上的价电子跳进来，空位就移到那个键。
//    零场时总跳跃速率 Γ = 6D_h（每跳 ⟨Δr²⟩ = 2/3，D = Γ⟨Δr²⟩/4）。有电场时各方向的速率 × e^{βΔx}，
//    β = FIELD/(2·VTH²)，使空穴与电子的迁移率之比等于扩散系数之比（爱因斯坦关系）。
//  - 产生与复合：G = Ni²κ，R = n·p·κ，κ = 1/(τ·max(n + p, 2Ni))。平衡时 n·p = Ni²；掺杂后少子寿命 ≈ τ。
import { K_B, kelvin } from './pn'
import { balance, type Dopant, type DisplayTarget } from './doping'

/** 晶格视图：12×7 个原子 */
export const VIEW = { W: 12, H: 7 }
/** 拉远后：向四周扩出去，原来的 12×7 位于正中，坐标整体平移 (ox, oy) */
export const ZOOM = { W: 36, H: 21, ox: 12, oy: 7 }

/** 自由电子热速度（格/s）与阻尼（1/s）：D_e = 1 格²/s */
export const VTH = 2
export const GAMMA = 4
/** 空穴与电子迁移率（扩散系数）之比：本征硅 μ_p/μ_n ≈ 450/1400 */
export const HOLE_RATIO = 450 / 1400
/** 复合时间常数（舞台秒） */
export const TAU = 3
/** 电场下电子的加速度（格/s²）：平均漂移速度 FIELD/GAMMA = 1.25 格/s */
export const FIELD = 5
/** 一次价电子跳跃的动画时长（舞台秒） */
export const HOP_T = 0.2
/** 键上两个电子离键中点的距离；空位画在 slot 0（左 / 上） */
export const SLOT = 0.12
/** 磷第 5 个电子的轨道半径（格）与角速度（rad/s） */
export const ORBIT = 0.42
const ORBIT_W = 2.4
/** 杂质电离能 0.045 eV；25 °C 时的电离速率（1/s，舞台时间） */
const E_ION = 0.045
const K_ION = 0.4
/** 复合配对：离得越近越容易选中（特征距离，格） */
const PAIR_L = 1.2
/** 已配对的电子奔向空穴：至少这么快，且最多 STEER_T 秒到达 */
const STEER_V = 3
const STEER_T = 0.6
/** 单步演示：空穴从这个横键出发 */
export const HOP_START = { bx: 2.5, by: 3 }

export type Rand = () => number

export interface Hole {
  id: number
  /** 所在键的中点：横键 (i+½, j)，竖键 (i, j+½) */
  bx: number
  by: number
  /** 正在进行的跳跃：从键 (fx, fy) 跳来，进度 t ∈ [0, 1) */
  hop: { fx: number; fy: number; t: number } | null
  /** 已被一个电子"认领"，正等它来复合：不再跳 */
  doom: boolean
  /** 未电离的硼原子自己键上缺的那个电子（不是自由空穴） */
  bound: boolean
}

export interface Electron {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  /** 已配对、正在奔向的空穴 */
  doom: Hole | null
}

export interface Impurity {
  i: number
  j: number
  kind: 'P' | 'B'
  ionized: boolean
  /** 未电离的磷：第 5 个电子的轨道相位 */
  phase: number
}

export interface LatticeEvent {
  kind: 'gen' | 'recomb' | 'ionize'
  x: number
  y: number
}

export interface LatticeCfg {
  dopant: Dopant
  /** 多个杂质；否则只在中央放一个 */
  many: boolean
  /** 单步演示：只有一个空穴，没有产生、复合 */
  hop: boolean
  /** 左右有电极：载流子可以从一侧离开、由另一侧补进 */
  field: boolean
  zoom: boolean
}

export const isH = (bx: number) => bx % 1 !== 0
const key = (bx: number, by: number) => (bx * 2 + 4) * 4096 + (by * 2 + 4)

/** 与键 (bx, by) 共用一个原子的 6 个键 */
export function neighbors(bx: number, by: number): [number, number][] {
  if (isH(bx)) {
    const a = bx - 0.5
    const b = bx + 0.5
    return [[a - 0.5, by], [a, by - 0.5], [a, by + 0.5], [b + 0.5, by], [b, by - 0.5], [b, by + 0.5]]
  }
  const a = by - 0.5
  const b = by + 0.5
  return [[bx, a - 0.5], [bx - 0.5, a], [bx + 0.5, a], [bx, b + 0.5], [bx - 0.5, b], [bx + 0.5, b]]
}

/** 原子 (i, j) 的 4 个键 */
export function atomBonds(i: number, j: number): [number, number][] {
  return [[i - 0.5, j], [i + 0.5, j], [i, j - 0.5], [i, j + 0.5]]
}

/** 键上第 k 个电子的位置 */
export function slotPos(bx: number, by: number, k: 0 | 1): [number, number] {
  const d = k ? SLOT : -SLOT
  return isH(bx) ? [bx + d, by] : [bx, by + d]
}

function gauss(r: Rand) {
  let u = 0
  while (u === 0) u = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r())
}

/** 泊松抽样（λ 较小时用乘积法） */
function poisson(lambda: number, r: Rand) {
  if (lambda <= 0) return 0
  const L = Math.exp(-lambda)
  let k = 0
  let p = r()
  while (p > L) {
    k++
    p *= r()
  }
  return k
}

export class Lattice {
  W = VIEW.W
  H = VIEW.H
  readonly cfg: LatticeCfg
  electrons: Electron[] = []
  holes: Hole[] = []
  dopants: Impurity[] = []
  /** 产生、复合、电离事件（渲染端取走后清空） */
  events: LatticeEvent[] = []
  tC = 25
  /** 本征参数：平衡时 n·p = Ni²（个数） */
  Ni = 0
  fieldOn = false
  time = 0
  /** 从电极离开的净个数：电子从左端（+）离开、空穴从右端（−）离开，都对应向右的电流 */
  exits = { e: 0, h: 0 }
  /** 单步演示：每一跳之前空位所在键的 x */
  hopLog: number[] = []
  private occ = new Map<number, Hole>()
  private nextId = 1

  constructor(cfg: LatticeCfg, readonly rand: Rand = Math.random) {
    this.cfg = { ...cfg }
    this.fieldOn = cfg.field
    if (cfg.zoom) {
      this.W = ZOOM.W
      this.H = ZOOM.H
    }
  }

  /** 单个杂质放在视野中央 */
  center() {
    return this.cfg.zoom ? { i: 5 + ZOOM.ox, j: 3 + ZOOM.oy } : { i: 5, j: 3 }
  }

  /** 摆好杂质，并直接放入平衡数量的载流子（不播放产生动画） */
  build(tC: number, t: DisplayTarget) {
    this.electrons = []
    this.holes = []
    this.dopants = []
    this.events = []
    this.occ.clear()
    this.exits = { e: 0, h: 0 }
    this.hopLog = []
    this.time = 0
    this.tC = tC
    this.Ni = t.Ni
    const { dopant, many, hop } = this.cfg
    if (hop) {
      this.addHole(HOP_START.bx, HOP_START.by)
      return
    }
    if (dopant !== 'none' && !many) {
      const { i, j } = this.center()
      this.dopants.push({ i, j, kind: dopant, ionized: false, phase: 0 })
      if (dopant === 'B') this.addHole(i + 0.5, j).bound = true
    } else if (many) {
      this.syncDopants(t.D)
    }
    this.fill()
  }

  /** 温度、浓度变化：载流子数靠产生、复合慢慢跟上；杂质个数立即增减（连同它提供的多子） */
  retarget(tC: number, t: DisplayTarget) {
    this.tC = tC
    this.Ni = t.Ni
    if (this.cfg.many && !this.cfg.hop) this.syncDopants(t.D)
  }

  /** 镜头拉远：向四周扩成 36×21，已有的原子、载流子位置不变 */
  expand() {
    if (this.cfg.zoom) return
    const { ox, oy } = ZOOM
    this.W = ZOOM.W
    this.H = ZOOM.H
    this.cfg.zoom = true
    for (const e of this.electrons) {
      e.x += ox
      e.y += oy
    }
    for (const h of this.holes) {
      h.bx += ox
      h.by += oy
      if (h.hop) {
        h.hop.fx += ox
        h.hop.fy += oy
      }
    }
    for (const d of this.dopants) {
      d.i += ox
      d.j += oy
    }
    this.occ.clear()
    for (const h of this.holes) this.occ.set(key(h.bx, h.by), h)
  }

  /** 补足平衡数量的少子（连同与之成对的多子）：只增不减 */
  fill() {
    if (this.cfg.hop) return
    const D = this.dopants.filter((d) => d.ionized).length
    const m = Math.round(balance(D, this.Ni).min)
    const minority = this.cfg.dopant === 'B' ? this.electrons : this.holes
    for (let guard = 0; minority.length < m && guard < 2000; guard++) this.addPair()
  }

  step(dt: number) {
    this.time += dt
    this.ionize(dt)
    this.moveElectrons(dt)
    this.moveHoles(dt)
    if (!this.cfg.hop) this.pairs(dt)
  }

  /** 单步演示：右边相邻键上的电子向左跳进空位，空位向右移一格；到右端后从头开始 */
  hopOnce() {
    const h = this.holes[0]
    if (!h || h.hop) return
    if (h.bx + 1 > this.W - 1.5) {
      this.moveHole(h, HOP_START.bx, HOP_START.by, false)
      this.hopLog = []
      return
    }
    this.hopLog.push(h.bx)
    this.moveHole(h, h.bx + 1, h.by)
  }

  isFree(bx: number, by: number) {
    return !this.occ.has(key(bx, by))
  }

  /** 键是否在晶格内 */
  inside(bx: number, by: number) {
    const { W, H } = this
    return isH(bx) ? bx >= 0.5 && bx <= W - 1.5 && by >= 0 && by <= H - 1 : bx >= 0 && bx <= W - 1 && by >= 0.5 && by <= H - 1.5
  }

  /** 杂质电离速率（1/s）∝ e^{−E_ion/kT}，25 °C 时为 K_ION */
  ionRate() {
    const TK = kelvin(this.tC)
    if (TK < 1) return 0
    return K_ION * Math.exp((E_ION / K_B) * (1 / kelvin(25) - 1 / TK))
  }

  private ionize(dt: number) {
    const k = this.ionRate()
    for (const d of this.dopants) {
      if (d.ionized) continue
      d.phase += ORBIT_W * dt
      if (this.rand() >= k * dt) continue
      if (d.kind === 'P') {
        // 第 5 个电子挣脱，沿轨道切向飞出
        const c = Math.cos(d.phase)
        const s = Math.sin(d.phase)
        this.addElectron(d.i + ORBIT * c, d.j + ORBIT * s, -VTH * s, VTH * c)
      } else {
        // 远端原子 (i+1, j) 另外 3 个键之一上的价电子跳过来补上硼的键，空位就到了那个键
        const h = this.occ.get(key(d.i + 0.5, d.j))
        const far = ([[d.i + 1.5, d.j], [d.i + 1, d.j - 0.5], [d.i + 1, d.j + 0.5]] as [number, number][])
          .filter(([x, y]) => this.inside(x, y) && this.isFree(x, y))
        if (!h || !far.length) continue
        const [x, y] = far[Math.floor(this.rand() * far.length)]
        h.bound = false
        this.moveHole(h, x, y)
      }
      d.ionized = true
      this.events.push({ kind: 'ionize', x: d.i, y: d.j })
    }
  }

  private moveElectrons(dt: number) {
    const c = Math.exp(-GAMMA * dt)
    const s = VTH * Math.sqrt(1 - c * c)
    const v0 = this.fieldOn ? -FIELD / GAMMA : 0
    const x0 = -0.5
    const x1 = this.W - 0.5
    const y0 = -0.5
    const y1 = this.H - 0.5
    const keep: Electron[] = []
    for (const e of this.electrons) {
      if (e.doom) {
        const h = e.doom
        const [tx, ty] = slotPos(h.bx, h.by, 0)
        const dx = tx - e.x
        const dy = ty - e.y
        const d = Math.hypot(dx, dy)
        const v = Math.max(STEER_V, d / STEER_T)
        if (d <= v * dt) {
          this.removeHole(h)
          this.events.push({ kind: 'recomb', x: tx, y: ty })
          continue
        }
        e.vx = (dx / d) * v
        e.vy = (dy / d) * v
        e.x += e.vx * dt
        e.y += e.vy * dt
        keep.push(e)
        continue
      }
      // 速度的精确积分：v' = v₀ + (v − v₀)c + vth√(1−c²)ξ
      e.vx = v0 + (e.vx - v0) * c + s * gauss(this.rand)
      e.vy = e.vy * c + s * gauss(this.rand)
      e.x += e.vx * dt
      e.y += e.vy * dt
      if (e.y < y0) {
        e.y = 2 * y0 - e.y
        e.vy = -e.vy
      } else if (e.y > y1) {
        e.y = 2 * y1 - e.y
        e.vy = -e.vy
      }
      if (this.cfg.field && (e.x < x0 || e.x > x1)) {
        // 从一侧电极离开，另一侧电极补进一个（随机高度）
        const left = e.x < x0
        this.exits.e += left ? 1 : -1
        e.x += left ? this.W : -this.W
        e.y = y0 + this.rand() * this.H
      } else if (e.x < x0) {
        e.x = 2 * x0 - e.x
        e.vx = -e.vx
      } else if (e.x > x1) {
        e.x = 2 * x1 - e.x
        e.vx = -e.vx
      }
      keep.push(e)
    }
    this.electrons = keep
  }

  private moveHoles(dt: number) {
    const rate = (6 * HOLE_RATIO * VTH * VTH) / GAMMA
    const beta = this.fieldOn ? FIELD / (2 * VTH * VTH) : 0
    for (const h of this.holes) {
      // 跳跃动画只是画面效果，不占用时间：动画没播完也可以接着跳
      if (h.hop) {
        h.hop.t += dt / HOP_T
        if (h.hop.t >= 1) h.hop = null
      }
      if (h.doom || h.bound || this.cfg.hop) continue
      // 向每个相邻键的速率 (Γ/6)·e^{βΔx}（不归一化：正反两向之比 e^{2βΔx}，满足细致平衡）；
      // 选中的键出界或已有空位，这一次就不跳
      const nb = neighbors(h.bx, h.by)
      const w = nb.map(([x]) => Math.exp(beta * (x - h.bx)))
      const sum = w.reduce((a, b) => a + b, 0)
      if (this.rand() >= (rate / 6) * sum * dt) continue
      let u = this.rand() * sum
      let k = 0
      while (k < 5 && (u -= w[k]) > 0) k++
      const [nx, ny] = nb[k]
      if (nx < 0 || nx > this.W - 1) {
        if (!this.cfg.field || ny < 0 || ny > this.H - 1) continue
        // 从一侧电极离开，另一侧电极补进一个：从右端离开就从左端补进
        const exitRight = nx > 0
        const b = this.edgeBond(exitRight)
        if (!b) continue
        this.exits.h += exitRight ? 1 : -1
        this.moveHole(h, b[0], b[1], false)
        continue
      }
      if (!this.inside(nx, ny) || !this.isFree(nx, ny)) continue
      this.moveHole(h, nx, ny)
    }
  }

  private pairs(dt: number) {
    const free = this.holes.filter((h) => !h.bound)
    const tot = Math.max(this.electrons.length + free.length, 2 * this.Ni)
    if (tot <= 0) return
    const kappa = 1 / (TAU * tot)
    for (let k = poisson(this.Ni * this.Ni * kappa * dt, this.rand); k > 0; k--) this.generate()
    const ea = this.electrons.filter((e) => !e.doom)
    const ha = free.filter((h) => !h.doom)
    for (let k = poisson(ea.length * ha.length * kappa * dt, this.rand); k > 0 && ea.length && ha.length; k--) {
      const e = ea.splice(Math.floor(this.rand() * ea.length), 1)[0]
      const w = ha.map((h) => Math.exp(-Math.hypot(h.bx - e.x, h.by - e.y) / PAIR_L))
      let u = this.rand() * w.reduce((a, b) => a + b, 0)
      let i = 0
      while (i < w.length - 1 && (u -= w[i]) > 0) i++
      const h = ha.splice(i, 1)[0]
      h.doom = true
      e.doom = h
    }
  }

  /** 热产生：一个完整的键断开，电子从 slot 0 飞出，空位留在原地 */
  private generate() {
    const b = this.randomBond()
    if (!b) return
    this.addHole(b[0], b[1])
    const [x, y] = slotPos(b[0], b[1], 0)
    this.addElectron(x, y)
    this.events.push({ kind: 'gen', x, y })
  }

  /** 不相关的一对：空穴在随机的键上，电子在随机位置 */
  private addPair() {
    const b = this.randomBond()
    if (!b) return
    this.addHole(b[0], b[1])
    this.addElectron(-0.5 + this.rand() * this.W, -0.5 + this.rand() * this.H)
  }

  private addElectron(x: number, y: number, vx = VTH * gauss(this.rand), vy = VTH * gauss(this.rand)) {
    this.electrons.push({ id: this.nextId++, x, y, vx, vy, doom: null })
  }

  private addHole(bx: number, by: number) {
    const h: Hole = { id: this.nextId++, bx, by, hop: null, doom: false, bound: false }
    this.holes.push(h)
    this.occ.set(key(bx, by), h)
    return h
  }

  private removeHole(h: Hole) {
    this.occ.delete(key(h.bx, h.by))
    const i = this.holes.indexOf(h)
    if (i >= 0) this.holes.splice(i, 1)
  }

  private moveHole(h: Hole, bx: number, by: number, anim = true) {
    this.occ.delete(key(h.bx, h.by))
    h.hop = anim ? { fx: h.bx, fy: h.by, t: 0 } : null
    h.bx = bx
    h.by = by
    this.occ.set(key(bx, by), h)
  }

  private randomBond(): [number, number] | null {
    const { W, H } = this
    const nh = (W - 1) * H
    const nv = W * (H - 1)
    for (let k = 0; k < 40; k++) {
      let u = Math.floor(this.rand() * (nh + nv))
      let b: [number, number]
      if (u < nh) b = [(u % (W - 1)) + 0.5, Math.floor(u / (W - 1))]
      else {
        u -= nh
        b = [u % W, Math.floor(u / W) + 0.5]
      }
      if (this.isFree(b[0], b[1])) return b
    }
    return null
  }

  /** 左 / 右边缘上一个空着的键 */
  private edgeBond(left: boolean): [number, number] | null {
    const xh = left ? 0.5 : this.W - 1.5
    const xv = left ? 0 : this.W - 1
    const c: [number, number][] = []
    for (let j = 0; j < this.H; j++) {
      if (this.isFree(xh, j)) c.push([xh, j])
      if (j < this.H - 1 && this.isFree(xv, j + 0.5)) c.push([xv, j + 0.5])
    }
    return c.length ? c[Math.floor(this.rand() * c.length)] : null
  }

  /** 新杂质的位置：不在边上，尽量不与已有杂质相邻 */
  private freeSite(): { i: number; j: number } | null {
    const { W, H } = this
    for (let k = 0; k < 120; k++) {
      const i = 1 + Math.floor(this.rand() * (W - 2))
      const j = 1 + Math.floor(this.rand() * (H - 2))
      const near = k < 60 ? 1 : 0
      if (this.dopants.every((d) => Math.abs(d.i - i) > near || Math.abs(d.j - j) > near)) return { i, j }
    }
    return null
  }

  private syncDopants(D: number) {
    const kind = this.cfg.dopant === 'B' ? 'B' : 'P'
    while (this.dopants.length < D) {
      const s = this.freeSite()
      if (!s) break
      this.dopants.push({ ...s, kind, ionized: true, phase: 0 })
      this.spawnMajority(s.i, s.j, kind)
    }
    while (this.dopants.length > D) {
      const d = this.dopants.pop()!
      this.removeMajority(d.i, d.j, d.kind)
    }
  }

  /** 新加入的杂质已电离：磷的电子在它附近，硼的空穴在它附近的键上 */
  private spawnMajority(i: number, j: number, kind: 'P' | 'B') {
    if (kind === 'P') {
      const a = this.rand() * Math.PI * 2
      this.addElectron(i + ORBIT * Math.cos(a), j + ORBIT * Math.sin(a), -VTH * Math.sin(a), VTH * Math.cos(a))
      return
    }
    const c = atomBonds(i, j)
      .flatMap(([x, y]) => neighbors(x, y))
      .filter(([x, y]) => Math.abs(x - i) + Math.abs(y - j) > 0.5 && this.inside(x, y) && this.isFree(x, y))
    const b = c.length ? c[Math.floor(this.rand() * c.length)] : this.randomBond()
    if (b) this.addHole(b[0], b[1])
  }

  /** 去掉一个杂质时，带走离它最近的一个多子 */
  private removeMajority(i: number, j: number, kind: 'P' | 'B') {
    const d2 = (x: number, y: number) => (x - i) ** 2 + (y - j) ** 2
    if (kind === 'P') {
      let best = -1
      this.electrons.forEach((e, k) => {
        if (!e.doom && (best < 0 || d2(e.x, e.y) < d2(this.electrons[best].x, this.electrons[best].y))) best = k
      })
      if (best >= 0) this.electrons.splice(best, 1)
      return
    }
    let best: Hole | null = null
    for (const h of this.holes) if (!h.doom && !h.bound && (!best || d2(h.bx, h.by) < d2(best.bx, best.by))) best = h
    if (best) this.removeHole(best)
  }
}
