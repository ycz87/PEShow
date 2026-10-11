import { describe, it, expect } from 'vitest'
import { CIRCUIT, dynWaves } from '../src/devices/power-diode/dynWaves'

describe('1.4 波形与软恢复示意', () => {
  const d = dynWaves()
  it('两个电源：U₁ = U_F + I_F·R ≈ 602 V，I_R = U_R/R = 30 A', () => {
    expect(CIRCUIT.U1).toBeGreaterThan(601)
    expect(CIRCUIT.U1).toBeLessThan(603)
    expect(CIRCUIT.IR).toBe(30)
  })
  it('t_fr（回落到 1.5 U_F）在 U_FRM 之后，几百纳秒', () => {
    expect(d.fr.tfr).toBeGreaterThan(d.fr.tPeak)
    expect(d.fr.tfr).toBeGreaterThan(150e-9)
    expect(d.fr.tfr).toBeLessThan(400e-9)
  })
  it('手册测法（500 A/µs）：A 是硬恢复，S ≈ 0.1、尖峰超过 U_R；I_RM、t_rr、Q_rr 与 STTH3012 换算到 25 °C 的值同一量级', () => {
    const r = d.rrD
    expect(r.S).toBeLessThan(0.3)
    expect(r.URM).toBeGreaterThan(CIRCUIT.UR + 150)
    expect(r.IRM).toBeGreaterThan(35)
    expect(r.IRM).toBeLessThan(55)
    expect(r.trr).toBeGreaterThan(60e-9)
    expect(r.trr).toBeLessThan(150e-9)
    expect(r.Qrr).toBeGreaterThan(1.5e-6)
    expect(r.Qrr).toBeLessThan(3.5e-6)
  })
  it('软恢复 B：峰值之前与 A 相同（t_a、I_RM 一样），软度 ≈ 1.3，没有明显尖峰', () => {
    expect(d.rrSoft.ta).toBeCloseTo(d.rrD.ta, 9)
    expect(d.rrSoft.IRM).toBeCloseTo(d.rrD.IRM, 6)
    expect(Math.abs(d.rrSoft.S - 1.3)).toBeLessThan(0.1)
    expect(d.rrSoft.URM).toBeLessThan(CIRCUIT.UR + 50)
  })
  it('电阻法里的 B：拖尾更长、没有超过 U_R 的尖峰；A 有尖峰', () => {
    expect(d.resB.trr).toBeGreaterThan(1.3 * d.resA.trr)
    expect(d.resB.URM).toBeLessThan(CIRCUIT.UR + 1)
    expect(d.resA.URM).toBeGreaterThan(CIRCUIT.UR + 50)
    expect(d.resA.trr).toBeCloseTo(d.rr.trr, 9)
  })
})
