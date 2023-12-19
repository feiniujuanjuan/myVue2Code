/* @flow */
/* globals MutationObserver */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIE, isIOS, isNative } from './env'

export let isUsingMicroTask = false

// 定义一个数组用于存储回调函数
const callbacks = []
// 定义一个标志用于表示是否有待执行的回调函数
let pending = false

/**
 * 执行并清空回调函数队列。
 */
function flushCallbacks () {
  // 设置 pending 为 false，表示当前没有待执行的回调函数
  pending = false
  // 创建回调函数队列的副本
  const copies = callbacks.slice(0)
  // 清空回调函数队列
  callbacks.length = 0
  // 执行副本中的所有回调函数
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}

// 定义 timerFunc 变量
let timerFunc

// 如果环境支持 Promise，并且 Promise 是原生的，使用 Promise.then 添加微任务
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve()
  timerFunc = () => {
    p.then(flushCallbacks)
    // 在某些有问题的 UIWebViews 中，Promise.then 不会完全失效，但可能会陷入一种奇怪的状态，
    // 在这种状态下，回调函数被推入微任务队列，但队列不会被清空，除非浏览器需要做一些其他的工作，
    // 例如处理一个定时器。因此，我们可以通过添加一个空的定时器来“强制”清空微任务队列。
    if (isIOS) setTimeout(noop)
  }
  isUsingMicroTask = true
} else if (!isIE && typeof MutationObserver !== 'undefined' && (
  isNative(MutationObserver) ||
  // PhantomJS 和 iOS 7.x
  MutationObserver.toString() === '[object MutationObserverConstructor]'
)) {
  // 在原生 Promise 不可用的环境中，例如 PhantomJS、iOS7、Android 4.4，使用 MutationObserver 添加微任务
  let counter = 1
  const observer = new MutationObserver(flushCallbacks)
  const textNode = document.createTextNode(String(counter))
  observer.observe(textNode, {
    characterData: true
  })
  timerFunc = () => {
    counter = (counter + 1) % 2
    textNode.data = String(counter)
  }
  isUsingMicroTask = true
} else if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  // 如果环境支持 setImmediate，并且 setImmediate 是原生的，使用 setImmediate 添加宏任务
  timerFunc = () => {
    setImmediate(flushCallbacks)
  }
} else {
  // 如果环境不支持 Promise、MutationObserver 和 setImmediate，使用 setTimeout 添加宏任务
  timerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}

/**
 * 在下一个 tick 中执行回调函数。
 *
 * @param {Function} [cb] - 要执行的回调函数。
 * @param {Object} [ctx] - 回调函数的上下文。
 * @return {Promise} 如果没有提供回调函数，并且环境支持 Promise，返回一个 Promise 对象。
 */
export function nextTick (cb?: Function, ctx?: Object) {
  let _resolve
  // 将回调函数添加到队列中
  callbacks.push(() => {
    if (cb) {
      // 如果有回调函数，尝试执行它
      try {
        cb.call(ctx)
      } catch (e) {
        // 如果执行回调函数时发生错误，处理错误
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) {
      // 如果没有回调函数，但有 _resolve 函数，执行 _resolve 函数
      _resolve(ctx)
    }
  })
  // 如果当前没有等待执行的回调函数，调用 timerFunc 函数
  if (!pending) {
    pending = true
    timerFunc()
  }
  // 如果没有提供回调函数，并且环境支持 Promise，返回一个 Promise 对象
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
