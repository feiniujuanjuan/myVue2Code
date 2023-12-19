/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute,
  invokeWithErrorHandling
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

/**
 * 在目标对象上设置一个代理属性，该属性实际上引用了源对象的属性。
 */
export function proxy (target: Object, sourceKey: string, key: string) { // 目标对象，源对象的键，代理属性的键
  sharedPropertyDefinition.get = function proxyGetter () { // 定义代理属性的 getter
    return this[sourceKey][key] // 返回源对象的属性值
  }
  sharedPropertyDefinition.set = function proxySetter (val) { // 定义代理属性的 setter
    this[sourceKey][key] = val // 设置源对象的属性值
  }
  Object.defineProperty(target, key, sharedPropertyDefinition) // 在目标对象上定义代理属性
}

/**
 * 初始化 Vue 组件的状态。
 */
export function initState (vm: Component) { // Vue 组件实例
  vm._watchers = [] // 初始化观察者数组
  const opts = vm.$options // 获取组件的选项

  if (opts.props) initProps(vm, opts.props) // 如果有 props 选项，则初始化 props
  if (opts.methods) initMethods(vm, opts.methods) // 如果有 methods 选项，则初始化 methods
  if (opts.data) { // 如果有 data 选项
    initData(vm) // 初始化 data
  } else { // 如果没有 data 选项
    observe(vm._data = {}, true /* asRootData */) // 观察一个空对象作为根数据
  }
  if (opts.computed) initComputed(vm, opts.computed) // 如果有 computed 选项，则初始化 computed
  if (opts.watch && opts.watch !== nativeWatch) { // 如果有 watch 选项，并且 watch 不是原生的 watch
    initWatch(vm, opts.watch) // 初始化 watch
  }
}

/**
 * 初始化 Vue 组件的 props。
 */
