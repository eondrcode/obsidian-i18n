export interface IState {
    id: string;             // 插件ID
    isApplied: boolean;     // [原 state] 是否已应用翻译 (true=已替换 main.js, false=未替换)
    pluginVersion: string;  // 应用翻译时的插件版本 (用于检测插件是否更新)
    translationVersion: string; // 译文版本 (用于检测译文文件是否更新，如修正错别字)
}
