// 图表上的拖动与键盘：在 SVG 上按住拖动、或用方向键（Shift 加大十倍）改变一个量（电压、温度），与舞台联动。
// 图表的 <svg> 要写 ref="plot"，并绑定 v-on="listeners"
import { useTemplateRef } from 'vue'

interface ChartDragOptions {
  /** SVG viewBox 的宽度 */
  width: number
  /** viewBox 横坐标 → 数值 */
  toValue: (x: number) => number
  /** 允许的范围 */
  range: () => [number, number]
  current: () => number
  /** 取整步长，也是方向键的一步 */
  step: number
  commit: (v: number) => void
}

export function useChartDrag(o: ChartDragOptions) {
  const svg = useTemplateRef<SVGSVGElement>('plot')
  const decimals = Math.max(0, -Math.floor(Math.log10(o.step)))
  const snap = (v: number) => {
    const [lo, hi] = o.range()
    return Math.min(hi, Math.max(lo, +(Math.round(v / o.step) * o.step).toFixed(decimals)))
  }
  let dragging = false

  function fromEvent(e: PointerEvent) {
    const box = svg.value!.getBoundingClientRect()
    o.commit(snap(o.toValue(((e.clientX - box.left) / box.width) * o.width)))
  }

  const listeners = {
    pointerdown(e: PointerEvent) {
      dragging = true
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      fromEvent(e)
    },
    pointermove(e: PointerEvent) {
      if (dragging) fromEvent(e)
    },
    pointerup() {
      dragging = false
    },
    pointercancel() {
      dragging = false
    },
    keydown(e: KeyboardEvent) {
      const d = e.shiftKey ? 10 * o.step : o.step
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') o.commit(snap(o.current() + d))
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') o.commit(snap(o.current() - d))
      else return
      e.preventDefault()
      e.stopPropagation()
    },
  }

  return listeners
}
