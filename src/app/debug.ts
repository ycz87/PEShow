// 开发调试：把渲染器、翻页函数等挂到 window.__pdvl 上，便于在控制台或后台标签页里手动推进动画。只在开发模式生效
declare global {
  interface Window {
    __pdvl?: Record<string, unknown>
  }
}

export function exposeDebug(patch: Record<string, unknown>) {
  if (!import.meta.env.DEV) return
  window.__pdvl = { ...window.__pdvl, ...patch }
}
