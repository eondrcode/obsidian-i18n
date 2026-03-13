import { createHash } from 'crypto';
import { PluginManifest } from 'obsidian';
import { OBThemeManifest, ITheme, PluginTranslationV1, PluginTranslationSchemaVersion, PluginTranslationV1Ast, PluginTranslationV1Regex } from '~/types';
import { AstTranslator } from '~/utils/translator/core-ast-translator';
import { RegexTranslator } from '~/utils/translator/core-regex-translator';
import { useGlobalStoreInstance } from '~/utils';

/**
 * 生成插件的翻译 JSON 对象。
 */
export function generatePlugin(pluginVersion: string, manifestJSON: PluginManifest, mainStr: string, language: string, settings: any): PluginTranslationV1 {
    const translationJson: PluginTranslationV1 = {
        schemaVersion: PluginTranslationSchemaVersion.V1,
        metadata: {
            plugin: manifestJSON.id,
            version: '1.0.0',
            title: manifestJSON.name,
            description: `${manifestJSON.name} Localization & Tweaks`,
            language: language,
            supportedVersions: pluginVersion,
            author: '',
        },
        dict: {
            'main.js': {
                ast: [],
                regex: []
            }
        }
    };

    const astTranslator = new AstTranslator(settings);
    const ast = astTranslator.loadCode(mainStr);
    if (ast) translationJson.dict['main.js'].ast = astTranslator.extract(ast);

    const regexTranslator = new RegexTranslator(settings);
    const regex = regexTranslator.loadCode(mainStr);
    if (regex) translationJson.dict['main.js'].regex = regex;

    return translationJson;
}

/**
 * 计算翻译数据的校验和 (SHA-256)
 */
export function calculateChecksum(data: any): string {
    const content = JSON.parse(JSON.stringify(data));
    if (content.checksum) delete content.checksum;
    const stableString = stableStringify(content);
    return createHash('sha256').update(stableString).digest('hex');
}

function stableStringify(obj: any): string {
    if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(obj).sort().map(key =>
        JSON.stringify(key) + ':' + stableStringify(obj[key])
    ).join(',') + '}';
}

/**
 * 生成主题的翻译 JSON 对象。
 */
export function generateTheme(themeManifest: OBThemeManifest, themeStr: string): ITheme {
    const themeJson: ITheme = {
        'manifest': {
            'translationVersion': 0,
            'pluginVersion': themeManifest.version
        },
        'dict': []
    };
    const settingsBlockRegex = /\/\* @settings([\s\S]*?)\*\//g;
    let blockMatch;
    const seenSources = new Set<string>();

    while ((blockMatch = settingsBlockRegex.exec(themeStr)) !== null) {
        const blockContent = blockMatch[1];
        const fieldRegex = /^(?:[ \t]*)(name|title|description|label|markdown):\s*(["']?)(.*?)\2[ \t]*(?:\r?\n|$)/gm;
        let fieldMatch;

        while ((fieldMatch = fieldRegex.exec(blockContent)) !== null) {
            const fieldType = fieldMatch[1];
            const pureText = fieldMatch[3];

            if (pureText.trim() !== '' && !seenSources.has(pureText)) {
                seenSources.add(pureText);
                themeJson.dict.push({
                    type: fieldType,
                    source: pureText,
                    target: pureText
                });
            }
        }
    }
    return themeJson;
}

/**
 * 合并 AST 翻译项
 */
export function mergeAstItems(existingItems: PluginTranslationV1Ast[], newItems: PluginTranslationV1Ast[]): PluginTranslationV1Ast[] {
    const mergedMap = new Map<string, PluginTranslationV1Ast>();
    existingItems.forEach(item => {
        const key = `${item.type}|${item.name || ''}|${item.source}`;
        mergedMap.set(key, { ...item });
    });
    newItems.forEach(newItem => {
        const key = `${newItem.type}|${newItem.name || ''}|${newItem.source}`;
        if (!mergedMap.has(key)) mergedMap.set(key, { ...newItem });
    });
    return Array.from(mergedMap.values());
}

/**
 * 合并 Regex 翻译项
 */
export function mergeRegexItems(existingItems: PluginTranslationV1Regex[], newItems: PluginTranslationV1Regex[]): PluginTranslationV1Regex[] {
    const mergedMap = new Map<string, PluginTranslationV1Regex>();
    existingItems.forEach(item => mergedMap.set(item.source, { ...item }));
    newItems.forEach(newItem => {
        if (!mergedMap.has(newItem.source)) mergedMap.set(newItem.source, { ...newItem });
    });
    return Array.from(mergedMap.values());
}
