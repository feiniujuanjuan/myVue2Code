/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * Dep 是一个可观察的对象，可以有多个指令订阅它。
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  // 构造函数初始化 id 和 subs
  constructor () {
    this.id = uid++
    this.subs = []
  }

  // 添加一个订阅者
  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  // 移除一个订阅者
  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  // 如果有目标，添加依赖
  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  // 通知所有订阅者更新
  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id)
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// 当前正在评估的目标观察者。这是全局唯一的，因为一次只能评估一个观察者。
Dep.target = null
const targetStack = []

/**
 * 将目标观察者压入栈中，并设置为当前正在评估的目标观察者。
 *
 * @param {Watcher} [target] - 目标观察者。
 */
export function pushTarget (target: ?Watcher) {
  targetStack.push(target)
  Dep.target = target
}

/**
 * 将目标观察者从栈中弹出，并设置下一个观察者为当前正在评估的目标观察者。
 */
export function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
