import zhCN from './zh-cn/index';

/**
 * 国际化资源类型定义
 * 用于为 i18next 提供的 t() 函数实现全自动 Key 路径补全
 */
export type TranslationSchema = typeof zhCN;

declare module 'i18next' {
    interface CustomTypeOptions {
        // [类型] 默认命名空间资源
        defaultNS: 'translation';
        resources: {
            translation: TranslationSchema;
        };
    }
}
