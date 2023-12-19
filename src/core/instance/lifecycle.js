/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import { mark, measure } from '../util/perf'
import { createEmptyVNode } from '../vdom/vnode'
import { updateComponentListeners } from './events'
import { resolveSlots } from './render-helpers/resolve-slots'
import { toggleObserving } from '../observer/index'
import { pushTarget, popTarget } from '../observer/dep'

import {
  warn,
  noop,
  remove,
  emptyObject,
  validateProp,
  invokeWithErrorHandling
} from '../util/index'

export let activeInstance: any = null
export let isUpdatingChildComponent: boolean = false

/**
 * 设置当前活动的 Vue 实例。
 *
 * @param {Component} vm - 新的活动实例。
 * @return {Function} 返回一个函数，调用该函数可以恢复旧的活动实例。
 */
export function setActiveInstance(vm: Component) {
  // 保存旧的活动实例
  const prevActiveInstance = activeInstance
  // 设置新的活动实例
  activeInstance = vm
  // 返回一个函数，调用该函数可以恢复旧的活动实例
  return () => {
    activeInstance = prevActiveInstance
  }
}

/**
 * 初始化 Vue 组件的生命周期。
 */
export function initLifecycle (vm: Component) {
  const options = vm.$options // 获取组件的选项

  // 定位第一个非抽象的父组件
  let parent = options.parent // 获取父组件
  if (parent && !options.abstract) { // 如果父组件存在，并且当前组件不是抽象的
    // 如果父组件是抽象的，并且父组件的父组件存在，那么继续向上查找
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent
    }
    // 将当前组件添加到找到的父组件的子组件列表中
    parent.$children.push(vm)
  }

  // 设置当前组件的父组件和根组件
  vm.$parent = parent
  vm.$root = parent ? parent.$root : vm

  // 初始化当前组件的子组件列表和引用对象
  vm.$children = []
  vm.$refs = {}

  // 初始化当前组件的观察者和一些生命周期相关的属性
  vm._watcher = null
  vm._inactive = null
  vm._directInactive = false
  vm._isMounted = false
  vm._isDestroyed = false
  vm._isBeingDestroyed = false
}

export function lifecycleMixin (Vue: Class<Component>) {
  /**
   * 更新 Vue 实例的 DOM。
   *
   * @param {VNode} vnode - 新的虚拟节点。
   * @param {boolean} [hydrating] - 是否在服务端渲染中。
   */
  Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    // 获取 Vue 实例
    const vm: Component = this
    // 保存旧的 DOM 元素和虚拟节点
    const prevEl = vm.$el
    const prevVnode = vm._vnode
    // 设置当前活动实例为 vm，并保存恢复函数
    const restoreActiveInstance = setActiveInstance(vm)
    // 更新当前虚拟节点
    vm._vnode = vnode
    // 如果没有旧的虚拟节点，进行初次渲染
    if (!prevVnode) {
      // initial render
      vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */)
    } else {
      // 如果有旧的虚拟节点，进行更新
      vm.$el = vm.__patch__(prevVnode, vnode)
    }
    // 恢复旧的活动实例
    restoreActiveInstance()
    // 更新 __vue__ 引用
    if (prevEl) {
      prevEl.__vue__ = null
    }
    if (vm.$el) {
      vm.$el.__vue__ = vm
    }
    // 如果父组件是一个高阶组件，更新其 $el
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      vm.$parent.$el = vm.$el
    }
    // updated 钩子由调度器调用，以确保在父组件的 updated 钩子中更新子组件
  }

  /**
   * 强制更新 Vue 实例。
   * 如果实例有关联的 watcher，会强制 watcher 进行一次 update。
   */
  Vue.prototype.$forceUpdate = function () {
    // 获取 Vue 实例
    const vm: Component = this
    // 如果实例有关联的 watcher，强制 watcher 进行一次 update
    if (vm._watcher) {
      vm._watcher.update()
    }
  }

  /**
   * 销毁 Vue 实例。
   * 这个方法会停止实例的所有 watcher，移除实例的所有引用，并触发 beforeDestroy 和 destroyed 钩子函数。
   */
  Vue.prototype.$destroy = function () {
    // 获取 Vue 实例
    const vm: Component = this
    // 如果实例已经在被销毁，直接返回
    if (vm._isBeingDestroyed) {
      return
    }
    // 触发 beforeDestroy 钩子函数
    callHook(vm, 'beforeDestroy')
    // 设置 _isBeingDestroyed 标志为 true
    vm._isBeingDestroyed = true
    // 从父组件的 $children 数组中移除自身
    const parent = vm.$parent
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      remove(parent.$children, vm)
    }
    // 销毁实例的 watcher
    if (vm._watcher) {
      vm._watcher.teardown()
    }
    // 销毁实例的所有子 watcher
    let i = vm._watchers.length
    while (i--) {
      vm._watchers[i].teardown()
    }
    // 如果实例的数据对象有 observer，减少 observer 的 vmCount
    if (vm._data.__ob__) {
      vm._data.__ob__.vmCount--
    }
    // 设置 _isDestroyed 标志为 true
    vm._isDestroyed = true
    // 销毁实例的虚拟节点树
    vm.__patch__(vm._vnode, null)
    // 触发 destroyed 钩子函数
    callHook(vm, 'destroyed')
    // 移除实例的所有事件监听器
    vm.$off()
    // 移除 __vue__ 引用
    if (vm.$el) {
      vm.$el.__vue__ = null
    }
    // 如果实例有关联的虚拟节点，移除虚拟节点的 parent 引用，以释放循环引用
    if (vm.$vnode) {
      vm.$vnode.parent = null
    }
  }
}

