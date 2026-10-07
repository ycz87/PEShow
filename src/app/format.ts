// 数值显示格式

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }

/** 10 的整数次幂，上标写法：pow10(16) → "10¹⁶" */
export function pow10(e: number): string {
  return '10' + String(e).replace(/./g, (c) => SUP[c] ?? c)
}

/** 负号写成"−"（U+2212）：minus(-2) → "−2" */
export function minus(x: number | string): string {
  return String(x).replace('-', '−')
}

/** 带正负号的电压：signedV(0.5) → "+0.50 V" */
export function signedV(v: number, digits = 2): string {
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)} V`
}

/** 摄氏温度，取整：celsius(-40) → "−40 °C" */
export function celsius(t: number): string {
  return `${minus(Math.round(t))} °C`
}

/** 科学计数法：1.0×10¹⁰；小于 1000 时直接写数，0（含下溢）写作 0 */
export function sci(x: number, digits = 1): string {
  if (x === 0 || !Number.isFinite(x)) return '0'
  if (x < 1000) return x < 1 ? '< 1' : String(Math.round(x))
  const e = Math.floor(Math.log10(x))
  const m = x / 10 ** e
  // 四舍五入后可能变成 10.0
  if (+m.toFixed(digits) >= 10) return `${(1).toFixed(digits)}×${pow10(e + 1)}`
  return `${m.toFixed(digits)}×${pow10(e)}`
}

/** 电流带单位显示，自动选合适量级：A / mA / µA / nA / pA / fA */
export function formatCurrent(I: number): string {
  const a = Math.abs(I)
  if (a === 0) return '0 A'
  const sign = I < 0 ? '−' : ''
  const units: [number, string][] = [
    [1, 'A'], [1e-3, 'mA'], [1e-6, 'µA'], [1e-9, 'nA'], [1e-12, 'pA'], [1e-15, 'fA'],
  ]
  for (const [k, u] of units) {
    if (a >= k) return `${sign}${(a / k).toPrecision(3)} ${u}`
  }
  return `${sign}${(a / 1e-15).toPrecision(3)} fA`
}

/** 电容带单位显示：µF / nF / pF */
export function formatCap(C: number): string {
  const units: [number, string][] = [[1e-6, 'µF'], [1e-9, 'nF'], [1e-12, 'pF']]
  for (const [k, u] of units) {
    if (C >= k) return `${(C / k).toPrecision(3)} ${u}`
  }
  return C < 1e-15 ? '≈ 0' : `${(C / 1e-12).toPrecision(2)} pF`
}

/** 掺杂浓度：1.25×10¹⁶、10¹⁹ */
export function conc(n: number): string {
  const e = Math.floor(Math.log10(n) + 1e-9)
  const m = n / 10 ** e
  return Math.abs(m - 1) < 1e-6 ? pow10(e) : `${+m.toFixed(2)}×${pow10(e)}`
}

/** 长度（cm）写成 nm 或 µm */
export function lengthText(cm: number): string {
  const nm = cm * 1e7
  return nm < 1000 ? `${nm < 10 ? nm.toFixed(1) : Math.round(nm)} nm` : `${(nm / 1000).toFixed(2)} µm`
}
