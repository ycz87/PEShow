import { describe, expect, it } from 'vitest'
import { COLUMNS, REF_UM, fieldShape, place, spreadLabels, totalUm } from '../src/devices/power-diode/sectionLayers'
import { PIN_SIM } from '../src/engine/physics/pinSim'

const H = 330
const [pin, real] = COLUMNS
const sum = (p: { h: number }[]) => p.reduce((s, l) => s + l.h, 0)

describe('1.2-2 剖面图排版', () => {
  it('真实比例：示例 PiN 占满整列，真实薄片按同一把尺只占一部分', () => {
    expect(sum(place(pin, 0, H))).toBeCloseTo(H, 6)
    expect(sum(place(real, 0, H))).toBeCloseTo((H * totalUm(real)) / REF_UM, 6)
    expect(totalUm(real)).toBeGreaterThan(115)
    expect(totalUm(real)).toBeLessThan(125) // 薄片工艺整片约 120 µm
  })

  it('同一把尺：同一层在两列里每微米的像素相同', () => {
    const a = place(pin, 0, H).find((p) => p.id === 'metalF')!
    const b = place(real, 0, H).find((p) => p.id === 'metalF')!
    expect(a.h).toBeCloseTo(b.h, 9)
  })

  it('压缩比例：两列都占满整列，示例 PiN 的 P⁺ / N⁻ / N⁺ 比例就是 1.1 舞台的', () => {
    expect(sum(place(pin, 1, H))).toBeCloseTo(H, 6)
    expect(sum(place(real, 1, H))).toBeCloseTo(H, 6)
    const p = place(pin, 1, H)
    const semi = p.filter((l) => l.id === 'p' || l.id === 'nm' || l.id === 'np')
    const s = sum(semi)
    const f = (id: string) => semi.find((l) => l.id === id)!.h / s
    expect(f('p')).toBeCloseTo(PIN_SIM.XA, 6)
    expect(f('nm')).toBeCloseTo(PIN_SIM.XK - PIN_SIM.XA, 6)
    expect(f('np')).toBeCloseTo(1 - PIN_SIM.XK, 6)
  })

  it('各层首尾相接、自上而下、高度为正', () => {
    for (const col of COLUMNS) {
      for (const t of [0, 0.3, 0.7, 1]) {
        const p = place(col, t, H)
        expect(p[0].y).toBe(0)
        for (let i = 1; i < p.length; i++) {
          expect(p[i].y).toBeCloseTo(p[i - 1].y + p[i - 1].h, 9)
          expect(p[i].h).toBeGreaterThan(0)
        }
      }
    }
  })

  it('穿通型比非穿通型的 N⁻ 更薄、多一层场截止层', () => {
    expect(real.layers.some((l) => l.id === 'fs')).toBe(true)
    expect(pin.layers.some((l) => l.id === 'fs')).toBe(false)
    const nm = (c: typeof pin) => c.layers.find((l) => l.id === 'nm')!.um
    expect(nm(real)).toBeLessThan(nm(pin))
  })
})

describe('标签摊开', () => {
  it('互不重叠，且都在范围内', () => {
    const ys = spreadLabels([2, 5, 8, 200], 30, 15, 330)
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(30 - 1e-9)
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(15)
    expect(Math.max(...ys)).toBeLessThanOrEqual(330)
  })

  it('不挤的标签留在原位', () => {
    expect(spreadLabels([50, 150, 250], 30, 15, 330)).toEqual([50, 150, 250])
  })

  it('挤到底时往上让', () => {
    const ys = spreadLabels([310, 320, 330], 30, 15, 330)
    expect(ys).toEqual([270, 300, 330])
  })
})

describe('电场示意轮廓', () => {
  it('非穿通是三角形：在 N⁻ 内部降到 0', () => {
    const p = place(pin, 0.5, H)
    const nm = p.find((l) => l.id === 'nm')!
    const s = fieldShape('npt', p, 60)
    expect(s).toHaveLength(3)
    expect(s[2][0]).toBe(0)
    expect(s[2][1]).toBeLessThan(nm.y + nm.h)
  })

  it('穿通是梯形：N⁻ 底部电场不为 0，在场截止层里降到 0', () => {
    const p = place(real, 0.5, H)
    const nm = p.find((l) => l.id === 'nm')!
    const fs = p.find((l) => l.id === 'fs')!
    const s = fieldShape('pt', p, 60)
    expect(s[2][0]).toBeGreaterThan(0)
    expect(s[2][1]).toBeCloseTo(nm.y + nm.h, 9)
    expect(s[3][0]).toBe(0)
    expect(s[3][1]).toBeGreaterThan(fs.y)
    expect(s[3][1]).toBeLessThan(fs.y + fs.h)
  })
})
