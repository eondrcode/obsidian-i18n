/**
 * 翻译源类型定义 (扁平化结构 v2)
 */

export interface TranslationSource {
    // 主键
    id: string;                    // 唯一标识 (8位随机字符串)

    // 核心识别信息
    plugin: string;                // 所属插件ID

    // UI 展示信息
    title: string;                 // 译文标题

    // 来源与状态
    type: 'plugin' | 'theme';      // 翻译目标类型
    origin: 'cloud' | 'local';     // 来源类型
    isActive: boolean;             // 是否为当前激活的翻译源（UI选中）
    checksum: string;              // 翻译内容的校验值 (本地和云端都有)

    // 云端元数据
    cloud?: {
        owner: string;             // 仓库所有者
        repo: string;              // 仓库名称
        hash: string;              // 下载时的远端 hash (用于更新检测)
    };

    // 时间戳
    createdAt: number;
    updatedAt: number;
}

/**
 * 翻译源元数据 (扁平化结构)
 * - sources: 以 sourceId 为键的扁平映射
 */
export interface TranslationSourceMeta {
    schemaVersion: number;
    sources: Record<string, TranslationSource>;
}

export const EMPTY_META: TranslationSourceMeta = {
    schemaVersion: 2,
    sources: {}
};
