/**
 * [模块] 通用与全局 (Common / Global)
 */
export default {
    Actions: {
        Save: "保存",
        Cancel: "取消",
        Confirm: "确定",
        Refresh: "刷新",
        Edit: "编辑",
        Back: "返回",
        Update: "更新",
        Clear: "清除",
        Delete: "删除",
        StopTranslate: "停止翻译"
    },
    Status: {
        Success: "成功",
        Failure: "失败",
        Loading: "加载中...",
        Reloading: "重载中...",
        Unknown: "未知",
        Error: "错误"
    },
    Labels: {
        I18n: "I18N",
        Themes: "主题",
        Plugins: "插件",
        GithubUser: "GitHub 用户",
        Mtime: "修改时间",
        Optional: "可选",
        Or: "或",
        NoPlugins: "暂无插件",
        UpdatePrefix: "更新于",
        Filter: "筛选"
    },
    Filters: {
        All: "全部",
        Translated: "已翻译",
        Untranslated: "未翻译",
        Applied: "已应用"
    },
    Notices: {
        Success: "成功",
        Failure: "失败",
        Clear: "清空",
        SaveSuccess: "保存成功",
        SaveFail: "保存失败",
        SaveFailPath: "保存失败：未找到有效的存储路径",
        DeleteSuccess: "删除成功",
        TaskStopped: "任务已停止",
        BatchTranslateSuccess: "批量翻译完成！",
        TranslateFail: "翻译失败: {{message}}",
        NoItemsToTranslate: "没有需要翻译的条目",
        ThemeNotFound: "未找到主题",
        MainNotFound: "未找到文件 {{file}}",
        TaskCancelled: "翻译任务已取消",
        Perfect: "状态良好",
        NoErrors: "暂未发现问题"
    },
    Placeholders: {
        Search: "输入搜索关键词..."
    },
    Data: {
        SortAsc: "正序",
        SortDesc: "倒序"
    },
    Pagination: {
        Label: "分页导航",
        Prev: "上一页",
        Next: "下一页"
    },
    MoreExpect: "更多期待"
} as const;
