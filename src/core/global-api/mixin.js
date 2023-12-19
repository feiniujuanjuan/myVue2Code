/* @flow */

import { mergeOptions } from '../util/index'

/**
 * 初始化 Vue 的 `mixin` 方法。
 *
 * @param {GlobalAPI} Vue - Vue 构造函数。
 */
export function initMixin (Vue: GlobalAPI) {
  // 定义 Vue.mixin 方法，该方法用于全局注册混入
  Vue.mixin = function (mixin: Object) {
    // 合并混入到 Vue 的全局选项中
    this.options = mergeOptions(this.options, mixin)
    // 返回 Vue 构造函数，以支持链式调用
    return this
  }
}
