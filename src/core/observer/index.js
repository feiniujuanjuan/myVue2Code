/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer 类，附加到每个被观察的对象上。
 * 一旦附加，观察者将目标对象的属性键转换为收集依赖项和分派更新的 getter/setter。
 */
export class Observer {
  value: any; // 被观察的值
  dep: Dep; // 依赖对象
  vmCount: number; // 有此对象作为根 $data 的 vm 数量

  constructor (value: any) { // 构造函数
    this.value = value // 设置被观察的值
    this.dep = new Dep() // 创建一个新的依赖对象
    this.vmCount = 0 // 初始化 vmCount
    def(value, '__ob__', this) // 在值上定义一个名为 __ob__ 的属性，值为 this
    if (Array.isArray(value)) { // 如果值是数组
      if (hasProto) { // 如果有 __proto__ 属性
        protoAugment(value, arrayMethods) // 使用原型增强
      } else {
        copyAugment(value, arrayMethods, arrayKeys) // 使用复制增强
      }
      this.observeArray(value) // 观察数组
    } else {
      this.walk(value) // 遍历对象
    }
  }

  /**
   * 遍历所有属性并将它们转换为 getter/setter。
   * 仅当值类型为 Object 时，才应调用此方法。
   */
  walk (obj: Object) { // 要遍历的对象
    const keys = Object.keys(obj) // 获取对象的所有键
    for (let i = 0; i < keys.length; i++) { // 遍历所有键
      defineReactive(obj, keys[i]) // 定义响应式属性
    }
  }

