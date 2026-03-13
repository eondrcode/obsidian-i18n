import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { moment } from 'obsidian'
import zhCN from './zh-cn/index';
import './types'; // 引入类型定义以支持 t() 路径补全

// 获取 Obsidian 当前语言
const getLocale = () => {
    const locale = (moment.locale() || 'en').toLowerCase();
    if (locale.startsWith('zh')) return 'zhCN';
    return 'en';
}

i18n.use(initReactI18next).init({
    lng: getLocale(),            // 默认语言
    fallbackLng: 'zhCN',
    debug: false,
    interpolation: {
        escapeValue: false,
    },
    resources: {
        zhCN: {
            translation: zhCN
        },
    },
});

/**
 * 全局翻译函数 (用于非 React 文件)
 */
export const t = (key: string, options?: any): string => i18n.t(key, options) as string;

export default i18n;