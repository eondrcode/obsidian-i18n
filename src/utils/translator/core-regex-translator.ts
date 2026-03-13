import fs from 'fs';
import { PluginTranslationV1Regex } from '~/types';
import { I18nSettings } from 'src/settings/data';

// Regex 翻译器

// #region 配置和类型定义 ==================================================
/** JavaScript 代码语法验证的结果信息 */
export interface RegexValidationResult {
    /** 代码是否合法  */
    success: boolean;
    /** 验证成功的节点类型 */
    // type: string | null;
    /** 验证失败的错误信息 */
    message: string;
}

/** 从代码中提取字符串的结果信息 */
export interface RegexExtractionResult {
    /** 提取操作是否成功（true 表示成功，false 表示失败） */
    success: boolean;
    /** 解析成功的节点类型 */
    // type: string | null;
    /** 提取到的字符串数组 */
    texts: string[];
}

// #endregion

// ------------------------------
// 核心类（优化：预编译、缓存、配置化）
// ------------------------------
export class RegexTranslator {
    private settings: I18nSettings;
    // [变量] 正则表达式模式 (预编译)
    private patterns: RegExp[];
    private rejectPatterns: RegExp[] = [];
    private validPatterns: RegExp[] = [];

    // 初始化变量
    constructor(settings: I18nSettings) {
        this.settings = settings;
        this.initPatterns();
    }

    private initPatterns() {
        // 初始化核心匹配正则
        const regexps = [...(this.settings.reDatas || [])];
        if (this.settings.reTempMode && this.settings.reTemp) {
            regexps.push(...this.settings.reTemp.split('|'));
        }
        this.patterns = regexps.filter(p => p !== '').map(p => new RegExp(p, this.settings.reFlags || 'gs'));

        // 初始化过滤正则 (排除型)
        this.rejectPatterns = (this.settings.reRejectRe || []).map(p => new RegExp(p));

        // 初始化验证正则 (有效型)
        this.validPatterns = (this.settings.reValidRe || []).map(p => new RegExp(p));
    }

    private isValidText(text: string): boolean {
        if (!text || text.length > this.settings.reLength) return false;

        // 1. 检查排除正则 (命中任一则排除)
        for (const re of this.rejectPatterns) {
            if (re.test(text)) return false;
        }

        // 2. 检查有效正则 (命中任一则视为有效; 若列表为空则默认有效)
        if (this.validPatterns.length === 0) return true;
        for (const re of this.validPatterns) {
            if (re.test(text)) return true;
        }

        return false;
    }

    /**
     * 加载文件并解析JavaScript代码
     * 
     * @param filePath 要读取的JavaScript文件的路径
     * @returns 解析成功时返回提取结果，文件读取失败时返回null 
     */
    public loadFile(filePath: string) {
        let code = ''
        try {
            code = fs.readFileSync(filePath, 'utf8');
            return this.extractTranslationsByRegex(code);
        } catch (err: any) {
            return null;
        }
    }

    /**
     * 加载文本并解析JavaScript代码
     * 
     * @param code 要加载和解析的JavaScript代码字符串
     * @returns 解析成功时返回提取结果，解析失败时返回null
     */
    public loadCode(code: string) {
        try {
            return this.extractTranslationsByRegex(code);
        } catch (err: any) {
            return null;
        }
    }


    /**
     * 使用正则表达式提取代码中的翻译条目
     * 
     * @param code 要提取翻译条目的代码
     * @returns 提取到的翻译条目数组
     */
    public extractTranslationsByRegex(code: string): PluginTranslationV1Regex[] {
        const translations: PluginTranslationV1Regex[] = [];
        // 用Set存储已添加的source，优化去重效率（O(1)查找）
        const seenSources = new Set<string>();

        // 遍历所有模式提取翻译条目
        for (const regex of this.patterns) {
            // regex 是预编译的 stateful RegExp ('g' flag)，循环前需重置 lastIndex
            regex.lastIndex = 0;

            const matches = code.match(regex);
            if (!matches) continue; // 无匹配结果则跳过

            // 遍历匹配结果，过滤并去重
            for (const item of matches) {
                // 使用统一的过滤校验逻辑
                if (!this.isValidText(item)) continue;
                // 利用Set快速判断是否重复
                if (seenSources.has(item)) continue;
                // 不重复则添加到结果集
                seenSources.add(item);
                translations.push({ source: item, target: item });
            }
        }

        return translations;
    }

    public translate(code: string, translations: PluginTranslationV1Regex[]): string {
        let translatedCode = code;
        for (const item of translations) {
            if (item.source && item.target && item.source !== item.target) {
                translatedCode = translatedCode.split(item.source).join(item.target);
            }
        }
        return translatedCode;
    }

};

// ------------------------------
// 工具类 (已禁用 AST 分析功能)
// ------------------------------

/**
 * [已禁用] 验证JavaScript代码片段的语法是否合法
 * 始终返回 true
 */
export const validationJavaScriptCode = (code: string): RegexValidationResult => {
    return { success: true, message: '' };
};

/**
 * [已禁用] 从JavaScript代码片段中提取所有字符串内容
 * 始终返回空数组
 */
export const extractionJavaScriptCode = (code: string): RegexExtractionResult => {
    return { success: true, texts: [] };
};