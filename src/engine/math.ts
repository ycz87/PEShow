// 小工具函数（物理与绘制共用）

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/** 平滑的缓动：0→1，两端斜率为零 */
export const smoothstep = (t: number) => t * t * (3 - 2 * t)
