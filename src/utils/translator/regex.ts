import fs from 'fs';
import { PluginTranslationV1Regex } from '~/types';
import { I18nSettings } from 'src/settings/data';

import { REGEX_DEFAULT_CONFIG } from './config';

export interface RegexValidationResult {
    success: boolean;
    message: string;
}

export interface RegexExtractionResult {
    success: boolean;
    texts: string[];
}

export class RegexTranslator {
    private settings: I18nSettings;
    private patterns: RegExp[];
    private rejectPatterns: RegExp[] = [];
    private validPatterns: RegExp[] = [];

    constructor(settings: I18nSettings) {
        this.settings = settings;
        this.initPatterns();
    }

    private initPatterns() {
        // 初始化核心匹配正则
        const regexps = (this.settings.reDatas && this.settings.reDatas.length > 0)
            ? this.settings.reDatas
            : REGEX_DEFAULT_CONFIG.patterns;
        
        this.patterns = regexps.filter(p => p !== '').map(p => new RegExp(p, this.settings.reFlags || 'gs'));

        // 初始化过滤正则 (排除型)
        const rejectRes = (this.settings.reRejectRe && this.settings.reRejectRe.length > 0)
            ? this.settings.reRejectRe
            : REGEX_DEFAULT_CONFIG.rejectPatterns;
        this.rejectPatterns = rejectRes.map(p => new RegExp(p));

        // 初始化验证正则 (有效型)
        const validRes = (this.settings.reValidRe && this.settings.reValidRe.length > 0)
            ? this.settings.reValidRe
            : REGEX_DEFAULT_CONFIG.validPatterns;
        this.validPatterns = validRes.map(p => new RegExp(p));
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

    public loadFile(filePath: string) {
        try {
            const code = fs.readFileSync(filePath, 'utf8');
            return this.extractTranslationsByRegex(code);
        } catch (err: any) {
            return null;
        }
    }

    public loadCode(code: string) {
        try {
            return this.extractTranslationsByRegex(code);
        } catch (err: any) {
            return null;
        }
    }

    public extractTranslationsByRegex(code: string): PluginTranslationV1Regex[] {
        const translations: PluginTranslationV1Regex[] = [];
        const seenSources = new Set<string>();

        for (const regex of this.patterns) {
            regex.lastIndex = 0;
            const matches = code.match(regex);
            if (!matches) continue;

            for (const item of matches) {
                if (!this.isValidText(item)) continue;
                if (seenSources.has(item)) continue;
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
}

export const validationJavaScriptCode = (code: string): RegexValidationResult => {
    return { success: true, message: '' };
};

export const extractionJavaScriptCode = (code: string): RegexExtractionResult => {
    return { success: true, texts: [] };
};
