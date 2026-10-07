import { describe, expect, it } from 'vitest'
import { richHtml } from '../src/app/rich'

describe('richHtml', () => {
  it('段落、加粗与转义', () => {
    expect(richHtml('a **b** <c>')).toBe('<p>a <strong>b</strong> &lt;c&gt;</p>')
  })

  it('列表项合并成一个 ul，前后段落分开', () => {
    expect(richHtml('头\n- 一\n- 二\n尾')).toBe('<p>头</p><ul><li>一</li><li>二</li></ul><p>尾</p>')
  })

  it('空行不产生空段落', () => {
    expect(richHtml('甲\n\n乙')).toBe('<p>甲</p><p>乙</p>')
  })

  it('行内公式交给 KaTeX，公式外的星号仍按加粗处理', () => {
    const h = richHtml('**x** 与 $a^2$')
    expect(h).toContain('<strong>x</strong>')
    expect(h).toContain('class="katex"')
    expect(h).not.toContain('$')
  })
})
