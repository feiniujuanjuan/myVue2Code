/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype // 获取数组原型
export const arrayMethods = Object.create(arrayProto) // 创建一个新对象，该对象的原型是数组原型

const methodsToPatch = [ // 需要修改的数组方法
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * 拦截变异方法并发出事件
 */
methodsToPatch.forEach(function (method) { // 遍历需要修改的数组方法
  // 缓存原始方法
  const original = arrayProto[method] // 获取数组原型上的原始方法
  def(arrayMethods, method, function mutator (...args) { // 在 arrayMethods 对象上定义新方法
    const result = original.apply(this, args) // 调用原始方法并获取结果
    const ob = this.__ob__ // 获取观察者对象
    let inserted // 插入的元素
    switch (method) { // 根据方法名判断
      case 'push':
      case 'unshift':
        inserted = args // 如果是 push 或 unshift 方法，插入的元素就是参数
        break
      case 'splice':
        inserted = args.slice(2) // 如果是 splice 方法，插入的元素是第三个参数开始的所有参数
        break
    }
    if (inserted) ob.observeArray(inserted) // 如果有插入的元素，观察这些元素
    // 通知变更
    ob.dep.notify()
    return result // 返回原始方法的结果
  })
})