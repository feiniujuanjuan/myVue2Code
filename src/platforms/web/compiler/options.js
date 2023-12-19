/* @flow */

import {
  isPreTag,
  mustUseProp,
  isReservedTag,
  getTagNamespace
} from '../util/index'

import modules from './modules/index'
import directives from './directives/index'
import { genStaticKeys } from 'shared/util'
import { isUnaryTag, canBeLeftOpenTag } from './util'

// 定义编译器选项的基础配置
export const baseOptions: CompilerOptions = {
  // expectHTML 为 true 表示期望 HTML 的输入
  expectHTML: true,
  // modules 是一个数组，包含了一组模块的编译选项
  modules,
  // directives 是一个对象，包含了一组指令的编译选项
  directives,
  // isPreTag 是一个函数，用于检查一个标签是否是 pre 标签
  isPreTag,
  // isUnaryTag 是一个函数，用于检查一个标签是否是自闭合标签
  isUnaryTag,
  // mustUseProp 是一个函数，用于检查一个属性是否必须使用 prop 绑定
  mustUseProp,
  // canBeLeftOpenTag 是一个函数，用于检查一个标签是否可以省略闭合标签
  canBeLeftOpenTag,
  // isReservedTag 是一个函数，用于检查一个标签是否是保留的标签
  isReservedTag,
  // getTagNamespace 是一个函数，用于获取一个标签的命名空间
  getTagNamespace,
  // staticKeys 是一个字符串，包含了所有静态键，由 genStaticKeys 函数生成
  staticKeys: genStaticKeys(modules)
}
