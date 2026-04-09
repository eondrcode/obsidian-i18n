import I18N from "@/main";
import { ReactView } from "~/utils";
import { PluginTranslationV1, PluginTranslationV1Regex, PluginTranslationV1Metadata, PluginTranslationV1Ast } from "@/src/types";

// 基础类型定义 ====================================================================================================
export interface EditorProps {
    reactView?: ReactView;
    title: string;
    translationJson: PluginTranslationV1;
    i18n: I18N;
}

export interface RegexItem {
    id: number;
    source: string;
    target: string;
}

export interface AstItem {
    id: number;
    type: string;
    name: string;
    source: string;
    target: string;
}

export type DiagnoseError = {
    type: 'ast' | 'regex';
    id: number;
    source: string;
    isUnused?: boolean;
    severity?: 'error' | 'warning' | 'critical';
    message?: string;
};

// ======================== Slice Interfaces ========================

export interface AstSlice {
    // ========== 基础状态 ==========
    /** AST项列表 */
    astItems: AstItem[];

    // ========== 操作 ==========
    /** 初始化AST项列表 */
    setAstItems: (items: AstItem[]) => void;
    /** 添加新AST项 */
    addAstItem: (item: AstItem) => void;
    /** 更新指定ID的AST项译文 */
    updateAstItem: (id: number, target: string) => void;
    /** 删除指定ID的AST项 */
    deleteAstItem: (id: number) => void;
    /** 重置指定ID的AST项（译文重置为原文） */
    resetAstItem: (id: number) => void;
    /** 批量更新AST项 */
    updateAstItems: (items: { id: number; updates: Partial<AstItem> }[]) => void;
    /** 删除所有未翻译的AST项 */
    deleteUntranslatedAstItems: () => void;
}

export interface RegexSlice {
    // ========== 基础状态 ==========
    /** 正则项列表 */
    regexItems: RegexItem[];

    // ========== 条目操作 ==========
    /** 初始化正则项列表 */
    setRegexItems: (items: RegexItem[]) => void;
    /** 添加新正则项 */
    addRegexItem: (newItem: RegexItem) => void;
    /** 更新指定ID的正则项 */
    updateRegexItem: (id: number, updates: Partial<PluginTranslationV1Regex>) => void;
    /** 删除指定ID的正则项 */
    deleteRegexItem: (id: number) => void;
    /** 重置指定ID的目标文本为源文本 */
    resetRegexItem: (id: number) => void;
    /** 批量更新正则项 */
    updateRegexItems: (items: { id: number; updates: Partial<PluginTranslationV1Regex> }[]) => void;
    /** 删除所有未翻译的正则项 */
    deleteUntranslatedRegexItems: () => void;
}

export interface MetadataSlice {
    // ========== 基础状态 ==========
    /** 元数据 */
    metadata: PluginTranslationV1Metadata | null;

    // ========== 操作 ==========
    /** 初始化元数据 */
    setMetadata: (metadata: PluginTranslationV1Metadata) => void;
    /** 更新元数据 */
    updateMetadata: (updates: Partial<PluginTranslationV1Metadata>) => void;
}

export interface DictSlice {
    // ========== 基础状态 ==========
    /** 完整的字典树数据 */
    dictData: Record<string, {
        ast: PluginTranslationV1Ast[];
        regex: PluginTranslationV1Regex[];
    }>;
    /** 当前选中的文件 */
    currentFile: string;

    // ========== 操作 ==========
    /** 初始化整个 Dict 数据 */
    setDictData: (data: Record<string, { ast: PluginTranslationV1Ast[], regex: PluginTranslationV1Regex[] }>) => void;
    /** 切换当前文件，这应该保存前一个文件的内容并加载新文件的内容 */
    setCurrentFile: (file: string) => void;
    /** 新增一个文件路径到字典中 */
    addFile: (file: string) => void;
    /** 删除指定文件路径 */
    deleteFile: (file: string) => void;
    /** 更新指定文件中的内容（用于保存前的同步） */
    syncFileDictInfo: (file: string, astItems: AstItem[], regexItems: RegexItem[]) => void;
    /** 源码缓存（文件名 -> 源码） */
    sourceCache: Record<string, string>;
    /** 设置指定文件的源码缓存 */
    setSourceCache: (file: string, code: string) => void;
    /** 全局搜索过滤 */
    searchQuery: string;
    setSearchQuery: (query: string) => void;
}

// RegexStore ====================================================================================================
export type RegexStore = RegexSlice & AstSlice & MetadataSlice & DictSlice;
