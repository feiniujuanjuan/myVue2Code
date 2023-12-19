/* @flow */

import {
  warn,
  invokeWithErrorHandling
} from 'core/util/index'
import {
  cached,
  isUndef,
  isTrue,
  isPlainObject
} from 'shared/util'

const normalizeEvent = cached((name: string): {
  name: string,
  once: boolean,
  capture: boolean,
  passive: boolean,
  handler?: Function,
  params?: Array<any>
} => {
  const passive = name.charAt(0) === '&'
  name = passive ? name.slice(1) : name
  const once = name.charAt(0) === '~' // Prefixed last, checked first
  name = once ? name.slice(1) : name
  const capture = name.charAt(0) === '!'
  name = capture ? name.slice(1) : name
  return {
    name,
    once,
    capture,
    passive
  }
})

export function createFnInvoker (fns: Function | Array<Function>, vm: ?Component): Function {
  function invoker () {
    const fns = invoker.fns
    if (Array.isArray(fns)) {
      const cloned = fns.slice()
      for (let i = 0; i < cloned.length; i++) {
        invokeWithErrorHandling(cloned[i], null, arguments, vm, `v-on handler`)
      }
    } else {
      // return handler return value for single handlers
      return invokeWithErrorHandling(fns, null, arguments, vm, `v-on handler`)
    }
  }
  invoker.fns = fns
  return invoker
}

/**
 * 更新事件监听器。
 */
export function updateListeners (
  on: Object, // 新的事件监听器
  oldOn: Object, // 旧的事件监听器
  add: Function, // 添加事件监听器的函数
  remove: Function, // 删除事件监听器的函数
  createOnceHandler: Function, // 创建一次性处理器的函数
  vm: Component // Vue 组件实例
) {
  let name, def, cur, old, event
  for (name in on) { // 遍历新的事件监听器
    def = cur = on[name] // 获取当前的事件处理器
    old = oldOn[name] // 获取旧的事件处理器
    event = normalizeEvent(name) // 规范化事件名
    /* istanbul ignore if */
    if (__WEEX__ && isPlainObject(def)) { // 如果在 Weex 环境中，并且 def 是一个对象
      cur = def.handler // 获取处理器
      event.params = def.params // 获取参数
    }
    if (isUndef(cur)) { // 如果当前的处理器未定义
      // 在非生产环境下，警告无效的处理器
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid handler for event "${event.name}": got ` + String(cur),
        vm
      )
    } else if (isUndef(old)) { // 如果旧的处理器未定义
      if (isUndef(cur.fns)) {
        // 创建函数调用器
        cur = on[name] = createFnInvoker(cur, vm)
      }
      if (isTrue(event.once)) {
        // 创建一次性处理器
        cur = on[name] = createOnceHandler(event.name, cur, event.capture)
      }
      // 添加事件监听器
      add(event.name, cur, event.capture, event.passive, event.params)
    } else if (cur !== old) { // 如果当前的处理器和旧的处理器不同
      old.fns = cur // 更新旧的处理器的函数
      on[name] = old // 更新事件监听器
    }
  }
  for (name in oldOn) { // 遍历旧的事件监听器
    if (isUndef(on[name])) { // 如果新的事件监听器中没有对应的处理器
      event = normalizeEvent(name) // 规范化事件名
      // 删除事件监听器
      remove(event.name, oldOn[name], event.capture)
    }
  }
}
