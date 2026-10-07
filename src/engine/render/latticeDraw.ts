// 晶格舞台的 Canvas 2D 绘制：原子、共价键、键上的价电子、空位、杂质、电极与单步跳跃的箭头。
// 坐标：晶格坐标（原子间距 = 1）经 View 线性映射到画布像素。主画面和空穴放大镜共用这些函数。
import { smoothstep } from '../math'
import { HOP_START, ORBIT, isH, slotPos, type Hole, type Lattice } from '../physics/lattice'

/** 屏幕坐标 = o + s·晶格坐标 */
export interface View {
  s: number
  ox: number
  oy: number
}

/** 要画的原子范围（含两端） */
export interface Box {
  i0: number
  i1: number
  j0: number
  j1: number
}

export interface LatticeColors {
  ink: string
  inkSoft: string
  line: string
  bg: string
  electron: string
  hole: string
  field: string
  potential: string
  ionPlus: string
  ionMinus: string
  /** 贴纸风格：原子加粗描边 */
  sticker: boolean
  font: string
}

type G = CanvasRenderingContext2D

const ATOM_R = 0.24
const DOT_R = 0.055
const BOND_GAP = 0.07

const key = (x: number, y: number) => x * 4096 + y

/** 空位当前画在哪里：跳跃动画中从旧键的 slot 0 移向新键的 slot 0 */
export function holePos(h: Hole): [number, number] {
  const [x1, y1] = slotPos(h.bx, h.by, 0)
  if (!h.hop) return [x1, y1]
  const [x0, y0] = slotPos(h.hop.fx, h.hop.fy, 0)
  const t = smoothstep(h.hop.t)
  return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]
}

/** 原子的热振动：振幅 ∝ √T（0 K 时静止），各原子相位不同 */
function vibration(i: number, j: number, t: number, amp: number): [number, number] {
  if (amp <= 0) return [0, 0]
  const a = (i * 12.9898 + j * 78.233) % (Math.PI * 2)
  const b = (i * 39.346 + j * 11.135) % (Math.PI * 2)
  return [amp * Math.sin(9.1 * t + a), amp * Math.sin(10.7 * t + b)]
}

function dot(g: G, x: number, y: number, r: number) {
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.fill()
}

