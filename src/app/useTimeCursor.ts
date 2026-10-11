// 1.4 波形的时间游标：t（真实时间，s）从 0 走到 tMax，播放一遍约 dur 秒；可暂停、拖动、从头播放
import { onBeforeUnmount, ref } from 'vue'

export function useTimeCursor(tMax: number, dur = 8) {
  const t = ref(0)
  const playing = ref(true)
  let raf = 0
  let last = 0

  const frame = (now: number) => {
    if (playing.value) {
      if (last) t.value = Math.min(tMax, t.value + ((now - last) / 1000) * (tMax / dur))
      if (t.value >= tMax) playing.value = false
    }
    last = now
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  onBeforeUnmount(() => cancelAnimationFrame(raf))

  return {
    t,
    playing,
    tMax,
    toggle() {
      if (!playing.value && t.value >= tMax) t.value = 0
      playing.value = !playing.value
    },
    replay() {
      t.value = 0
      playing.value = true
    },
    seek(v: number) {
      t.value = Math.max(0, Math.min(tMax, v))
      playing.value = false
    },
  }
}

export type TimeCursor = ReturnType<typeof useTimeCursor>
