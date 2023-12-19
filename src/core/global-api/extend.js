/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'

// 初始化 Vue 的继承机制
export function initExtend (Vue: GlobalAPI) {
  // 每个实例构造函数，包括 Vue，都有一个唯一的 cid
  // 这使我们能够为原型继承创建包装的 "子构造函数" 并缓存它们
  Vue.cid = 0
  let cid = 1

  // 定义 Vue.extend 方法，用于创建 Vue 的子类
  Vue.extend = function (extendOptions: Object): Function {
    // 如果没有提供扩展选项，使用空对象
    extendOptions = extendOptions || {}
    // Super 是当前的 Vue 构造函数
    const Super = this
    // SuperId 是当前 Vue 构造函数的唯一标识符
    const SuperId = Super.cid
    // cachedCtors 是用于缓存子类构造函数的对象
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    // 如果已经有缓存的子类构造函数，直接返回
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }

    // 获取子类的名称，如果没有提供，使用父类的名称
    const name = extendOptions.name || Super.options.name
    // 在非生产环境下，验证组件名称
    if (process.env.NODE_ENV !== 'production' && name) {
      validateComponentName(name)
    }

    // 定义子类构造函数
    const Sub = function VueComponent (options) {
      this._init(options)
    }
    // 设置子类的原型为父类的原型，使得子类可以继承父类的方法
    Sub.prototype = Object.create(Super.prototype)
    // 修复子类的构造函数指向
    Sub.prototype.constructor = Sub
    // 为子类分配一个唯一的 cid
    Sub.cid = cid++
    // 合并父类和子类的选项
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    // 在子类上保存对父类的引用
    Sub['super'] = Super

    // 如果子类有 props 或 computed 选项，为它们在 Vue 实例上定义代理 getter
    if (Sub.options.props) {
      initProps(Sub)
    }
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // 允许子类使用 extend、mixin 和 use 方法
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // 为子类创建资产注册，使得子类也可以有它们的私有资产
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // 如果子类有名称，将子类添加到其组件选项中，以启用递归自查找
    if (name) {
      Sub.options.components[name] = Sub
    }

    // 在扩展时，保存对父类选项的引用，以便在实例化时检查父类选项是否已更新
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options)

    // 缓存子类构造函数，以便下次扩展时可以直接使用
    cachedCtors[SuperId] = Sub
    // 返回子类构造函数
    return Sub
  }
}

/**
 * 初始化组件的 props 属性。
 *
 * @param {Function} Comp - 组件构造函数。
 */
function initProps (Comp) {
  // 获取组件的 props 选项
  const props = Comp.options.props
  // 遍历 props 选项
  for (const key in props) {
    // 在组件原型上定义代理，使得我们可以直接使用 this[key] 访问到 props 数据
    proxy(Comp.prototype, `_props`, key)
  }
}

/**
 * 初始化组件的 computed 属性。
 *
 * @param {Function} Comp - 组件构造函数。
 */
function initComputed (Comp) {
  // 获取组件的 computed 选项
  const computed = Comp.options.computed
  // 遍历 computed 选项
  for (const key in computed) {
    // 在组件原型上定义 computed 属性
    defineComputed(Comp.prototype, key, computed[key])
  }
}
