/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools,
  inBrowser,
  isIE
} from '../util/index'

// 最大更新次数，用于防止无限循环更新
export const MAX_UPDATE_COUNT = 100

// watcher 队列，用于存储待处理的 watcher
const queue: Array<Watcher> = []

// 激活的子组件队列，用于存储待激活的子组件
const activatedChildren: Array<Component> = []

// 一个对象，用于跟踪已经被推入 watcher 队列的 watcher 的 id
let has: { [key: number]: ?true } = {}

// 一个对象，用于跟踪每个 watcher 的更新次数，防止无限循环更新
let circular: { [key: number]: number } = {}

// 一个标志，表示是否正在等待刷新 watcher 队列
let waiting = false

// 一个标志，表示是否正在刷新 watcher 队列
let flushing = false

// 当前正在处理的 watcher 在队列中的索引
let index = 0

/**
 * 重置调度器的状态。
 * 清空 watcher 队列和激活的子组件队列，重置 has 对象和 circular 对象（在非生产环境下），
 * 并设置等待和刷新的标志为 false。
 */
function resetSchedulerState () {
  // 重置当前正在处理的 watcher 在队列中的索引为 0
  index = 0
  // 清空 watcher 队列
  queue.length = 0
  // 清空激活的子组件队列
  activatedChildren.length = 0
  // 重置 has 对象
  has = {}
  // 在非生产环境下，重置 circular 对象
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  // 设置等待刷新 watcher 队列的标志为 false
  waiting = false
  // 设置正在刷新 watcher 队列的标志为 false
  flushing = false
}

// Async edge case #6566 requires saving the timestamp when event listeners are
// attached. However, calling performance.now() has a perf overhead especially
// if the page has thousands of event listeners. Instead, we take a timestamp
// every time the scheduler flushes and use that for all event listeners
// attached during that flush.
export let currentFlushTimestamp = 0

// Async edge case fix requires storing an event listener's attach timestamp.
let getNow: () => number = Date.now

// Determine what event timestamp the browser is using. Annoyingly, the
// timestamp can either be hi-res (relative to page load) or low-res
// (relative to UNIX epoch), so in order to compare time we have to use the
// same timestamp type when saving the flush timestamp.
// All IE versions use low-res event timestamps, and have problematic clock
// implementations (#9632)
if (inBrowser && !isIE) {
  const performance = window.performance
  if (
    performance &&
    typeof performance.now === 'function' &&
    getNow() > document.createEvent('Event').timeStamp
  ) {
    // if the event timestamp, although evaluated AFTER the Date.now(), is
    // smaller than it, it means the event is using a hi-res timestamp,
    // and we need to use the hi-res version for event listener timestamps as
    // well.
    getNow = () => performance.now()
  }
}

/**
 * 刷新 watcher 队列和激活的子组件队列，并运行 watcher。
 */
function flushSchedulerQueue () {
  // 获取当前时间戳
  currentFlushTimestamp = getNow()
  // 设置正在刷新队列的标志为 true
  flushing = true
  let watcher, id

  // 在刷新前对队列进行排序
  // 这可以确保：
  // 1. 组件从父到子进行更新（因为父组件总是在子组件之前创建）
  // 2. 组件的用户 watcher 在其渲染 watcher 之前运行（因为用户 watcher 在渲染 watcher 之前创建）
  // 3. 如果一个组件在其父组件的 watcher 运行期间被销毁，那么可以跳过其 watcher
  queue.sort((a, b) => a.id - b.id)

  // 不缓存长度，因为在运行现有 watcher 时可能会推入更多的 watcher
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    // 如果 watcher 有 before 钩子函数，那么在运行 watcher 之前调用它
    if (watcher.before) {
      watcher.before()
    }
    id = watcher.id
    // 将 has 对象中对应的 id 设置为 null
    has[id] = null
    // 运行 watcher
    watcher.run()
    // 在开发环境下，检查并停止循环更新
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // 在重置状态之前保留 post 队列的副本
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()

  // 重置调度器状态
  resetSchedulerState()

  // 调用组件的激活和更新钩子函数
  callActivatedHooks(activatedQueue)
  callUpdatedHooks(updatedQueue)

  // devtool 钩子
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

/**
 * 调用已更新组件的 'updated' 钩子函数。
 *
 * @param {Array<Watcher>} queue - 已更新组件的 watcher 队列。
 */
function callUpdatedHooks (queue) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    // 如果 vm 的 _watcher 是当前的 watcher，并且 vm 已经挂载并且没有被销毁
    if (vm._watcher === watcher && vm._isMounted && !vm._isDestroyed) {
      // 调用 vm 的 'updated' 钩子函数
      callHook(vm, 'updated')
    }
  }
}

/**
 * 将在 patch 过程中激活的 keep-alive 组件添加到队列中。
 * 在整个树被 patch 后，队列将被处理。
 *
 * @param {Component} vm - 被激活的组件。
 */
export function queueActivatedComponent (vm: Component) {
  // 这里将 _inactive 设置为 false，以便渲染函数可以
  // 依赖于检查它是否在一个非活动的树中（例如 router-view）
  vm._inactive = false
  // 将组件添加到激活的子组件队列中
  activatedChildren.push(vm)
}

/**
 * 调用激活的组件的钩子函数。
 *
 * @param {Array<Component>} queue - 激活的组件队列。
 */
function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    // 将组件的 _inactive 属性设置为 true
    queue[i]._inactive = true
    // 调用组件的激活子组件函数
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * 将一个 watcher 推入 watcher 队列。
 * 如果队列正在被刷新，那么根据其 id 插入 watcher。
 * 如果已经超过其 id，它将立即运行。
 *
 * @param {Watcher} watcher - 需要推入队列的 watcher。
 */
export function queueWatcher (watcher: Watcher) {
  // 获取 watcher 的 id
  const id = watcher.id
  // 如果 id 还没有在 has 对象中
  if (has[id] == null) {
    // 在 has 对象中添加 id
    has[id] = true
    // 如果当前没有在刷新队列
    if (!flushing) {
      // 将 watcher 推入队列
      queue.push(watcher)
    } else {
      // 如果已经在刷新队列，根据其 id 插入 watcher
      // 如果已经超过其 id，它将立即运行
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
    }
    // 如果当前没有在等待刷新队列
    if (!waiting) {
      // 设置等待刷新队列为 true
      waiting = true
      // 如果在非生产环境下，并且配置的 async 为 false
      if (process.env.NODE_ENV !== 'production' && !config.async) {
        // 立即刷新调度队列
        flushSchedulerQueue()
        return
      }
      // 在下一个 tick 刷新调度队列
      nextTick(flushSchedulerQueue)
    }
  }
}
