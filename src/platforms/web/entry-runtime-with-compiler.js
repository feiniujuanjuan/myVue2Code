/* @flow */

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

// 保存原始的 $mount 方法
const mount = Vue.prototype.$mount
// 重新定义 $mount 方法
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  // 如果 el 存在，使用 query 函数查找 el 对应的元素
  el = el && query(el)

  // 如果 el 是 document.body 或 document.documentElement，发出警告并返回 this
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  // 获取 Vue 实例的选项
  const options = this.$options
  // 如果 render 选项不存在，解析 template/el 并转换为 render 函数
  if (!options.render) {
    let template = options.template
    if (template) {
      // 如果 template 是一个字符串
      if (typeof template === 'string') {
        // 如果 template 是一个 ID 选择器
        if (template.charAt(0) === '#') {
          // 使用 idToTemplate 函数将 ID 选择器转换为模板字符串
          template = idToTemplate(template)
          // 如果在非生产环境下，template 为空，发出警告
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
        // 如果 template 是一个 DOM 节点，获取其 innerHTML 作为模板字符串
        template = template.innerHTML
      } else {
        // 如果 template 既不是字符串也不是 DOM 节点，在非生产环境下发出警告，并返回 this
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      // 如果 el 存在，使用 getOuterHTML 函数获取 el 的外部 HTML 作为模板字符串
      template = getOuterHTML(el)
    }
    if (template) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

      // 使用 compileToFunctions 函数将模板编译为 render 函数
      // compileToFunctions 函数的参数包括模板字符串、编译选项和当前 Vue 实例
      const { render, staticRenderFns } = compileToFunctions(template, {
        // 在非生产环境下，outputSourceRange 为 true，会生成编译错误的源代码位置信息
        outputSourceRange: process.env.NODE_ENV !== 'production',
        // shouldDecodeNewlines 和 shouldDecodeNewlinesForHref 用于处理模板中的换行符和链接
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        // delimiters 用于定义插值的分隔符
        delimiters: options.delimiters,
        // comments 为 true 时，会保留模板中的 HTML 注释
        comments: options.comments
      }, this)
      // 将编译后的 render 函数存储在 options 对象中
      options.render = render
      // 将编译后的静态 render 函数存储在 options 对象中
      options.staticRenderFns = staticRenderFns

      // 如果当前环境不是生产环境，并且启用了性能跟踪
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        // 记录编译结束的时间
        mark('compile end')
        // 测量编译所用的时间，从 'compile' 到 'compile end'
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  // 调用原始的 $mount 方法挂载 Vue 实例
  return mount.call(this, el, hydrating)
}

/**
 * 获取元素的外部 HTML，同时处理 IE 中的 SVG 元素。
 *
 * @param {Element} el - 要获取外部 HTML 的元素。
 * @return {string} 返回元素的外部 HTML。
 */
function getOuterHTML (el: Element): string {
  // 如果元素的 outerHTML 属性存在，直接返回
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    // 否则，创建一个新的 div 元素作为容器
    const container = document.createElement('div')
    // 将元素的克隆添加到容器中
    container.appendChild(el.cloneNode(true))
    // 返回容器的 innerHTML，即元素的外部 HTML
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue
