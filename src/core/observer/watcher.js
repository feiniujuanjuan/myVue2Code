/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  invokeWithErrorHandling,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * Watcher 类用于解析表达式，收集依赖，并在表达式值改变时触发回调。
 * 这个类被用于 $watch() API 和指令。
 */
export default class Watcher {
  // Watcher 类的构造函数
  constructor (
    vm: Component, // 组件实例
    expOrFn: string | Function, // 表达式或函数
    cb: Function, // 回调函数
    options?: ?Object, // 选项对象
    isRenderWatcher?: boolean // 是否是渲染观察者
  ) {
    this.vm = vm // 组件实例
    if (isRenderWatcher) { // 如果是渲染观察者
      vm._watcher = this // 将组件实例的 _watcher 属性设置为当前实例
    }
    vm._watchers.push(this) // 将当前实例添加到组件实例的 _watchers 数组中
    // options
    if (options) { // 如果有选项对象
      this.deep = !!options.deep // 设置 deep 属性
      this.user = !!options.user // 设置 user 属性
      this.lazy = !!options.lazy // 设置 lazy 属性
      this.sync = !!options.sync // 设置 sync 属性
      this.before = options.before // 设置 before 属性
    } else { // 如果没有选项对象
      this.deep = this.user = this.lazy = this.sync = false // 将 deep、user、lazy、sync 属性都设置为 false
    }
    this.cb = cb // 回调函数
    this.id = ++uid // uid 用于批处理
    this.active = true // active 属性表示观察者是否活跃
    this.dirty = this.lazy // dirty 属性表示观察者是否需要更新，对于 lazy 观察者，初始值为 true
    this.deps = [] // deps 数组用于存储依赖
    this.newDeps = [] // newDeps 数组用于存储新的依赖
    this.depIds = new Set() // depIds 集合用于存储依赖的 id
    this.newDepIds = new Set() // newDepIds 集合用于存储新的依赖的 id
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    if (typeof expOrFn === 'function') { // 如果 expOrFn 是函数
      this.getter = expOrFn // 将 getter 设置为 expOrFn
    } else { // 如果 expOrFn 不是函数
      this.getter = parsePath(expOrFn) // 将 getter 设置为解析 expOrFn 得到的路径
      if (!this.getter) { // 如果 getter 不存在
        this.getter = noop // 将 getter 设置为 noop 函数
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    this.value = this.lazy
      ? undefined
      : this.get() // 如果 lazy 为 true，将 value 设置为 undefined，否则将 value 设置为 get 方法的返回值
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {
    pushTarget(this) // 将当前实例设置为全局的目标观察者
    let value // 用于存储 getter 的返回值
    const vm = this.vm // 组件实例
    try {
      value = this.getter.call(vm, vm) // 调用 getter 方法，并将其上下文和参数都设置为组件实例，然后将返回值赋值给 value
    } catch (e) { // 如果在调用 getter 方法时抛出错误
      if (this.user) { // 如果 user 属性为 true
        handleError(e, vm, `getter for watcher "${this.expression}"`) // 处理错误
      } else { // 如果 user 属性为 false
        throw e // 抛出错误
      }
    } finally { // 无论是否抛出错误，都会执行 finally 代码块
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) { // 如果 deep 属性为 true
        traverse(value) // 遍历 value 的每个属性，以便收集深度依赖
      }
      popTarget() // 将全局的目标观察者恢复为上一个观察者
      this.cleanupDeps() // 清理依赖
    }
    return value // 返回 value
  }

  /**
   * 添加一个依赖到当前实例。
   */
  addDep (dep: Dep) {
    const id = dep.id // 依赖的 id
    // 如果 newDepIds 集合中没有这个 id
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id) // 将这个 id 添加到 newDepIds 集合中
      this.newDeps.push(dep) // 将这个依赖添加到 newDeps 数组中
      // 如果 depIds 集合中没有这个 id
      if (!this.depIds.has(id)) {
        dep.addSub(this) // 将当前实例添加到依赖的订阅者中
      }
    }
  }

  /**
   * 清理依赖收集。
   */
  cleanupDeps () {
    let i = this.deps.length // deps 数组的长度
    // 从后向前遍历 deps 数组
    while (i--) {
      const dep = this.deps[i] // 当前依赖
      // 如果 newDepIds 集合中没有当前依赖的 id
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this) // 将当前实例从依赖的订阅者中移除
      }
    }
    // 交换 depIds 和 newDepIds，然后清空 newDepIds
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    // 交换 deps 和 newDeps，然后清空 newDeps
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * 订阅者接口。
   * 当一个依赖变化时，将会被调用。
   */
  update () {
    /* istanbul ignore else */
    // 如果 lazy 属性为 true，将 dirty 属性设置为 true
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) { // 如果 sync 属性为 true，立即运行 run 方法
      this.run()
    } else { // 否则，将当前实例添加到观察者队列中，稍后运行
      queueWatcher(this)
    }
  }

  /**
   * 调度器任务接口。
   * 将会被调度器调用。
   */
  run () {
    // 如果 active 属性为 true
    if (this.active) {
      const value = this.get() // 获取 getter 的返回值
      // 如果返回值与当前值不同，或者返回值是对象，或者 deep 属性为 true
      if (
        // 如果新值和旧值不同
        value !== this.value ||
        // 如果新值是一个对象，即使新值和旧值相同，也需要触发更新，因为对象可能发生了变化
        isObject(value) ||
        // 如果设置了深度监听，即使新值和旧值相同，也需要触发更新，因为对象的子属性可能发生了变化
        this.deep
      ) {
        // set new value
        const oldValue = this.value // 保存旧值
        this.value = value // 更新当前值
        // 如果 user 属性为 true
        if (this.user) {
          const info = `callback for watcher "${this.expression}"` // 回调信息
          // 调用回调函数，并处理可能的错误
          invokeWithErrorHandling(this.cb, this.vm, [value, oldValue], this.vm, info)
        } else { // 如果 user 属性为 false
          // 直接调用回调函数
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * 评估观察者的值。
   * 这个方法只会被惰性观察者调用。
   */
  evaluate () {
    this.value = this.get() // 获取 getter 的返回值，并赋值给 value
    this.dirty = false // 将 dirty 属性设置为 false
  }

  /**
   * 依赖所有由此观察者收集的依赖。
   */
  depend () {
    let i = this.deps.length // deps 数组的长度
    while (i--) { // 从后向前遍历 deps 数组
      this.deps[i].depend() // 调用当前依赖的 depend 方法
    }
  }

  /**
   * 从所有依赖的订阅者列表中移除自己。
   */
  teardown () {
    if (this.active) { // 如果 active 属性为 true
      // 如果 vm 实例没有正在被销毁
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this) // 从 vm 实例的观察者列表中移除当前实例
      }
      let i = this.deps.length // deps 数组的长度
      while (i--) { // 从后向前遍历 deps 数组
        this.deps[i].removeSub(this) // 从当前依赖的订阅者中移除当前实例
      }
      this.active = false // 将 active 属性设置为 false
    }
  }
}
