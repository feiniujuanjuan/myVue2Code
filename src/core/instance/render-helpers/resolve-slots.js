/* @flow */

import type VNode from 'core/vdom/vnode'

/**
 * 将原始子虚拟节点（VNodes）解析为插槽对象的运行时助手。
 *
 * @param {Array<VNode>} children - 子虚拟节点数组。
 * @param {Component} context - 组件上下文。
 * @return {Object} 插槽对象，键是插槽名，值是虚拟节点数组。
 */
export function resolveSlots (
  children: ?Array<VNode>,
  context: ?Component
): { [key: string]: Array<VNode> } {
  // 如果没有子节点，返回空对象
  if (!children || !children.length) {
    return {}
  }
  const slots = {}
  for (let i = 0, l = children.length; i < l; i++) {
    const child = children[i]
    const data = child.data
    // 如果节点被解析为 Vue 插槽节点，删除 slot 属性
    if (data && data.attrs && data.attrs.slot) {
      delete data.attrs.slot
    }
    // 只有当虚拟节点在同一上下文中渲染时，才应该尊重命名插槽
    if ((child.context === context || child.fnContext === context) &&
      data && data.slot != null
    ) {
      const name = data.slot
      const slot = (slots[name] || (slots[name] = []))
      // 如果子节点是模板，将其子节点添加到插槽中
      if (child.tag === 'template') {
        slot.push.apply(slot, child.children || [])
      } else {
        // 否则，将子节点添加到插槽中
        slot.push(child)
      }
    } else {
      // 如果子节点没有命名插槽，将其添加到默认插槽中
      (slots.default || (slots.default = [])).push(child)
    }
  }
  // 忽略只包含空白的插槽
  for (const name in slots) {
    if (slots[name].every(isWhitespace)) {
      delete slots[name]
    }
  }
  return slots
}

/**
 * 检查一个虚拟节点是否是空白节点。
 *
 * @param {VNode} node - 要检查的虚拟节点。
 * @return {boolean} 如果虚拟节点是空白节点，返回 true，否则返回 false。
 */
function isWhitespace (node: VNode): boolean {
  // 如果虚拟节点是注释节点，并且不是异步工厂，或者虚拟节点的文本是空格，那么它就是空白节点
  return (node.isComment && !node.asyncFactory) || node.text === ' '
}
