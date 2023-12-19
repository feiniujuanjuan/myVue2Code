/* @flow */

import { hasOwn } from 'shared/util'
import { warn, hasSymbol } from '../util/index'
import { defineReactive, toggleObserving } from '../observer/index'

/**
 * 初始化组件的提供者。
 *
 * @param {Component} vm - Vue 组件实例。
 */
export function initProvide (vm: Component) {
  // 从组件的选项中获取 provide
  const provide = vm.$options.provide
  // 如果 provide 存在
  if (provide) {
    // 如果 provide 是一个函数，就调用这个函数并将结果赋值给 _provided
    // 如果 provide 不是一个函数，就直接将 provide 赋值给 _provided
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}
/**
 * 初始化 Vue 组件的注入。
 */
export function initInjections (vm: Component) { // Vue 组件实例
  const result = resolveInject(vm.$options.inject, vm) // 解析注入
  if (result) { // 如果解析结果存在
    toggleObserving(false) // 关闭观察
    Object.keys(result).forEach(key => { // 遍历解析结果的每个键
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') { // 在非生产环境下
        // 定义响应式，并添加警告
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else { // 在生产环境下
        // 定义响应式
        defineReactive(vm, key, result[key])
      }
    })
    toggleObserving(true) // 开启观察
  }
}

/**
 * 解析并返回注入的依赖。
 *
 * @param {any} inject - 注入的依赖。
 * @param {Component} vm - Vue 实例。
 * @return {?Object} 返回解析后的依赖。
 */
export function resolveInject (inject: any, vm: Component): ?Object {
  if (inject) {
    // 创建一个空对象用于存储解析后的依赖
    const result = Object.create(null)
    // 获取 inject 对象的所有自身属性的键
    const keys = hasSymbol
      ? Reflect.ownKeys(inject)
      : Object.keys(inject)

    // 遍历所有的键
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      // 如果键是 '__ob__'，则跳过这个键
      if (key === '__ob__') continue
      // 获取提供的键
      const provideKey = inject[key].from
      let source = vm
      // 在组件树中向上查找提供的键
      while (source) {
        if (source._provided && hasOwn(source._provided, provideKey)) {
          // 如果找到提供的键，将其值添加到结果中，并跳出循环
          result[key] = source._provided[provideKey]
          break
        }
        // 向上移动到父组件
        source = source.$parent
      }
      // 如果没有找到提供的键
      if (!source) {
        // 如果定义了默认值
        if ('default' in inject[key]) {
          const provideDefault = inject[key].default
          // 如果默认值是函数，调用该函数并将返回值添加到结果中，否则直接将默认值添加到结果中
          result[key] = typeof provideDefault === 'function'
            ? provideDefault.call(vm)
            : provideDefault
        } else if (process.env.NODE_ENV !== 'production') {
          // 在非生产环境下，如果没有找到注入的依赖，给出警告
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }
    // 返回解析后的依赖
    return result
  }
}
