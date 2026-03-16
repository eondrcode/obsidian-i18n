/**
 * 云端翻译管理视图类型定义
 */


// 搜索参数
export interface SearchParams {
    query: string;
    language: string;
    page: number;
    page_size: number;
}

// 上传表单数据
export interface UploadFormData {
    plugin_id: string;
    title: string;
    description: string;
    version: string;
}

// ========== GitHub API 数据类型 ==========
export interface GithubUserInfo {
    login: string;
    id: number;
    avatar_url?: string;
    name?: string;
    followers?: number;
    following?: number;
    public_repos?: number;
    created_at?: string;
    bio?: string;
}

export interface GithubRepoInfo {
    stargazers_count: number;
    watchers_count: number;
    forks_count: number;
    open_issues_count: number;
    created_at: string;
    updated_at: string;
    size: number;
    description: string;
}

// 本地翻译文件信息
export interface LocalTranslationFile {
    path: string;
    language: string;
    exists: boolean;
    lastModified?: Date;
    size?: number;
}

// Tab 类型
export type CloudTabType = 'community' | 'download' | 'upload' | 'my' | 'history' | 'backup';

// metadata.json 条目（个人仓库）
export interface ManifestEntry {
    id: string;                 // UUID，也是翻译文件名
    plugin: string;             // 目标插件 ID
    language: string;           // 语言代码
    version: string;            // 翻译版本
    supported_versions: string; // 兼容的插件版本
    title: string;
    description: string;
    hash: string;               // 文件内容 hash
    created_at: string;
    updated_at: string;
    type: 'plugin' | 'theme';   // 翻译目标类型
}

// 社区索引条目（registry.json 中的单条记录）
export interface RegistryItem {
    repoAddress: string;        // owner/repo 格式
    registeredAt: string;       // 注册时间 ISO 8601
    isOfficial?: boolean;       // 是否官方仓库
    isFeatured?: boolean;       // 是否精选/推荐仓库
    reason?: string;            // 推荐理由
    badges?: string[];          // 仓库勋章
    authorBadge?: string;       // 作者/译者称号 (手动指定)
}

// ========== 社区仓库统计数据（stats.json 中的单条记录） ==========
export interface CommunityRepoStats {
    // ===== 作者信息 =====
    authorName: string;             // GitHub 用户名
    authorId: number;               // GitHub 用户 ID
    avatarUrl: string;              // 头像 URL
    authorType: string;             // 用户类型：'User' | 'Organization'
    authorHtmlUrl: string;          // 作者 GitHub 主页 URL

    // ===== 仓库基本信息 =====
    repoName: string;               // 仓库名
    repoFullName: string;           // 完整名 owner/repo
    description: string;            // 仓库描述
    htmlUrl: string;                // 仓库 GitHub 页面 URL
    defaultBranch: string;          // 默认分支
    license: string | null;         // 开源协议（如 'MIT', 'Apache-2.0'）
    topics: string[];               // 仓库 Topics 标签
    isArchived: boolean;            // 是否已归档
    isFork: boolean;                // 是否是 Fork 仓库
    repoSize: number;               // 仓库大小（KB）

    // ===== 仓库指标 =====
    stars: number;                  // Star 数
    forks: number;                  // Fork 数
    watchers: number;               // Watcher 数
    openIssuesCount: number;        // 打开的 Issue 数量

    // ===== 时间戳 =====
    repoCreatedAt: string;          // 仓库创建时间 (ISO 8601)
    repoUpdatedAt: string;          // 仓库最后更新时间 (ISO 8601)
    lastPushedAt: string;           // 最后一次推送时间 (ISO 8601)

    // ===== 活跃度数据 =====
    recentCommits30d: number;       // 近 30 天 commit 数量
    totalContributors: number;      // 贡献者总数
    activityScore: number;          // 预计算的活跃度分数 (0-1)

    // ===== Metadata 摘要（从 metadata.json 统计） =====
    translationCount: number;       // 翻译覆盖的文件数量
    pluginCount: number;            // 该仓库涵盖的独立插件种数
    themeCount?: number;            // 该仓库涵盖的独立主题种数
    languages: string[];            // 支持的语言列表
    pluginIds: string[];            // 翻译覆盖的插件 ID 列表
    lastManifestUpdate: string;     // metadata.json 最后更新时间 (ISO 8601)
}

// ========== 排行榜作者条目（预计算） ==========
export interface LeaderboardAuthorEntry {
    name: string;                   // GitHub 用户名
    avatarUrl: string;              // 头像 URL
    htmlUrl: string;                // 作者 GitHub 主页 URL
    totalPlugins: number;           // 所有仓库翻译插件总数
    totalStars: number;             // 所有仓库累计 Star 数
    repoCount: number;              // 拥有的翻译仓库数
    languages: string[];            // 覆盖的语言列表
    activityScore: number;          // 综合活跃度分数 (0-1)
    lastActiveAt: string;           // 最近活跃时间 (ISO 8601)
}

// ========== stats.json 完整结构 ==========
export interface CommunityStatsData {
    /** 数据生成时间 */
    lastUpdated: string;
    /** 所有仓库的详细统计 */
    repos: Record<string, CommunityRepoStats>;
    /** 预计算的排行榜 */
    leaderboard: {
        /** 按 Star 排序的仓库地址列表 */
        topReposByStars: string[];
        /** 按活跃度排序的仓库地址列表 */
        topReposByActivity: string[];
        /** 按综合得分排序的活跃译者 */
        topAuthors: LeaderboardAuthorEntry[];
    };
    /** 全局汇总统计 */
    summary: {
        totalRepos: number;             // 注册仓库总数
        totalPlugins: number;           // 翻译覆盖的插件总数（去重）
        totalTranslations: number;      // 翻译条目总数
        totalContributors: number;      // 贡献者总数（去重）
        totalStars: number;             // 全社区累计 Star 数
        languageDistribution: Record<string, number>;  // 各语言的翻译数量分布
    };
}

// 视图 Props
export interface CloudViewProps {
    // 预留
}

// ========== 待更新项 ..........
export interface OutdatedSource {
    sourceId: string;               // 本地翻译源 ID
    pluginId: string;               // 插件 ID
    title: string;                  // 翻译标题
    currentVersion: string;         // 本地版本
    newVersion: string;             // 云端版本
    repoAddress: string;            // 云端仓库地址
    newHash: string;                // 云端新 Hash
}

// ========== 翻译历史 ==========
export interface CommitEntry {
    sha: string;
    message: string;
    date: string;
    author: string;
    avatarUrl?: string;
}

// ========== 备份进度 ==========
export interface BackupProgress {
    total: number;
    current: number;
    currentPlugin: string;
    phase: 'uploading' | 'downloading' | 'done' | 'error';
    errorMessage?: string;
}

// ========== Diff 行 ==========
export interface DiffEntry {
    type: 'added' | 'removed' | 'modified' | 'unchanged';
    key: string;
    localValue?: string;
    cloudValue?: string;
}

/** 根据翻译类型获取仓库中的文件目录 */
export function getCloudDirectory(type: 'plugin' | 'theme'): string {
    return type === 'theme' ? 'themes' : 'plugins';
}

/** 根据 type + id 获取仓库中的完整文件路径 */
export function getCloudFilePath(id: string, type: 'plugin' | 'theme'): string {
    return `${getCloudDirectory(type)}/${id}.json`;
}
