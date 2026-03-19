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
        ContinueApply: "坚持应用",
        StartAuto: "开始一键任务"
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
        Auto: "自动",
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
        Labels: {
            pending: '等待中',
            processing: '处理中',
            success: '应用成功',
            found: '已发现匹配',
            skipped: '已跳过',
            error: '任务失败',
            plugin: '插件',
            theme: '主题',
        },
        AutoStarting: "正在启动一键自动化处理...",
        ScanningInstalled: "正在扫描已安装项 ({{count}})...",
        Running: "正在自动化扫描...",
        ParsingEntries: "正在解析翻译注册表 ({{count}})...",
        CacheHitApplying: "命中本地缓存，正在应用: {{id}}",
        DownloadingBest: "正在下载最佳翻译: {{id}}",
        NoLogs: "暂无自动化任务记录",
        AutoRollbacked: '运行异常已自动回滚'
    },
    Modes: {
        Incremental: '增量检查',
        Full: '全量自检'
    },
    AutoDashboard: {
        Stats: {
            TotalInstalled: '已安装总数',
            AppliedCount: '累计翻译应用',
            CurrentSuccess: '本次成功',
            CurrentSkipped: '本次跳过/失败',
            Plugins: '插件',
            Themes: '主题',
            LastCheckTime: '上次检查：{{time}}'
        },
        Repos: {
            Title: '受信任的仓库',
            AddPlaceholder: '添加仓库 (owner/repo)...',
            Empty: '暂无受信任仓库',
            RemoveConfirm: '确定移除该仓库吗？',
            ScanRegistry: '扫描注册表'
        },
        QuickSettings: {
            Title: '自动化配置',
            AutoApply: '自动应用翻译',
            SilentMode: '静默运行'
        },
        Tips: {
            Title: '提示',
            Desc: '自动化扫描仅会从您信任的仓库中检查翻译 Registry。确保仓库地址格式为 <code className="bg-muted px-1 rounded">owner/repo</code>。'
        }
    },
    Tabs: {
        AutoManagerTitle: "自动化",
        AutoManagerDesc: "查看一键翻译的后台执行状态与详情。",
        Sources: "管理",
        Credits: "鸣谢"
    },
    TranslationManager: {
        Title: "本地译文仓库",
        Subtitle: "搜索、导入、导出以及批量管理您所有的本地翻译数据。",
        Table: {
            Name: "翻译名称/插件",
            Id: "源 ID",
            Origin: "来源",
            Mtime: "更新时间",
            Type: "类型",
            Actions: "操作"
        },
        Actions: {
            Export: "批量导出",
            Import: "导入译文",
            BatchDelete: "批量删除",
            DeleteConfirm: "确定要删除选中的 {{count}} 项译文吗？此操作不可撤销。",
            ImportSuccess: "成功导入 {{count}} 项译文",
            ExportSuccess: "译文导出成功",
            SelectAll: "全选"
        },
        Filters: {
            SearchPlaceholder: "搜索翻译或插件 ID...",
            OriginLocal: "本地提取",
            OriginCloud: "云端下载"
        },
        Stats: {
            Total: "总译文数",
            Selected: "已选中"
        }
    },
    Credits: {
        Title: "致谢所有贡献者",
        Subtitle: "感谢每一位以不同方式为本项目付出努力的人。",
        NoData: "暂未加载到社区创作者数据",
        StatCreators: "位创作者",
        StatStars: "个星标",
        StatTranslations: "份译文",
        UnitRepos: "仓库",
        UnitPlugins: "插件",
        Footer: "感谢所有贡献者的无私付出",
        ComingSoon: "暂无数据，敬请期待",
        CatTranslation: "翻译贡献者",
        CatTranslationDesc: "为插件与主题提供多语言翻译的社区成员",
        CatCode: "代码贡献者",
        CatCodeDesc: "为项目提供代码贡献的开发者",
        CatVideo: "视频创作者",
        CatVideoDesc: "制作教程、介绍视频的创作者",
        CatTesting: "测试贡献者",
        CatTestingDesc: "帮助发现和反馈问题的测试人员",
        CatSuggestion: "建议贡献者",
        CatSuggestionDesc: "提供宝贵意见与建议的社区成员"
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
        ApplyPluginSuccess: "{{id}} 翻译应用成功",
        AutoApplied: "自动已为 {{count}} 个新插件应用翻译",
        AutoComplete: "一键处理完成！统计：成功 {{success}}，已最新 {{upToDate}}，失败 {{error}}，未找到 {{skip}}",
        NoMatchFound: "未在社区库中找到匹配的翻译 (跳过: {{skip}})",
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
        PluginProcessFailed: "处理插件 {{id}} 时出错",
        SyncFailed: "中心库同步失败，请检查网络或 Token 权限",
        TrustedRepoNotInRegistry: "您配置的信任源未在云端注册表中找到匹配项，请检查设置。",
        NoTrustedRepos: "[安全防范] 未配置任何受信任的翻译仓库源，已终止自动同步。请前往设置中添加。"
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