  /**
   * 观察数组项列表。
   */
  observeArray (items: Array<any>) { // 要观察的数组
    for (let i = 0, l = items.length; i < l; i++) { // 遍历所有项
      observe(items[i]) // 观察项
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * 通过定义隐藏属性来增强目标对象或数组。
 */
function copyAugment (target: Object, src: Object, keys: Array<string>) { // 目标对象，源对象，键数组
  for (let i = 0, l = keys.length; i < l; i++) { // 遍历键数组
    const key = keys[i] // 获取当前键
    def(target, key, src[key]) // 在目标对象上定义一个属性，该属性的键是当前键，值是源对象上对应的值
  }
}

/**
 * 尝试为一个值创建一个观察者实例，
 * 如果成功观察，返回新的观察者，
 * 如果该值已经有一个观察者，返回现有的观察者。
 */
export function observe (value: any, asRootData: ?boolean): Observer | void { // 要观察的值和是否作为根数据的标志
  if (!isObject(value) || value instanceof VNode) { // 如果值不是对象或值是 VNode 实例
    return // 返回 undefined
  }
  let ob: Observer | void // 观察者
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) { // 如果值有 __ob__ 属性且 __ob__ 属性是 Observer 实例
    ob = value.__ob__ // 使用现有的观察者
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) { // 如果应该观察且不是在服务器渲染且值是数组或普通对象且值是可扩展的且值不是 Vue 实例
    ob = new Observer(value) // 创建新的观察者
  }
  if (asRootData && ob) { // 如果作为根数据且观察者存在
    ob.vmCount++ // 增加 vmCount
  }
  return ob // 返回观察者
}

/**
 * 在对象上定义一个响应式属性。
 */
export function defineReactive (
  obj: Object, // 对象
  key: string, // 属性的键
  val: any, // 属性的值
  customSetter?: ?Function, // 自定义的 setter
  shallow?: boolean // 是否浅观察
) {
  const dep = new Dep() // 创建一个依赖对象

  const property = Object.getOwnPropertyDescriptor(obj, key) // 获取属性的描述符
  if (property && property.configurable === false) { // 如果属性存在且不可配置
    return // 直接返回
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get // 获取 getter
  const setter = property && property.set // 获取 setter
  if ((!getter || setter) && arguments.length === 2) { // 如果 getter 不存在或 setter 存在且参数长度为 2
    val = obj[key] // 获取属性的值
  }

  let childOb = !shallow && observe(val) // 如果不是浅观察，则观察属性的值
  Object.defineProperty(obj, key, { // 在对象上定义属性
    enumerable: true, // 可枚举
    configurable: true, // 可配置
    get: function reactiveGetter () { // 定义 getter
      const value = getter ? getter.call(obj) : val // 获取属性的值
      if (Dep.target) { // 如果有依赖目标
        dep.depend() // 添加依赖
        if (childOb) { // 如果子观察对象存在
          childOb.dep.depend() // 添加子观察对象的依赖
          if (Array.isArray(value)) { // 如果值是数组
            dependArray(value) // 添加数组的依赖
          }
        }
      }
      return value // 返回值
    },
    set: function reactiveSetter (newVal) { // 定义 setter
      const value = getter ? getter.call(obj) : val // 获取属性的值
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) { // 如果新值等于旧值或新值和旧值都是 NaN
        return // 直接返回
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) { // 在非生产环境下，如果有自定义的 setter
        customSetter() // 调用自定义的 setter
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return // 如果有 getter 但没有 setter，直接返回
      if (setter) { // 如果有 setter
        setter.call(obj, newVal) // 调用 setter 设置新值
      } else { // 如果没有 setter
        val = newVal // 直接设置新值
      }
      childOb = !shallow && observe(newVal) // 如果不是浅观察，则观察新值
      dep.notify() // 通知依赖更新
    }
  })
}

/**
 * 在对象上设置一个属性。如果属性不存在，它将添加新属性并触发更改通知。
 *
 * @param {Array<any> | Object} target - 需要设置属性的目标对象。
 * @param {any} key - 需要设置的属性的键。
 * @param {any} val - 需要设置的属性的值。
 * @return {any} 返回设置的属性的值。
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  // 在非生产环境下，如果目标是 undefined、null 或原始值，给出警告
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  // 如果目标是数组，并且键是有效的数组索引
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    // 更新数组的长度
    target.length = Math.max(target.length, key)
    // 在指定的位置插入新的元素
    target.splice(key, 1, val)
    return val
  }
  // 如果键已经在目标对象中存在，并且键不在 Object.prototype 中
  if (key in target && !(key in Object.prototype)) {
    // 直接更新目标对象的属性
    target[key] = val
    return val
  }
  // 获取目标对象的观察者
  const ob = (target: any).__ob__
  // 如果目标对象是 Vue 实例或其根 $data，或者目标对象有观察者并且观察者的 vmCount 大于 0
  if (target._isVue || (ob && ob.vmCount)) {
    // 在非生产环境下，给出警告
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  // 如果目标对象没有观察者
  if (!ob) {
    // 直接更新目标对象的属性
    target[key] = val
    return val
  }
  // 在目标对象上定义响应式属性
  defineReactive(ob.value, key, val)
  // 通知依赖更新
  ob.dep.notify()
  return val
}

/**
 * 删除对象的一个属性。如果属性存在并且删除后会改变对象，那么会触发更改通知。
 *
 * @param {Array<any> | Object} target - 需要删除属性的目标对象。
 * @param {any} key - 需要删除的属性的键。
 */
export function del (target: Array<any> | Object, key: any) {
  // 在非生产环境下，如果目标是 undefined、null 或原始值，给出警告
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  // 如果目标是数组，并且键是有效的数组索引
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    // 删除指定位置的元素
    target.splice(key, 1)
    return
  }
  // 获取目标对象的观察者
  const ob = (target: any).__ob__
  // 如果目标对象是 Vue 实例或其根 $data，或者目标对象有观察者并且观察者的 vmCount 大于 0
  if (target._isVue || (ob && ob.vmCount)) {
    // 在非生产环境下，给出警告
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  // 如果目标对象没有指定的键
  if (!hasOwn(target, key)) {
    return
  }
  // 删除目标对象的指定键
  delete target[key]
  // 如果目标对象没有观察者
  if (!ob) {
    return
  }
  // 通知依赖更新
  ob.dep.notify()
}

/**
 * 在数组被访问时收集数组元素的依赖。
 *
 * @param {Array<any>} value - 需要收集依赖的数组。
 */
function dependArray (value: Array<any>) {
  // 遍历数组
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    // 如果元素存在，并且元素有 __ob__ 属性（表示元素是一个响应式对象），
    // 则调用元素的 dep.depend() 方法收集依赖
    e && e.__ob__ && e.__ob__.dep.depend()
    // 如果元素是数组，递归调用 dependArray 函数
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
