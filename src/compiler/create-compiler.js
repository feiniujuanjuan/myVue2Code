/* @flow */

import { extend } from 'shared/util'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'

/**
 * 创建编译器创建函数。
 *
 * @param {Function} baseCompile - 基础编译函数。
 * @return {Function} 返回创建编译器的函数。
 */
export function createCompilerCreator (baseCompile: Function): Function {
  /**
   * 创建编译器。
   *
   * @param {CompilerOptions} baseOptions - 基础编译选项。
   * @return {Object} 返回编译器对象，包括编译函数和编译为函数的函数。
   */
  return function createCompiler (baseOptions: CompilerOptions) {
    /**
     * 编译模板。
     *
     * @param {string} template - 模板字符串。
     * @param {CompilerOptions} [options] - 编译选项。
     * @return {CompiledResult} 返回编译结果，包括抽象语法树、渲染函数、静态渲染函数、错误和提示。
     */
    function compile (
      template: string,
      options?: CompilerOptions
    ): CompiledResult {
      // 创建最终编译选项，继承自基础编译选项
      const finalOptions = Object.create(baseOptions)
      // 初始化错误和提示数组
      const errors = []
      const tips = []

      // 定义警告函数，用于添加错误或提示
      let warn = (msg, range, tip) => {
        (tip ? tips : errors).push(msg)
      }

      // 如果编译选项存在，处理编译选项
      if (options) {
        // 如果在非生产环境且开启了输出源范围选项，重定义警告函数，添加源范围信息
        if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
          // 计算模板前导空白长度
          const leadingSpaceLength = template.match(/^\s*/)[0].length

          warn = (msg, range, tip) => {
            const data: WarningMessage = { msg }
            if (range) {
              if (range.start != null) {
                data.start = range.start + leadingSpaceLength
              }
              if (range.end != null) {
                data.end = range.end + leadingSpaceLength
              }
            }
            (tip ? tips : errors).push(data)
          }
        }
        // 合并自定义模块
        if (options.modules) {
          finalOptions.modules =
            (baseOptions.modules || []).concat(options.modules)
        }
        // 合并自定义指令
        if (options.directives) {
          finalOptions.directives = extend(
            Object.create(baseOptions.directives || null),
            options.directives
          )
        }
        // 复制其他选项
        for (const key in options) {
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key]
          }
        }
      }

      // 设置最终编译选项的警告函数
      finalOptions.warn = warn

      // 使用基础编译函数编译模板，获取编译结果
      const compiled = baseCompile(template.trim(), finalOptions)
      // 如果在非生产环境，检测抽象语法树的错误
      if (process.env.NODE_ENV !== 'production') {
        detectErrors(compiled.ast, warn)
      }
      // 设置编译结果的错误和提示
      compiled.errors = errors
      compiled.tips = tips
      // 返回编译结果
      return compiled
    }

    // 返回编译器对象，包括编译函数和编译为函数的函数
    return {
      compile,
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}