/** 画原子、键、价电子、空位与杂质。amp：热振动振幅（格），t：时间（舞台秒） */
export function drawLattice(g: G, L: Lattice, v: View, box: Box, c: LatticeColors, t: number, amp: number) {
  const { s } = v
  const X = (x: number) => v.ox + x * s
  const Y = (y: number) => v.oy + y * s
  const i0 = Math.max(0, box.i0)
  const i1 = Math.min(L.W - 1, box.i1)
  const j0 = Math.max(0, box.j0)
  const j1 = Math.min(L.H - 1, box.j1)

  // 空出来的 slot 0：空位所在的键，以及跳跃动画中电子正在离开的旧键
  const empty = new Set<number>()
  for (const h of L.holes) {
    empty.add(key(h.bx, h.by))
    if (h.hop) empty.add(key(h.hop.fx, h.hop.fy))
  }

  // 共价键：两条平行短线，代表两个原子共用的一对电子
  g.strokeStyle = c.inkSoft
  const a0 = g.globalAlpha
  g.globalAlpha = a0 * 0.4
  g.lineWidth = Math.max(1, 0.025 * s)
  g.beginPath()
  const bond = (bx: number, by: number) => {
    const h = isH(bx)
    const d = BOND_GAP * s
    if (h) {
      const xa = X(bx - 0.5 + ATOM_R)
      const xb = X(bx + 0.5 - ATOM_R)
      for (const o of [-d, d]) {
        g.moveTo(xa, Y(by) + o)
        g.lineTo(xb, Y(by) + o)
      }
    } else {
      const ya = Y(by - 0.5 + ATOM_R)
      const yb = Y(by + 0.5 - ATOM_R)
      for (const o of [-d, d]) {
        g.moveTo(X(bx) + o, ya)
        g.lineTo(X(bx) + o, yb)
      }
    }
  }
  const bonds: [number, number][] = []
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      if (i < L.W - 1) bonds.push([i + 0.5, j])
      if (j < L.H - 1) bonds.push([i, j + 0.5])
    }
  }
  for (const [bx, by] of bonds) bond(bx, by)
  g.stroke()

  // 键上的价电子
  g.globalAlpha = a0 * 0.85
  g.fillStyle = c.electron
  const r = Math.max(1.6, DOT_R * s)
  for (const [bx, by] of bonds) {
    const [x1, y1] = slotPos(bx, by, 1)
    dot(g, X(x1), Y(y1), r)
    if (empty.has(key(bx, by))) continue
    const [x0, y0] = slotPos(bx, by, 0)
    dot(g, X(x0), Y(y0), r)
  }
  // 正在跳跃的价电子：从新键的 slot 0 移到旧键的 slot 0（与空位的移动方向相反）
  for (const h of L.holes) {
    if (!h.hop) continue
    const [xa, ya] = slotPos(h.bx, h.by, 0)
    const [xb, yb] = slotPos(h.hop.fx, h.hop.fy, 0)
    const k = smoothstep(h.hop.t)
    dot(g, X(xa + (xb - xa) * k), Y(ya + (yb - ya) * k), r)
  }

  // 空位：虚线圆圈（自由空穴带一圈淡淡的底色，便于在满屏的键中找到）
  const inBox = (x: number, y: number) => x >= box.i0 - 1 && x <= box.i1 + 1 && y >= box.j0 - 1 && y <= box.j1 + 1
  g.lineWidth = Math.max(1.5, 0.022 * s)
  g.setLineDash([Math.max(2, 0.04 * s), Math.max(2, 0.03 * s)])
  for (const h of L.holes) {
    const [x, y] = holePos(h)
    if (!inBox(x, y)) continue
    if (!h.bound) {
      g.globalAlpha = a0 * 0.2
      g.fillStyle = c.hole
      dot(g, X(x), Y(y), 0.2 * s)
    }
    g.globalAlpha = a0
    g.strokeStyle = h.bound ? c.inkSoft : c.hole
    g.beginPath()
    g.arc(X(x), Y(y), Math.max(3, 0.08 * s), 0, Math.PI * 2)
    g.stroke()
  }
  g.setLineDash([])

  // 原子
  const dop = new Map(L.dopants.map((d) => [key(d.i, d.j), d]))
  const R = ATOM_R * s
  const label = R >= 9
  g.font = `600 ${Math.round(0.2 * s)}px ${c.font}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineWidth = c.sticker ? Math.max(1.5, 0.04 * s) : Math.max(1, 0.02 * s)
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const [dx, dy] = vibration(i, j, t, amp)
      const x = X(i + dx)
      const y = Y(j + dy)
      const d = dop.get(key(i, j))
      if (d) continue
      g.globalAlpha = a0
      g.fillStyle = c.bg
      dot(g, x, y, R)
      g.globalAlpha = a0 * 0.25
      g.fillStyle = c.inkSoft
      dot(g, x, y, R)
      g.globalAlpha = a0 * 0.7
      g.strokeStyle = c.sticker ? c.line : c.inkSoft
      g.beginPath()
      g.arc(x, y, R, 0, Math.PI * 2)
      g.stroke()
      if (label) {
        g.fillStyle = c.inkSoft
        g.fillText('Si', x, y + 0.5)
      }
    }
  }

  // 杂质：磷（5 个价电子）、硼（3 个价电子）
  for (const d of L.dopants) {
    if (d.i < box.i0 || d.i > box.i1 || d.j < box.j0 || d.j > box.j1) continue
    const [dx, dy] = vibration(d.i, d.j, t, amp)
    const x = X(d.i + dx)
    const y = Y(d.j + dy)
    const col = d.kind === 'P' ? c.potential : c.field
    g.globalAlpha = a0
    g.fillStyle = col
    dot(g, x, y, R)
    g.strokeStyle = c.sticker ? c.line : col
    g.beginPath()
    g.arc(x, y, R, 0, Math.PI * 2)
    g.stroke()
    if (label) {
      g.fillStyle = c.bg
      g.font = `700 ${Math.round(0.22 * s)}px ${c.font}`
      g.fillText(d.kind, x, y + 0.5)
      g.font = `600 ${Math.round(0.2 * s)}px ${c.font}`
    }
    if (!d.ionized && d.kind === 'P') {
      // 未电离：第 5 个电子松松地绕着磷原子转
      g.globalAlpha = a0 * 0.5
      g.strokeStyle = c.electron
      g.setLineDash([3, 4])
      g.beginPath()
      g.arc(x, y, ORBIT * s, 0, Math.PI * 2)
      g.stroke()
      g.setLineDash([])
      g.globalAlpha = a0
      g.fillStyle = c.electron
      dot(g, x + ORBIT * s * Math.cos(d.phase), y + ORBIT * s * Math.sin(d.phase), Math.max(2.5, 0.075 * s))
    }
    if (d.ionized) {
      // 电离后：固定的离子，带一个 ⊕ / ⊖ 角标
      const bx = x + 0.2 * s
      const by = y - 0.2 * s
      const br = Math.max(5, 0.1 * s)
      g.globalAlpha = a0
      g.fillStyle = c.bg
      dot(g, bx, by, br)
      g.strokeStyle = d.kind === 'P' ? c.ionPlus : c.ionMinus
      g.lineWidth = Math.max(1.2, 0.02 * s)
      g.beginPath()
      g.arc(bx, by, br, 0, Math.PI * 2)
      g.moveTo(bx - br * 0.55, by)
      g.lineTo(bx + br * 0.55, by)
      if (d.kind === 'P') {
        g.moveTo(bx, by - br * 0.55)
        g.lineTo(bx, by + br * 0.55)
      }
      g.stroke()
      g.lineWidth = c.sticker ? Math.max(1.5, 0.04 * s) : Math.max(1, 0.02 * s)
    }
  }
  g.globalAlpha = a0
}

/** 左右电极（左 +、右 −）与电场方向箭头（由 + 指向 −） */
export function drawElectrodes(g: G, L: Lattice, v: View, c: LatticeColors, fieldOn: boolean) {
  const { s } = v
  const X = (x: number) => v.ox + x * s
  const Y = (y: number) => v.oy + y * s
  const a0 = g.globalAlpha
  const top = Y(-0.5)
  const h = L.H * s
  const w = 0.22 * s
  for (const [x, sign] of [[X(-0.5) - 0.12 * s - w, '+'], [X(L.W - 0.5) + 0.12 * s, '−']] as [number, string][]) {
    g.globalAlpha = a0 * 0.85
    g.fillStyle = sign === '+' ? c.ionPlus : c.ionMinus
    g.beginPath()
    g.roundRect(x, top, w, h, Math.min(6, w / 2))
    g.fill()
    g.globalAlpha = a0
    g.fillStyle = c.bg
    g.font = `800 ${Math.round(Math.min(w * 0.95, 0.3 * s))}px ${c.font}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(sign, x + w / 2, top + h / 2)
  }
  if (!fieldOn) return
  g.globalAlpha = a0 * 0.4
  g.strokeStyle = c.field
  g.fillStyle = c.field
  g.lineWidth = Math.max(1.5, 0.03 * s)
  const head = 0.12 * s
  for (let j = 0.5; j < L.H - 1; j += 2) {
    for (let i = 1; i < L.W - 1; i += 3) {
      const x0 = X(i + 0.18)
      const x1 = X(i + 0.82)
      const y = Y(j)
      g.beginPath()
      g.moveTo(x0, y)
      g.lineTo(x1 - head, y)
      g.stroke()
      g.beginPath()
      g.moveTo(x1, y)
      g.lineTo(x1 - head, y - head * 0.6)
      g.lineTo(x1 - head, y + head * 0.6)
      g.fill()
    }
  }
  g.globalAlpha = a0
}

