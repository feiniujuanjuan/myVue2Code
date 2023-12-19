/* @flow */

import {
  warn,
  nextTick,
  emptyObject,
  handleError,
  defineReactive
} from '../util/index'

import { createElement } from '../vdom/create-element'
import { installRenderHelpers } from './render-helpers/index'
import { resolveSlots } from './render-helpers/resolve-slots'
import { normalizeScopedSlots } from '../vdom/helpers/normalize-scoped-slots'
import VNode, { createEmptyVNode } from '../vdom/vnode'

import { isUpdatingChildComponent } from './lifecycle'

/**
 * 初始化 Vue 组件的渲染。
 */
export function initRender (vm: Component) {
  vm._vnode = null // 子树的根节点
  vm._staticTrees = null // v-once 缓存的树
  const options = vm.$options // 获取组件的选项
  const parentVnode = vm.$vnode = options._parentVnode // 父树中的占位符节点
  const renderContext = parentVnode && parentVnode.context // 渲染上下文
  vm.$slots = resolveSlots(options._renderChildren, renderContext) // 解析插槽
  vm.$scopedSlots = emptyObject // 初始化作用域插槽为一个空对象
  // 将 createElement 函数绑定到这个实例，以便在其中获取正确的渲染上下文。
  // 参数顺序：标签，数据，子节点，规范化类型，总是规范化
  // 内部版本由模板编译的渲染函数使用
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
  // 对公共版本总是应用规范化，用于用户编写的渲染函数。
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)

  // $attrs 和 $listeners 用于更容易地创建高阶组件。
  // 它们需要是响应式的，以便使用它们的高阶组件总是更新的
  const parentData = parentVnode && parentVnode.data // 父节点的数据

  /* istanbul ignore else */
  if (process.env.NODE_ENV !== 'production') {
    // 在非生产环境下，定义 $attrs 和 $listeners 为响应式，并添加警告
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, () => {
      !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm)
    }, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, () => {
      !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm)
    }, true)
  } else {
    // 在生产环境下，定义 $attrs 和 $listeners 为响应式
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, null, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, null, true)
  }
}

export let currentRenderingInstance: Component | null = null

// for testing only
export function setCurrentRenderingInstance (vm: Component) {
  currentRenderingInstance = vm
}

export function renderMixin (Vue: Class<Component>) {
  // install runtime convenience helpers
  installRenderHelpers(Vue.prototype)

  Vue.prototype.$nextTick = function (fn: Function) {
    return nextTick(fn, this)
  }

  /**
   * 创建并返回一个虚拟节点（VNode）。
   *
   * @return {VNode} 创建的虚拟节点。
   */
  Vue.prototype._render = function (): VNode {
    const vm: Component = this
    const { render, _parentVnode } = vm.$options

    // 如果存在父虚拟节点，标准化作用域插槽
    if (_parentVnode) {
      vm.$scopedSlots = normalizeScopedSlots(
        _parentVnode.data.scopedSlots,
        vm.$slots,
        vm.$scopedSlots
      )
    }

    // 设置父虚拟节点，这允许渲染函数访问占位节点上的数据
    vm.$vnode = _parentVnode
    // 渲染自身
    let vnode
    try {
      // 设置当前正在渲染的实例
      currentRenderingInstance = vm
      // 调用渲染函数创建虚拟节点
      vnode = render.call(vm._renderProxy, vm.$createElement)
    } catch (e) {
      // 处理渲染错误
      handleError(e, vm, `render`)
      // 如果存在渲染错误处理函数，尝试调用它创建虚拟节点
      if (process.env.NODE_ENV !== 'production' && vm.$options.renderError) {
        try {
          vnode = vm.$options.renderError.call(vm._renderProxy, vm.$createElement, e)
        } catch (e) {
          handleError(e, vm, `renderError`)
          vnode = vm._vnode
        }
      } else {
        vnode = vm._vnode
      }
    } finally {
      // 清除当前正在渲染的实例
      currentRenderingInstance = null
    }
    // 如果返回的是一个只包含一个节点的数组，将其转换为单个节点
    if (Array.isArray(vnode) && vnode.length === 1) {
      vnode = vnode[0]
    }
    // 如果渲染函数出错，返回一个空的虚拟节点
    if (!(vnode instanceof VNode)) {
      if (process.env.NODE_ENV !== 'production' && Array.isArray(vnode)) {
        warn(
          'Multiple root nodes returned from render function. Render function ' +
          'should return a single root node.',
          vm
        )
      }
      vnode = createEmptyVNode()
    }
    // 设置父虚拟节点
    vnode.parent = _parentVnode
    return vnode
  }
}
