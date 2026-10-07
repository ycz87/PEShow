// 第 0 章：PN 结。各节内容见 s01–s08，界面文字见 ui.ts
import type { ChapterContent } from '../../common/content'
import { S01 } from './s01'
import { S02 } from './s02'
import { S03 } from './s03'
import { S04 } from './s04'
import { S05 } from './s05'
import { S06 } from './s06'
import { S07 } from './s07'
import { S08 } from './s08'
import type { Section } from './types'

export const CHAPTER: ChapterContent<Section> = {
  name: { zh: 'PN结', en: 'PN Junction' },
  tagline: {
    zh: '所有功率半导体器件的"地基"：一块 P 型和一块 N 型半导体的交界面。',
    en: 'The foundation of every power device: where P-type meets N-type silicon.',
  },
  sections: [S01, S02, S03, S04, S05, S06, S07, S08],
}
