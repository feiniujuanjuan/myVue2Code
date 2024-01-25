/* @flow */

import { cached } from 'shared/util'
import { parseFilters } from './filter-parser'

const defaultTagRE = /\{\{((?:.|\r?\n)+?)\}\}/g
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g

const buildRegex = cached(delimiters => {
  const open = delimiters[0].replace(regexEscapeRE, '\\$&')
  const close = delimiters[1].replace(regexEscapeRE, '\\$&')
  return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

type TextParseResult = {
  expression: string,
  tokens: Array<string | { '@binding': string }>
}

/**
 * 解析文本。
 * @param {string} text - 需要解析的文本。
 * @param {Array<string>} delimiters - 分隔符数组。
 * @returns {Object|void} 返回解析结果，如果文本不匹配正则表达式，则返回 undefined。
 */
export function parseText (
  text: string,
  delimiters?: [string, string]
): TextParseResult | void {
  // 根据分隔符构建正则表达式，如果没有分隔符，则使用默认的正则表达式
  const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
  // 如果文本不匹配正则表达式，则返回 undefined
  if (!tagRE.test(text)) {
    return
  }
  // 初始化 tokens 和 rawTokens 数组
  const tokens = []
  const rawTokens = []
  let lastIndex = tagRE.lastIndex = 0
  let match, index, tokenValue
  // 使用正则表达式匹配文本
  while ((match = tagRE.exec(text))) {
    index = match.index
    // 如果匹配到的位置大于上一次的位置，则将中间的文本添加到 tokens 和 rawTokens 中
    if (index > lastIndex) {
      rawTokens.push(tokenValue = text.slice(lastIndex, index))
      tokens.push(JSON.stringify(tokenValue))
    }
    // 解析过滤器，并将结果添加到 tokens 和 rawTokens 中
    const exp = parseFilters(match[1].trim())
    tokens.push(`_s(${exp})`)
    rawTokens.push({ '@binding': exp })
    lastIndex = index + match[0].length
  }
  // 如果文本的长度大于上一次的位置，则将剩余的文本添加到 tokens 和 rawTokens 中
  if (lastIndex < text.length) {
    rawTokens.push(tokenValue = text.slice(lastIndex))
    tokens.push(JSON.stringify(tokenValue))
  }
  // 返回解析结果
  return {
    expression: tokens.join('+'),
    tokens: rawTokens
  }
}
