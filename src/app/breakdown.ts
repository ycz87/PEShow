// 0.6 反向击穿：舞台与图表共用的状态。舞台持有示例器件、反向电压、限流与散热，变化时（热击穿一步每帧）发给图表。
import { TEMP } from '../engine/physics/pn'
import { THERMAL, ZENERS, opPoint, reverseV, type Cooling, type ZenerId } from '../engine/physics/breakdown'
import type { BreakdownCue } from '../devices/pn-junction/sections/types'

export type BreakdownMode = BreakdownCue['mode']

/** 进入各模式时的示例器件；null = 这一模式不针对单个器件（对比） */
export const MODE_DEVICE: Record<BreakdownMode, ZenerId | null> = {
  intro: '1N4757A',
  avalanche: '1N4757A',
  zener: '1N4728A',
  compare: null,
  thermal: THERMAL.device,
}

/**
 * 进入时的反向电压（V）：
 *  - 认识击穿：工作在测试电流 I_ZT（即 U_Z）；
 *  - 雪崩：48 V，倍增因子约 7，舞台上的倍增树大小适中（I_ZT 处 M 达 10³ 量级，画面只能封顶）；
 *  - 齐纳：3.0 V，约 0.65 I_ZT。
 */
export function defaultVr(mode: BreakdownMode, id: ZenerId) {
  if (mode === 'avalanche') return 48
  if (mode === 'zener') return 3
  return ZENERS[id].VZ
}

/** 反向电压滑块的上限：整个温度范围内 1.5 I_ZT 对应的最高电压，滑块范围不随温度跳动 */
export function vrMax(id: ZenerId) {
  const d = ZENERS[id]
  const v = Math.max(reverseV(d, 1.5 * d.IZT, TEMP.min), reverseV(d, 1.5 * d.IZT, TEMP.max))
  const step = v > 20 ? 0.5 : 0.05
  return Math.ceil(v / step) * step
}
export const vrStep = (id: ZenerId) => (ZENERS[id].VZ > 20 ? 0.1 : 0.01)

/** 给图表的实时状态 */
export interface BreakdownLive {
  mode: BreakdownMode
  device: ZenerId
  /** 温度（°C）：热击穿一步为结温 T_j，其余为页面温度 */
  T: number
  /** 工作点：反向电压与反向电流（V、A，正值） */
  V: number
  I: number
  /** 热击穿一步：是否限流、串联电阻（Ω）、散热、是否已损坏 */
  limit: boolean
  R: number
  cooling: Cooling
  burnt: boolean
}

/** 直接加反向电压 vr 时的工作点 */
export function liveAt(mode: BreakdownMode, device: ZenerId, vr: number, T: number): BreakdownLive {
  const op = opPoint(ZENERS[device], vr, 0, T)
  return { mode, device, T, V: op.V, I: op.I, limit: false, R: 0, cooling: 'good', burnt: false }
}
