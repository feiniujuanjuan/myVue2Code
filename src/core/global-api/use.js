/* @flow */

import { toArray } from '../util/index'

/**
 * 初始化 Vue 的 `use` 方法。
 *
 * @param {GlobalAPI} Vue - Vue 构造函数。
 */
export function initUse (Vue: GlobalAPI) {
  // 定义 Vue.use 方法，该方法用于安装 Vue 插件
  Vue.use = function (plugin: Function | Object) {
    // 获取已安装的插件列表，如果不存在，则初始化为空数组
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    // 如果插件已经被安装，直接返回
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // 获取额外的参数
    const args = toArray(arguments, 1)
    // 将 Vue 构造函数添加到参数列表的开头
    args.unshift(this)
    // 如果插件提供了 install 方法，调用它来安装插件
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      // 如果插件本身就是一个函数，直接调用它
      plugin.apply(null, args)
    }
    // 将插件添加到已安装的插件列表
    installedPlugins.push(plugin)
    // 返回 Vue 构造函数，以支持链式调用
    return this
  }
}
