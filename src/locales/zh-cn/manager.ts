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
        Reload: "重载插件"
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
        NoThemes: "未发现主题"
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
        ThemeRestorePrefix: "主题还原"
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
        BackupNotFound: "备份文件不存在，无法还原"
    }
} as const;
