// 0.7 的交流小信号：在直流偏压上叠加一个正弦波动。幅度为了看清而放大（页面上有说明）；
// 正弦按舞台仿真时钟推进，慢放、暂停时跟着变慢、停住

/** 某一时刻的交流信号（V）：v 为瞬时值，amp 为幅度 */
export interface AcSignal {
  v: number
  amp: number
}

/** 周期（舞台秒）：少子寿命在舞台上约 2.2 s，周期取它的几倍，正偏时小山基本跟得上电压 */
export const AC_PERIOD = 8

/**
 * 幅度（V）：反偏 0.5 V，耗尽层边界的进退才看得清；正偏时注入随电压指数变化，0.08 V 就足够；
 * 0…0.5 V 之间线性过渡。不越出本步的电压范围
 */
export function acAmplitude(V: number, range: [number, number]) {
  const a = V <= 0 ? 0.5 : V >= 0.5 ? 0.08 : 0.5 - 0.84 * V
  return Math.max(0, Math.min(a, V - range[0], range[1] - V))
}
