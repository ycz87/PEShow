// 1.1-1 电力电子要什么：三张应用卡片 + 一张"耐压–额定电流"双对数图。
// 左下角是普通电子器件（小信号二极管、肖特基、整流管、第 0 章示例 PN 结），右上角是电力电子器件；
// 右侧标出常见电压的"阶梯"。对数坐标画出每个数量级里 2…9 的细刻度，一眼就能看出是对数坐标
import { rgba } from '../../../design/tokens'
import { roundRect, text } from '../canvasDraw'
import { sup, type PinCtx, type PinScene } from './common'
import { DEVICES, LADDER, U_RANGE, I_RANGE } from './appsData'

export class AppsScene implements PinScene {
  private t = 0

  update(dt: number) {
    this.t += dt
  }

  draw(ctx: PinCtx) {
    const { g, w, h, c, L } = ctx
    const t = this.t
    const ease = (a: number, d: number) => Math.min(1, Math.max(0, (t - a) / d))

    // ── 应用卡片
    const cards = [
      { t: L.appDrive, s: L.appDriveSub, col: c.accent },
      { t: L.appEv, s: L.appEvSub, col: c.electron },
      { t: L.appPv, s: L.appPvSub, col: c.field },
    ]
    const pad = Math.max(14, w * 0.025)
    const cw = (w - pad * 4) / 3
    const ch = 74
    cards.forEach((k, i) => {
      const a = ease(i * 0.3, 0.5)
      const x = pad + i * (cw + pad)
      const y = 10 + (1 - a) * 12
      g.globalAlpha = a
      roundRect(g, x, y, cw, ch, 10)
      g.fillStyle = rgba(k.col, 0.12)
      g.fill()
      g.strokeStyle = rgba(k.col, 0.8)
      g.lineWidth = 1.5
      g.stroke()
      text(ctx, k.t, x + 12, y + 18, { size: 14, weight: 800, display: true, max: cw - 20 })
      k.s.split('\n').forEach((s, j) => text(ctx, s, x + 12, y + 40 + j * 17, { size: 11.5, color: c.inkSoft, weight: 500, max: cw - 20 }))
    })
    g.globalAlpha = 1

    // ── 双对数图
    const m = { l: 62, r: 132, t: 10 + ch + 34, b: 40 }
    const lu = U_RANGE.map(Math.log10)
    const li = I_RANGE.map(Math.log10)
    const X = (I: number) => m.l + ((Math.log10(I) - li[0]) / (li[1] - li[0])) * (w - m.l - m.r)
    const Y = (U: number) => h - m.b - ((Math.log10(U) - lu[0]) / (lu[1] - lu[0])) * (h - m.t - m.b)
    const x1 = w - m.r
    const y0 = m.t
    const y1 = h - m.b
    // 网格：每个数量级一条粗线 + 2…9 的细线
    for (let e = li[0]; e <= li[1]; e++) {
      for (let k = 1; k <= 9; k++) {
        const v = k * 10 ** e
        if (Math.log10(v) > li[1] + 1e-9) break
        g.strokeStyle = rgba(c.ink, k === 1 ? 0.22 : 0.07)
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(X(v), y0)
        g.lineTo(X(v), y1)
        g.stroke()
      }
      text(ctx, e < 0 ? `10${sup(e)} A` : e < 3 ? `${10 ** e} A` : `${10 ** (e - 3)} kA`, X(10 ** e), y1 + 14, { align: 'center', size: 10.5, color: c.inkSoft, weight: 600 })
    }
    for (let e = lu[0]; e <= lu[1]; e++) {
      for (let k = 1; k <= 9; k++) {
        const v = k * 10 ** e
        if (Math.log10(v) > lu[1] + 1e-9) break
        g.strokeStyle = rgba(c.ink, k === 1 ? 0.22 : 0.07)
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(m.l, Y(v))
        g.lineTo(x1, Y(v))
        g.stroke()
      }
      text(ctx, e < 3 ? `${10 ** e} V` : `${10 ** (e - 3)} kV`, m.l - 6, Y(10 ** e), { align: 'right', size: 10.5, color: c.inkSoft, weight: 600 })
    }
    g.strokeStyle = rgba(c.ink, 0.6)
    g.lineWidth = 1.4
    g.strokeRect(m.l, y0, x1 - m.l, y1 - y0)
    text(ctx, L.mapU, m.l, y0 - 12, { size: 12, weight: 700 })
    text(ctx, L.mapI, x1, y1 + 30, { align: 'right', size: 12, weight: 700 })

    // ── 右侧：常见电压的阶梯
    const la = ease(0.8, 1)
    g.globalAlpha = la
    text(ctx, L.ladder, x1 + 8, y0 - 12, { size: 11.5, weight: 700, color: c.inkSoft })
    for (const r of LADDER) {
      const y = Y(r.U)
      g.strokeStyle = rgba(c.potential, 0.45)
      g.setLineDash([3, 4])
      g.beginPath()
      g.moveTo(m.l, y)
      g.lineTo(x1 + 4, y)
      g.stroke()
      g.setLineDash([])
      text(ctx, `${r.U} V  ${L[r.key]}`, x1 + 8, y, { size: 10.5, color: c.potential, max: m.r - 12 })
    }
    g.globalAlpha = 1

    // ── 器件：普通的先出现，电力电子的后出现
    const groups: ['small' | 'power', string, number][] = [['small', L.everyday, 1.6], ['power', L.power, 3.2]]
    for (const [grp, name, at] of groups) {
      const list = DEVICES.filter((d) => d.group === grp)
      const a = ease(at, 0.6)
      if (a <= 0) continue
      // 一组的外框
      const xs = list.map((d) => X(d.I))
      const ys = list.map((d) => Y(d.U))
      const bx0 = Math.min(...xs) - 22
      const bx1 = Math.max(...xs) + 22
      const by0 = Math.min(...ys) - 24
      const by1 = Math.max(...ys) + 22
      const col = grp === 'small' ? c.electron : c.accent
      g.globalAlpha = a
      roundRect(g, bx0, by0, bx1 - bx0, by1 - by0, 14)
      g.fillStyle = rgba(col, 0.1)
      g.fill()
      g.strokeStyle = rgba(col, 0.6)
      g.lineWidth = 1.5
      g.stroke()
      // 组名：普通器件写在框左上角，电力电子器件写在框下方（上方挤着型号）
      if (grp === 'small') text(ctx, name, bx0 + 8, by0 + 12, { size: 12.5, weight: 800, color: col })
      else text(ctx, name, bx1 - 8, by1 + 13, { size: 12.5, weight: 800, color: col, align: 'right' })
      list.forEach((d, k) => {
        const ad = ease(at + 0.15 * k, 0.4)
        g.globalAlpha = ad
        const x = X(d.I)
        const y = Y(d.U)
        g.fillStyle = col
        g.beginPath()
        g.arc(x, y, 5, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = c.bg
        g.lineWidth = 1.5
        g.stroke()
        const lx = x + (d.dx ?? 9)
        const ly = y + (d.dy ?? 0)
        text(ctx, d.label ? L[d.label] : d.name, lx, ly, { size: 10.5, weight: 700, align: (d.dx ?? 9) < 0 ? 'right' : 'left' })
      })
    }
    g.globalAlpha = 1

    // ── 结论
    const ak = ease(5, 0.8)
    if (ak > 0) {
      g.globalAlpha = ak
      // 写在左上角的空白处（小电流、高电压没有器件）
      text(ctx, L.mapGap, m.l + 10, y0 + 16, { size: 13, weight: 800, max: (x1 - m.l) * 0.55 })
      L.mapKey.split('\n').forEach((s, i) => text(ctx, s, m.l + 10, y0 + 36 + i * 17, { size: 11.5, color: c.inkSoft, max: (x1 - m.l) * 0.55 }))
      g.globalAlpha = 1
    }
  }
}