function arrow(g: G, x0: number, y0: number, x1: number, y1: number, bend: number, head: number) {
  const mx = (x0 + x1) / 2
  const my = (y0 + y1) / 2 + bend
  g.beginPath()
  g.moveTo(x0, y0)
  g.quadraticCurveTo(mx, my, x1, y1)
  g.stroke()
  // 箭头沿曲线末端的切线方向
  const a = Math.atan2(y1 - my, x1 - mx)
  g.beginPath()
  g.moveTo(x1, y1)
  g.lineTo(x1 - head * Math.cos(a - 0.45), y1 - head * Math.sin(a - 0.45))
  g.lineTo(x1 - head * Math.cos(a + 0.45), y1 - head * Math.sin(a + 0.45))
  g.closePath()
  g.fill()
}

/** 单步演示：每一跳中价电子的移动（蓝，向左）与空位累计的移动（橙，向右） */
export function drawHops(g: G, L: Lattice, v: View, c: LatticeColors) {
  const h = L.holes[0]
  if (!h) return
  const { s } = v
  const X = (x: number) => v.ox + x * s
  const Y = (y: number) => v.oy + y * s
  const y = HOP_START.by
  const a0 = g.globalAlpha
  g.lineWidth = Math.max(1.8, 0.035 * s)
  g.globalAlpha = a0 * 0.9
  g.strokeStyle = c.electron
  g.fillStyle = c.electron
  for (const x of L.hopLog) {
    const [xa] = slotPos(x + 1, y, 0)
    const [xb] = slotPos(x, y, 0)
    arrow(g, X(xa), Y(y - 0.2), X(xb), Y(y - 0.2), -0.28 * s, 0.11 * s)
  }
  if (h.bx > HOP_START.bx) {
    g.strokeStyle = c.hole
    g.fillStyle = c.hole
    g.lineWidth = Math.max(2.5, 0.05 * s)
    const [xa] = slotPos(HOP_START.bx, y, 0)
    const [xb] = holePos(h)
    if (xb - xa > 0.2) arrow(g, X(xa), Y(y + 0.36), X(xb), Y(y + 0.36), 0, 0.15 * s)
  }
  g.globalAlpha = a0
}
