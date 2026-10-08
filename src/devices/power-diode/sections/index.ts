// 第 1 章：功率二极管。各节内容见 s11…，界面文字见 ui.ts
import type { ChapterContent } from '../../common/content'
import { S11 } from './s11'
import { S12 } from './s12'
import type { Section } from './types'

export const CHAPTER: ChapterContent<Section> = {
  name: { zh: '功率二极管', en: 'Power Diode' },
  tagline: {
    zh: '一层又淡又厚的 N⁻ 区，让二极管既能扛住上千伏，又能流过上百安。',
    en: 'A thick, lightly doped N⁻ layer lets the diode block over a kilovolt and still carry hundreds of amps.',
  },
  sections: [S11, S12],
}
