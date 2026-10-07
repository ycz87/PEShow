// 击穿舞台的"座位"背景：硅原子排成方格，相邻原子之间的共价键上坐着一对价电子（0.1 晶格画法的简化版）。
// 只作背景，画得很淡；座位间距不按真实原子间距
import { rgba } from '../../../design/tokens'
import type { BdCtx } from './common'

export interface Box {
  l: number
  t: number
  r: number
  b: number
}

/** 方格：cols × rows 个原子，原子 (i, j) 在 box 内的相对位置为 ((i + ½)/cols, (j + ½)/rows) */
export interface Grid {
  cols: number
  rows: number
}

export function seatGrid(box: Box, step: number): Grid {
  return { cols: Math.max(2, Math.floor((box.r - box.l) / step)), rows: Math.max(2, Math.floor((box.b - box.t) / step)) }
}

/** 相对坐标 (u, v) ∈ [0,1]² 处最近的原子，以及最近的座位（键的中点），都用相对坐标返回 */
export function nearestAtom(gr: Grid, u: number, v: number): [number, number] {
  const i = Math.min(gr.cols - 1, Math.max(0, Math.round(u * gr.cols - 0.5)))
  const j = Math.min(gr.rows - 1, Math.max(0, Math.round(v * gr.rows - 0.5)))
  return [(i + 0.5) / gr.cols, (j + 0.5) / gr.rows]
}

export function nearestSeat(gr: Grid, u: number, v: number): [number, number] {
  // 横键中点 (i + 1, j + ½)/cols…，竖键中点 (i + ½, j + 1)/rows…：取两者中较近的
  const fx = u * gr.cols - 0.5
  const fy = v * gr.rows - 0.5
  const hi = Math.min(gr.cols - 2, Math.max(0, Math.floor(fx)))
  const hj = Math.min(gr.rows - 1, Math.max(0, Math.round(fy)))
  const vi = Math.min(gr.cols - 1, Math.max(0, Math.round(fx)))
  const vj = Math.min(gr.rows - 2, Math.max(0, Math.floor(fy)))
  const h: [number, number] = [(hi + 1) / gr.cols, (hj + 0.5) / gr.rows]
  const w: [number, number] = [(vi + 0.5) / gr.cols, (vj + 1) / gr.rows]
  const d = (p: [number, number]) => (p[0] - u) ** 2 * gr.cols ** 2 + (p[1] - v) ** 2 * gr.rows ** 2
  return d(h) <= d(w) ? h : w
}

/** 在 box 内画座位方格，step 为原子间距（像素） */
export function drawSeats(ctx: BdCtx, box: Box, step: number) {
  const { g: G, c } = ctx
  const { cols, rows } = seatGrid(box, step)
  const sx = (box.r - box.l) / cols
  const sy = (box.b - box.t) / rows
  const X = (i: number) => box.l + (i + 0.5) * sx
  const Y = (j: number) => box.t + (j + 0.5) * sy
  const gap = Math.max(1.2, step * 0.06)
  const ra = Math.max(2.2, step * 0.14)
  // 共价键：两条平行短线
  G.strokeStyle = rgba(c.inkSoft, 0.16)
  G.lineWidth = 1
  G.beginPath()
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (i < cols - 1) for (const o of [-gap, gap]) {
        G.moveTo(X(i) + ra, Y(j) + o)
        G.lineTo(X(i + 1) - ra, Y(j) + o)
      }
      if (j < rows - 1) for (const o of [-gap, gap]) {
        G.moveTo(X(i) + o, Y(j) + ra)
        G.lineTo(X(i) + o, Y(j + 1) - ra)
      }
    }
  }
  G.stroke()
  // 原子
  G.fillStyle = rgba(c.inkSoft, 0.14)
  G.beginPath()
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    G.moveTo(X(i) + ra, Y(j))
    G.arc(X(i), Y(j), ra, 0, Math.PI * 2)
  }
  G.fill()
  // 键上的一对价电子
  const rd = Math.max(1.3, step * 0.05)
  G.fillStyle = rgba(c.electron, 0.3)
  G.beginPath()
  const dot = (x: number, y: number) => {
    G.moveTo(x + rd, y)
    G.arc(x, y, rd, 0, Math.PI * 2)
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const mx = (X(i) + X(i + 1)) / 2
      const my = (Y(j) + Y(j + 1)) / 2
      if (i < cols - 1) { dot(mx - gap * 1.6, Y(j)); dot(mx + gap * 1.6, Y(j)) }
      if (j < rows - 1) { dot(X(i), my - gap * 1.6); dot(X(i), my + gap * 1.6) }
    }
  }
  G.fill()
}
