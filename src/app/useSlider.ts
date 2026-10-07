// 滑块与外部状态联动：拖动时滑块显示本地值，每帧最多提交一次（避免 Vue 响应链和仿真重算阻塞主线程），
// 松手（change）时补交最后一个值并回到读外部状态。键盘调节同样每一下都会触发 change
import { computed, onBeforeUnmount, reactive, ref } from 'vue'

export function useSlider(source: () => number, commit: (v: number) => void) {
  const local = ref<number | null>(null)
  let pending = 0
  let raf = 0

  function flush() {
    raf = 0
    commit(pending)
  }

  /** 滑块上显示的值，绑定到 :value */
  const shown = computed(() => local.value ?? source())

  /** 绑定到 @input */
  function input(e: Event) {
    pending = +(e.target as HTMLInputElement).value
    local.value = pending
    if (!raf) raf = requestAnimationFrame(flush)
  }

  /** 绑定到 @change */
  function release() {
    if (raf) {
      cancelAnimationFrame(raf)
      flush()
    }
    local.value = null
  }

  onBeforeUnmount(() => cancelAnimationFrame(raf))
  return reactive({ shown, input, release })
}
