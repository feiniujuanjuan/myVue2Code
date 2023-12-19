/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

/**
 * 初始化 Vue 的全局 API。
 *
 * @param {GlobalAPI} Vue - Vue 构造函数。
 */
export function initGlobalAPI (Vue: GlobalAPI) {
  // 定义 Vue.config 属性，该属性是一个 getter，用于获取全局配置对象
  const configDef = {}
  configDef.get = () => config
  // 在非生产环境下，Vue.config 属性也有一个 setter，用于警告用户不要替换整个配置对象
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)

  // 定义 Vue.util 对象，该对象包含一些实用方法
  // 注意，这些方法不被视为公共 API 的一部分，除非你了解风险，否则不要依赖它们
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  // 定义 Vue.set、Vue.delete 和 Vue.nextTick 方法
  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 定义 Vue.observable 方法，该方法用于使一个对象变得可观察
  Vue.observable = <T>(obj: T): T => {
    observe(obj)
    return obj
  }

  // 初始化 Vue.options 对象，该对象用于存储全局的组件、指令和过滤器
  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // 在 Vue.options 对象上定义 _base 属性，该属性用于在 Weex 的多实例场景中标识 "基础" 构造函数
  Vue.options._base = Vue

  // 将内置组件添加到 Vue.options.components 对象中
  extend(Vue.options.components, builtInComponents)

  // 初始化 Vue.use、Vue.mixin、Vue.extend 和 Vue.component/directive/filter 方法
  initUse(Vue)
  initMixin(Vue)
  initExtend(Vue)
  initAssetRegisters(Vue)
}
