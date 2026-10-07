// 掺杂硅的热平衡载流子：真实浓度（计数器、n_i–T 曲线）与晶格舞台上的显示数量
import { kelvin, niSi } from './pn'

export type Dopant = 'none' | 'P' | 'B'

/** 掺杂浓度滑块：log₁₀(N / cm⁻³) */
export const CONC = { min: 14, max: 18, def: 16 }

export interface Carriers {
  n: number
  p: number
  ni: number
}

/**
 * 热平衡浓度（cm⁻³）。假设杂质全部电离：电中性 n − p = N_D（或 p − n = N_A），再加上 n·p = n_i²。
 * 多子 = N/2 + √(N²/4 + n_i²)，少子 = n_i² / 多子（这样写可以避免两个大数相减丢掉精度）
 */
export function equilibrium(tC: number, dopant: Dopant, logN: number): Carriers {
  const ni = niSi(kelvin(tC))
  if (dopant === 'none') return { n: ni, p: ni, ni }
  const N = 10 ** logN
  const maj = N / 2 + Math.sqrt((N * N) / 4 + ni * ni)
  const min = (ni * ni) / maj
  return dopant === 'P' ? { n: maj, p: min, ni } : { n: min, p: maj, ni }
}

/** 舞台上：D 个电离杂质；本征参数 Ni 使平衡时 (多子)·(少子) = Ni²，且 多子 − 少子 = D */
export interface DisplayTarget {
  D: number
  Ni: number
}

/** 给定 D、Ni 时的平衡个数 */
export function balance(D: number, Ni: number) {
  const min = (-D + Math.sqrt(D * D + 4 * Ni * Ni)) / 2
  return { maj: D + min, min }
}

const NI25 = niSi(kelvin(25))
/** 晶格视图（12×7 个原子）里 25 °C 时画几对本征载流子 */
const PAIRS25 = 6

/**
 * 真实数量画不出来，这里做了压缩（页面上有说明，计数器显示真实值）：
 *  - 本征：画面对数 ∝ n_i 的 1/5 次方。真实 n_i 从 −40 °C 到 175 °C 涨了约 5×10⁶ 倍，压缩后约 22 倍，趋势仍明显；
 *  - 单个杂质（0.2-1、0.2-2）：不画本征对，只看这一个杂质；
 *  - 多个杂质：杂质个数随浓度每十倍增加一档；少子按真实的 p/n 比例画，但至少画 floor 个（真实少子少 10 个数量级以上）。
 */
export function displayTarget(o: { dopant: Dopant; many: boolean; zoom: boolean }, tC: number, logN: number): DisplayTarget {
  // 拉远后视野里的原子数是晶格视图的 9 倍
  const area = o.zoom ? 9 : 1
  const c = equilibrium(tC, o.dopant, logN)
  if (o.dopant === 'none') return { D: 0, Ni: PAIRS25 * area * (c.ni / NI25) ** 0.2 }
  if (!o.many) return { D: 1, Ni: 0 }
  const L = logN - CONC.min
  const D = Math.round(o.zoom ? 60 + 20 * L : 2 + 6 * L)
  const r = Math.min(0.95, Math.min(c.n, c.p) / Math.max(c.n, c.p))
  // 少子下限随 ni 对数压缩（指数 0.2），让低温区也有平滑的视觉变化；
  // 不用固定 floor，避免 25-140 °C 之间少子数量被压死在同一个值上。
  const niFloor = o.zoom ? 3 : 1
  const niScale = Math.max(1, niFloor * (c.ni / NI25) ** 0.2)
  const floor = Math.max(niFloor, Math.round(niScale))
  const min = Math.max(floor, (r * D) / (1 - r))
  return { D, Ni: Math.sqrt((D + min) * min) }
}
