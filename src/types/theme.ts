export interface OBThemeManifest {
    name: string;
    version: string;
    minAppVersion: string;
    author: string;
    authorUrl: string;
}

export enum ThemeTranslationSchemaVersion {
    V1 = 1,
}

export interface ThemeTranslationV1Metadata {
    // 核心识别信息
    theme: string;                  // 所属主题ID 
    language: string;               // 翻译包语言 (BCP 47)
    version: string;                // 翻译包自身的版本 (e.g. "1.0.1")
    supportedVersions: string;      // 使用 SemVer 范围字符串

    // UI 展示信息
    title: string;                  // 翻译包的标题
    description: string;            // 翻译包的描述
    author: string;                 // 译文创建 creator
}

export interface ThemeTranslationItem {
    id?: number;
    type: string;
    source: string;
    target: string;
}

// [译文] 主题译文 V1
export interface ThemeTranslationV1 {
    schemaVersion: ThemeTranslationSchemaVersion;
    metadata: ThemeTranslationV1Metadata;
    dict: ThemeTranslationItem[];
}

/** @deprecated 使用 ThemeTranslationV1 代替 */
export interface IThemeManifest {
    translationVersion: number
    pluginVersion: string
}

/** @deprecated 使用 ThemeTranslationV1 代替 */
export interface ITheme {
    manifest: IThemeManifest;
    dict: ThemeTranslationItem[];
}
