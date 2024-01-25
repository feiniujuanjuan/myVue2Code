/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson (MPL-1.1 OR Apache-2.0 OR GPL-2.0-or-later)
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'
import { unicodeRegExp } from 'core/util/lang'

// 用于匹配 HTML 属性的正则表达式
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// 用于匹配动态参数属性（例如 v-bind:[arg]、@click、:class 等）的正则表达式
const dynamicArgAttribute = /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+?\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// 用于匹配 XML 名称（NCName）的正则表达式
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`
// 用于匹配带有命名空间的 XML 名称（QName）的正则表达式
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
// 用于匹配开始标签开头的正则表达式
const startTagOpen = new RegExp(`^<${qnameCapture}`)
// 用于匹配开始标签结束的正则表达式
const startTagClose = /^\s*(\/?)>/
// 用于匹配结束标签的正则表达式
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
// 用于匹配 Doctype 的正则表达式
const doctype = /^<!DOCTYPE [^>]+>/i
// 用于匹配 HTML 注释的正则表达式
const comment = /^<!\--/
// 用于匹配条件注释的正则表达式
const conditionalComment = /^<!\[/

// Special Elements (can contain anything)
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t',
  '&#39;': "'"
}
const encodedAttr = /&(?:lt|gt|quot|amp|#39);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#39|#10|#9);/g

// #5992
// 创建一个映射，用于判断一个标签是否应该忽略首个换行符
const isIgnoreNewlineTag = makeMap('pre,textarea', true)

/**
 * 判断是否应该忽略标签内容的首个换行符。
 * @param {string} tag - 标签名。
 * @param {string} html - 标签的内容。
 * @returns {boolean} 如果标签是 'pre' 或 'textarea'，并且内容的第一个字符是换行符，则返回 true，否则返回 false。
 */
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

/**
 * 解码 HTML 属性的值。
 * @param {string} value - 需要解码的属性值。
 * @param {boolean} shouldDecodeNewlines - 是否需要解码换行符。
 * @returns {string} 返回解码后的属性值。
 */
function decodeAttr (value, shouldDecodeNewlines) {
  // 根据是否需要解码换行符来选择正则表达式
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  // 使用正则表达式替换属性值中的编码字符
  return value.replace(re, match => decodingMap[match])
}

export function parseHTML (html, options) {
  // 初始化一个空数组，用于存储标签的堆栈
  const stack = []
  // 从选项中获取 expectHTML，如果没有提供，则默认为 false
  // expectHTML 表示是否期望输入的是 HTML
  const expectHTML = options.expectHTML
  // 从选项中获取 isUnaryTag 函数，如果没有提供，则使用一个始终返回 false 的函数
  // isUnaryTag 函数用于检查一个标签是否是自闭合标签
  const isUnaryTag = options.isUnaryTag || no
  // 从选项中获取 canBeLeftOpenTag 函数，如果没有提供，则使用一个始终返回 false 的函数
  // canBeLeftOpenTag 函数用于检查一个标签是否可以省略闭合标签
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  // 初始化索引变量，表示当前解析到的位置
  let index = 0
  // 初始化 last 和 lastTag 变量，用于存储上一次解析的结果和上一个标签
  let last, lastTag
  // 循环处理 HTML 字符串，直到字符串为空
  while (html) {
    // 保存当前的 HTML 字符串
    last = html
    // 确保我们不在像 script/style 这样的纯文本内容元素中
    if (!lastTag || !isPlainTextElement(lastTag)) {
      // 找到第一个 '<' 的位置
      let textEnd = html.indexOf('<')

      // 如果 '<' 在字符串的开头
      if (textEnd === 0) {
        // 处理注释
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) {
            if (options.shouldKeepComment) {
              options.comment(html.substring(4, commentEnd), index, index + commentEnd + 3)
            }
            advance(commentEnd + 3)
            continue
          }
        }

        // 处理条件注释
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')
          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2)
            continue
          }
        }

        // 处理 Doctype
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }

        // 处理结束标签
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // 处理开始标签
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            advance(1)
          }
          continue
        }
      }

      // 处理文本
      let text, rest, next
      if (textEnd >= 0) {
        rest = html.slice(textEnd)
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1)
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }
        text = html.substring(0, textEnd)
      }

      if (textEnd < 0) {
        text = html
      }

      if (text) {
        advance(text.length)
      }

      if (options.chars && text) {
        options.chars(text, index - text.length, index)
      }
    } else {
      // 处理特殊元素（script/style）
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    // 如果 HTML 字符串没有变化，那么可能是因为标签格式错误，此时应该停止解析
    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`, { start: index + html.length })
      }
      break
    }
  }

  // Clean up any remaining tags
  parseEndTag()

  function advance (n) {
    index += n
    html = html.substring(n)
  }

  /**
   * 解析 HTML 字符串中的开始标签。
   * @returns {Object} 返回一个对象，包含标签名、属性列表、开始位置、结束位置和是否为自闭合标签。
   */
  function parseStartTag () {
    // 使用正则表达式匹配开始标签
    const start = html.match(startTagOpen)
    if (start) {
      // 如果匹配成功，创建一个对象来存储标签的信息
      const match = {
        tagName: start[1], // 标签名
        attrs: [], // 属性列表
        start: index // 开始位置
      }
      // 将索引向前移动匹配到的字符串的长度
      advance(start[0].length)
      let end, attr
      // 循环匹配标签的属性，直到匹配到开始标签的结束部分
      while (!(end = html.match(startTagClose)) && (attr = html.match(dynamicArgAttribute) || html.match(attribute))) {
        attr.start = index // 属性的开始位置
        // 将索引向前移动匹配到的字符串的长度
        advance(attr[0].length)
        attr.end = index // 属性的结束位置
        match.attrs.push(attr) // 将属性添加到属性列表中
      }
      // 如果匹配到开始标签的结束部分
      if (end) {
        match.unarySlash = end[1] // 是否为自闭合标签
        // 将索引向前移动匹配到的字符串的长度
        advance(end[0].length)
        match.end = index // 标签的结束位置
        return match // 返回匹配到的标签信息
      }
    }
  }

  /**
   * 处理解析到的开始标签。
   * @param {Object} match - 包含标签信息的对象。
   */
  function handleStartTag (match) {
    // 获取标签名和是否为自闭合标签
    const tagName = match.tagName
    const unarySlash = match.unarySlash

    // 如果期望输入的是 HTML
    if (expectHTML) {
      // 如果上一个标签是 'p' 并且当前标签不是短语标签，则解析上一个标签的结束标签
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      // 如果当前标签可以省略闭合标签并且和上一个标签相同，则解析当前标签的结束标签
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    // 判断标签是否为自闭合标签
    const unary = isUnaryTag(tagName) || !!unarySlash

    // 创建一个新数组来存储标签的属性
    const l = match.attrs.length
    const attrs = new Array(l)
    for (let i = 0; i < l; i++) {
      // 获取属性的信息
      const args = match.attrs[i]
      const value = args[3] || args[4] || args[5] || ''
      // 判断是否需要解码属性的值
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'
        ? options.shouldDecodeNewlinesForHref
        : options.shouldDecodeNewlines
      // 将属性的信息添加到数组中
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value, shouldDecodeNewlines)
      }
      // 如果在非生产环境并且需要输出源代码的范围，则记录属性的开始和结束位置
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        attrs[i].start = args.start + args[0].match(/^\s*/).length
        attrs[i].end = args.end
      }
    }

    // 如果标签不是自闭合标签，则将标签的信息添加到堆栈中，并将当前标签设置为上一个标签
    if (!unary) {
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs, start: match.start, end: match.end })
      lastTag = tagName
    }

    // 如果提供了开始标签的处理函数，则调用该函数
    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  function parseEndTag (tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    // Find the closest opened tag of the same type
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`,
            { start: stack[i].start, end: stack[i].end }
          )
        }
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
