// 章节内的小节 / 步骤导航：越过一节末尾进入下一节；←/→、PageUp/PageDown 翻步
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { SectionBase, StepBase } from '../devices/common/content'

export function useSteps<S extends StepBase, Sec extends SectionBase<S>>(sections: Sec[], onEnter: (step: S, prev: S) => void) {
  const secIdx = ref(0)
  const stepIdx = ref(0)
  const section = computed(() => sections[secIdx.value])
  const step = computed(() => section.value.steps[stepIdx.value])

  function go(sec: number, i: number) {
    const prev = step.value
    if (i >= sections[sec].steps.length && sec < sections.length - 1) [sec, i] = [sec + 1, 0]
    else if (i < 0 && sec > 0) [sec, i] = [sec - 1, sections[sec - 1].steps.length - 1]
    secIdx.value = Math.max(0, Math.min(sections.length - 1, sec))
    stepIdx.value = Math.max(0, Math.min(section.value.steps.length - 1, i))
    onEnter(step.value, prev)
  }
  const next = (d: number) => go(secIdx.value, stepIdx.value + d)

  /** 章节自己的按键（翻步之外的）；返回 true 表示已处理 */
  let extra: ((e: KeyboardEvent) => boolean) | undefined
  function onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable)) return
    if (e.key === 'ArrowRight' || e.key === 'PageDown') next(1)
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') next(-1)
    else if (!extra?.(e)) return
    e.preventDefault()
  }
  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

  return { secIdx, stepIdx, section, step, go, next, onExtraKey: (f: (e: KeyboardEvent) => boolean) => (extra = f) }
}
