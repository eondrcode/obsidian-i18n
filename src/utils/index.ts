/**
 * 核心翻译器模块
 * 提供 AST（抽象语法树）和 正则表达式 两种核心翻译能力
 */

import exp from 'constants';

// AST 翻译器核心实现
export * from '~/utils/translator/core-ast-translator';
// 正则表达式翻译器核心实现
export * from '~/utils/translator/core-regex-translator';
// 通用翻译相关类型/工具（基础翻译逻辑、接口定义等）
export * from '~/utils/translator/translation';

/**
 * 格式转换工具模块
 * 处理版本转换、插件翻译内容转换等数据格式转换需求
 */
// 版本号格式转换工具（如版本号解析、升级/降级处理）
export * from '~/utils/converters/version-converter';
// 插件翻译内容转换器（插件翻译数据的格式适配、转换）
export * from '~/utils/converters/plugin-translation-converter';

/**
 * 类型工具模块
 * 提供类型安全相关的辅助工具
 */
// 类型守卫工具（运行时类型校验、类型断言）
export * from '~/utils/types/guard';

/**
 * UI 层工具模块
 * 沉浸式翻译相关的 UI 交互逻辑、中文本地化处理
 */
// 沉浸式翻译 UI 交互逻辑（如悬浮翻译、页面注入等）
export * from '~/utils/ui/immersive';
// UI 中文本地化配置/工具（文本汉化、语言适配）
export * from '~/utils/ui/cn';

/**
 * 通用工具模块
 * 项目通用的基础工具函数
 */
// 通用基础工具（如通用工具函数、常量定义等）
export * from '~/utils/common/general';

/**
 * 数据处理工具模块
 * 提供数据验证、压缩、格式化等数据处理能力
 */
// 数据验证工具（参数校验、数据格式验证）
export * from '~/utils/data/validation';
// 文字压缩工具（文本内容压缩、精简）
export * from '~/utils/data/compression';
// 数据格式化工具（如日期、数字、文本格式标准化）
export * from '~/utils/data/format';

/**
 * 状态管理模块
 * 基于 Zustand 的状态管理相关导出
 */
export * from '~/utils/store/zustand';

export * from '~/utils/store/global';


/**
 * React 视图模块
 * 提供 React 视图相关的工具函数
 */
export * from '~/utils/core/react';


export * from '~/utils/ui/icon';

export * from '~/utils/ui/string-picker';
