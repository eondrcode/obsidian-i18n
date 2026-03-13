// 贡献者目录类型
export interface Contributor {
    login: string;
    name: string;
    url: string;
    translation: number;
    modification: number;
    erasure: number;
}

// [目录] 译文条目（单个译文对象）  
export interface TranslationDirectoryItem {
    id: string;
    translations: Record<string, number>;
}

// [目录] 译文条目集合（译文目录）
export type TranslationDirectory = TranslationDirectoryItem[];
