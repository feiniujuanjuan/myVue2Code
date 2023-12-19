import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

/**
 * Vue 构造函数。
 *
 * @param {Object} options - Vue 实例的选项。
 */
function Vue (options) {
  // 如果在非生产环境且 Vue 不是通过 new 关键字调用的，发出警告
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  // 初始化 Vue 实例
  this._init(options)
}

// 为 Vue 混入 init 方法，用于初始化 Vue 实例
initMixin(Vue)
// 为 Vue 混入 state 方法，用于处理 Vue 实例的状态
stateMixin(Vue)
// 为 Vue 混入 events 方法，用于处理 Vue 实例的事件
eventsMixin(Vue)
// 为 Vue 混入 lifecycle 方法，用于处理 Vue 实例的生命周期
lifecycleMixin(Vue)
// 为 Vue 混入 render 方法，用于处理 Vue 实例的渲染
renderMixin(Vue)

export default Vue
