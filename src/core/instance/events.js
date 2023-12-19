/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  formatComponentName,
  invokeWithErrorHandling
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

/**
 * 初始化 Vue 组件的事件。
 */
export function initEvents (vm: Component) {
  vm._events = Object.create(null) // 创建一个没有原型的空对象，用于存储事件
  vm._hasHookEvent = false // 初始化钩子事件标志为 false

  // 初始化父组件附加的事件
  const listeners = vm.$options._parentListeners // 获取父组件的监听器
  if (listeners) { // 如果监听器存在
    // 更新组件的监听器
    updateComponentListeners(vm, listeners)
  }
}

let target: any

function add (event, fn) {
  target.$on(event, fn)
}

function remove (event, fn) {
  target.$off(event, fn)
}

function createOnceHandler (event, fn) {
  const _target = target
  return function onceHandler () {
    const res = fn.apply(null, arguments)
    if (res !== null) {
      _target.$off(event, onceHandler)
    }
  }
}

/**
 * 更新 Vue 组件的事件监听器。
 */
export function updateComponentListeners (
  vm: Component, // Vue 组件实例
  listeners: Object, // 新的事件监听器
  oldListeners: ?Object // 旧的事件监听器
) {
  target = vm // 设置目标为 Vue 组件实例
  // 更新监听器，添加和删除必要的事件监听器
  updateListeners(listeners, oldListeners || {}, add, remove, createOnceHandler, vm)
  target = undefined // 清除目标
}

export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/
  /**
   * 监听实例上的自定义事件。
   *
   * @param {string | Array<string>} event - 要监听的事件名或事件名数组。
   * @param {Function} fn - 当事件被触发时调用的回调函数。
   * @return {Component} 返回 Vue 实例，以便链式调用。
   */
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    // 获取 Vue 实例
    const vm: Component = this
    // 如果 event 是数组，遍历数组，对每个事件名递归调用 $on 方法
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$on(event[i], fn)
      }
    } else {
      // 如果 event 不是数组，将回调函数添加到对应事件名的回调函数数组中
      // 如果该事件名的回调函数数组不存在，先创建一个空数组
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // 如果事件名匹配 hookRE（钩子事件正则表达式），设置 _hasHookEvent 标志为 true
      // 这是一种优化，避免每次都要进行哈希查找
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    // 返回 Vue 实例，以便链式调用
    return vm
  }

  /**
   * 监听实例上的自定义事件，但只触发一次，在第一次触发之后移除监听器。
   *
   * @param {string} event - 要监听的事件名。
   * @param {Function} fn - 当事件被触发时调用的回调函数。
   * @return {Component} 返回 Vue 实例，以便链式调用。
   */
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    // 获取 Vue 实例
    const vm: Component = this
    // 定义一个函数，当事件被触发时，先移除监听器，然后调用回调函数
    function on () {
      // 使用 $off 方法移除监听器
      vm.$off(event, on)
      // 调用回调函数，使用 apply 方法确保 this 指向正确
      fn.apply(vm, arguments)
    }
    // 保存原始的回调函数，以便在移除监听器时使用
    on.fn = fn
    // 使用 $on 方法添加监听器
    vm.$on(event, on)
    // 返回 Vue 实例，以便链式调用
    return vm
  }

  /**
   * 移除实例上的自定义事件监听器。
   *
   * @param {string | Array<string>} [event] - 要移除的事件名或事件名数组。
   * @param {Function} [fn] - 要移除的回调函数。
   * @return {Component} 返回 Vue 实例，以便链式调用。
   */
  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    // 获取 Vue 实例
    const vm: Component = this
    // 如果没有提供参数，移除所有事件监听器
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }
    // 如果 event 是数组，遍历数组，对每个事件名递归调用 $off 方法
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$off(event[i], fn)
      }
      return vm
    }
    // 获取指定事件的回调函数数组
    const cbs = vm._events[event]
    // 如果回调函数数组不存在，直接返回
    if (!cbs) {
      return vm
    }
    // 如果没有提供回调函数，移除指定事件的所有监听器
    if (!fn) {
      vm._events[event] = null
      return vm
    }
    // 如果提供了回调函数，移除指定事件的指定监听器
    let cb
    let i = cbs.length
    while (i--) {
      cb = cbs[i]
      // 如果找到匹配的回调函数，从数组中移除
      if (cb === fn || cb.fn === fn) {
        cbs.splice(i, 1)
        break
      }
    }
    // 返回 Vue 实例，以便链式调用
    return vm
  }

  /**
   * 触发实例上的自定义事件。
   *
   * @param {string} event - 要触发的事件名。
   * @return {Component} 返回 Vue 实例，以便链式调用。
   */
  Vue.prototype.$emit = function (event: string): Component {
    // 获取 Vue 实例
    const vm: Component = this
    // 如果在非生产环境，检查事件名的大小写
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      // 如果事件名的小写形式与原事件名不同，且存在小写形式的事件，发出警告
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    // 获取指定事件的回调函数数组
    let cbs = vm._events[event]
    if (cbs) {
      // 如果回调函数数组的长度大于 1，将其转换为真正的数组
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      // 获取事件参数
      const args = toArray(arguments, 1)
      const info = `event handler for "${event}"`
      // 遍历回调函数数组，对每个回调函数调用 invokeWithErrorHandling 函数
      for (let i = 0, l = cbs.length; i < l; i++) {
        invokeWithErrorHandling(cbs[i], vm, args, vm, info)
      }
    }
    // 返回 Vue 实例，以便链式调用
    return vm
  }
}
