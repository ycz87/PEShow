// 1.2-1 电气符号（PinSymbolStage）的界面文字
import type { BiText } from '../../../app/settings'

export type SymEnd = 'A' | 'K'

export const UI_SYMBOL = {
  hint: {
    zh: '把鼠标移到 A 或 K 上（手机上点一下），看它接的是芯片里的哪一层。',
    en: 'Hover A or K (tap on a phone) to see which layer of the chip it connects to.',
  },
  current: { zh: '电流方向', en: 'Current' },
  strip: {
    P: { zh: 'P⁺', en: 'P⁺' },
    N: { zh: 'N⁻', en: 'N⁻' },
    Np: { zh: 'N⁺', en: 'N⁺' },
    pSub: { zh: '阳极侧 · 浓', en: 'anode side · heavy' },
    nSub: { zh: '漂移区 · 淡而厚', en: 'drift region · light and thick' },
    npSub: { zh: '阴极侧 · 浓', en: 'cathode side · heavy' },
  },
  missing: {
    zh: '符号里画不出这一层：耐压和导通能力都靠它',
    en: 'The symbol cannot show this layer, yet voltage and current ability both hang on it',
  },
  ends: {
    A: {
      name: { zh: '阳极 A ↔ P⁺', en: 'Anode A ↔ P⁺' },
      text: {
        zh: '电流从 A 进入芯片正面的 P⁺ 区。P⁺ 很浓，正偏时向 N⁻ 注入大量空穴（1.1 的电导调制）。',
        en: 'Current enters the P⁺ region on the chip front through A. P⁺ is heavily doped and, under forward bias, injects lots of holes into N⁻ (the conductivity modulation of 1.1).',
      },
    },
    K: {
      name: { zh: '阴极 K ↔ N⁺', en: 'Cathode K ↔ N⁺' },
      text: {
        zh: '电流从芯片背面的 N⁺ 区流向 K。N⁺ 很浓，与背面金属形成欧姆接触，正偏时向 N⁻ 提供电子。',
        en: 'Current leaves through the N⁺ region on the chip back towards K. N⁺ is heavily doped and makes an ohmic contact with the back metal; under forward bias it supplies electrons to N⁻.',
      },
    },
  } satisfies Record<SymEnd, { name: BiText; text: BiText }>,
  rule: {
    zh: '三角形指向电流的正方向（从阳极 A 到阴极 K），竖线一侧是阴极。符号只说明电流的方向和两个电极，不说明内部结构，也不说明耐压和电流的大小。',
    en: 'The triangle points the way current flows (anode A to cathode K) and the bar marks the cathode. The symbol tells direction and the two electrodes only, not the inside, nor the voltage or current rating.',
  },
  cmp: {
    title: { zh: '符号相同，内部结构不同', en: 'Same symbol, different inside' },
    ch0: {
      name: { zh: '第 0 章的 PN 结', en: 'The PN junction of chapter 0' },
      facts: [
        { zh: '两侧都是 4.8×10¹⁶ cm⁻³，P 区与 N 区对称', en: 'Both sides 4.8×10¹⁶ cm⁻³, P and N symmetric' },
        { zh: '耐压只有约 28 V', en: 'Blocks only about 28 V' },
        { zh: '电流毫安到百毫安级', en: 'Current: milliamps to hundreds of milliamps' },
      ],
    },
    pin: {
      name: { zh: '功率二极管（PiN）', en: 'The power diode (PiN)' },
      facts: [
        { zh: '中间多一层又淡又厚的 N⁻（1.3×10¹⁴ cm⁻³、约 100 µm）', en: 'An extra light, thick N⁻ in the middle (1.3×10¹⁴ cm⁻³, about 100 µm)' },
        { zh: '耐压 1200 V 级', en: 'Blocks 1200 V class' },
        { zh: '电流几十到几百安（压接型上千安）', en: 'Current: tens to hundreds of amps (thousands for press-pack)' },
      ],
    },
    tail: {
      zh: '所以符号只是"门牌号"：耐压、电流、速度这些，要看剖面结构和数据手册的参数（1.3 起讲）。',
      en: 'So the symbol is only a street number: voltage, current and speed come from the structure and the datasheet (from 1.3 on).',
    },
  },
}
