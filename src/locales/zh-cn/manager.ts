/**
 * [模块] 插件管理器 (Manager)
 */
export default {
    Titles: {
        Main: "i18n 资源库管理"
    },
    Actions: {
        Search: "搜索",
        MoreActions: "更多选项",
        Sponsor: "请喝咖啡",
        Help: "使用帮助",
        HelpDoc: "官方文档教程",
        Cloud: "云端译文",
        Settings: "综合设置",
        Apply: "应用",
        Restore: "还原",
        Edit: "编辑译文",
        Extract: "提取译文",
        Delete: "删除译文",
        OpenFolder: "浏览目录",
        OpenSettings: "插件设置",
        SelectSource: "选择数据源",
        Reload: "重载插件",
        GoToEditor: "前往编辑器",
        ContinueApply: "坚持应用"
    },
    Placeholders: {
        SearchPlugins: "搜索插件...",
        SearchThemes: "搜索主题...",
        SearchPlaceholder: "输入搜索关键词..."
    },
    Filters: {
        All: "全部",
        Applied: "已应用",
        Unapplied: "未应用",
        Translated: "已翻译",
        Untranslated: "未翻译",
        ToExtract: "待提取"
    },
    Labels: {
        Plugins: "插件",
        Themes: "主题",
        Admin: "管理",
        Mtime: "最后更新",
        SupportVer: "支持版本",
        ThemeActive: "当前主题",
        Author: "作者"
    },
    Status: {
        On: "已启用",
        Off: "已禁用",
        Applied: "已应用",
        Unapplied: "未应用",
        Translated: "已翻译",
        Untranslated: "未翻译",
        ToExtract: "待提取",
        NoTrans: "未翻译",
        Reloading: "重载中...",
        NoPlugins: "未发现插件",
        NoThemes: "未发现主题",
        AutoStarting: "正在启动一键自动化处理...",
        ScanningInstalled: "正在扫描已安装项 ({{count}})...",
        Running: "自动化任务正在运行中"
    },
    Dialogs: {
        EmptyTranslationTitle: "未检测到翻译内容",
        EmptyTranslationDesc: "当前选择的翻译源尚未进行任何实质性翻译（译文与原文完全一致）。应用此文件后，插件界面语言将不会发生任何变化。建议您先在编辑器中完成翻译后再应用。",
        AutoWarningTitle: "实验性功能风险提示",
        AutoWarningDesc: "「一键自动化」目前处于实验阶段，稳定性较低。它会批量执行扫描、应用并重启插件。为防止非预期错误，强烈建议您先在【测试库/备份库】中验证。是否继续执行？"
    },
    Hints: {
        NoTransDesc: "暂无本地语言数据",
        ExtractSuccessDesc: "已生成当前版本的翻译模板"
    },
    Notices: {
        ReloadPlugin: "准备重启插件: {{id}}",
        ReloadSuccess: "插件重载成功",
        ExtractSuccess: "提取成功",
        ThemeExtractPrefix: "提取译文",
        ThemeApplyPrefix: "主题应用",
        ThemeRestorePrefix: "主题还原",
        ApplySuccess: "翻译应用成功",
        AutoFillComplete: "自动化处理完成: 成功 {{success}} 项, 跳过 {{skip}} 项",
        CopySuccess: "Registry JSON 已复制到剪贴板",
        SyncSuccess: "中心库注册表同步成功！"
    },
    Errors: {
        Error: "错误",
        ErrorDesc: "译文解析异常",
        ReloadPluginFailed: "插件重启失败: {{error}}",
        ReloadFailed: "插件重载失败: {{error}}",
        PluginNotEnabled: "插件未启用",
        LoadFailedAfterApply: "插件重载失败，可能是源码存在运行时错误。请按 Ctrl+Shift+I 打开控制台查看具体报错堆栈。",
        SyntaxError: "JavaScript 语法损坏，已终止应用: {{file}}",
        ThemeCssNotFound: "未找到 theme.css 文件",
        NoSettingsBlock: "未找到 @settings 块，无可翻译内容",
        MainNotFound: "未找到 main.js 文件",
        BackupNotFound: "备份文件不存在，无法还原",
        FetchCommunityDataFailed: "获取社区注册表数据失败，请检查网络",
        AutoFailed: "自动化处理过程中发生错误",
        SyncFailed: "中心库同步失败，请检查网络或 Token 权限"
    },
    Dashboard: {
        Title: "社区数据看板",
        AdminControl: "管理员控制",
        Subtitle: "深度监控社区动态与注册表权重分配系统",
        SearchPlaceholder: "搜索仓库地址或作者勋章...",
        PushToCloud: "推送至云端",
        ExportJson: "导出注册表 JSON",
        Stats: {
            Repos: "仓库",
            Stars: "星标",
            Contribs: "贡献者",
            Plugins: "插件",
            Translations: "词条翻译",
            Commits30d: "30天提交",
            Langs: "涵盖语言",
            ActivityIndex: "活跃指数",
            Forks: "派生 (Forks)",
            OpenIssues: "开放议题",
            LastUpdate: "最后推送",
            Size: "资源占用"
        },
        Leaderboard: {
            Title: "活跃贡献榜",
            Subtitle: "顶尖贡献者与高活跃度项目"
        },
        LanguageDistribution: {
            Title: "语言分布概览",
            TotalTranslations: "{{count}} 项翻译"
        },
        Management: {
            Title: "仓库注册表管理",
            ShowingStats: "当前展示 {{filtered}} / {{total}} 个仓库",
            SyncingData: "正在同步数据层...",
            NoData: "当前轨道未发现数据",
            NoLicense: "无许可证"
        },
        Fields: {
            AuthorReputation: "作者声望/勋章",
            AuthorReputationPlaceholder: "例如：翻译巨匠, 社区新星...",
            RegistryBadges: "注册表标签 (JSON)",
            RegistryBadgesPlaceholder: '["精选", "热门"]',
            FeaturedContext: "深度推荐理由",
            FeaturedContextPlaceholder: "展示在云端首页的深度推荐理由..."
        },
        Controls: {
            Official: "官方认证",
            VerifiedNode: "已验证节点",
            Featured: "精选推荐",
            HighlightedContent: "高光内容展示"
        }
    }
} as const;
