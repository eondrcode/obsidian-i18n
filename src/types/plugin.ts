import { PluginManifest } from "obsidian";

export interface PluginItem {
    id: string;
    manifest: PluginManifest;
    isApplied: boolean;
}

export enum PluginTranslationSchemaVersion {
    V1 = 1,
}

export interface PluginTranslationV1 {
    schemaVersion: PluginTranslationSchemaVersion;
    metadata: PluginTranslationV1Metadata;
    dict: Record<string, {
        ast: PluginTranslationV1Ast[];
        regex: PluginTranslationV1Regex[];
    }>;
}

export interface PluginTranslationV1Metadata {
    // 核心识别信息
    plugin: string;                 // 所属插件ID 
    language: string;               // 翻译包语言 (BCP 47)
    version: string;                // 翻译包自身的版本 (e.g. "1.0.1")
    supportedVersions: string;      // 使用 SemVer 范围字符串

    // UI 展示信息
    title: string;                  // 翻译包的标题
    description: string;            // 翻译包的描述
    author: string;                 // 译文创建者
}

// AST翻译条目
export interface PluginTranslationV1Ast {
    type: string;
    name: string;
    source: string;
    target: string;
}

// RE翻译条目
export interface PluginTranslationV1Regex {
    source: string;
    target: string;
}
