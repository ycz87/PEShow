// 1.3 静态特性图共用的曲线与刻度：正向端电压曲线、反向漏电流曲线（按温度缓存）、对数刻度
import { BV_PIN, matAt, reverseI, terminalU } from '../../engine/physics/pin'

/** 正向图：横轴 0–2.6 V，纵轴 0–90 A */
export const FWD = { uMax: 2.6, iMax: 90 }
/** 反向图：横轴 0–1500 V，纵轴 10⁻³–10⁴ µA（对数） */
export const REV = { uMax: 1500, iMin: 1e-3, iMax: 1e4 }

type Pts = [number, number][]
const fwdCache = new Map<number, Pts>()
const revCache = new Map<number, Pts>()

/** 正向曲线 [U (V), I (A)]：电流按对数取点，小电流段的指数上升也取得到 */
export function fwdCurve(tC: number): Pts {
  let pts = fwdCache.get(tC)
  if (!pts) {
    pts = [[0, 0]]
    for (let e = -4; e <= Math.log10(FWD.iMax) + 1e-9; e += 0.04) pts.push([terminalU(10 ** e, tC), 10 ** e])
    fwdCache.set(tC, pts)
  }
  return pts
}

/** 反向曲线 [U_R (V), I_R (µA)]，画到击穿电压附近；靠近击穿时加密取点 */
export function revCurve(tC: number): Pts {
  let pts = revCache.get(tC)
  if (!pts) {
    const m = matAt(tC)
    pts = []
    const knee = BV_PIN - 20
    for (let u = 5; u < knee; u += 10) pts.push([u, reverseI(u, m) * 1e6])
    for (let n = 0; n <= 14; n++) {
      const u = knee + (BV_PIN - knee) * (1 - 2 ** -n)
      pts.push([u, reverseI(u, m) * 1e6])
    }
    revCache.set(tC, pts)
  }
  return pts
}

/** 折线路径 */
export const toPath = (pts: Pts, X: (u: number) => number, Y: (i: number) => number) =>
  pts.map(([u, i], k) => `${k ? 'L' : 'M'}${X(u).toFixed(1)} ${Y(i).toFixed(1)}`).join(' ')

const SUP: Record<string, string> = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }
/** 10 的整数次幂写成 10ⁿ（0.001 … 1000 写成小数） */
export function pow10Label(k: number) {
  if (k >= -3 && k <= 3) return String(10 ** k)
  return '10' + String(k).split('').map((c) => SUP[c]).join('')
}

/** 对数刻度：主刻度 10ᵏ，细刻度 2…9 × 10ᵏ */
export function logTicks(lo: number, hi: number) {
  const majors: number[] = []
  const minors: number[] = []
  for (let k = Math.floor(Math.log10(lo)); k <= Math.ceil(Math.log10(hi)); k++) {
    const v = 10 ** k
    if (v >= lo * 0.999 && v <= hi * 1.001) majors.push(k)
    for (let d = 2; d <= 9; d++) if (d * v > lo && d * v < hi) minors.push(d * v)
  }
  return { majors, minors }
}

/** 页面上写的击穿电压：经验式算得 1387 V，与讲解文字一致取整到 10 V（约 1390 V） */
export const BV_SHOWN = Math.round(BV_PIN / 10) * 10
