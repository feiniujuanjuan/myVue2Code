/* @flow */

import { warn } from 'core/util/index'

export * from './attrs'
export * from './class'
export * from './element'

/**
 * 查询一个元素选择器，如果它还不是一个元素。
 *
 * @param {string | Element} el - 元素选择器或元素。
 * @return {Element} 返回查询到的元素，如果没有查询到，返回一个新创建的 div 元素。
 */
export function query (el: string | Element): Element {
  // 如果 el 是一个字符串，认为它是一个元素选择器
  if (typeof el === 'string') {
    // 使用 document.querySelector 查询元素
    const selected = document.querySelector(el)
    // 如果没有查询到元素
    if (!selected) {
      // 在非生产环境下，发出警告
      process.env.NODE_ENV !== 'production' && warn(
        'Cannot find element: ' + el
      )
      // 返回一个新创建的 div 元素
      return document.createElement('div')
    }
    // 返回查询到的元素
    return selected
  } else {
    // 如果 el 不是一个字符串，认为它已经是一个元素，直接返回
    return el
  }
}
