import {
    PluginTranslationSchemaVersion,
    PluginTranslationV1,
    PluginTranslationV1Regex,
    PluginTranslationV1Ast
} from '@/src/types';

/**
 * 便捷工具：验证数据是否为有效的 V1 格式
 * @param data 待验证数据
 * @returns 是否为有效 V1 格式
 */
export function isPluginTranslationV1(data: any): data is PluginTranslationV1 {
    return data && typeof data === 'object' && 'schemaVersion' in data && 'metadata' in data && 'ast' in data && Array.isArray(data.ast) && 'regex' in data && Array.isArray(data.regex);
}