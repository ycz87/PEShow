// 各章共用的讲解内容结构：一节（Section）讲一个主题，分若干步（Step）。
// 一句话理解、比喻、通俗讲解、公式、示意说明按"节"组织；舞台画面、工具、吉祥物台词按"步"组织。
// 各章在此基础上扩展自己的舞台设定（见 pn-junction/sections/types.ts、power-diode/sections/types.ts）。
import type { BiText } from '../../app/settings'

export type Mood = 'happy' | 'excited' | 'worried' | 'calm'

export interface Formula {
  tex: string
  note: BiText
}

export interface Line {
  mood: Mood
  say: BiText
}

export interface StepBase {
  id: string
  title: BiText
  /** 这一步画面上发生什么（简短，显示在讲解区顶部） */
  caption: BiText
  mascot?: { electron: Line; hole: Line }
}

export interface SectionBase<S extends StepBase = StepBase> {
  /** 节号，如 "0.4"、"1.1" */
  id: string
  title: BiText
  /** 承上 / 本节 / 启下 */
  bridge: { prev?: BiText; here: BiText; next?: BiText }
  oneLiner: BiText
  /** 打个比方（随吉祥物开关显示） */
  analogy: BiText[]
  plain: BiText[]
  /** 深入一步：text 在公式前；core 默认展开，ext 与 extText 折叠在"更多"里 */
  deep: { text: BiText[]; core: Formula[]; ext: Formula[]; extText?: BiText[] }
  /** 示意说明：哪里做了夸张或简化 */
  notes: BiText[]
  steps: S[]
}

/** 一章：页面顶部的名称与一句话定位，加上各节 */
export interface ChapterContent<S extends SectionBase<any> = SectionBase> {
  name: BiText
  tagline: BiText
  sections: S[]
}
