/* @flow */

import { warn } from './debug'
import { observe, toggleObserving, shouldObserve } from '../observer/index'
import {
  hasOwn,
  isObject,
  toRawType,
  hyphenate,
  capitalize,
  isPlainObject
} from 'shared/util'

type PropOptions = {
  type: Function | Array<Function> | null,
  default: any,
  required: ?boolean,
  validator: ?Function
};

/**
 * 验证 Vue 组件的 prop。
 */
export function validateProp (
  key: string, // prop 的键
  propOptions: Object, // prop 的选项
  propsData: Object, // prop 的数据
  vm?: Component // Vue 组件实例
): any {
  const prop = propOptions[key] // 获取 prop
  const absent = !hasOwn(propsData, key) // 判断 prop 是否缺失
  let value = propsData[key] // 获取 prop 的值
  // boolean 类型转换
  const booleanIndex = getTypeIndex(Boolean, prop.type) // 获取 Boolean 类型的索引
  if (booleanIndex > -1) { // 如果 Boolean 类型存在
    if (absent && !hasOwn(prop, 'default')) { // 如果 prop 缺失且没有默认值
      value = false // 设置值为 false
    } else if (value === '' || value === hyphenate(key)) { // 如果值为空字符串或等于连字符形式的键
      // 只有当 boolean 类型有更高的优先级时，才将空字符串或同名值转换为 boolean 类型
      const stringIndex = getTypeIndex(String, prop.type) // 获取 String 类型的索引
      if (stringIndex < 0 || booleanIndex < stringIndex) { // 如果 String 类型不存在或 Boolean 类型的索引小于 String 类型的索引
        value = true // 设置值为 true
      }
    }
  }
  // 检查默认值
  if (value === undefined) { // 如果值未定义
    value = getPropDefaultValue(vm, prop, key) // 获取 prop 的默认值
    // 由于默认值是一个新的副本，所以需要观察它
    const prevShouldObserve = shouldObserve // 获取之前的观察状态
    toggleObserving(true) // 开启观察
    observe(value) // 观察值
    toggleObserving(prevShouldObserve) // 恢复之前的观察状态
  }
  if (
    process.env.NODE_ENV !== 'production' && // 在非生产环境下
    // 跳过对 weex recycle-list 子组件 props 的验证
    !(__WEEX__ && isObject(value) && ('@binding' in value))
  ) {
    assertProp(prop, key, value, vm, absent) // 断言 prop
  }
  return value // 返回值
}

/**
 * 获取 prop 的默认值。
 *
 * @param {?Component} vm - Vue 实例。
 * @param {PropOptions} prop - prop 选项。
 * @param {string} key - prop 的键。
 * @return {any} 返回 prop 的默认值。
 */
function getPropDefaultValue (vm: ?Component, prop: PropOptions, key: string): any {
  // 如果没有默认值，返回 undefined
  if (!hasOwn(prop, 'default')) {
    return undefined
  }
  const def = prop.default
  // 在非生产环境下，如果默认值是对象，给出警告
  if (process.env.NODE_ENV !== 'production' && isObject(def)) {
    warn(
      'Invalid default value for prop "' + key + '": ' +
      'Props with type Object/Array must use a factory function ' +
      'to return the default value.',
      vm
    )
  }
  // 如果在上一次渲染中，原始 prop 值也是 undefined，
  // 返回上一次的默认值，以避免不必要的 watcher 触发
  if (vm && vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined
  ) {
    return vm._props[key]
  }
  // 对于非函数类型，调用工厂函数
  // 如果一个值的原型是函数，即使在不同的执行上下文中，它也被认为是函数
  return typeof def === 'function' && getType(prop.type) !== 'Function'
    ? def.call(vm)
    : def
}

/**
 * Assert whether a prop is valid.
 */
