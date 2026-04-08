/**
 * [模块] 插件管理器 (Manager)
 */
export default {
    Common: {
        Titles: {
            Main: "i18n 管理中心"
        },
        Actions: {
            Search: "搜索",
            MoreActions: "更多选项",
            Sponsor: "支持作者",
            Help: "使用帮助",
            HelpDoc: "官方文档教程",
            Cloud: "云端译文",
            Settings: "综合设置",
            SelectSource: "选择数据源",
            Apply: "应用",
            Restore: "还原",
            Edit: "编辑译文",
            Delete: "删除译文",
            OpenFolder: "浏览目录"
        },
        Placeholders: {
            SearchPlaceholder: "输入搜索关键词..."
        },
        Filters: {
            All: "全部"
        },
        Labels: {
            Author: "作者"
        },
        Status: {
            Labels: {
                pending: '等待中',
                processing: '处理中',
                success: '应用成功',
                found: '已发现匹配',
                skipped: '已跳过',
                error: '任务失败',
                discovered: '待审阅',
                discovered_new: '发现新译文',
                discovered_update: '发现版本更新',
                up_to_date: '已是最新',
                applied: '已应用',
                plugin: '插件',
                theme: '主题',
                DiscoveryNotice: '发现更新时通知',
                AutoApply: '找到匹配后自动应用 (不推荐)',
                SilentMode: '完全静默模式',
                MatchStrategy: '匹配优选策略',
                MatchStrategies: {
                    comprehensive: '综合优选 (推荐)',
                    version_first: '版本最接近优先',
                    popularity: '社区热度优先',
                    latest_update: '最新翻译优先'
                }
            }
        },
        Errors: {
            Error: "错误",
            ErrorDesc: "译文解析异常",
            FetchCommunityDataFailed: "获取社区注册表数据失败，请检查网络",
            SyncFailed: "中心库同步失败，请检查网络或 Token 权限",
            InvalidRepo: "无效的仓库地址，请确保格式为 owner/repo"
        },
        Notices: {
            ApplySuccess: "翻译应用成功",
            CopySuccess: "Registry JSON 已复制到剪贴板",
            SyncSuccess: "中心库注册表同步成功！"
        }
    },
    Plugins: {
        TabName: "插件",
        Actions: {
            Extract: "提取译文",
            OpenSettings: "插件设置",
            Reload: "重载插件",
            GoToEditor: "前往编辑器",
            ContinueApply: "坚持应用"
        },
        Placeholders: {
            SearchPlugins: "搜索插件..."
        },
        Filters: {
            Applied: "已应用",
            Unapplied: "未应用",
            Translated: "已翻译",
            Untranslated: "未翻译",
            ToExtract: "待提取"
        },
        Labels: {
            Auto: "自动",
            Admin: "管理",
            Mtime: "最后更新",
            SupportVer: "支持版本"
        },
        Status: {
            NoPlugins: "未发现插件",
            On: "已启用",
            Off: "已禁用",
            Applied: "已应用",
            Unapplied: "未应用",
            Translated: "已翻译",
            Untranslated: "未翻译",
            ToExtract: "待提取",
            NoTrans: "未翻译",
            Reloading: "重载中..."
        },
        Dialogs: {
            EmptyTranslationTitle: "未检测到翻译内容",
            EmptyTranslationDesc: "当前选择的翻译源尚未进行任何实质性翻译（译文与原文完全一致）。应用此文件后，插件界面语言将不会发生任何变化。建议您先在编辑器中完成翻译后再应用。"
        },
        Hints: {
            NoTransDesc: "暂无本地语言数据",
            ExtractSuccessDesc: "已生成当前版本的翻译模板"
        },
        Errors: {
            ReloadPluginFailed: "插件重启失败: {{error}}",
            ReloadFailed: "插件重载失败: {{error}}",
            PluginNotEnabled: "插件未启用",
            LoadFailedAfterApply: "插件重载失败，可能是源码存在运行时错误。请按 Ctrl+Shift+I 打开控制台查看具体报错堆栈。",
            SyntaxError: "JavaScript 语法损坏，已终止应用: {{file}}",
            MainNotFound: "未找到 main.js 文件",
            BackupNotFound: "备份文件不存在，无法还原",
            PluginProcessFailed: "处理插件 {{id}} 时出错"
        },
        Notices: {
            ApplyPluginSuccess: "{{id}} 翻译应用成功",
            ReloadPlugin: "准备重启插件: {{id}}",
            ReloadSuccess: "插件重载成功",
            ExtractSuccess: "提取成功"
        }
    },
    Themes: {
        TabName: "主题",
        Placeholders: {
            SearchThemes: "搜索主题..."
        },
        Labels: {
            ThemeActive: "当前主题",
            Auto: "自动",
            Admin: "管理",
            Mtime: "最后更新",
            SupportVer: "支持版本"
        },
        Filters: {
            Applied: "已应用",
            Unapplied: "未应用",
            Translated: "已翻译",
            Untranslated: "未翻译",
            ToExtract: "待提取"
        },
        Status: {
            NoThemes: "未发现主题",
            On: "已启用",
            Off: "已禁用",
            Applied: "已应用",
            Unapplied: "未应用",
            Translated: "已翻译",
            Untranslated: "未翻译",
            ToExtract: "待提取",
            NoTrans: "未翻译",
            Reloading: "重载中..."
        },
        Dialogs: {
            EmptyTranslationTitle: "未检测到翻译内容",
            EmptyTranslationDesc: "当前选择的翻译源尚未进行任何实质性翻译（译文与原文完全一致）。应用此文件后，插件界面语言将不会发生任何变化。建议您先在编辑器中完成翻译后再应用。"
        },
        Errors: {
            ThemeCssNotFound: "未找到 theme.css 文件",
            NoSettingsBlock: "未找到 @settings 块，无可翻译内容",
            BackupNotFound: "备份文件不存在，无法还原"
        },
        Notices: {
            ThemeExtractPrefix: "提取译文",
            ThemeApplyPrefix: "主题应用",
            ThemeRestorePrefix: "主题还原",
        }
    },
    Sources: {
        TabName: "管理",
        Table: {
            Name: "翻译名称/插件",
            Id: "源 ID",
            Origin: "来源",
            Mtime: "更新时间",
            Type: "类型",
            Actions: "操作"
        },
        Status: {
            NotInstalled: "插件缺失",
            ThemeNotInstalled: "主题缺失"
        },
        Actions: {
            Export: "导出",
            Import: "导入",
            BatchDelete: "删除",
            SelectUninstalled: "异常项",
            DeleteConfirm: "确定要删除选中的 {{count}} 项译文吗？此操作不可撤销。",
            ImportSuccess: "成功导入 {{count}} 项译文",
            ExportSuccess: "译文导出成功",
            SelectAll: "全选"
        },
        Filters: {
            SearchPlaceholder: "搜索翻译或插件...",
            OriginLocal: "本地提取",
            OriginCloud: "云端下载"
        },
        Stats: {
            Total: "总译文数",
            Selected: "已选中"
        }
    },
    Auto: {
        TabName: "自动化",
        Title: "自动化服务",
        Desc: "智能探测可用的插件翻译并进行安全审阅。",
        Discovery: {
            Title: "发现更新",
            ReviewAction: "审阅并应用",
            IgnoreAction: "忽略此更新",
            SafetyWarning: "安全提醒：此翻译来自社区仓库，建议在应用前确认来源可靠性。",
            NewSource: "新来源 (首次发现)",
            HashChanged: "内容已变更 (Hash 不一致)",
            TrustScore: "汉化信誉评分",
            ScoreBreakdown: {
                Title: "匹配质量评分",
                Version: "版本兼容",
                Popularity: "社区认可",
                Freshness: "更新鲜活"
            }
        },
        Filters: {
            Title: "任务筛选"
        },
        Scoping: {
            Title: "探测范围"
        },
        History: {
            Title: "安全审计日志",
            Empty: "暂无操作记录",
            BatchHeader: "执行批次：{{id}}",
            TriggerDiscovery: "后台探测",
            TriggerManual: "手动执行",
            TriggerStartup: "启动自检"
        },
        Actions: {
            StartAuto: "探测扫描",
            ReviewAll: "全部审阅并应用",
            OneClickReview: "一键审阅"
        },
        Modes: {
            Incremental: '增量探测',
            Full: '全量扫描'
        },
        Status: {
            Analyzing: "正在分析云端仓库...",
            AutoStarting: "正在启动安全探测...",
            ScanningInstalled: "正在扫描已安装项 ({{count}})...",
            Running: "正在探测更新...",
            DiscoveryComplete: "探测完成，发现 {{count}} 项待审阅",
            NoLogs: "暂无扫描结果记录",
            AutoRollbacked: "运行异常已自动回滚",
            BatchApply: "批量应用发现",
            BatchComplete: "批量任务已结束: 成功 {{success}}, 失败 {{fail}}",
            SkipReasons: {
                Exclusion: "插件已加入排除名单",
                NoMatch: "所有信任源中均无该插件记录",
                NoVersion: "未找到符合过滤条件的汉化版本"
            }
        },
        QuickSettings: {
            Title: '自动化策略',
            AutoApply: '自动应用翻译',
            DiscoveryNotice: '后台探测与通知',
            CheckInterval: '探测周期',
            Hours: '小时'
        },
        Stats: {
            Health: '汉化健康度',
            VaultStatus: '汉化状态',
            TotalInstalled: '已安装总数',
            AppliedCount: '累计翻译应用',
            CurrentSuccess: '本次成功',
            CurrentSkipped: '本次跳过/失败',
            Plugins: '插件',
            Themes: '主题',
            LastCheckTime: '上次检查：{{time}}'
        },
        Errors: {
            NoCachedManifest: "未找到该插件的缓存清单",
            NoBestMatch: "最佳匹配已不可用",
            LocalApplyFailed: "本地应用失败",
            DownloadApplyFailed: "下载或应用失败",
            BatchApplyFailed: "批量应用失败"
        },
        Repos: {
            Title: '受信任的仓库',
            AddPlaceholder: '添加仓库 (owner/repo)...',
            Empty: '暂无受信任仓库',
            RemoveConfirm: '确定移除该仓库吗？',
            ScanRegistry: '扫描注册表'
        },
        Tips: {
            Title: '提示',
            Desc: '自动化扫描仅会从您信任的仓库中检查翻译 Registry。确保仓库地址格式为 <code className="bg-muted px-1 rounded">owner/repo</code>。'
        }
    },
    Credits: {
        TabName: "鸣谢",
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
        CatSuggestionDesc: "提供宝贵意见与建议的社区成员",
        CatSponsor: "爱发电持续赞助",
        CatSponsorDesc: "为项目持续提供电力的金主爸爸"
    },
    Admin: {
        TabName: "管理员",
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
        },
        ContributorsManagement: {
            Title: "贡献者管理",
            PushToCloud: "推送贡献者",
            AddNew: "添加贡献者",
            Name: "名称",
            Category: "类别",
            Url: "链接 URL",
            Github: "GitHub 用户名",
            Description: "贡献描述",
            Add: "添加",
            RemoveSuccess: "已移除贡献者: {{name}}",
            AddSuccess: "已添加贡献者: {{name}}"
        }
    }
} as const;
