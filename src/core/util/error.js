/* @flow */

import config from '../config'
import { warn } from './debug'
import { inBrowser, inWeex } from './env'
import { isPromise } from 'shared/util'
import { pushTarget, popTarget } from '../observer/dep'

export function handleError (err: Error, vm: any, info: string) {
  // Deactivate deps tracking while processing error handler to avoid possible infinite rendering.
  // See: https://github.com/vuejs/vuex/issues/1505
  pushTarget()
  try {
    if (vm) {
      let cur = vm
      while ((cur = cur.$parent)) {
        const hooks = cur.$options.errorCaptured
        if (hooks) {
          for (let i = 0; i < hooks.length; i++) {
            try {
              const capture = hooks[i].call(cur, err, vm, info) === false
              if (capture) return
            } catch (e) {
              globalHandleError(e, cur, 'errorCaptured hook')
            }
          }
        }
      }
    }
    globalHandleError(err, vm, info)
  } finally {
    popTarget()
  }
}

/**
 * 调用处理器并处理可能出现的错误。
 */
export function invokeWithErrorHandling (
  handler: Function, // 要调用的处理器
  context: any, // 处理器的上下文
  args: null | any[], // 传递给处理器的参数
  vm: any, // Vue 组件实例
  info: string // 信息
) {
  let res // 用于存储处理器的返回值
  try {
    // 如果 args 存在，则使用 apply 调用处理器，否则使用 call 调用处理器
    res = args ? handler.apply(context, args) : handler.call(context)
    // 如果返回值存在，且不是 Vue 实例，且是 Promise，且没有被处理过
    if (res && !res._isVue && isPromise(res) && !res._handled) {
      // 使用 catch 处理 Promise 的错误
      res.catch(e => handleError(e, vm, info + ` (Promise/async)`))
      // 避免在嵌套调用时 catch 触发多次
      res._handled = true
    }
  } catch (e) {
    // 处理调用处理器时出现的错误
    handleError(e, vm, info)
  }
  // 返回处理器的返回值
  return res
}

function globalHandleError (err, vm, info) {
  if (config.errorHandler) {
    try {
      return config.errorHandler.call(null, err, vm, info)
    } catch (e) {
      // if the user intentionally throws the original error in the handler,
      // do not log it twice
      if (e !== err) {
        logError(e, null, 'config.errorHandler')
      }
    }
  }
  logError(err, vm, info)
}

function logError (err, vm, info) {
  if (process.env.NODE_ENV !== 'production') {
    warn(`Error in ${info}: "${err.toString()}"`, vm)
  }
  /* istanbul ignore else */
  if ((inBrowser || inWeex) && typeof console !== 'undefined') {
    console.error(err)
  } else {
    throw err
  }
}
