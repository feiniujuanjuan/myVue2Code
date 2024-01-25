/* @flow */

import config from "../config";
import { initProxy } from "./proxy";
import { initState } from "./state";
import { initRender } from "./render";
import { initEvents } from "./events";
import { mark, measure } from "../util/perf";
import { initLifecycle, callHook } from "./lifecycle";
import { initProvide, initInjections } from "./inject";
import { extend, mergeOptions, formatComponentName } from "../util/index";

let uid = 0;

export function initMixin(Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this; // 获取当前 Vue 实例
    // 为每个 Vue 实例分配一个唯一的 uid
    vm._uid = uid++;

    let startTag, endTag;
    /* istanbul ignore if */
    // 如果在非生产环境下，并且开启了性能测量，那么标记性能测量的开始
    if (process.env.NODE_ENV !== "production" && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`; // 设置性能测量开始标签
      endTag = `vue-perf-end:${vm._uid}`; // 设置性能测量结束标签
      mark(startTag); // 标记性能测量的开始
    }

    vm._isVue = true; // 设置 _isVue 标志，避免这个对象被观察（响应式）
    // 合并选项
    if (options && options._isComponent) {
      // 优化内部组件实例化
      // 因为动态选项合并相当慢，而且没有一个
      // 内部组件选项需要特殊处理。
      initInternalComponent(vm, options); // 初始化内部组件
    } else {
      // 合并构造函数选项、实例选项和实例本身
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor), // 解析构造函数选项
        options || {}, // 实例选项
        vm // 实例本身
      );
    }
    /* istanbul ignore else */
    // 如果不是生产环境，初始化代理
    if (process.env.NODE_ENV !== "production") {
      initProxy(vm); // 初始化代理
    } else {
      // 如果是生产环境，设置渲染代理为自身
      vm._renderProxy = vm;
    }
    // 暴露真实的 self
    vm._self = vm; // 设置 _self 为自身
    initLifecycle(vm); // 初始化生命周期
    initEvents(vm); // 初始化事件
    initRender(vm); // 初始化渲染函数
    callHook(vm, "beforeCreate"); // 调用 beforeCreate 钩子函数
    initInjections(vm); // 在初始化 data/props 之前解析 injections
    initState(vm); // 初始化状态
    initProvide(vm); // 在初始化 data/props 之后解析 provide
    callHook(vm, "created"); // 调用 created 钩子函数

    /* istanbul ignore if */
    // 如果在非生产环境下，并且开启了性能测量，那么标记性能测量的结束，并测量性能
    if (process.env.NODE_ENV !== "production" && config.performance && mark) {
      vm._name = formatComponentName(vm, false); // 格式化组件名称
      mark(endTag); // 标记性能测量的结束
      measure(`vue ${vm._name} init`, startTag, endTag); // 测量性能
    }

    // 如果存在 el 选项，那么挂载 Vue 实例
    if (vm.$options.el) {
      vm.$mount(vm.$options.el);
    }
  };
}

/**
 * 初始化内部组件。
 *
 * @param {Component} vm - Vue 实例。
 * @param {InternalComponentOptions} options - 内部组件选项。
 */
export function initInternalComponent(
  vm: Component,
  options: InternalComponentOptions
) {
  // 创建一个新的对象，该对象的原型指向 vm.constructor.options
  // 这样我们就可以访问到全局定义的选项
  const opts = (vm.$options = Object.create(vm.constructor.options));

  // 获取父虚拟节点
  const parentVnode = options._parentVnode;
  // 设置父组件和父虚拟节点
  opts.parent = options.parent;
  opts._parentVnode = parentVnode;

  // 获取父虚拟节点的组件选项
  const vnodeComponentOptions = parentVnode.componentOptions;
  // 设置 props 数据、父级监听器、渲染子组件和组件标签
  opts.propsData = vnodeComponentOptions.propsData;
  opts._parentListeners = vnodeComponentOptions.listeners;
  opts._renderChildren = vnodeComponentOptions.children;
  opts._componentTag = vnodeComponentOptions.tag;

  // 如果提供了 render 函数，设置 render 函数和静态渲染函数
  if (options.render) {
    opts.render = options.render;
    opts.staticRenderFns = options.staticRenderFns;
  }
}

export function resolveConstructorOptions(Ctor: Class<Component>) {
  let options = Ctor.options; // 获取构造函数的选项
  if (Ctor.super) { // 如果存在超类
    const superOptions = resolveConstructorOptions(Ctor.super); // 解析超类的构造函数选项
    const cachedSuperOptions = Ctor.superOptions; // 获取缓存的超类构造函数选项
    if (superOptions !== cachedSuperOptions) { // 如果超类的构造函数选项已经改变
      // 需要解析新的选项
      Ctor.superOptions = superOptions; // 更新超类的构造函数选项
      // 检查是否有任何后期修改/附加的选项
      const modifiedOptions = resolveModifiedOptions(Ctor);
      // 更新基础扩展选项
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions);
      }
      // 合并超类的构造函数选项和扩展选项
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions);
      // 如果选项有名字，那么在组件选项中添加一个引用
      if (options.name) {
        options.components[options.name] = Ctor;
      }
    }
  }
  return options;
}

function resolveModifiedOptions(Ctor: Class<Component>): ?Object {
  let modified;
  const latest = Ctor.options;
  const sealed = Ctor.sealedOptions;
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {};
      modified[key] = latest[key];
    }
  }
  return modified;
}
