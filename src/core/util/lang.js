/* @flow */

/**
 * unicode letters used for parsing html tags, component names and property paths.
 * using https://www.w3.org/TR/html53/semantics-scripting.html#potentialcustomelementname
 * skipping \u10000-\uEFFFF due to it freezing up PhantomJS
 */
export const unicodeRegExp = /a-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD/

/**
 * 检查一个字符串是否以 $ 或 _ 开始。
 */
export function isReserved (str: string): boolean { // 输入的字符串
  const c = (str + '').charCodeAt(0) // 获取字符串的第一个字符的 Unicode 编码
  return c === 0x24 || c === 0x5F // 如果 Unicode 编码等于 0x24（$ 的 Unicode 编码）或 0x5F（_ 的 Unicode 编码），返回 true，否则返回 false
}

/**
 * 在一个对象上定义一个属性。
 */
export function def (obj: Object, key: string, val: any, enumerable?: boolean) { // 对象，键，值，是否可枚举
  Object.defineProperty(obj, key, { // 在对象上定义属性
    value: val, // 属性的值
    enumerable: !!enumerable, // 属性是否可枚举，如果 enumerable 为真，转换为 true，否则转换为 false
    writable: true, // 属性是否可写
    configurable: true // 属性是否可配置
  })
}

/**
 * 定义一个正则表达式，用于匹配非法的路径字符。
 */
const bailRE = new RegExp(`[^${unicodeRegExp.source}.$_\\d]`)

/**
 * 解析简单的路径。
 *
 * @param {string} path - 需要解析的路径。
 * @return {Function} 返回一个函数，该函数接受一个对象作为参数，返回路径对应的值。
 */
export function parsePath (path: string): any {
  // 如果路径包含非法的字符，返回 undefined
  if (bailRE.test(path)) {
    return
  }
  // 使用 '.' 分割路径，得到一个路径段的数组
  const segments = path.split('.')
  // 返回一个函数，该函数接受一个对象作为参数
  return function (obj) {
    // 遍历路径段的数组
    for (let i = 0; i < segments.length; i++) {
      // 如果对象不存在，返回 undefined
      if (!obj) return
      // 使用路径段更新对象
      obj = obj[segments[i]]
    }
    // 返回路径对应的值
    return obj
  }
}