function initProps (vm: Component, propsOptions: Object) { // Vue 组件实例和 props 的选项
  const propsData = vm.$options.propsData || {} // 获取 props 的数据，如果不存在，则使用空对象
  const props = vm._props = {} // 初始化 props
  // 缓存 prop 的键，以便将来的 props 更新可以使用数组迭代，而不是动态对象键枚举。
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent // 判断是否是根实例
  // 根实例的 props 应该被转换
  if (!isRoot) {
    toggleObserving(false) // 关闭观察
  }
  for (const key in propsOptions) { // 遍历 props 的选项
    keys.push(key) // 将键添加到键数组
    const value = validateProp(key, propsOptions, propsData, vm) // 验证 prop
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') { // 在非生产环境下
      const hyphenatedKey = hyphenate(key) // 将键转换为连字符形式
      if (isReservedAttribute(hyphenatedKey) || // 如果是保留属性
          config.isReservedAttr(hyphenatedKey)) { // 或者是保留属性
        warn( // 发出警告
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => { // 定义响应式，并添加警告
        if (!isRoot && !isUpdatingChildComponent) { // 如果不是根实例且不在更新子组件
          warn( // 发出警告
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else { // 在生产环境下
      defineReactive(props, key, value) // 定义响应式
    }
    // 静态 props 在 Vue.extend() 期间已经在组件的原型上代理。
    // 我们只需要在这里代理在实例化时定义的 props。
    if (!(key in vm)) {
      proxy(vm, `_props`, key) // 代理 props
    }
  }
  toggleObserving(true) // 开启观察
}

/**
 * 初始化 Vue 组件的数据。
 */
function initData (vm: Component) { // Vue 组件实例
  let data = vm.$options.data // 获取组件的数据
  data = vm._data = typeof data === 'function'
    ? getData(data, vm) // 如果数据是函数，调用该函数获取数据
    : data || {} // 如果数据不是函数，直接使用数据，如果数据不存在，使用空对象
  if (!isPlainObject(data)) { // 如果数据不是普通对象
    data = {} // 使用空对象
    process.env.NODE_ENV !== 'production' && warn( // 在非生产环境下发出警告
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // 在实例上代理数据
  const keys = Object.keys(data) // 获取数据的所有键
  const props = vm.$options.props // 获取组件的 props
  const methods = vm.$options.methods // 获取组件的方法
  let i = keys.length // 获取键的数量
  while (i--) { // 遍历所有键
    const key = keys[i] // 获取当前键
    if (process.env.NODE_ENV !== 'production') { // 在非生产环境下
      if (methods && hasOwn(methods, key)) { // 如果方法存在且已经定义了同名的方法
        warn( // 发出警告
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) { // 如果 props 存在且已经定义了同名的 prop
      process.env.NODE_ENV !== 'production' && warn( // 在非生产环境下发出警告
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) { // 如果键不是保留的
      proxy(vm, `_data`, key) // 在实例上代理数据
    }
  }
  // 观察数据
  observe(data, true /* asRootData */)
}

/**
 * 获取组件的数据。
 *
 * @param {Function} data - 数据函数。
 * @param {Component} vm - Vue 实例。
 * @return {any} 返回组件的数据。
 */
export function getData (data: Function, vm: Component): any {
  // #7573 在调用数据 getter 时禁用 dep 收集
  pushTarget()
  try {
    // 调用数据函数，获取组件的数据
    return data.call(vm, vm)
  } catch (e) {
    // 如果在获取数据时发生错误，处理错误
    handleError(e, vm, `data()`)
    // 返回一个空对象
    return {}
  } finally {
    // 恢复之前的 dep 收集
    popTarget()
  }
}

// 计算属性的观察者配置对象，设置 lazy 为 true，表示计算属性是惰性求值的
const computedWatcherOptions = { lazy: true }

/**
 * 初始化组件的计算属性。
 */
function initComputed (vm: Component, computed: Object) { // 组件实例，计算属性对象
  // 创建一个空对象，用于存储计算属性的观察者
  const watchers = vm._computedWatchers = Object.create(null)
  // 判断是否在服务器渲染
  const isSSR = isServerRendering()

  // 遍历计算属性对象
  for (const key in computed) {
    const userDef = computed[key] // 用户定义的计算属性
    // 如果用户定义的计算属性是函数，就使用这个函数作为 getter，否则使用用户定义的计算属性的 get 方法作为 getter
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    // 如果在非生产环境且 getter 不存在，发出警告
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    // 如果不是在服务器渲染，为计算属性创建内部观察者
    if (!isSSR) {
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // 如果组件实例上没有定义这个计算属性，就定义它
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') { // 如果在非生产环境
      // 如果计算属性已经在 data、props 或 methods 中定义，发出警告
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      } else if (vm.$options.methods && key in vm.$options.methods) {
        warn(`The computed property "${key}" is already defined as a method.`, vm)
      }
    }
  }
}

/**
 * 在目标对象上定义计算属性。
 *
 * @param {Object} target - 目标对象。
 * @param {string} key - 属性键名。
 * @param {Object|Function} userDef - 用户定义的计算属性。
 */
export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  // 判断是否应该缓存计算属性的结果，如果不是在服务器端渲染，就应该缓存
  const shouldCache = !isServerRendering()
  // 如果用户定义的计算属性是一个函数
  if (typeof userDef === 'function') {
    // 如果应该缓存，就使用 createComputedGetter 创建一个计算属性的 getter
    // 否则，使用 createGetterInvoker 创建一个调用用户定义的函数的 getter
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    // 计算属性的 setter 为一个空操作
    sharedPropertyDefinition.set = noop
  } else {
    // 如果用户定义的计算属性是一个对象，并且有 get 方法
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    // 如果用户定义的计算属性有 set 方法，就使用这个 set 方法
    // 否则，setter 为一个空操作
    sharedPropertyDefinition.set = userDef.set || noop
  }
  // 如果在非生产环境，并且 setter 是一个空操作
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    // 将 setter 设置为一个警告函数，提示用户计算属性被赋值，但是没有 setter
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  // 在目标对象上定义这个计算属性
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

/**
 * 创建计算属性的 getter。
 *
 * @param {string} key - 计算属性的键名。
 * @return {Function} 计算属性的 getter。
 */
function createComputedGetter (key) {
  // 返回一个函数，这个函数就是计算属性的 getter
  return function computedGetter () {
    // 从当前实例的 _computedWatchers 对象中获取对应的观察者
    const watcher = this._computedWatchers && this._computedWatchers[key]
    // 如果找到了观察者
    if (watcher) {
      // 如果观察者的 dirty 属性为 true，表示观察者的值需要重新计算
      if (watcher.dirty) {
        watcher.evaluate() // 调用观察者的 evaluate 方法重新计算值
      }
      // 如果 Dep.target 存在，表示正在进行依赖收集
      if (Dep.target) {
        watcher.depend() // 调用观察者的 depend 方法进行依赖收集
      }
      // 返回观察者的值
      return watcher.value
    }
  }
}

/**
 * 创建一个调用用户定义的函数的 getter。
 *
 * @param {Function} fn - 用户定义的函数。
 * @return {Function} 调用用户定义的函数的 getter。
 */
function createGetterInvoker(fn) {
  // 返回一个函数，这个函数就是 getter
  return function computedGetter () {
    // 调用用户定义的函数，并将当前实例作为上下文和参数
    return fn.call(this, this)
  }
}

/**
 * 初始化 Vue 组件的方法。
 */
function initMethods (vm: Component, methods: Object) { // Vue 组件实例和方法对象
  const props = vm.$options.props // 获取组件的 props
  for (const key in methods) { // 遍历方法对象
    if (process.env.NODE_ENV !== 'production') { // 在非生产环境下
      if (typeof methods[key] !== 'function') { // 如果方法不是函数
        warn( // 发出警告
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) { // 如果 props 存在且已经定义了同名的 prop
        warn( // 发出警告
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) { // 如果方法名在 Vue 实例中已存在且是保留的
        warn( // 发出警告
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm) // 如果方法不是函数，设置为无操作函数，否则绑定到 Vue 实例
  }
}

/**
 * 初始化组件的观察者。
 *
 * @param {Component} vm - Vue 组件实例。
 * @param {Object} watch - 观察者对象。
 */
function initWatch (vm: Component, watch: Object) {
  // 遍历观察者对象的每一个键
  for (const key in watch) {
    // 获取当前键对应的处理函数
    const handler = watch[key]
    // 如果处理函数是一个数组
    if (Array.isArray(handler)) {
      // 遍历处理函数数组
      for (let i = 0; i < handler.length; i++) {
        // 为每一个处理函数创建一个观察者
        createWatcher(vm, key, handler[i])
      }
    } else {
      // 如果处理函数不是一个数组，直接为处理函数创建一个观察者
      createWatcher(vm, key, handler)
    }
  }
}

/**
 * 为指定的表达式或函数创建一个观察者。
 *
 * @param {Component} vm - Vue 组件实例。
 * @param {string | Function} expOrFn - 要观察的表达式或函数。
 * @param {any} handler - 观察者的处理函数。
 * @param {Object} [options] - 观察者的选项。
 * @return {Function} 返回一个取消观察的函数。
 */
function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  // 如果处理函数是一个对象
  if (isPlainObject(handler)) {
    // 将对象赋值给 options
    options = handler
    // 将对象的 handler 属性赋值给 handler
    handler = handler.handler
  }
  // 如果处理函数是一个字符串
  if (typeof handler === 'string') {
    // 将组件实例的对应属性赋值给 handler
    handler = vm[handler]
  }
  // 调用组件实例的 $watch 方法创建一个观察者，并返回一个取消观察的函数
  return vm.$watch(expOrFn, handler, options)
}

/**
 * 在 Vue 的原型上添加一些与状态相关的方法和属性。
 *
 * @param {Class<Component>} Vue - Vue 构造函数。
 */
export function stateMixin (Vue: Class<Component>) {
  // 定义 $data 属性的 getter 和 setter
  const dataDef = {}
  dataDef.get = function () { return this._data } // 返回实例的 _data 属性
  // 定义 $props 属性的 getter 和 setter
  const propsDef = {}
  propsDef.get = function () { return this._props } // 返回实例的 _props 属性
  // 在非生产环境下，$data 和 $props 的 setter 会发出警告
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  // 在 Vue 的原型上定义 $data 和 $props 属性
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  // 在 Vue 的原型上添加 $set 和 $delete 方法
  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  // 在 Vue 的原型上添加 $watch 方法
  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    // 如果回调函数是一个对象，创建一个观察者
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true
    const watcher = new Watcher(vm, expOrFn, cb, options)
    // 如果 immediate 选项为 true，立即执行回调函数
    if (options.immediate) {
      const info = `callback for immediate watcher "${watcher.expression}"`
      pushTarget()
      invokeWithErrorHandling(cb, vm, [watcher.value], vm, info)
      popTarget()
    }
    // 返回一个取消观察的函数
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
