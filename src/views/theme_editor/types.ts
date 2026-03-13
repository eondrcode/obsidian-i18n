import I18N from "@/main";
import { ThemeTranslationV1Metadata } from "@/src/types";

// 基础类型定义 ====================================================================================================

export interface ThemeEditorProps {
    title?: string;
    i18n: I18N;
}

export interface ThemeTranslationItem {
    id: number;
    type?: string;
    source: string;  // 原文 (e.g. "title: Accent Color")
    target: string;  // 译文 (e.g. "title: 强调色")
}

// ======================== Store Interface ========================

export interface ThemeEditorStore {
    // ========== 基础状态 ==========
    /** 翻译条目列表 */
    items: ThemeTranslationItem[];
    /** 主题翻译 metadata 元信息 */
    metadata: ThemeTranslationV1Metadata | null;
    /** 主题名称 */
    themeName: string;
    /** 主题目录路径 */
    themeDir: string;
    /** 翻译文件路径 */
    translationPath: string;
    /** 是否正在翻译中 */
    isTranslating: boolean;
    /** 翻译进度 (0-100) */
    progress: number;
    /** 已处理数量 */
    processedCount: number;
    /** 总数量 */
    totalCount: number;
    /** 是否覆盖现有译文 */
    overwrite: boolean;

    // ========== 条目操作 ==========
    /** 初始化条目列表 */
    setItems: (items: ThemeTranslationItem[]) => void;
    /** 添加新条目 */
    addItem: (item: ThemeTranslationItem) => void;
    /** 更新指定 ID 的条目译文 */
    updateItem: (id: number, target: string) => void;
    /** 删除指定 ID 的条目 */
    deleteItem: (id: number) => void;
    /** 重置指定 ID 的条目（译文重置为原文） */
    resetItem: (id: number) => void;
    /** 批量更新条目 */
    updateItems: (items: { id: number; target: string }[]) => void;
    /** 删除所有未翻译的条目 */
    deleteUntranslatedItems: () => void;

    // ========== 元信息操作 ==========
    /** 初始化 metadata 元信息 */
    setMetadata: (metadata: ThemeTranslationV1Metadata) => void;
    /** 更新 metadata 元信息 */
    updateMetadata: (updates: Partial<ThemeTranslationV1Metadata>) => void;
    /** 设置主题基本信息 */
    setThemeInfo: (name: string, dir: string, translationPath: string) => void;
    /** 更新翻译状态 */
    setTranslationStatus: (status: Partial<{ isTranslating: boolean; progress: number; processedCount: number; totalCount: number; overwrite: boolean }>) => void;
}