/**
 * 挂载组件。
 *
 * @param {Component} vm - Vue 实例。
 * @param {?Element} el - 挂载的元素。
 * @param {boolean} hydrating - 是否为服务端渲染。
 * @return {Component} 返回 Vue 实例。
 */
export function mountComponent (
  vm: Component,
  el: ?Element,
  hydrating?: boolean
): Component {
  // 设置挂载元素
  vm.$el = el
  // 如果没有定义 render 函数
  if (!vm.$options.render) {
    // 设置一个创建空虚拟节点的 render 函数
    vm.$options.render = createEmptyVNode
    // 在非生产环境下，如果模板没有预编译为 render 函数，给出警告
    if (process.env.NODE_ENV !== 'production') {
      /* istanbul ignore if */
      if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') ||
        vm.$options.el || el) {
        warn(
          'You are using the runtime-only build of Vue where the template ' +
          'compiler is not available. Either pre-compile the templates into ' +
          'render functions, or use the compiler-included build.',
          vm
        )
      } else {
        warn(
          'Failed to mount component: template or render function not defined.',
          vm
        )
      }
    }
  }
  // 调用 beforeMount 钩子函数
  callHook(vm, 'beforeMount')

  let updateComponent
  /* istanbul ignore if */
  // 在非生产环境下，如果开启了性能追踪，定义一个更新组件的函数，该函数会记录渲染和更新的性能
  if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
    updateComponent = () => {
      const name = vm._name
      const id = vm._uid
      const startTag = `vue-perf-start:${id}`
      const endTag = `vue-perf-end:${id}`
  
      // 标记开始渲染
      mark(startTag)
      // 渲染虚拟节点
      const vnode = vm._render()
      // 标记结束渲染
      mark(endTag)
      // 计算渲染性能
      measure(`vue ${name} render`, startTag, endTag)
  
      // 标记开始更新
      mark(startTag)
      // 更新虚拟节点
      vm._update(vnode, hydrating)
      // 标记结束更新
      mark(endTag)
      // 计算更新性能
      measure(`vue ${name} patch`, startTag, endTag)
    }
  } else {
    // 定义一个更新组件的函数，该函数会调用 _render 和 _update 方法
    updateComponent = () => {
      // 更新虚拟节点
      vm._update(vm._render(), hydrating)
    }
  }
  
  // 创建一个渲染 Watcher，该 Watcher 在每次依赖项更新时都会重新渲染组件
  new Watcher(vm, updateComponent, noop, {
    before () {
      // 如果组件已挂载且未销毁，在更新前调用 beforeUpdate 钩子函数
      if (vm._isMounted && !vm._isDestroyed) {
        callHook(vm, 'beforeUpdate')
      }
    }
  }, true /* isRenderWatcher */)
  hydrating = false
  
  // 如果是手动挂载的实例，调用 mounted 钩子函数
  // 对于 render 创建的子组件，mounted 钩子函数会在其 inserted 钩子函数中被调用
  if (vm.$vnode == null) {
    vm._isMounted = true
    callHook(vm, 'mounted')
  }
  return vm
}

/**
 * 更新子组件。
 *
 * @param {Component} vm - 子组件实例。
 * @param {?Object} propsData - 新的 props 数据。
 * @param {?Object} listeners - 新的事件监听器。
 * @param {MountedComponentVNode} parentVnode - 父虚拟节点。
 * @param {?Array<VNode>} renderChildren - 新的子虚拟节点数组。
 */