function assertProp (
  prop: PropOptions,
  name: string,
  value: any,
  vm: ?Component,
  absent: boolean
) {
  if (prop.required && absent) {
    warn(
      'Missing required prop: "' + name + '"',
      vm
    )
    return
  }
  if (value == null && !prop.required) {
    return
  }
  let type = prop.type
  let valid = !type || type === true
  const expectedTypes = []
  if (type) {
    if (!Array.isArray(type)) {
      type = [type]
    }
    for (let i = 0; i < type.length && !valid; i++) {
      const assertedType = assertType(value, type[i], vm)
      expectedTypes.push(assertedType.expectedType || '')
      valid = assertedType.valid
    }
  }

  const haveExpectedTypes = expectedTypes.some(t => t)
  if (!valid && haveExpectedTypes) {
    warn(
      getInvalidTypeMessage(name, value, expectedTypes),
      vm
    )
    return
  }
  const validator = prop.validator
  if (validator) {
    if (!validator(value)) {
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      )
    }
  }
}

const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol|BigInt)$/

function assertType (value: any, type: Function, vm: ?Component): {
  valid: boolean;
  expectedType: string;
} {
  let valid
  const expectedType = getType(type)
  if (simpleCheckRE.test(expectedType)) {
    const t = typeof value
    valid = t === expectedType.toLowerCase()
    // for primitive wrapper objects
    if (!valid && t === 'object') {
      valid = value instanceof type
    }
  } else if (expectedType === 'Object') {
    valid = isPlainObject(value)
  } else if (expectedType === 'Array') {
    valid = Array.isArray(value)
  } else {
    try {
      valid = value instanceof type
    } catch (e) {
      warn('Invalid prop type: "' + String(type) + '" is not a constructor', vm);
      valid = false;
    }
  }
  return {
    valid,
    expectedType
  }
}

const functionTypeCheckRE = /^\s*function (\w+)/

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 */
function getType (fn) {
  const match = fn && fn.toString().match(functionTypeCheckRE)
  return match ? match[1] : ''
}

function isSameType (a, b) {
  return getType(a) === getType(b)
}

/**
 * 获取给定类型在预期类型数组中的索引。
 */
function getTypeIndex (type, expectedTypes): number {
  if (!Array.isArray(expectedTypes)) { // 如果预期类型不是数组
    return isSameType(expectedTypes, type) ? 0 : -1 // 如果预期类型和给定类型相同，返回 0，否则返回 -1
  }
  for (let i = 0, len = expectedTypes.length; i < len; i++) { // 遍历预期类型数组
    if (isSameType(expectedTypes[i], type)) { // 如果预期类型和给定类型相同
      return i // 返回当前索引
    }
  }
  return -1 // 如果没有找到相同的类型，返回 -1
}

function getInvalidTypeMessage (name, value, expectedTypes) {
  let message = `Invalid prop: type check failed for prop "${name}".` +
    ` Expected ${expectedTypes.map(capitalize).join(', ')}`
  const expectedType = expectedTypes[0]
  const receivedType = toRawType(value)
  // check if we need to specify expected value
  if (
    expectedTypes.length === 1 &&
    isExplicable(expectedType) &&
    isExplicable(typeof value) &&
    !isBoolean(expectedType, receivedType)
  ) {
    message += ` with value ${styleValue(value, expectedType)}`
  }
  message += `, got ${receivedType} `
  // check if we need to specify received value
  if (isExplicable(receivedType)) {
    message += `with value ${styleValue(value, receivedType)}.`
  }
  return message
}

function styleValue (value, type) {
  if (type === 'String') {
    return `"${value}"`
  } else if (type === 'Number') {
    return `${Number(value)}`
  } else {
    return `${value}`
  }
}

const EXPLICABLE_TYPES = ['string', 'number', 'boolean']
function isExplicable (value) {
  return EXPLICABLE_TYPES.some(elem => value.toLowerCase() === elem)
}

function isBoolean (...args) {
  return args.some(elem => elem.toLowerCase() === 'boolean')
}
