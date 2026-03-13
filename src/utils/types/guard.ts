/**
 * 文件名称: guard.ts
 * 模块描述: 类型守卫工具模块，提供Plugin和Theme类型的运行时判断功能
 * 核心功能:
 *   - isPlugin: 判断对象是否为Plugin类型 (检查description属性存在性)
 *   - isTheme: 判断对象是否为Theme类型 (检查dict属性存在性且无description属性)
 *
 * 开发人员: zero
 * 维护人员: zero
 * 创建日期: 2025-08-15
 *
 * 修改日期:
 *   - 2025-08-15 [v1.0.0] zero: 初始版本，实现基础功能;
 *
 * 依赖模块: IPlugin、ITheme (from src/types/types)
 * 注意事项:
 *   - 类型判断基于属性存在性，需确保接口定义与判断逻辑同步更新
 *   - 仅用于区分Plugin和Theme两种互斥类型，不处理其他类型判断
 *   - 利用TypeScript类型断言实现类型窄化，编译时不执行运行时检查
 */
import { PluginTranslationV1, ITheme } from "~/types";

export const isPlugin = (issueJson: PluginTranslationV1 | ITheme): issueJson is PluginTranslationV1 => {
    return (issueJson as PluginTranslationV1).schemaVersion !== undefined || (issueJson as PluginTranslationV1).metadata !== undefined;
}

export const isTheme = (issueJson: PluginTranslationV1 | ITheme): issueJson is ITheme => {
    return (issueJson as ITheme).dict !== undefined;
}