export function updateChildComponent (
  vm: Component,
  propsData: ?Object,
  listeners: ?Object,
  parentVnode: MountedComponentVNode,
  renderChildren: ?Array<VNode>
) {
  // 设置更新子组件的标志
  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = true
  }

  // 检查是否有动态的 scopedSlots
  const newScopedSlots = parentVnode.data.scopedSlots
  const oldScopedSlots = vm.$scopedSlots
  const hasDynamicScopedSlot = !!(
    (newScopedSlots && !newScopedSlots.$stable) ||
    (oldScopedSlots !== emptyObject && !oldScopedSlots.$stable) ||
    (newScopedSlots && vm.$scopedSlots.$key !== newScopedSlots.$key) ||
    (!newScopedSlots && vm.$scopedSlots.$key)
  )

  // 检查是否需要强制更新
  const needsForceUpdate = !!(
    renderChildren ||               // 有新的静态插槽
    vm.$options._renderChildren ||  // 有旧的静态插槽
    hasDynamicScopedSlot            // 有动态的 scopedSlots
  )

  // 更新父虚拟节点和占位虚拟节点
  vm.$options._parentVnode = parentVnode
  vm.$vnode = parentVnode

  // 更新子树的父虚拟节点
  if (vm._vnode) {
    vm._vnode.parent = parentVnode
  }

  // 更新渲染的子虚拟节点数组
  vm.$options._renderChildren = renderChildren

  // 更新 $attrs 和 $listeners
  vm.$attrs = parentVnode.data.attrs || emptyObject
  vm.$listeners = listeners || emptyObject

  // 更新 props
  if (propsData && vm.$options.props) {
    toggleObserving(false)
    const props = vm._props
    const propKeys = vm.$options._propKeys || []
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i]
      const propOptions: any = vm.$options.props
      props[key] = validateProp(key, propOptions, propsData, vm)
    }
    toggleObserving(true)
    // keep a copy of raw propsData
    vm.$options.propsData = propsData
  }

  // 更新事件监听器
  listeners = listeners || emptyObject
  const oldListeners = vm.$options._parentListeners
  vm.$options._parentListeners = listeners
  updateComponentListeners(vm, listeners, oldListeners)

  // 解析插槽并强制更新（如果有子节点）
  if (needsForceUpdate) {
    vm.$slots = resolveSlots(renderChildren, parentVnode.context)
    vm.$forceUpdate()
  }

  // 清除更新子组件的标志
  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = false
  }
}

/**
 * 检查一个组件是否在一个不活动的组件树中。
 *
 * @param {Component} vm - 要检查的组件实例。
 * @return {boolean} 如果组件在一个不活动的组件树中，返回 true，否则返回 false。
 */
function isInInactiveTree (vm) {
  // 从当前组件开始，向上遍历组件树
  while (vm && (vm = vm.$parent)) {
    // 如果找到一个不活动的父组件，返回 true
    if (vm._inactive) return true
  }
  // 如果没有找到不活动的父组件，返回 false
  return false
}

/**
 * 激活子组件。
 *
 * @param {Component} vm - 要激活的组件实例。
 * @param {boolean} [direct] - 是否直接激活。如果为 true，会清除 _directInactive 标志，并检查组件是否在一个不活动的树中。
 */
export function activateChildComponent (vm: Component, direct?: boolean) {
  // 如果直接激活，清除 _directInactive 标志，并检查组件是否在一个不活动的树中
  if (direct) {
    vm._directInactive = false
    if (isInInactiveTree(vm)) {
      return
    }
  } else if (vm._directInactive) {
    return
  }
  // 如果组件是不活动的，清除 _inactive 标志，并递归激活所有子组件
  if (vm._inactive || vm._inactive === null) {
    vm._inactive = false
    for (let i = 0; i < vm.$children.length; i++) {
      activateChildComponent(vm.$children[i])
    }
    // 调用 activated 钩子函数
    callHook(vm, 'activated')
  }
}

/**
 * 停用子组件。
 *
 * @param {Component} vm - 要停用的组件实例。
 * @param {boolean} [direct] - 是否直接停用。如果为 true，会设置 _directInactive 标志，并检查组件是否在一个不活动的树中。
 */
export function deactivateChildComponent (vm: Component, direct?: boolean) {
  // 如果直接停用，设置 _directInactive 标志，并检查组件是否在一个不活动的树中
  if (direct) {
    vm._directInactive = true
    if (isInInactiveTree(vm)) {
      return
    }
  }
  // 如果组件还没有被停用，设置 _inactive 标志，并递归停用所有子组件
  if (!vm._inactive) {
    vm._inactive = true
    for (let i = 0; i < vm.$children.length; i++) {
      deactivateChildComponent(vm.$children[i])
    }
    // 调用 deactivated 钩子函数
    callHook(vm, 'deactivated')
  }
}

/**
 * 调用 Vue 组件的生命周期钩子。
 */
export function callHook (vm: Component, hook: string) {
  // #7573 在调用生命周期钩子时禁用 dep 收集
  pushTarget()
  const handlers = vm.$options[hook] // 获取钩子的处理器
  const info = `${hook} hook` // 钩子的信息
  if (handlers) { // 如果处理器存在
    for (let i = 0, j = handlers.length; i < j; i++) {
      // 使用错误处理调用处理器
      invokeWithErrorHandling(handlers[i], vm, null, vm, info)
    }
  }
  if (vm._hasHookEvent) { // 如果有钩子事件
    // 触发钩子事件
    vm.$emit('hook:' + hook)
  }
  popTarget() // 弹出目标
}
