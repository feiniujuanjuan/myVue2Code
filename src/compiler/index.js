/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

/**
 * 创建一个编译器，该编译器使用默认的解析器、优化器和代码生成器。
 *
 * @param {string} template - 要编译的模板字符串。
 * @param {CompilerOptions} options - 编译选项。
 * @return {CompiledResult} 返回编译结果，包括抽象语法树、渲染函数和静态渲染函数。
 */
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  // 使用 parse 函数解析模板字符串，生成抽象语法树
  const ast = parse(template.trim(), options)
  // 如果 optimize 选项不为 false，使用 optimize 函数优化抽象语法树
  if (options.optimize !== false) {
    optimize(ast, options)
  }
  // 使用 generate 函数生成代码
  const code = generate(ast, options)
  // 返回编译结果，包括抽象语法树、渲染函数和静态渲染函数
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
